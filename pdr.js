// KAP portföy dağılım raporu (PDR) okuyucu.
// KAP eki Java ile paketlenmiş gelir; PDF baytları "%PDF" işaretinden başlar.
// Tablo biçimi kurucudan kurucuya değiştiği için satırlar konumdan çıkarılır:
//   - "FON PORTFÖY DEĞERİ" bölümü ile "FON TOPLAM DEĞERİ" bölümü arası okunur
//   - sol kenarda rakamsız satır = grup başlığı (Hisse senetleri, BYF, Katılma payı…)
//   - en az iki sayı içeren ve son sayısı 0–100 arası olan satır = varlık satırı; son sayı fon toplam değerine oranı (%)
//   - varlık satırının altındaki rakamsız satırlar ihraççı adının devamıdır
let pdfjsP = null;
const pdfjs = () => pdfjsP || (pdfjsP = import('pdfjs-dist/legacy/build/pdf.mjs'));

function unwrap(buf) {
  const b = Buffer.from(buf); const i = b.indexOf('%PDF');
  return i >= 0 ? b.subarray(i) : null;
}
const ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/;
const CUR = new Set(['TRY', 'TL', 'USD', 'EUR', 'GBP', 'CHF', 'JPY', 'AU1', 'AU', 'XAU', 'XAG', 'CNY', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK', 'HKD']);
const STOP = new Set(['INC', 'LTD', 'CORP', 'PLC', 'ETF', 'ADR', 'GRUP', 'GROUP', 'HOLDING', 'TOPLAM', 'HAZINE', 'BANKASI', 'FONU', 'FON', 'A.Ş.', 'AŞ', 'NV', 'SA', 'AG', 'SE', 'ASA', 'AB', 'CO', 'COM', 'ORD', 'CLASS', 'ISIN', 'KODU', 'DÖVİZ', 'VADE']);
const SUFFIX = new Set(['INC', 'LTD', 'CORP', 'PLC', 'NV', 'SA', 'AG', 'CO', 'COM', 'ORD', 'SE', 'AB', 'ASA', 'SPA', 'AS', 'A', 'ADR', 'ETF', 'FON']);
const isNum = s => /^[-+]?(\d{1,3}([.,]\d{3})+|\d+)([.,]\d+)?%?$/.test(s);
function num(s) {
  let t = String(s).replace(/[%\s]/g, '');
  const lc = t.lastIndexOf(','), ld = t.lastIndexOf('.');
  if (lc > -1 && ld > -1) t = lc > ld ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (lc > -1) t = /,\d{3}$/.test(t) && (t.match(/,/g) || []).length > 1 ? t.replace(/,/g, '') : t.replace(',', '.');
  else if (ld > -1 && (t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
  return parseFloat(t);
}
const isDate = s => /^\d{2}[./]\d{2}[./]\d{2,4}$/.test(s);
const trUp = s => String(s).toLocaleUpperCase('tr-TR');

async function lines(pdfBuf) {
  const { getDocument } = await pdfjs();
  const doc = await getDocument({ data: new Uint8Array(pdfBuf), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p), tc = await page.getTextContent();
    const rows = [];
    for (const it of tc.items) {
      const s = (it.str || '').trim(); if (!s) continue;
      const x = it.transform[4], y = it.transform[5];
      let r = rows.find(r => Math.abs(r.y - y) < 2.2);
      if (!r) rows.push(r = { y, t: [] });
      // pdf.js bazen bir hücreyi tek parça verir ("1.234,56 7,89"); boşlukla böl, x'i yaklaşık dağıt
      const parts = s.split(/\s{2,}/);
      let dx = 0; const cw = parts.length > 1 ? (it.width || 0) / s.length : 0;
      for (const part of parts) { r.t.push({ x: x + dx, s: part }); dx += (part.length + 2) * cw; }
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) { r.t.sort((a, b) => a.x - b.x); out.push({ p, y: r.y, t: r.t, s: r.t.map(t => t.s).join(' ') }); }
  }
  try { if (doc.destroy) await doc.destroy(); else if (doc.cleanup) await doc.cleanup(); } catch (e) { }
  return out;
}

async function parsePdr(buf) {
  const pdf = unwrap(buf); if (!pdf) throw new Error('PDF değil');
  const L = await lines(pdf);
  const st = L.findIndex(l => /FON PORTF[OÖ]Y DE[GĞ]ER[İI]/i.test(trUp(l.s)) && !/\d{3}/.test(l.s));
  if (st < 0) throw new Error('portföy değeri tablosu bulunamadı');
  let en = L.findIndex((l, i) => i > st && /FON TOPLAM DE[GĞ]ER[İI]/.test(trUp(l.s)) && (/^\s*(IV|4)\s*[-–).]/.test(l.s) || /TABLOSU/.test(trUp(l.s))));
  if (en < 0) en = L.length;
  // her sayfada tekrarlanan başlık satırları (fon adı, ay) içerik değildir
  const cnt = new Map(); for (const l of L) cnt.set(l.s, (cnt.get(l.s) || 0) + 1);
  const pageHead = l => cnt.get(l.s) >= 2 && (l.s.length >= 15 || /^[A-Za-zÇĞİÖŞÜçğıöşü]+\s*-\s*\d{4}$/.test(l.s)) && !l.t.some(t => isNum(t.s) && !/^\d{4}$/.test(t.s));
  const body = L.slice(st + 1, en).filter(l => !pageHead(l));
  const left = Math.min(...body.filter(l => l.t.length).map(l => l.t[0].x));
  let isinX = null; for (const l of L.slice(st, st + 12)) { const h = l.t.find(t => /ISIN|Isin/.test(t.s)); if (h) { isinX = h.x; break; } }
  // 1. geçiş: satırları sınıflandır (atla / başlık / varlık / devam)
  const R = []; let group = '', lastWasHeader = false, gid = 0;
  for (const l of body) {
    const U = trUp(l.s), nums = l.t.filter(t => isNum(t.s) && !isDate(t.s));
    if (/PORTF[OÖ]Y DE[GĞ]ER[İI]/.test(U) || /^\s*(GRUP\s+)?TOPLAM/.test(U) || /TOPLAMI/.test(U) || /SAYFA\s+\d+\s*\/\s*\d+/.test(U) || /ISIN|NOM[İI]NAL|D[ÖO]V[İI]Z|GÖRE\)|\(%\)/.test(U)) { R.push({ k: 'skip', l, g: gid }); gid++; lastWasHeader = false; continue; }
    const last = l.t[l.t.length - 1];
    const isRow = (nums.length >= 3 || (nums.length >= 2 && l.t.some(t => /[A-Za-zÇĞİÖŞÜ]{2,}/.test(t.s)))) && last && isNum(last.s) && num(last.s) >= 0 && num(last.s) <= 100.5;
    if (isRow) { R.push({ k: 'row', l, g: gid, group, w: num(last.s) }); lastWasHeader = false; continue; }
    if (!nums.length && l.t.length && l.t[0].x <= left + 12) {
      // sol kenarda rakamsız satır: grup başlığı (ardışıksa birleştir)
      const h = l.s.replace(/\s*:\s*$/, '').trim();
      const fresh = /^\(?[A-ZÇĞİÖŞÜ]{1,2}\)\s/.test(h) || /^[IVX]+\s*[-.]/.test(h);
      group = lastWasHeader && !fresh ? (group + ' ' + h).trim() : h; lastWasHeader = true; gid++; R.push({ k: 'hdr', l, g: gid }); continue;
    }
    R.push({ k: nums.length ? 'skip' : 'cont', l, g: gid }); lastWasHeader = false;
  }
  // Ad satırları varlık satırının altına mı sarılıyor, yoksa ortalanmış mı (üstünde de satır var mı)?
  let centered = 0;
  for (let i = 0; i < R.length; i++) if (R[i].k === 'cont') { let j = i - 1; while (j >= 0 && R[j].k === 'cont') j--; if (j < 0 || R[j].k === 'hdr' || R[j].k === 'skip') { let n = i + 1; while (n < R.length && R[n].k === 'cont') n++; if (n < R.length && R[n].k === 'row' && R[n].g === R[i].g && R[n].l.p === R[i].l.p) centered++; } }
  // 2. geçiş: devam satırlarını bir varlık satırına bağla
  const items = R.filter(r => r.k === 'row').map(r => { const isin = r.l.t.find(t => ISIN.test(t.s)); r.it = { w: r.w, t: r.group, code: isin ? isin.s : null, first: r.l.t[0], toks: r.l.t.map(t => ({ ...t, y: r.l.y })), isinX }; return r.it; });
  for (let i = 0; i < R.length; i++) {
    if (R[i].k !== 'cont') continue;
    let p = i - 1; while (p >= 0 && R[p].k === 'cont') p--;
    let n = i + 1; while (n < R.length && R[n].k === 'cont') n++;
    const P = p >= 0 && R[p].k === 'row' && R[p].l.p === R[i].l.p ? R[p] : null;
    const N = n < R.length && R[n].k === 'row' && R[n].g === R[i].g && R[n].l.p === R[i].l.p ? R[n] : null;
    let to = P;
    if (centered >= 2 && N) to = !P || Math.abs(N.l.y - R[i].l.y) < Math.abs(P.l.y - R[i].l.y) ? N : P;
    if (!to) continue;
    const isin = R[i].l.t.find(t => ISIN.test(t.s)); if (isin && !to.it.code) to.it.code = isin.s;
    to.it.toks.push(...R[i].l.t.map(t => ({ ...t, cont: 1, y: R[i].l.y })));
  }
  // kod, ad, kısa kod
  const res = [];
  for (const it of items) {
    const firstTok = it.first && it.first.x <= left + 12 ? it.first.s : '';
    let code = it.code;
    if (!code) {
      const cands = it.toks.filter(t => /^[A-ZÇĞİÖŞÜ][A-Z0-9ÇĞİÖŞÜ]{2,5}$/.test(t.s) && !CUR.has(t.s) && !STOP.has(t.s));
      const f = cands.find(t => t.s === firstTok);
      const nearIsin = it.isinX != null ? cands.filter(t => Math.abs(t.x - it.isinX) < 70).sort((a, b) => Math.abs(a.x - it.isinX) - Math.abs(b.x - it.isinX))[0] : null;
      code = (nearIsin || f || {}).s || null;
    }
    const tk = /^([A-Z0-9.]{1,8})(?:\s+(?:US|UW|UN|UQ|LN|GY|FP|NA|JP|JT|HK|TT|KS|IM|SW|SS|CN|AU|TI))?$|^([A-Z0-9]{1,6})\.[A-Z]{1,2}$/.exec(firstTok);
    const ticker = tk ? (tk[1] || tk[2]).replace(/\.[A-Z]{1,2}$/, '') : null;
    const wt = it.toks.filter(t => t.s !== firstTok && !isNum(t.s) && !isDate(t.s) && !ISIN.test(t.s) && !CUR.has(t.s) && t.s !== code && /[A-Za-zÇĞİÖŞÜçğıöşü]{1,}/.test(t.s) && !(/^[A-Z0-9]{6,}$/.test(t.s) && /\d.*\d.*\d/.test(t.s))).sort((a, b) => (b.y - a.y) || (a.x - b.x));
    // dar sütunda kelime ortasından bölünmüş adları birleştir: MICROSOF + T CORP → MICROSOFT CORP
    let name = '';
    wt.forEach((t, i) => {
      const prev = wt[i - 1], fw = t.s.split(' ')[0];
      const glue = prev && t.cont && prev.s.length >= 7 && /^[A-ZÇĞİÖŞÜ.]+$/.test(prev.s.split(' ').pop()) && fw.length <= 3 && /^[A-ZÇĞİÖŞÜ-]+$/.test(fw) && !SUFFIX.has(fw.replace(/[.-].*$/, ''));
      name += (name && !glue ? ' ' : '') + t.s;
    });
    name = name.replace(/\s+/g, ' ').trim();
    if (ticker) name = name.split(' ').filter((w, i, A) => !(trUp(w) === ticker && (i === 0 || i === A.length - 1))).join(' ');
    if (!name && !ticker && /[A-Za-zÇĞİÖŞÜ]{3,}/.test(firstTok)) name = firstTok;
    if (ticker && trUp(name) === ticker + ' US') name = '';
    if (!code && !name && !ticker) { const any = it.toks.find(t => /[A-Za-zÇĞİÖŞÜ]{3,}/.test(t.s) && !CUR.has(t.s)); name = any ? any.s : (it.t || 'Diğer'); }
    const row = { code: code || ticker || null, name: ticker && ticker !== code ? (name ? `${ticker} · ${name}` : ticker) : (name || code), t: it.t, w: it.w };
    if (ticker) row.tk = ticker;
    res.push(row);
  }
  const sum = res.reduce((s, r) => s + r.w, 0);
  return { items: res.filter(r => r.w > 0), sum };
}


// Bir PDF'in düz metni (sayfa sırasıyla, boşlukla birleştirilmiş)
async function pdfText(pdfBuf, maxPages = 12) {
  const { getDocument } = await pdfjs();
  const doc = await getDocument({ data: new Uint8Array(pdfBuf), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
  let t = '';
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) { const c = await (await doc.getPage(i)).getTextContent(); t += ' ' + c.items.map(x => x.str).join(' '); }
  try { await doc.destroy(); } catch (e) { }
  return t.replace(/\s+/g, ' ');
}
module.exports = { unwrap, parsePdr, lines, num, pdfText };
