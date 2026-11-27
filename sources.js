// Veri kaynakları: herkese açık servislere düz istekler.
// Hisse (BIST), altın, gümüş, kur: Yahoo Finance grafik servisi
// Coin: Yahoo Finance (USD fiyatı × USD/TRY)
// Bildirimler: KAP'ın herkese açık bildirim listesi
// Fon fiyatları: TEFAS'ın herkese açık fon fiyat servisi (fonFiyatBilgiGetir); TEFAS Excel içe aktarma yedek olarak kalır.
// Fon içerikleri: KAP fon bildirimleri (funds/byCriteria) → aylık Portföy Dağılım Raporu PDF eki → pdr.js
// Bildirim detayı: KAP bildirim sayfasındaki açıklama metni ve ekleri
// Mali tablolar: KAP'a gönderilen finansal raporların İş Yatırım'daki herkese açık mali tablo servisi (MaliTablo).

const UA = 'YatirimPusulasi/1.0 (masaustu)';
const pdr = require('./pdr');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pad = n => String(n).padStart(2, '0');
const isoUTC = d => d.toISOString().slice(0, 10);
const trDate = d => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
const sid = s => String(s).toUpperCase().replace(/[^A-Z0-9_~:@+-]/g, '-').slice(0, 120) || 'X';

async function getJSON(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { 'User-Agent': UA, Accept: 'application/json', ...(opts.headers || {}) }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${new URL(url).hostname} ${r.status}`);
  return r.json();
}

async function getBuf(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9', ...(opts.headers || {}) }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`${new URL(url).hostname} ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

/* ---------- Yahoo Finance ---------- */
async function yahoo(symbol, range) {
  const j = await getJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d&includePrePost=false`);
  const res = j && j.chart && j.chart.result && j.chart.result[0];
  if (!res || !res.timestamp) throw new Error(`${symbol}: veri yok`);
  const off = (res.meta && res.meta.gmtoffset || 0) * 1000, q = res.indicators.quote[0];
  const rows = [];
  res.timestamp.forEach((t, i) => {
    const c = q.close[i]; if (c == null) return;
    rows.push([isoUTC(new Date(t * 1000 + off)), q.open[i] ?? c, q.high[i] ?? c, q.low[i] ?? c, c, q.volume[i] || 0]);
  });
  const out = dedupe(rows); out.currency = res.meta && res.meta.currency; out.name = res.meta && (res.meta.longName || res.meta.shortName); return out;
}
function dedupe(rows) { const m = new Map(); for (const r of rows) m.set(r[0], r); return [...m.values()].sort((a, b) => a[0].localeCompare(b[0])); }
const r6 = v => Math.round(v * 1e6) / 1e6;
async function gramMetal(futures, range) {      // ons (USD) × USD/TRY ÷ 31,1035 = gram TL
  const [m, fx] = await Promise.all([yahoo(futures, range), yahoo('USDTRY=X', range)]);
  const usd = new Map(fx.map(r => [r[0], r[4]]));
  let lastFx = null; const out = [];
  for (const r of m) {
    const k = usd.get(r[0]) ?? lastFx; if (usd.has(r[0])) lastFx = usd.get(r[0]);
    if (!k) continue; const f = k / 31.1035;
    out.push([r[0], r6(r[1] * f), r6(r[2] * f), r6(r[3] * f), r6(r[4] * f), 0]);
  }
  return out;
}
// Fiziki altın birimleri: içerdiği saf (24 ayar) altın gramı. 22 ayar = 0,916 milyem.
// Fiyat = gram has altın × saf gram; kuyumcu makası/işçilik dahil değil (varlıkta 'prem' % ile eklenebilir).
const GOLD_UNITS = {
  ALTIN: [1, 'Gram altın (24 ayar)'], GRAM: [1, 'Gram altın (24 ayar)'], HAS: [1, 'Gram altın (24 ayar)'],
  CEYREK: [1.75 * 0.916, 'Çeyrek altın'], YARIM: [3.5 * 0.916, 'Yarım altın'], TAM: [7.016 * 0.916, 'Tam altın'],
  CUMHURIYET: [7.216 * 0.916, 'Cumhuriyet altını'], ATA: [7.216 * 0.916, 'Ata altın'], RESAT: [7.216 * 0.916, 'Reşat altın'],
  GREMSE: [17.54 * 0.916, 'Gremse (iki buçukluk)'], ATA5: [36.08 * 0.916, 'Beşli ata'], BESLI: [36.08 * 0.916, 'Beşli ata'],
  AYAR22: [0.916, '22 ayar gram / bilezik'], BILEZIK: [0.916, '22 ayar bilezik (gram)'], AYAR18: [0.75, '18 ayar gram'], AYAR14: [0.585, '14 ayar gram']
};
const trUp = x => String(x || '').toLocaleUpperCase('tr-TR').replace(/Ç/g, 'C').replace(/Ğ/g, 'G').replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ş/g, 'S').replace(/Ü/g, 'U').replace(/[^A-Z0-9]/g, '');
function goldUnit(a) { const k = trUp(a.sym); return GOLD_UNITS[k] ? { key: k, f: GOLD_UNITS[k][0], label: GOLD_UNITS[k][1] } : null; }
function emtiaSource(a) {
  if (a.src) return { kind: 'yahoo', symbol: a.src };
  const u = goldUnit(a); if (u) return { kind: 'gram', futures: 'GC=F', f: u.f, label: u.label };
  const s = (String(a.sym) + ' ' + String(a.name || '')).toUpperCase();
  if (/ALTIN|XAU|GOLD/.test(s)) return { kind: 'gram', futures: 'GC=F', label: 'gram altın' };
  if (/GÜMÜŞ|GUMUS|XAG|SILVER/.test(s)) return { kind: 'gram', futures: 'SI=F', label: 'gram gümüş' };
  if (/BRENT|PETROL/.test(s)) return { kind: 'yahoo', symbol: 'BZ=F' };
  return { kind: 'yahoo', symbol: a.sym };
}

/* ---------- Coin ---------- */
async function coin(sym, range) {            // Yahoo: COIN-USD × USD/TRY
  const base = String(sym).toUpperCase().replace(/(TRY|USDT|USD)$/, '').replace(/[^A-Z0-9]/g, '');
  const [c, fx] = await Promise.all([yahoo(`${base}-USD`, range), yahoo('USDTRY=X', range)]);
  const usd = new Map(fx.map(r => [r[0], r[4]])); let lastFx = null; const out = [];
  for (const r of c) { const k = usd.get(r[0]) ?? lastFx; if (usd.has(r[0])) lastFx = usd.get(r[0]); if (!k) continue; out.push([r[0], r6(r[1] * k), r6(r[2] * k), r6(r[3] * k), r6(r[4] * k), 0]); }
  return out;
}

/* ---------- KAP bildirimleri ---------- */
function kapTip(title) {
  const t = String(title || '').toLocaleLowerCase('tr');
  if (/finansal rapor|faaliyet raporu/.test(t)) return 'bilanco';
  if (/kar payı|kâr payı|temettü/.test(t)) return 'temettu';
  if (/yeni iş ilişkisi|sözleşme|ihale|anlaşma|iş birliği|işbirliği/.test(t)) return 'anlasma';
  if (/portföy dağılım/.test(t)) return 'pdr';
  return null;
}
function kapDate(s) {            // "24.11.2026 20:00:08" → "2026-11-24"
  const m = String(s || '').match(/^(\d{2})\.(\d{2})\.(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
async function kapList(from, to, memberTypes) {
  return getJSON('https://www.kap.org.tr/tr/api/disclosure/list/main', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromDate: trDate(from), toDate: trDate(to), memberTypes })
  });
}
async function kapNews(syms, sinceISO, progress) {
  const want = new Set(syms.map(s => s.toUpperCase())), out = {};
  if (!want.size) return out;
  const start = sinceISO ? new Date(sinceISO + 'T00:00:00') : new Date(Date.now() - 30 * 864e5);
  for (let a = new Date(start); a <= new Date(); a = new Date(a.getTime() + 3 * 864e5)) {
    const b = new Date(Math.min(a.getTime() + 2 * 864e5, Date.now()));
    progress && progress(`KAP bildirimleri: ${trDate(a)} – ${trDate(b)}`);
    const list = await kapList(a, b, ['IGS', 'DDK']);
    for (const it of list || []) {
      const d = it.disclosureBasic || it; const codes = String(d.stockCode || '').split(/[,\s]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
      const hit = codes.filter(c => want.has(c)); if (!hit.length) continue;
      const tip = kapTip(d.title); if (!tip) continue;
      const day = kapDate(d.publishDate); if (!day) continue;
      out['k' + d.disclosureIndex] = { d: day, t: d.summary ? `${d.title}: ${String(d.summary).slice(0, 140)}` : d.title, s: 'KAP', u: `https://www.kap.org.tr/tr/Bildirim/${d.disclosureIndex}`, kat: 'kap', tip, ilgili: hit };
    }
    await sleep(400);
  }
  return out;
}



/* ---------- KAP fon bildirimleri ve portföy dağılım raporları ---------- */
const isoD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
async function kapFunds(from, to) {         // tüm fonların bildirimleri; tek yanıt ~2000 kayıtla sınırlı → kısa pencereler
  return getJSON('https://www.kap.org.tr/tr/api/disclosure/funds/byCriteria', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fromDate: isoD(from), toDate: isoD(to) })
  });
}
const FUND_TIP = [[/portföy dağılım/i, 'pdr'], [/izahname|iç tüzük|ihraç belgesi/i, 'izahname'], [/tasfiye|birleşme|devir|unvan/i, 'onemli'], [/genel açıklama|özel durum/i, 'aciklama'], [/yatırımcı bilgi formu/i, 'ybf']];
function fundTip(subject) { for (const [re, t] of FUND_TIP) if (re.test(subject || '')) return t; return null; }
// Belirtilen fonların bildirimleri (haber) ve en son PDR kayıtları
async function kapFundScan(codes, sinceISO, progress) {
  const want = new Set(codes.map(c => c.toUpperCase())), news = {}, pdrs = {};
  if (!want.size) return { news, pdrs };
  const now = new Date();
  // PDR'ler ayın ilk ~12 gününde yayımlanır: bu ayın ve geçen ayın ilk 16 günü + haber için son günler
  const wins = [];
  const addWin = (a, b) => { if (a > now) return; wins.push([a, b > now ? now : b]); };
  for (const k of [1, 0]) { const m0 = new Date(now.getFullYear(), now.getMonth() - k, 1); for (let d = 1; d <= 13; d += 4) addWin(new Date(m0.getFullYear(), m0.getMonth(), d), new Date(m0.getFullYear(), m0.getMonth(), d + 3)); }
  const since = sinceISO ? new Date(sinceISO + 'T00:00:00') : new Date(now.getTime() - 30 * 864e5);
  for (let a = new Date(since); a <= now; a = new Date(a.getTime() + 4 * 864e5)) if (a.getDate() > 16 || a.getMonth() !== now.getMonth()) addWin(new Date(a), new Date(a.getTime() + 3 * 864e5));
  const seen = new Set();
  for (const [a, b] of wins) {
    const key = isoD(a) + isoD(b); if (seen.has(key)) continue; seen.add(key);
    progress && progress(`KAP fon bildirimleri: ${trDate(a)} – ${trDate(b)}`);
    let L; try { L = await kapFunds(a, b); } catch (e) { await sleep(1500); L = await kapFunds(a, b); }
    for (const x of L || []) {
      const c = String(x.fundCode || '').toUpperCase(); if (!want.has(c)) continue;
      const tip = fundTip(x.subject || x.summary), day = kapDate(x.publishDate); if (!tip || !day) continue;
      if (tip === 'pdr') { const cur = pdrs[c]; const k = (x.year || 0) * 100 + (+x.period || 0); if (!cur || k > cur.k || (k === cur.k && x.disclosureIndex > cur.i)) pdrs[c] = { k, i: x.disclosureIndex, y: x.year, p: +x.period, rt: x.ruleType, d: day }; }
      if (tip !== 'ybf' && (!sinceISO || day >= sinceISO)) news['k' + x.disclosureIndex] = { d: day, t: `${x.subject}${x.summary && x.summary !== x.subject ? ': ' + String(x.summary).slice(0, 140) : ''}`, s: 'KAP', u: `https://www.kap.org.tr/tr/Bildirim/${x.disclosureIndex}`, kat: 'kap', tip: tip === 'pdr' ? 'pdr' : 'fon', ilgili: [c], idx: x.disclosureIndex };
    }
    await sleep(400);
  }
  return { news, pdrs };
}
const lastDay = (y, m) => `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
async function kapFiles(index) {
  const html = (await getBuf(`https://www.kap.org.tr/tr/Bildirim/${index}`)).toString('utf8');
  const ids = [...new Set([...html.matchAll(/api\/file\/download\/([0-9a-fA-F]{20,})/g)].map(m => m[1]))];
  return { html, ids };
}
async function fundHolding(code, rec) {      // rec: {i, y, p, rt}
  const { ids } = await kapFiles(rec.i);
  let lastErr = null;
  for (const id of ids.slice(0, 3)) {
    try {
      const buf = await getBuf('https://www.kap.org.tr/tr/api/file/download/' + id);
      if (!pdr.unwrap(buf)) continue;
      const r = await pdr.parsePdr(buf);
      if (r.items.length && r.sum > 40) {
        const monthly = /ay/i.test(rec.rt || '') || (rec.p >= 1 && rec.p <= 12 && !/hafta/i.test(rec.rt || ''));
        const date = monthly && rec.y ? lastDay(rec.y, rec.p) : kapDate(rec.d) || rec.d;
        return { date, items: r.items.map(i => ({ ...i, w: i.w / 100 })), src: 'kap', idx: rec.i, sum: Math.round(r.sum * 100) / 100 };   // ağırlık: oran (0,12 = %12)
      }
      lastErr = new Error(`tablo okunamadı (toplam %${r.sum.toFixed(0)})`);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('PDR eki bulunamadı');
}

/* ---------- Bildirim detayı (uygulama içinde göstermek için) ---------- */
const ent = s => s.replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16))).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
function cleanHtml(h) {      // yalnız metin biçimi kalsın: p, br, b, i, ul/ol/li, table
  return h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(\/?)(p|br|b|strong|i|em|u|ul|ol|li|table|thead|tbody|tr|td|th)\b[^>]*>/gi, (m, sl, t) => `\u0001${sl}${t.toLowerCase()}\u0002`)
    .replace(/<[^>]+>/g, '').replace(/\u0001/g, '<').replace(/\u0002/g, '>')
    .replace(/(<p>\s*<\/p>)+/g, '').replace(/\s{3,}/g, ' ').trim();
}
async function kapDetail(index) {
  const { html, ids } = await kapFiles(index);
  // sunucu tarafında çizilen kısım (gizli div S:x) gerçek HTML'i içerir
  const out = { index, blocks: [], fields: [], files: [] };
  const sm = html.match(/class="disclosureSummary[^"]*">([\s\S]*?)<\/div>/); if (sm) out.summary = ent(sm[1].replace(/<[^>]+>/g, '')).trim();
  // Türkçe açıklama metin blokları
  for (const m of html.matchAll(/class="taxonomy-context-value-summernote multi-language-content content-tr"[^>]*>([\s\S]*?)<\/td>/g)) {
    // boş alanlarda KAP'ın metin düzenleyici araç çubuğu metni gelir: ayıkla
    let t = cleanHtml(ent(m[1])).replace(/×Resim ekle[\s\S]*?Summernote[^<]*?Issues/g, '').replace(/1 x 1\s*/g, '').replace(/www\.google\.com\s*100%50%25%/g, '');
    const plain = t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (plain.length > 2 && !/^(.{3,80}?)( \1)*$/.test(plain) && plain !== out.summary) out.blocks.push(t);
  }
  // Alan / değer satırları (örn. kâr payı tablosu): Türkçe başlık + değer hücreleri
  for (const m of html.matchAll(/<tr class="[^"]*data-input-row[^"]*">([\s\S]*?)<\/tr>/g)) {
    const row = m[1]; if (/summernote/.test(row)) continue;
    const lab = row.match(/multi-language-content content-tr"[^>]*>([^<]{2,200})</); if (!lab) continue;
    const vals = [...row.matchAll(/class="[^"]*taxonomy-context-value[^"]*"[^>]*>([\s\S]*?)<\/td>/g)].map(v => ent(v[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()).filter(v => v && v !== '-');
    if (vals.length) out.fields.push([ent(lab[1]).trim(), [...new Set(vals)].slice(0, 4).join(' · ')]);
  }
  out.fields = out.fields.slice(0, 80);
  // Şablon dışı bildirimler (kâr payı tablosu gibi): içerik alanını tablolarıyla al
  if (!out.blocks.length && !out.fields.length && !/taxonomy-field-name/.test(html)) {
    const i = html.indexOf('class="disclosureScrollableArea"');
    if (i > 0) {
      const j = html.indexOf('>', i) + 1; let seg = html.slice(j, html.indexOf('<script', j) > 0 ? html.indexOf('<script', j) : j + 200000);
      seg = cleanHtml(ent(seg)).replace(/<tr>\s*(<td>\s*<\/td>\s*)*<\/tr>/g, '').replace(/<td>\s*<\/td>/g, '<td></td>');
      if (seg.replace(/<[^>]+>/g, '').trim().length > 20) out.html = seg.slice(0, 80000);
    }
  }
  // Ek adları
  const names = [...new Set([...html.matchAll(/>([^<>]{2,140}\.(?:pdf|xlsx?|docx?|zip|PDF|XLSX?|DOCX?))</g)].map(m => ent(m[1]).trim()))];
  out.files = ids.map((id, i) => ({ id, name: names[i] || `Ek ${i + 1}` }));
  return out;
}
async function kapAttachment(id) {
  const buf = await getBuf('https://www.kap.org.tr/tr/api/file/download/' + id);
  const p = pdr.unwrap(buf); if (p) return { kind: 'pdf', buf: p };
  // Java paketinden çıkar: AC ED 00 05 ... 'xp' + 4 bayt uzunluk
  if (buf[0] === 0xac && buf[1] === 0xed) { const i = buf.indexOf(Buffer.from([0x78, 0x70])); if (i > 0) { const n = buf.readUInt32BE(i + 2); return { kind: 'bin', buf: buf.subarray(i + 6, i + 6 + n) }; } }
  return { kind: 'bin', buf };
}



/* ---------- Yabancı (ABD) hisseler: fiyat Yahoo (USD × USD/TRY), mali tablolar SEC EDGAR XBRL ---------- */
async function usStock(sym, range) {
  const c = await yahoo(sym, range), cur = (c.currency || 'USD').toUpperCase();
  if (cur === 'TRY') return { rows: c, fx: 1, cur, name: c.name };
  const fx = await yahoo(`${cur}TRY=X`, range);
  if (c.currency === 'GBp') fx.forEach(r => { r[4] = r[4] / 100; });
  const usd = new Map(fx.map(r => [r[0], r[4]])); let lastFx = null; const out = [];
  for (const r of c) { const k = usd.get(r[0]) ?? lastFx; if (usd.has(r[0])) lastFx = usd.get(r[0]); if (!k) continue; out.push([r[0], r6(r[1] * k), r6(r[2] * k), r6(r[3] * k), r6(r[4] * k), r[5]]); }
  return { rows: out, fx: lastFx, cur, name: c.name };
}
// Yahoo temel veri zaman serisi: son ~5 çeyrek + 4 yıl (ABD dahil tüm yabancı hisseler)
const YF_Q = { rev: 'TotalRevenue', gp: 'GrossProfit', op: 'OperatingIncome', ni: 'NetIncome', ebitda: 'EBITDA', ca: 'CurrentAssets', inv: 'Inventory', cash: 'CashAndCashEquivalents', ta: 'TotalAssets', cl: 'CurrentLiabilities', tl: 'TotalLiabilitiesNetMinorityInterest', eq: 'StockholdersEquity', debt: 'TotalDebt', _sh: 'OrdinarySharesNumber' };
const YF_FLOW = new Set(['rev', 'gp', 'op', 'ni', 'ebitda']);
async function yfFinancials(sym, fx) {
  const types = Object.values(YF_Q).flatMap(t => ['quarterly' + t, 'annual' + t]).join(',');
  const j = await getJSON(`https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(sym)}?symbol=${encodeURIComponent(sym)}&type=${types}&period1=1400000000&period2=${Math.floor(Date.now() / 1000)}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const Q = {}, A = {}; let cur = null;
  for (const r of (j.timeseries && j.timeseries.result) || []) {
    const t = r.meta && r.meta.type && r.meta.type[0]; if (!t || !r[t]) continue;
    const ann = t.startsWith('annual'), base = t.replace(/^(quarterly|annual)/, ''), key = Object.keys(YF_Q).find(k => YF_Q[k] === base); if (!key) continue;
    for (const v of r[t]) { if (!v || !v.asOfDate || !v.reportedValue) continue; cur = cur || v.currencyCode; ((ann ? A : Q)[v.asOfDate] = (ann ? A : Q)[v.asOfDate] || {})[key] = v.reportedValue.raw; }
  }
  const aDates = Object.keys(A).sort(); if (!aDates.length && !Object.keys(Q).length) throw new Error('mali tablo bulunamadı');
  const fyM = aDates.length ? +aDates[aDates.length - 1].slice(5, 7) : 12;
  const fyOf = d => { const y = +d.slice(0, 4), m = +d.slice(5, 7); return m > fyM ? y + 1 : y; };
  const qOf = d => { const m = +d.slice(5, 7); let k = (m - fyM + 12) % 12; if (k === 0) k = 12; return Math.min(4, Math.max(1, Math.round(k / 3))); };
  const disc = {}, bal = {}, ann = {};
  for (const [d, o] of Object.entries(Q)) { const y = fyOf(d), q = qOf(d); disc[`${y}-${q}`] = o; bal[`${y}-${q}`] = o; }
  for (const [d, o] of Object.entries(A)) { const y = fyOf(d); ann[y] = o; if (!bal[`${y}-4`]) bal[`${y}-4`] = o; }
  const ys = [...new Set([...Object.keys(disc).map(k => +k.split('-')[0]), ...Object.keys(ann).map(Number)])].sort();
  const k = fx || 1, rows = [];
  for (const y of ys) for (let q = 1; q <= 4; q++) {
    const row = { y, m: q * 3, src: 'yahoo', fyM }; let any = false;
    for (const key of YF_FLOW) {    // mali yıl başından birikimli: çeyrekler toplamı, ya da yıllık − sonraki çeyrekler
      let v = null; const qs = [1, 2, 3, 4].slice(0, q).map(i => disc[`${y}-${i}`] && disc[`${y}-${i}`][key]);
      if (q === 4 && ann[y] && ann[y][key] != null) v = ann[y][key];
      else if (qs.every(x => x != null)) v = qs.reduce((a, b) => a + b, 0);
      else if (ann[y] && ann[y][key] != null) { const rest = [1, 2, 3, 4].slice(q).map(i => disc[`${y}-${i}`] && disc[`${y}-${i}`][key]); if (rest.every(x => x != null)) v = ann[y][key] - rest.reduce((a, b) => a + b, 0); }
      if (v != null) { row[key] = v * k; any = true; }
    }
    const b = bal[`${y}-${q}`];
    if (b) for (const key of ['ca', 'inv', 'cash', 'ta', 'cl', 'tl', 'eq', 'debt']) if (b[key] != null) { row[key] = b[key] * k; any = true; }
    if (any && (row.ta != null || row.ni != null)) rows.push(row);
  }
  const shQ = Object.keys(Q).sort().reverse().find(d => Q[d]._sh), shA = aDates.slice().reverse().find(d => A[d]._sh);
  return { fin: rows.slice(-12), shares: shQ ? Q[shQ]._sh : shA ? A[shA]._sh : null, fyM, cur };
}
const SEC_UA = 'YatirimPusulasi/1.2 masaustu (yatirimpusulasi-app@users.noreply.github.com)';
let secTickers = null;
async function secCik(sym) {
  if (!secTickers) { const j = await getJSON('https://www.sec.gov/files/company_tickers.json', { headers: { 'User-Agent': SEC_UA } }); secTickers = new Map(Object.values(j).map(x => [String(x.ticker).toUpperCase(), String(x.cik_str).padStart(10, '0')])); }
  return secTickers.get(String(sym).toUpperCase().replace('.', '-')) || secTickers.get(String(sym).toUpperCase()) || null;
}
const SEC_MAP = {
  rev: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax'],
  gp: ['GrossProfit'], op: ['OperatingIncomeLoss'], ni: ['NetIncomeLoss', 'ProfitLoss'], _dep: ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization', 'DepreciationAmortizationAndAccretionNet'],
  ca: ['AssetsCurrent'], inv: ['InventoryNet'], cash: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'], ta: ['Assets'],
  cl: ['LiabilitiesCurrent'], tl: ['Liabilities'], eq: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  _ltd: ['LongTermDebtNoncurrent', 'LongTermDebt'], _std: ['LongTermDebtCurrent', 'DebtCurrent', 'ShortTermBorrowings']
};
const FLOW = new Set(['rev', 'gp', 'op', 'ni', '_dep']);
async function secFinancials(sym, fx) {
  const cik = await secCik(sym); if (!cik) throw new Error('SEC kaydı yok (ABD dışı şirketlerde mali tablo çekilemiyor)');
  const j = await getJSON(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, { headers: { 'User-Agent': SEC_UA } });
  const g = (j.facts && j.facts['us-gaap']) || {};
  const pick = names => { for (const n of names) { const u = g[n] && g[n].units && (g[n].units.USD); if (u && u.length) return u; } return null; };
  // mali yıl sonu ayı: 10-K yıllık (≈365 gün) akış kalemlerinden
  const D = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;
  const revU = pick(SEC_MAP.rev) || pick(SEC_MAP.ni) || [];
  const fyEnds = revU.filter(x => x.start && x.form && /^10-K/.test(x.form) && D(x.start, x.end) > 340 && D(x.start, x.end) < 380).map(x => x.end);
  if (!fyEnds.length) throw new Error('SEC verisinde yıllık rapor bulunamadı');
  const fyM = +fyEnds[fyEnds.length - 1].slice(5, 7);
  const fyOf = end => { const y = +end.slice(0, 4), m = +end.slice(5, 7); return m > fyM ? y + 1 : y; };   // mali yıl = bittiği takvim yılı
  const qOf = end => { const m = +end.slice(5, 7); let k = (m - fyM + 12) % 12; if (k === 0) k = 12; return Math.min(4, Math.max(1, Math.round(k / 3))); };
  const rows = new Map(), filed = new Map();
  const put = (y, q, key, val, f) => { const id = `${y}-${q}`; const r = rows.get(id) || { y, m: q * 3, src: 'sec', fy: 1 }; const fk = id + key; if (!filed.has(fk) || f > filed.get(fk)) { r[key] = val; filed.set(fk, f); } rows.set(id, r); };
  for (const [key, names] of Object.entries(SEC_MAP)) {
    const u = pick(names); if (!u) continue;
    for (const x of u) {
      if (!x.end || x.val == null || !/^10-[KQ]/.test(x.form || '')) continue;
      const y = fyOf(x.end), q = qOf(x.end);
      if (FLOW.has(key)) { if (!x.start) continue; const d = D(x.start, x.end); if (Math.abs(d - q * 91.3) > 25) continue; }   // mali yıl başından birikimli
      else if (x.start) continue;
      put(y, q, key, x.val, x.filed || '');
    }
  }
  const k = fx || 1;   // güncel kurla TL'ye çevir: oranlar kurdan bağımsız kalır
  const out = [...rows.values()].filter(r => r.ta || r.rev).sort((a, b) => a.y - b.y || a.m - b.m).slice(-12).map(r => {
    const o = { y: r.y, m: r.m, src: 'sec', fyM };
    for (const key of ['rev', 'gp', 'op', 'ni', 'ca', 'inv', 'cash', 'ta', 'cl', 'tl', 'eq']) if (r[key] != null) o[key] = r[key] * k;
    if (r.op != null && r._dep != null) o.ebitda = (r.op + Math.abs(r._dep)) * k;
    if (r._ltd != null || r._std != null) o.debt = ((r._ltd || 0) + (r._std || 0)) * k;
    if (o.tl == null && o.ta != null && o.eq != null) o.tl = o.ta - o.eq;
    return o;
  });
  const sh = j.facts && j.facts.dei && j.facts.dei.EntityCommonStockSharesOutstanding && j.facts.dei.EntityCommonStockSharesOutstanding.units.shares;
  const shares = sh && sh.length ? sh[sh.length - 1].val : null;
  return { fin: out, shares, fyM };
}

async function foreignFin(sym, fx, cur) {
  try {
    const f = await yfFinancials(sym, 1);
    // tablo para birimi fiyatınkinden farklıysa (ör. ADR) o kurla çevir
    let k = fx || 1; if (f.cur && cur && f.cur !== cur) { const r = await yahoo(`${f.cur}TRY=X`, '5d'); k = r[r.length - 1][4]; }
    f.fin = f.fin.map(o => { const x = { ...o }; for (const key of ['rev', 'gp', 'op', 'ni', 'ebitda', 'ca', 'inv', 'cash', 'ta', 'cl', 'tl', 'eq', 'debt']) if (x[key] != null) x[key] *= k; return x; });
    return f;
  } catch (e) {
    try { return await secFinancials(sym, fx); } catch (e2) { throw new Error(`${e.message || e}; SEC: ${e2.message || e2}`); }
  }
}


/* ---------- Analist beklentileri ---------- */
// Yahoo konsensüsü (çok sayıda aracı kurumun ortalaması): oturum çerezi + crumb ile
let yCk = null, yCrumb = null, yAt = 0;
async function yahooSession() {
  if (yCrumb && Date.now() - yAt < 6 * 3600e3) return;
  const a = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual', signal: AbortSignal.timeout(20000) }).catch(() => null);
  yCk = a ? (a.headers.get('set-cookie') || '').split(';')[0] : '';
  const c = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': 'Mozilla/5.0', Cookie: yCk }, signal: AbortSignal.timeout(20000) });
  yCrumb = (await c.text()).trim(); yAt = Date.now(); if (!c.ok || !yCrumb || yCrumb.length > 40) { yCrumb = null; throw new Error('Yahoo oturumu açılamadı'); }
}
async function yahooInsights(sym) {
  await yahooSession();
  const j = await getJSON(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=financialData,recommendationTrend,calendarEvents,defaultKeyStatistics,summaryDetail&crumb=${encodeURIComponent(yCrumb)}`, { headers: { 'User-Agent': 'Mozilla/5.0', Cookie: yCk } });
  const d = j && j.quoteSummary && j.quoteSummary.result && j.quoteSummary.result[0]; if (!d) return null;
  const v = x => x && typeof x === 'object' ? (x.raw ?? null) : (x ?? null);
  const fd = d.financialData || {}, ks = d.defaultKeyStatistics || {}, sd = d.summaryDetail || {}, ce = (d.calendarEvents || {}).earnings || {};
  const tr = ((d.recommendationTrend || {}).trend || []).map(t => ({ p: t.period, sb: t.strongBuy, b: t.buy, h: t.hold, s: t.sell, ss: t.strongSell }));
  const ed = (ce.earningsDate || [])[0];
  return {
    n: v(fd.numberOfAnalystOpinions), mean: v(fd.targetMeanPrice), med: v(fd.targetMedianPrice), hi: v(fd.targetHighPrice), lo: v(fd.targetLowPrice), px: v(fd.currentPrice),
    rec: fd.recommendationKey && fd.recommendationKey !== 'none' ? fd.recommendationKey : null, recMean: v(fd.recommendationMean), trend: tr,
    fpe: v(ks.forwardPE) ?? v(sd.forwardPE), feps: v(ks.forwardEps), beta: v(ks.beta) ?? v(sd.beta), ins: v(ks.heldPercentInsiders), inst: v(ks.heldPercentInstitutions),
    divY: v(sd.dividendYield), payout: v(sd.payoutRatio),
    earn: ed ? { d: new Date(v(ed) * 1000).toISOString().slice(0, 10), est: !!ce.isEarningsDateEstimate, eps: v(ce.earningsAverage) } : null,
    cur: (d.summaryDetail && d.summaryDetail.currency) || null
  };
}
// İş Yatırım şirket kartı: kurumun kendi önerisi, hedef fiyatı, yatırım teması, gelecek yıl tahminleri ve temettü geçmişi
async function isyCard(sym) {
  const html = (await getBuf(`https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/sirket-karti.aspx?hisse=${encodeURIComponent(sym)}`, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' } })).toString('utf8');
  const out = {};
  const i = html.indexOf('id="Oneri_Aciklama"');
  if (i > 0) {
    const seg = html.slice(i, i + 9000), txt = x => ent(String(x || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    out.oneri = txt((seg.match(/^[^>]*>([^<]*)</) || [])[1]);
    const li = k => { const m = seg.match(new RegExp(k + '\\s*<span>([^<]*)</span>')); return m ? txt(m[1]) : null; };
    out.tarih = li('Son Öneri Tarihi'); out.hedef = trNum(li('Hedef Fiyat')); out.pot = li('Getiri Pot');
    out.analist = txt((seg.match(/<h4>([\s\S]*?)<\/h4>/) || [])[1]) || null;
    const tm = seg.match(/Yatırım Teması<\/b><\/p>([\s\S]*?)<\/div>/); if (tm) { const t = txt(tm[1]); out.tema = t.length > 420 ? t.slice(0, 420).replace(/\s\S*$/, '') + '…' : t; }
    out.oTarih = li('Önceki Öneri Tarihi'); out.oHedef = trNum(li('Önceki Hedef Fiyat'));
    const om = seg.match(/Önceki Hedef Fiyat[\s\S]{0,200}?<\/li>[\s\S]{0,400}?>(AL|TUT|SAT|ENDEKSE PARALEL|ENDEKSİN ÜZERİNDE GETİRİ|ENDEKSİN ALTINDA GETİRİ|GÖZDEN GEÇİRİLİYOR)</i); if (om) out.oOneri = om[1];
  }
  const T = htmlTables(html), find = re => T.find(t => t[0] && re.test(t[0].join(' ')));
  const est = find(/^Kod Satışlar \(mn TL\) Net Kar \(mn TL\) FAVÖK/); if (est && est[1]) out.tahmin = { satis: trNum(est[1][1]), netkar: trNum(est[1][2]), favok: trNum(est[1][3]), tur: est[1][4] };
  const mul = T.find(t => t[0] && /^Kod F\/K FD\/FAVÖK FD\/Satışlar PD\/DD Tahmin/.test(t[0].join(' '))); if (mul && mul[1]) out.carpan = { fk: trNum(mul[1][1]), fdfavok: trNum(mul[1][2]), pddd: trNum(mul[1][4]), tur: mul[1][5] };
  const dv = find(/^Kod Dağ\. Tarihi Temettü Verim/); if (dv) { const seen = new Set(); out.temettu = dv.slice(1).filter(r => r[1] && !seen.has(r[1]) && seen.add(r[1])).slice(0, 8).map(r => ({ d: r[1], verim: trNum(r[2]), hb: trNum(r[3]) })); }
  if (!out.oneri && !out.tahmin) return null;
  return out;
}
// KAP şirket işlemleri takvimi (genel kurul, temettü ödemesi, sermaye artırımı …): bu ay ve gelecek ay
const CA_TIP = { generalMeeting: 'Genel kurul', dividendPayment: 'Temettü ödemesi', capitalIncreaseDecrease: 'Sermaye artırımı/azaltımı', mergerDemergerAssignSubject: 'Birleşme/bölünme', retirementRight: 'Ayrılma hakkı', saleOutRight: 'Satma hakkı', tenderOffer: 'Pay alım teklifi' };
async function kapCalendar() {
  const now = new Date(), items = [];
  for (const k of [0, 1]) {
    const d = new Date(now.getFullYear(), now.getMonth() + k, 1);
    const L = await getJSON(`https://www.kap.org.tr/tr/api/ca/allCa/${d.getFullYear()}/${pad(d.getMonth() + 1)}`);
    for (const day of L || []) for (const [key, tip] of Object.entries(CA_TIP)) { const x = day[key]; if (!x || !x.companies) continue; x.companies.forEach((c, i) => items.push({ d: String(day.date).replace(/\//g, '-'), tip, firma: c, idx: (x.disclosureIndex || [])[i] || null })); }
    await sleep(300);
  }
  return { at: new Date().toISOString(), items };
}


/* ---------- TCMB fiyat endeksleri (TÜFE ve Yİ-ÜFE aylık % değişim; kaynak TÜİK) ---------- */
async function tcmbPrices() {
  const B = 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Istatistikler/Enflasyon+Verileri';
  const rows = html => [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c => ent(c[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, '').trim()));
  const ym = s => { const m = String(s).match(/^(\d{2})-(\d{4})$/); return m ? `${m[2]}-${m[1]}` : null; };
  const num = s => { const v = parseFloat(String(s).replace(',', '.')); return isFinite(v) ? v : null; };
  const tufe = {}, ufe = {};
  const t = (await getBuf(B)).toString('utf8');
  for (const r of rows(t)) { const k = ym(r[0]); if (k && r.length >= 3 && num(r[2]) != null) tufe[k] = num(r[2]); }
  await sleep(300);
  const u = (await getBuf(B + '/Uretici+Fiyatlari')).toString('utf8');
  for (const r of rows(u)) { const k = ym(r[0]); if (!k || r.length < 5) continue; const v = num(r[4]) ?? num(r[3]); if (v != null) ufe[k] = v; }
  if (Object.keys(tufe).length < 24 || Object.keys(ufe).length < 24) throw new Error('TCMB tablo yapısı değişmiş');
  return { tufe, ufe, at: new Date().toISOString() };
}

/* ---------- TCMB Piyasa Katılımcıları Anketi (aylık): enflasyon, kur, faiz, büyüme beklentileri ---------- */
async function tcmbSurvey() {
  const base = 'https://www.tcmb.gov.tr';
  const h = (await getBuf(base + '/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Istatistikler/Egilim+Anketleri/Piyasa+Katilimcilari+Anketi/')).toString('utf8');
  const m = h.match(/href="([^"]*PKA_Rapor\.pdf[^"]*)"/); if (!m) throw new Error('anket raporu bağlantısı yok');
  const url = base + m[1].replace(/&amp;/g, '&');
  const t = await require('./pdr').pdfText(await getBuf(url), 8);
  const n = re => { const x = t.match(re); return x ? parseFloat(x[1].replace(/\./g, '').replace(',', '.')) : null; };
  const ay = (t.match(/Anketi\s*\|\s*([^\s|]+\s+20\d\d)/) || t.match(/((?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık|OCAK|ŞUBAT|MART|NİSAN|MAYIS|HAZİRAN|TEMMUZ|AĞUSTOS|EYLÜL|EKİM|KASIM|ARALIK)\s+20\d\d)/) || [])[1] || '';
  const out = {
    ay, url,
    tufeYS: n(/cari yıl sonu tüketici enflasyonu \(TÜFE\) beklentisi.*?bu anket döneminde yüzde ([\d,]+)/i),
    tufe12: n(/12 ay sonrası TÜFE beklentisi.*?bu anket döneminde yüzde ([\d,]+)/i),
    tufe24: n(/24 ay sonrası TÜFE beklentisi.*?bu anket döneminde yüzde ([\d,]+)/i),
    usdYS: n(/cari yıl sonu döviz kuru \(ABD Doları\/TL\) beklentisi.*?bu anket döneminde ([\d,]+) TL/i),
    usd12: n(/12 ay sonrası döviz kuru beklentisi.*?bu anket döneminde ([\d,]+) TL/i),
    faiz: n(/politika faiz oranı beklentisi bu anket döneminde yüzde ([\d,]+)/i),
    gsyh: n(/büyüme beklentileri.*?sırasıyla yüzde ([\d,]+)/i)
  };
  if (out.tufe12 == null && out.tufeYS == null) throw new Error('anket metni okunamadı');
  return out;
}

/* ---------- TEFAS fon kataloğu: tüm yatırım fonlarının dönem getirileri ve risk değeri ---------- */
async function tefasCatalog() {
  const per = { donemGetiri1a: '1', donemGetiri3a: '1', donemGetiri6a: '1', donemGetiri1y: '1', donemGetiriyb: '1', donemGetiri3y: '1', donemGetiri5y: '1' };
  const out = [];
  for (const tip of ['YAT', 'EMK']) {
    const j = await getJSON('https://www.tefas.gov.tr/api/funds/fonGetiriBazliBilgiGetir', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: '*/*', Origin: 'https://www.tefas.gov.tr' }, body: JSON.stringify({ dil: 'TR', fonTipi: tip, islem: 1, ...per, calismaTipi: 2, getiriOrani: '1' }) });
    if (j && j.errorMessage) throw new Error('TEFAS: ' + j.errorMessage);
    for (const x of (j && j.resultList) || []) if (x.fonKodu) out.push([x.fonKodu, x.fonUnvan, (x.fonTurAciklama || '').replace(/ Şemsiye Fonu$/, ''), x.getiri1a, x.getiri3a, x.getiri6a, x.getiriyb, x.getiri1y, x.getiri3y, x.getiri5y, +x.riskDegeri || null, tip]);
    await sleep(400);
  }
  if (out.length < 300) throw new Error('TEFAS katalog eksik');
  return { at: new Date().toISOString(), cols: ['kod', 'ad', 'tur', 'g1a', 'g3a', 'g6a', 'gyb', 'g1y', 'g3y', 'g5y', 'risk', 'tip'], rows: out };
}

/* ---------- Fırsat radarı: İş Yatırım "Temel Değerler ve Oranlar" sayfası (tüm BIST, tek istek) ---------- */
function trNum(x) { const t = String(x || '').replace(/&nbsp;/g, '').trim(); if (!t || /^A\/D$|^-$/.test(t)) return null; const v = parseFloat(t.replace(/\./g, '').replace(',', '.')); return isFinite(v) ? v : null; }
function htmlTables(html) {
  const out = [];
  for (const m of html.matchAll(/<table[\s\S]*?<\/table>/g)) {
    const rows = [...m[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map(r => [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c => ent(c[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()));
    out.push(rows);
  }
  return out;
}
async function radarFetch(progress) {
  progress && progress('Fırsat radarı: BIST temel oranları');
  const html = (await getBuf('https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/Temel-Degerler-Ve-Oranlar.aspx', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' } })).toString('utf8');
  const T = htmlTables(html), find = re => T.find(t => t[0] && re.test(t[0].join(' ')) && t.length > 100);
  const basic = find(/Hisse Adı.*Sektör.*Piyasa Değeri/), val = find(/F\/K.*FD\/FAVÖK.*PD\/DD.*Son Dönem/), ret = find(/Günlük Getiri.*Yıl İçi Getiri/);
  if (!basic || !val) throw new Error('İş Yatırım tablo yapısı değişmiş');
  const rows = {};
  for (const r of basic.slice(1)) { if (!/^[A-Z0-9]{3,6}$/.test(r[0])) continue; rows[r[0]] = { k: r[0], ad: r[1], sek: r[2], px: trNum(r[3]), mc: trNum(r[4]), mcUsd: trNum(r[5]), ha: trNum(r[6]), ser: trNum(r[7]) }; }
  for (const r of val.slice(1)) { const o = rows[r[0]]; if (!o) continue; Object.assign(o, { fk: trNum(r[2]), fdf: trNum(r[3]), fds: trNum(r[4]), pddd: trNum(r[5]), donem: r[6] }); }
  if (ret) for (const r of ret.slice(1)) { const o = rows[r[0]]; if (!o) continue; Object.assign(o, { g1: trNum(r[2]), g5: trNum(r[3]), g21: trNum(r[4]), gy: trNum(r[5]) }); }
  const fc = T.find(t => t[1] && /F\/K Tahmin/.test(t[1].join(' ')) && t.length > 20);   // İş Yatırım analist tahminleri (kapsadığı ~75 hisse)
  if (fc) for (const r of fc.slice(2)) { const o = rows[r[0]]; if (!o) continue; Object.assign(o, { fkT: trNum(r[2]), fdfT: trNum(r[4]), pdT: trNum(r[6]) }); }
  return { at: new Date().toISOString(), rows };
}
// Büyük şirketler için teknik göstergeler (Yahoo, 1 yıl): RSI, 52 hafta zirvesinden uzaklık, 200 günlük ortalamaya göre konum
async function radarTech(codes, progress) {
  const out = {};
  for (const [i, k] of codes.entries()) {
    if (i % 10 === 0) progress && progress(`Fırsat radarı teknik: ${i}/${codes.length}`);
    try {
      const px = await yahoo(`${k}.IS`, '1y'); const c = px.map(r => r[4]); if (c.length < 60) continue;
      const n = c.length, last = c[n - 1];
      let g = 0, l = 0; for (let j = n - 14; j < n; j++) { const d = c[j] - c[j - 1]; if (d > 0) g += d; else l -= d; }
      // Wilder RSI (tam seri)
      let ag = 0, al = 0; for (let j = 1; j <= 14; j++) { const d = c[j] - c[j - 1]; if (d > 0) ag += d; else al -= d; } ag /= 14; al /= 14;
      for (let j = 15; j < n; j++) { const d = c[j] - c[j - 1]; ag = (ag * 13 + Math.max(d, 0)) / 14; al = (al * 13 + Math.max(-d, 0)) / 14; }
      const rsi = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
      const hi = Math.max(...px.map(r => r[2] ?? r[4])), lo = Math.min(...px.map(r => r[3] ?? r[4]));
      const s200 = n >= 200 ? c.slice(n - 200).reduce((a, b) => a + b, 0) / 200 : null;
      out[k] = { rsi: Math.round(rsi * 10) / 10, dHi: last / hi - 1, dLo: last / lo - 1, s200: s200 ? last / s200 - 1 : null, d: px[n - 1][0] };
    } catch (e) { }
    await sleep(150);
  }
  return out;
}

/* ---------- TEFAS fon fiyatları ---------- */
async function tefas(code, months) {
  const per = [1, 3, 6, 12, 36, 60].find(p => p >= months) || 60;
  const j = await getJSON('https://www.tefas.gov.tr/api/funds/fonFiyatBilgiGetir', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*' },
    body: JSON.stringify({ fonKodu: String(code).toUpperCase(), dil: 'TR', periyod: per })
  });
  const L = (j && j.resultList) || [];
  const rows = L.filter(x => x && x.tarih && x.fiyat > 0).map(x => { const f = +x.fiyat; return [String(x.tarih).slice(0, 10), f, f, f, f, 0]; });
  const lastR = L[L.length - 1] || {};
  return { rows: dedupe(rows), name: lastR.fonUnvan || '', rank: lastR.kategoriDerece ? { k: +lastR.kategoriDerece, n: +lastR.kategoriFonSay || null, d: String(lastR.tarih || '').slice(0, 10) } : null };
}

/* ---------- Mali tablolar (İş Yatırım MaliTablo, kaynak: KAP finansal raporları) ---------- */
const FINMAP = {
  rev: ['3C'], gp: ['3D'], op: ['3DF'], ni: ['3Z'], ca: ['1A'], inv: ['1AF'], cash: ['1AA'], ta: ['1BL'],
  cl: ['2A'], tl: ['2A', '2B'], debt: ['2AA', '2BA'], eq: ['2O'], _dep: ['4B'], _cap: ['2OA'],
  cfo: ['4C'], capex: ['4CAI'], fcf: ['4CB'], fxp: ['4BE'], divp: ['4CBB']
};
const FIN_VER = 2;   // nakit akışı ve döviz pozisyonu kalemleri eklendi → eski kayıtlar bir kez yeniden çekilir
// Bankalar UFRS şablonuyla raporlar
const FINMAP_BANK = {
  rev: ['3A'], ni: ['3Z'], cash: ['1A'], ta: [['1Z', '1BL', '1L']], eq: ['2O'], _cap: ['2OA']   // iç içe dizi: ilk bulunan kod
};
function lastQuarters(n, now = new Date()) {
  // KAP takvimi: çeyrek bitiminden ~45-70 gün sonra açıklanır; en yeni olası dönemden geriye
  let y = now.getFullYear(), m = Math.floor(now.getMonth() / 3) * 3; if (m === 0) { y--; m = 12; }
  const out = [];
  for (let i = 0; i < n; i++) { out.push({ y, m }); m -= 3; if (m <= 0) { m += 12; y--; } }
  return out;
}
async function malitablo(sym, group, per) {
  const q = per.map((p, i) => `&year${i + 1}=${p.y}&period${i + 1}=${p.m}`).join('');
  const url = `https://www.isyatirim.com.tr/_layouts/15/IsYatirim.Website/Common/Data.aspx/MaliTablo?companyCode=${encodeURIComponent(sym)}&exchange=TRY&financialGroup=${group}${q}`;
  for (let i = 0; ; i++) {   // ağ hatasında 3 deneme
    try { const j = await getJSON(url); return (j && j.value) || []; }
    catch (e) { if (i >= 2) throw e; await sleep(2500 * (i + 1)); }
  }
}
async function financials(sym, quarters = 12) {
  const all = lastQuarters(quarters);
  let group = 'XI_29', out = [], shares = null;
  for (let k = 0; k < all.length; k += 4) {
    const per = all.slice(k, k + 4);
    let items = await malitablo(sym, group, per);
    if (k === 0 && !items.some(it => it.itemCode === '1BL' && +it.value1)) {
      const b = await malitablo(sym, 'UFRS', per);
      if (b.length) { group = 'UFRS'; items = b; }
    }
    const byCode = new Map(items.map(it => [it.itemCode, it]));
    const map = group === 'UFRS' ? FINMAP_BANK : FINMAP;
    per.forEach((p, i) => {
      const val = code => { const it = byCode.get(code); const v = it ? it['value' + (i + 1)] : null; return v == null || v === '' ? null : +v; };
      const row = { y: p.y, m: p.m, src: 'isy' }; let any = false;
      for (const [key, codes] of Object.entries(map)) {
        const vs = codes.map(c => Array.isArray(c) ? c.map(val).find(v => v != null && isFinite(v) && v !== 0) : val(c)).filter(v => v != null && isFinite(v));
        if (!vs.length) continue; row[key] = vs.reduce((a, b) => a + b, 0); if (row[key] !== 0) any = true;
      }
      if (!any || !row.ta) return;
      if (group === 'UFRS' && row.tl == null && row.eq != null) row.tl = row.ta - row.eq;   // banka: toplam yükümlülük ≈ aktif − özkaynak
      if (row.op != null && row._dep != null) row.ebitda = row.op + Math.abs(row._dep);
      if (row._cap > 0 && shares == null) shares = row._cap;   // ödenmiş sermaye ≈ pay adedi (1 TL nominal)
      if (row._cap > 0) row.cap = row._cap; delete row._dep; delete row._cap; out.push(row);
    });
    await sleep(300);
  }
  return { fin: out, shares, group };
}
function mergeFin(old, rows) {
  const key = p => `${p.y}-${p.m}`, m = new Map((old || []).map(p => [key(p), p]));
  for (const r of rows) { const o = m.get(key(r)); if (o && o.man) continue; m.set(key(r), { ...(o || {}), ...r }); }  // elle düzeltilen dönem korunur
  return [...m.values()].sort((a, b) => a.y - b.y || a.m - b.m);
}

/* ---------- Toplu güncelleme ---------- */
function mergePx(old, rows) {
  const m = new Map((old || []).map(r => [r[0], r]));
  for (const r of rows) m.set(r[0], r);
  return [...m.values()].sort((a, b) => a[0].localeCompare(b[0])).slice(-2500);
}
async function refreshAll(data, progress, only) {
  const assets = data.assets || {}, patches = {}, errors = [], updated = [];
  const want = only && only.length ? new Set(only.map(x => String(x).toUpperCase())) : null;
  const rangeFor = a => (a.px && a.px.length > 30 ? '3mo' : '5y');
  const now = Date.now();
  for (const [id, a] of Object.entries(assets)) {
    if (!a || !a.sym || (want && !want.has(a.sym))) continue;
    const patch = {};
    try {
      let rows = null;
      if (a.type === 'hisse') {
        const retry = !a.noAuto || want || !a.noAutoAt || now - Date.parse(a.noAutoAt) > 7 * 864e5;
        if (retry) {
          progress && progress(`${a.sym} (BIST)`);
          try {
            if (a.mkt === 'US') { const r = await usStock(a.src || a.sym, rangeFor(a)); rows = r.rows; if (r.fx) patch.fx = r.fx; patch.cur = r.cur; if (!a.name && r.name) patch.name = r.name; }
            else rows = await yahoo(a.src || `${a.sym}.IS`, rangeFor(a));
            if (a.noAuto) { patch.noAuto = false; }
          }
          catch (e) {
            if (/404|veri yok/.test(String(e.message || e))) { patch.noAuto = true; patch.noAutoAt = new Date().toISOString(); if (!a.noAuto) errors.push(`${a.sym}: otomatik fiyat kaynağı yok (gayrimenkul sertifikası, varant gibi araçlar Yahoo'da bulunmuyor) — fiyatı Veri ve ayarlar → Son fiyatları hızlı güncelle ile girebilirsin`); }
            else throw e;
          }
        }
      }
      else if (a.type === 'emtia') { progress && progress(`${a.sym}`); const s = emtiaSource(a); rows = s.kind === 'gram' ? await gramMetal(s.futures, rangeFor(a)) : await yahoo(s.symbol, rangeFor(a));
        const k = (s.f || 1) * (1 + (+a.prem || 0) / 100);
        if (k !== 1) rows = rows.map(r => [r[0], r6(r[1] * k), r6(r[2] * k), r6(r[3] * k), r6(r[4] * k), r[5]]);
        if (!a.name && s.label) patch.name = s.label; }
      else if (a.type === 'coin') { progress && progress(`${a.sym} (coin)`); rows = await coin(a.sym, rangeFor(a)); }
      else if (a.type === 'fon') {
        progress && progress(`${a.sym} (TEFAS)`);
        const have = a.px && a.px.length > 30 ? a.px[a.px.length - 1][0] : null;
        const months = have ? Math.ceil((now - Date.parse(have)) / (30 * 864e5)) + 1 : 60;
        const r = await tefas(a.src || a.sym, months); rows = r.rows; if (!a.name && r.name) patch.name = r.name; if (r.rank) patch.rank = r.rank;
      }
      if (rows && rows.length) {
        const px = mergePx(a.px, rows), l = px[px.length - 1];
        Object.assign(patch, { px, last: l[4], lastDate: l[0] }); updated.push(a.sym);
      } else if (rows) errors.push(`${a.sym}: fiyat bulunamadı`);
    } catch (e) { errors.push(`${a.sym}: ${e.message || e}`); }
    // Hisse: mali tablolar — ilk eklemede geçmiş 12 çeyrek, sonra haftada bir yeni dönem kontrolü
    if (a.type === 'hisse' && (!a.noFin || want) && !(patch.noAuto || (a.noAuto && !want))) {
      const age = a.finAt ? now - Date.parse(a.finAt) : Infinity;
      if (want || !(a.fin && a.fin.length) || age > 7 * 864e5 || (a.mkt !== 'US' && a.finVer !== FIN_VER)) {
        try {
          progress && progress(`${a.sym} mali tablolar`);
          const f = a.mkt === 'US' ? await foreignFin(a.src || a.sym, patch.fx || a.fx, patch.cur || a.cur) : await financials(a.src ? a.src.replace(/\.IS$/, '') : a.sym, a.fin && a.fin.length >= 8 && a.finVer === FIN_VER ? 4 : 12);
          patch.finAt = new Date().toISOString();
          if (f.fin.length) { patch.noFin = false; patch.finVer = FIN_VER; patch.fin = mergeFin(a.fin, f.fin); if (f.shares && !a.sharesMan) patch.shares = f.shares; updated.push(`${a.sym} mali`); }
          else { patch.noFin = true; if (!a.noFin) errors.push(`${a.sym}: mali tablo bulunamadı (şirket değilse ya da yeni listelendiyse normal)`); }
        } catch (e) { errors.push(`${a.sym} mali tablo: ${e.message || e}`); }
      }
    }
    // Analist beklentileri: günde bir (hisse; BIST'te İş Yatırım + Yahoo, yabancıda Yahoo)
    if (a.type === 'hisse' && !a.noAuto && !patch.noAuto && (want || !a.insAt || now - Date.parse(a.insAt) > 20 * 3600e3)) {
      const ins = { ...(a.ins || {}) }; let ok = false;
      try { progress && progress(`${a.sym} analist beklentileri`); const y = await yahooInsights(a.mkt === 'US' ? (a.src || a.sym) : `${a.sym}.IS`); if (y) { ins.y = y; ok = true; } } catch (e) { }
      if (a.mkt !== 'US') { try { const c = await isyCard(a.sym); if (c) { ins.i = c; ok = true; } } catch (e) { } }
      if (ok) { patch.ins = ins; patch.insAt = new Date().toISOString(); }
    }
    if (Object.keys(patch).length) patches[id] = patch;
    await sleep(250);
  }
  // KAP: portföydeki ve takip edilen hisseler
  let news = {};
  const since = data.settings && data.settings.main && data.settings.main.kapSince;
  if (!want) {
    try {
      const syms = Object.values(assets).filter(a => a && a.type === 'hisse' && a.mkt !== 'US').map(a => a.sym);
      news = await kapNews(syms, since, progress);
    } catch (e) { errors.push(`KAP: ${e.message || e}`); }
  }
  // KAP: fon bildirimleri + aylık portföy dağılım raporu (fon içeriği)
  const funds = Object.entries(assets).filter(([id, a]) => a && a.type === 'fon' && a.sym && /^[A-Z0-9]{3}$/.test(a.sym) && (!want || want.has(a.sym)));
  const lastHold = a => (a.hold && a.hold.length ? a.hold[a.hold.length - 1] : null);
  const needPdr = ([id, a]) => { const h = lastHold(a); const age = a.pdrAt ? Date.now() - Date.parse(a.pdrAt) : Infinity; const pm = new Date(new Date().getFullYear(), new Date().getMonth(), 0), stale = !h || h.date < isoD(pm) /* geçen ay sonu */; return want || (stale && age > 20 * 3600e3); };
  if (funds.length && (!want || funds.some(needPdr))) {
    try {
      const scan = await kapFundScan(funds.map(([, a]) => a.sym), want ? null : since, progress);
      if (!want) Object.assign(news, scan.news);
      for (const [id, a] of funds) {
        if (!needPdr([id, a])) continue;
        const rec = scan.pdrs[a.sym]; const patch = patches[id] = patches[id] || {}; patch.pdrAt = new Date().toISOString();
        if (!rec) continue;
        const h = lastHold(a); if (h && h.idx === rec.i) continue;
        try {
          progress && progress(`${a.sym} portföy dağılım raporu`);
          const snap = await fundHolding(a.sym, rec);
          const m = new Map((a.hold || []).map(x => [x.date, x])); m.set(snap.date, snap);
          patch.hold = [...m.values()].sort((x, y) => x.date.localeCompare(y.date)).slice(-12);
          updated.push(`${a.sym} içerik`);
        } catch (e) { errors.push(`${a.sym} portföy raporu: ${e.message || e}`); }
        await sleep(300);
      }
    } catch (e) { errors.push(`KAP fon: ${e.message || e}`); }
  }
  // TCMB fiyat endeksleri ve TEFAS fon kataloğu: yalnız tam güncellemede
  let macro = null, fonlar = null;
  if (!want) {
    try { progress && progress('TCMB enflasyon verileri'); macro = await tcmbPrices(); } catch (e) { errors.push(`TCMB enflasyon: ${e.message || e}`); }
    try { progress && progress('TCMB beklenti anketi'); const pka = await tcmbSurvey(); macro = { ...(macro || {}), pka }; } catch (e) { errors.push(`TCMB anket: ${e.message || e}`); }
    try { progress && progress('TEFAS fon kataloğu'); fonlar = await tefasCatalog(); } catch (e) { errors.push(`TEFAS katalog: ${e.message || e}`); }
  }
  // KAP şirket takvimi: yalnız tam güncellemede
  let cal = null;
  if (!want) { try { progress && progress('KAP şirket takvimi'); cal = await kapCalendar(); } catch (e) { errors.push(`KAP takvim: ${e.message || e}`); } }
  // Karşılaştırma serileri (dolar, gram altın, BIST 100): yalnız tam güncellemede
  let bench = null;
  if (!want) {
    try {
      progress && progress('Karşılaştırma serileri');
      const c = r => r.map(x => [x[0], x[4]]);
      const [usd, gold, xu] = await Promise.all([yahoo('USDTRY=X', '5y'), gramMetal('GC=F', '5y'), yahoo('XU100.IS', '5y')]);
      bench = { at: new Date().toISOString(), usd: c(usd), gold: c(gold), xu100: c(xu) };
    } catch (e) { errors.push(`Karşılaştırma serileri: ${e.message || e}`); }
  }
  // Fırsat radarı: günlük tam güncellemede ya da radar düğmesiyle
  let radar = null;
  if (!want || want.has('__RADAR')) {
    try {
      radar = await radarFetch(progress);
      const top = Object.values(radar.rows).filter(r => r.mc && r.ha).sort((a, b) => b.mc * b.ha - a.mc * a.ha).slice(0, 100).map(r => r.k);
      radar.top100 = top;
      radar.tech = await radarTech(top, progress);
      updated.push('fırsat radarı');
    } catch (e) { errors.push(`Fırsat radarı: ${e.message || e}`); radar = null; }
  }
  return { patches, errors, updated, news, radar, bench, cal, macro, fonlar };
}

module.exports = { refreshAll, tcmbPrices, tcmbSurvey, tefasCatalog, yahooInsights, isyCard, kapCalendar, yfFinancials, secFinancials, usStock, radarFetch, radarTech, kapDetail, kapAttachment, kapFundScan, fundHolding, GOLD_UNITS, goldUnit, tefas, financials, mergeFin, lastQuarters, yahoo, gramMetal, coin, kapNews, kapTip, kapDate, emtiaSource, sid };
