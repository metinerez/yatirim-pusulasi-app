{
const $ = s => document.querySelector(s);
const DESK = !!window.pusula;
const pRefresh = async only => { if (window.pusulaFlush) await window.pusulaFlush(); return window.pusula.refresh(only); };
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NF = {};
const fmt = (n, d = 2) => n == null || !isFinite(n) ? '—' : (NF[d] || (NF[d] = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }))).format(n);
const fp = n => n == null || !isFinite(n) ? '—' : fmt(n, Math.abs(n) < 1 ? 4 : Math.abs(n) < 10 ? 3 : 2);
const fpct = (n, d = 1) => n == null || !isFinite(n) ? '—' : (n > 0 ? '+' : n < 0 ? '−' : '') + '%' + fmt(Math.abs(n) * 100, d);
const fbig = n => n == null || !isFinite(n) ? '—' : Math.abs(n) >= 1e9 ? fmt(n / 1e9, 2) + ' mlr' : Math.abs(n) >= 1e6 ? fmt(n / 1e6, 2) + ' mn' : fmt(n, 0);
const fpc = (n, d = 1) => n == null || !isFinite(n) ? '—' : (n < 0 ? '−' : '') + '%' + fmt(Math.abs(n) * 100, d);
const fc = n => n == null || !isFinite(n) ? '—' : Math.abs(n) >= 1e6 ? fmt(n / 1e6, Math.abs(n) >= 1e8 ? 0 : 2) + ' mn' : Math.abs(n) >= 1e4 ? fmt(n, 0) : fp(n);
const fm = (n, d = 0) => n == null || !isFinite(n) ? '—' : (n < 0 ? '−' : '') + '₺' + fmt(Math.abs(n), d);
const fx = (n, d = 2) => n == null || !isFinite(n) ? '—' : fmt(n, d) + 'x';
const cls = n => n > 0 ? 'up' : n < 0 ? 'dn' : '';
const TYPES = { hisse: 'Hisse', fon: 'Fon', emtia: 'Emtia', coin: 'Coin' };
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const sid = s => String(s).toUpperCase().replace(/[^A-Z0-9_~:@+-]/g, '-').slice(0, 120) || 'X';
const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const dshort = iso => iso ? `${+iso.slice(8, 10)} ${AYLAR[+iso.slice(5, 7) - 1]} ${iso.slice(2, 4)}` : '';
const dtr = iso => iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '';
const tagH = l => `<span class="tag t-${l.replace(/\s/g, '')}">${l}</span>`;
let toastT;
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200); };

/* ---------------- Durum ve saklama ---------------- */
const S = { assets: {}, txns: {}, settings: { rf: '', infl: '' }, cpi: {}, news: [] };
let db = null; const LS = 'yatirim-pusulasi-v1';
const setSt = (txt, k) => { const c = $('#st'); c.className = 'chip ' + (k || ''); c.lastElementChild.textContent = txt; };
function loadLocal() { try { const j = JSON.parse(localStorage.getItem(LS) || 'null'); if (j) { S.assets = j.assets || {}; S.txns = j.txns || {}; S.settings = { ...S.settings, ...(j.settings || {}) }; S.cpi = j.cpi || {}; S.news = j.news || []; return true; } } catch (e) { } return false; }
function saveLocal() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { } }
const chain = {};
function w(path, data) {
  if (!db) { saveLocal(); return Promise.resolve(); }
  const p = (chain[path] || Promise.resolve()).then(() => data === null ? db.doc(path).delete() : db.doc(path).set(data))
    .catch(e => toast('Kaydedilemedi: ' + (e && (e.message || e.code) || e)));
  chain[path] = p; return p;
}
const putAsset = a => { S.assets[a.sym] = a; return w('assets/' + sid(a.sym), a); };
const delAsset = sym => { delete S.assets[sym]; return w('assets/' + sid(sym), null); };
const putTx = t => { S.txns[t.id] = t; return w('txns/' + t.id, t); };
const delTx = id => { delete S.txns[id]; return w('txns/' + id, null); };
const putSettings = () => w('settings/main', S.settings);
const putCpi = () => w('settings/cpi', { m: S.cpi, updated: today() });
const newId = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Fiziki altın birimleri (fiyatları gram altından hesaplanır; sources.js ile aynı liste)
const GOLD_UNITS = [['ALTIN', 'Gram altın (24 ayar)'], ['CEYREK', 'Çeyrek altın'], ['YARIM', 'Yarım altın'], ['TAM', 'Tam altın'], ['CUMHURIYET', 'Cumhuriyet altını'], ['ATA', 'Ata altın'], ['RESAT', 'Reşat altın'], ['GREMSE', 'Gremse (iki buçukluk)'], ['ATA5', 'Beşli ata'], ['BILEZIK', '22 ayar bilezik (gram)'], ['AYAR22', '22 ayar gram'], ['AYAR18', '18 ayar gram'], ['AYAR14', '14 ayar gram'], ['GUMUS', 'Gram gümüş']];
const GOLD_SET = new Set(GOLD_UNITS.map(u => u[0]).concat(['GRAM', 'HAS', 'BESLI']));
const trKey = x => String(x || '').toLocaleUpperCase('tr-TR').replace(/Ç/g, 'C').replace(/Ğ/g, 'G').replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ş/g, 'S').replace(/Ü/g, 'U').replace(/[^A-Z0-9]/g, '');
function guessType(sym) {
  if (GOLD_SET.has(trKey(sym))) return 'emtia';
  const s = String(sym).toUpperCase();
  if (/BTC|ETH|USDT|SOL|XRP|AVAX|DOGE|BNB|ADA/.test(s)) return 'coin';
  if (/XAU|XAG|ALTIN|GUMUS|GÜMÜŞ|GOLD|SILVER|ONS|BRENT|PETROL/.test(s)) return 'emtia';
  if (/^[A-Z]{3}$/.test(s)) return 'fon';
  return 'hisse';
}
function normType(v, sym) {
  const n = C.norm(v);
  if (/^(hisse|pay|stock|bist|equity)/.test(n)) return 'hisse';
  if (/^(fon|fund|tefas|byf|etf)/.test(n)) return 'fon';
  if (/^(emtia|altin|gumus|commodity|maden|gold|silver)/.test(n)) return 'emtia';
  if (/^(coin|kripto|crypto)/.test(n)) return 'coin';
  return guessType(sym);
}
function ensureAsset(sym, type) {
  const a = S.assets[sym];
  return a ? JSON.parse(JSON.stringify(a)) : { sym, name: '', type: type || guessType(sym), last: null, lastDate: null, shares: null, px: [], fin: [] };
}
function lastOf(a) {
  const p = a.px && a.px.length ? a.px[a.px.length - 1] : null;
  if (p && (!a.lastDate || p[0] >= a.lastDate)) return { v: p[4], d: p[0] };
  return { v: a.last, d: a.lastDate };
}
function mergePx(a, rows) {
  const m = new Map((a.px || []).map(r => [r[0], r]));
  for (const r of rows) m.set(r[0], r);
  a.px = [...m.values()].sort((x, y) => x[0].localeCompare(y[0])).slice(-2500);
  const l = a.px[a.px.length - 1];
  if (l && (!a.lastDate || l[0] >= a.lastDate)) { a.last = l[4]; a.lastDate = l[0]; }
}
const rf = () => (C.num(S.settings.rf) || 0) / 100;
const infl = () => (C.num(S.settings.infl) || S.macro?.pka?.tufe12 || 0) / 100;
const inflSrc = () => C.num(S.settings.infl) ? `%${S.settings.infl}, Ayarlar` : S.macro?.pka?.tufe12 ? `%${fmt(S.macro.pka.tufe12, 1)}, TCMB piyasa katılımcıları anketi` : '';

/* Hesap önbelleği: aynı nesne için bir kez hesapla */
let cache = new WeakMap();
function sig(a) {
  if (!a) return null;
  let c = cache.get(a);
  if (!c) { const v = { ...a, last: lastOf(a).v }; c = { comb: C.combined(v), st: a.px && a.px.length > 1 ? C.stats(a.px.map(r => r[0]), a.px.map(r => r[4]), a.type, rf()) : null, rat: a.type === 'hisse' ? C.ratios(v) : null }; cache.set(a, c); }
  return c;
}
function portfolio(type) {
  let pos = C.positions(Object.values(S.txns));
  for (const p of pos) {
    const a = S.assets[p.sym]; const L = a ? lastOf(a).v : null;
    p.type = a ? a.type : guessType(p.sym); p.last = L;
    p.value = p.qty > 0 ? p.qty * (L ?? p.avg) : 0; p.missing = p.qty > 0 && L == null;
    p.unreal = p.qty > 0 && L != null ? p.value - p.cost : null;
  }
  if (type) pos = pos.filter(p => p.type === type);
  let value = 0, cost = 0, realized = 0, missing = 0;
  for (const p of pos) { value += p.value; cost += p.cost; realized += p.realized; if (p.missing) missing++; }
  pos.forEach(p => p.w = value ? p.value / value : 0);
  return { pos, value, cost, realized, unreal: value - cost, missing };
}

/* ---------------- Gezinme ---------------- */
const CLS = { fonlar: 'fon', hisseler: 'hisse', emtia: 'emtia', coin: 'coin' };
const CLS_HASH = { fon: 'fonlar', hisse: 'hisseler', emtia: 'emtia', coin: 'coin' };
const CLS_AD = { fon: 'Fonlar', hisse: 'Hisseler', emtia: 'Emtia', coin: 'Coin' };
const CLS_COL = { fon: 'var(--teal)', hisse: 'var(--blue)', emtia: 'var(--gold)', coin: 'var(--orange)' };
const VIEWS = ['ana', 'fonlar', 'hisseler', 'emtia', 'coin', 'analiz', 'mali', 'dolayli', 'plan', 'radar', 'fonsec', 'incele', 'vergi', 'rapor', 'veri'];
const ALIAS = { pusula: 'ana', portfoy: 'fonlar' };
let view = 'ana', hash = 'ana', curType = null, selA = null, selM = null, range = 260, totRange = 99999, newsF = 'tum';
function route() {
  let h = location.hash.slice(1); h = ALIAS[h] || h; hash = VIEWS.includes(h) ? h : 'ana';
  curType = CLS[hash] || null; view = curType ? 'sinif' : hash;
  document.querySelectorAll('section[data-v]').forEach(s => s.classList.toggle('on', s.dataset.v === view));
  const navOn = view === 'analiz' ? CLS_HASH[S.assets[selA]?.type] : view === 'mali' ? 'hisseler' : hash;
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.t === navOn));
  if (curType && !$('#txSym').value) $('#txType').value = curType;
  render();
}
let raf = 0;
function render() { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { try { if (DESK && window.deskStatus) setSt(...window.deskStatus()); renderLists(); ({ ana: rAna, sinif: () => rSinif(curType), analiz: rAnaliz, mali: rMali, dolayli: rDolayli, radar: rRadar, fonsec: rFonsec, incele: rIncele, vergi: rVergi, rapor: rRapor, plan: rPlan, veri: rVeri })[view](); } catch (e) { console.error(e); } }); }
function renderLists() {
  const syms = Object.keys(S.assets).sort();
  $('#symList').innerHTML = syms.map(s => `<option value="${esc(s)}">`).join('') + GOLD_UNITS.filter(u => !S.assets[u[0]]).map(u => `<option value="${u[0]}" label="${esc(u[1])}">`).join('');
  $('#fundList').innerHTML = syms.filter(s => S.assets[s].type === 'fon').map(s => `<option value="${esc(s)}">`).join('');
}
function kpis(P, title) {
  const open = P.pos.filter(p => p.qty > 0), up = P.cost ? P.unreal / P.cost : null, R = realNow(P);
  const real = !R ? `<div class="kpi"><span class="sm mut">Açık maliyet</span><b>${fm(P.cost)}</b><span class="sm mut">komisyon dahil</span></div>`
    : R.missing ? `<div class="kpi"><span class="sm mut">Enflasyona göre K/Z</span><b class="mut">—</b><span class="sm mut">${R.missing} varlıkta güncel fiyat eksik</span></div>`
    : `<div class="kpi"><span class="sm mut">Enflasyona göre K/Z</span><b class="${cls(R.real)}">${fm(R.real)}</b><span class="sm ${cls(R.real)}">${fpct(R.real / R.rcost)} · ${esc(cpiLabel())}'e kadar TÜFE</span></div>`;
  return `<div class="kpi"><span class="sm mut">${title}</span><b>${fm(P.value, 2)}</b><span class="sm mut">${open.length} açık pozisyon${P.missing ? ` · ${P.missing} varlıkta güncel fiyat yok, maliyetten sayıldı` : ''}</span></div>
    <div class="kpi"><span class="sm mut">Gerçekleşmemiş K/Z</span><b class="${P.missing ? 'mut' : cls(P.unreal)}">${P.missing && P.missing === open.length ? '—' : fm(P.unreal)}</b><span class="sm ${cls(up)}">${P.missing === open.length ? 'güncel fiyat gerekli' : fpct(up)}</span></div>
    ${real}
    <div class="kpi"><span class="sm mut">${P.realized ? 'Gerçekleşen K/Z' : 'Yatırılan (açık)'}</span><b class="${P.realized ? cls(P.realized) : ''}">${fm(P.realized || P.cost)}</b><span class="sm mut">${P.realized ? 'satışlardan' : 'komisyon dahil maliyet'}</span></div>`;
}

/* ---------------- Ana sayfa: yekün + haberler ---------------- */
function priceFn(sym) {
  const a = S.assets[sym] || {}, pts = [], est = !(a.px && a.px.length > 1);
  if (!est) a.px.forEach(r => pts.push([r[0], r[4]]));
  else Object.values(S.txns).filter(t => t.sym === sym).forEach(t => pts.push([t.d, +t.price]));
  const L = lastOf(a); if (L.v != null && L.d) pts.push([L.d, L.v]);
  pts.sort((x, y) => x[0].localeCompare(y[0]));
  const ts = pts.map(p => Date.parse(p[0])), vs = pts.map(p => p[1]);
  return { est, noPrice: L.v == null && !(a.px && a.px.length), f: d => { const t = Date.parse(d); if (!ts.length) return null; if (t <= ts[0]) return vs[0]; if (t >= ts[ts.length - 1]) return vs[vs.length - 1]; let i = 1; while (ts[i] < t) i++; const k = (t - ts[i - 1]) / ((ts[i] - ts[i - 1]) || 1); return vs[i - 1] + k * (vs[i] - vs[i - 1]); } };
}
const prevYm = ym => { let [y, m] = ym.split('-').map(Number); m--; if (!m) { m = 12; y--; } return `${y}-${pad(m)}`; };
function totalSeries() {
  const tx = Object.values(S.txns).filter(t => t.d).sort((a, b) => a.d.localeCompare(b.d));
  if (!tx.length) return null;
  const end = today(), set = new Set(tx.map(t => t.d)); set.add(end);
  for (let d = new Date(tx[0].d + 'T00:00:00Z'); ; d.setUTCDate(d.getUTCDate() + 7)) { const s = d.toISOString().slice(0, 10); if (s > end) break; set.add(s); }
  const D = [...set].sort(), PF = {}, qty = {}, costS = {}, lots = [], hasCpi = C.cpiMonths(S.cpi).length > 0, out = [];
  const TY = {};
  for (const s of new Set(tx.map(t => t.sym))) { PF[s] = priceFn(s); TY[s] = S.assets[s]?.type || guessType(s); }
  let inv = 0, k = 0;
  for (const dd of D) {
    while (k < tx.length && tx[k].d <= dd) {
      const t = tx[k++], amt = +t.qty * +t.price, sgn = t.side === 'AL' ? 1 : -1, net = amt + sgn * (+t.fee || 0);
      const q0 = qty[t.sym] || 0, c0 = costS[t.sym] || 0;
      costS[t.sym] = sgn > 0 ? c0 + net : (q0 > 0 ? c0 * Math.max(0, 1 - (+t.qty) / q0) : 0);
      qty[t.sym] = q0 + sgn * +t.qty; inv += sgn * net; lots.push({ d: t.d, a: sgn * net });
    }
    let val = 0; const byT = {};
    for (const [s, q] of Object.entries(qty)) if (q > 0) { const v = PF[s].noPrice ? (costS[s] || 0) : q * (PF[s].f(dd) || 0); val += v; const ty = TY[s]; byT[ty] = (byT[ty] || 0) + v; }
    let need = null;
    if (hasCpi) { const upTo = +dd.slice(8, 10) > 15 ? dd.slice(0, 7) : prevYm(dd.slice(0, 7)); need = lots.reduce((s, l) => s + l.a * (C.cpiFactor(S.cpi, l.d, upTo) ?? 1), 0); }
    out.push({ d: dd, val, inv, need, byT });
  }
  return { pts: out, est: Object.values(PF).some(p => p.est) };
}
function drawTotal(fig, ser) {
  const svg = fig.querySelector('svg'), tip = fig.querySelector('.tip');
  const from = new Date(Date.now() - totRange * 864e5).toISOString().slice(0, 10);
  const P = ser.pts.filter(p => p.d >= from); if (P.length < 2) { svg.innerHTML = ''; return; }
  let geo = null;
  observe(svg, () => {
    const W = svg.clientWidth, H = svg.clientHeight; if (!W || !H) return;
    const nar = W < 520, L = nar ? 50 : 66, R = nar ? 84 : 118, T = 12, Bm = 26, iw = W - L - R, ih = H - T - Bm;
    let lo = Infinity, hi = -Infinity; for (const p of P) for (const v of [p.val, p.inv, p.need]) if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    lo = Math.max(0, lo - (hi - lo) * .06); hi += (hi - lo) * .06;
    const t0 = Date.parse(P[0].d), t1 = Date.parse(P[P.length - 1].d), X = d => L + (Date.parse(d) - t0) / ((t1 - t0) || 1) * iw, Y = v => T + (hi - v) / ((hi - lo) || 1) * ih;
    const line = k => P.filter(p => p[k] != null).map((p, i) => (i ? 'L' : 'M') + X(p.d).toFixed(1) + ' ' + Y(p[k]).toFixed(1)).join('');
    const step = P.map((p, i) => i ? `H${X(p.d).toFixed(1)}V${Y(p.inv).toFixed(1)}` : `M${X(p.d).toFixed(1)} ${Y(p.inv).toFixed(1)}`).join('');
    let g = '';
    for (const v of ticks(lo, hi, nar ? 4 : 5)) g += `<line x1="${L}" x2="${L + iw}" y1="${Y(v)}" y2="${Y(v)}" stroke="${COL.line}"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="12" fill="${COL.mut}">${esc(Math.abs(v) >= 1e6 ? fmt(v / 1e6, 2) + ' mn' : fmt(v / 1e3, 0) + ' bin')}</text>`;
    const nT = Math.max(2, Math.floor(iw / (nar ? 80 : 110))), every = Math.max(1, Math.ceil(P.length / nT));
    for (let i = 0; i < P.length; i += every) g += `<text x="${X(P[i].d)}" y="${H - 7}" text-anchor="middle" font-size="12" fill="${COL.mut}">${esc(dshort(P[i].d))}</text>`;
    g += `<path d="${line('val')}L${X(P[P.length - 1].d)} ${T + ih}L${X(P[0].d)} ${T + ih}Z" fill="var(--y)" opacity=".28"/>`;
    g += `<path d="${step}" fill="none" stroke="${COL.mut}" stroke-width="1.5"/>`;
    if (P.some(p => p.need != null)) g += `<path d="${line('need')}" fill="none" stroke="${COL.s200}" stroke-width="2" stroke-dasharray="6 4"/>`;
    g += `<path d="${line('val')}" fill="none" stroke="${COL.ink}" stroke-width="2.2" stroke-linejoin="round"/>`;
    const last = P[P.length - 1], labs = [{ v: last.val, l: fbig(last.val), bg: COL.ink, fg: 'var(--bg)' }, { v: last.inv, l: 'Yat. ' + fbig(last.inv), fg: COL.mut }];
    if (last.need != null) labs.push({ v: last.need, l: 'Gereken ' + fbig(last.need), fg: COL.s200 });
    labs.forEach(o => o.y = Y(o.v)); labs.sort((a, b) => a.y - b.y);
    for (let i = 1; i < labs.length; i++) labs[i].y = Math.max(labs[i].y, labs[i - 1].y + 18);
    const over = labs[labs.length - 1].y - (T + ih); if (over > 0) labs.forEach(o => o.y -= over);
    for (const o of labs) g += (o.bg ? `<rect x="${L + iw + 4}" y="${o.y - 10}" width="${R - 6}" height="19" rx="4" fill="${o.bg}"/>` : '') + `<text x="${L + iw + 9}" y="${o.y + 4}" font-size="12" font-weight="700" fill="${o.fg}">${esc(nar ? o.l.replace('Gereken ', 'G ').replace('Yat. ', 'Y ') : o.l)}</text>`;
    g += `<g id="hvT"></g>`;
    svg.innerHTML = g; geo = { L, iw, T, ih, X, Y, W, t0, t1 };
  });
  svg.onmousemove = e => {
    if (!geo) return; const r = svg.getBoundingClientRect(), x = e.clientX - r.left;
    if (x < geo.L || x > geo.L + geo.iw) { tip.style.display = 'none'; return; }
    const t = geo.t0 + (x - geo.L) / geo.iw * (geo.t1 - geo.t0); let p = P[0]; for (const q of P) if (Math.abs(Date.parse(q.d) - t) < Math.abs(Date.parse(p.d) - t)) p = q;
    svg.querySelector('#hvT').innerHTML = `<line x1="${geo.X(p.d)}" x2="${geo.X(p.d)}" y1="${geo.T}" y2="${geo.T + geo.ih}" stroke="${COL.mut}" stroke-dasharray="2 3"/><circle cx="${geo.X(p.d)}" cy="${geo.Y(p.val)}" r="4" fill="${COL.ink}"/>`;
    tip.innerHTML = `<b>${esc(dtr(p.d))}</b><br>Değer ${esc(fm(p.val))}<br><span class="mut">Yatırılan ${esc(fm(p.inv))}</span>${p.need != null ? `<br><span style="color:var(--cpi)">Gereken ${esc(fm(p.need))}</span><br>Enflasyona göre <b class="${cls(p.val - p.need)}">${esc(fm(p.val - p.need))}</b>` : ''}`;
    tip.style.display = 'block'; const tw = tip.offsetWidth; tip.style.left = (x + 14 + tw > geo.W ? x - tw - 14 : x + 14) + 'px'; tip.style.top = '10px';
  };
  svg.onmouseleave = () => { tip.style.display = 'none'; const h = svg.querySelector('#hvT'); if (h) h.innerHTML = ''; };
}
const GUN = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const dgun = iso => { const d = new Date(iso + 'T12:00:00Z'); return `${+iso.slice(8, 10)} ${AYLAR[+iso.slice(5, 7) - 1]} ${GUN[d.getUTCDay()]}`; };
const kapIdx = n => n.idx || ((/kap\.org\.tr\/tr\/Bildirim\/(\d+)/.exec(n.u || '') || [])[1]) || null;
const nlink = n => DESK && n.kat === 'kap' && kapIdx(n) ? `<a href="#" data-det="${esc(kapIdx(n))}" data-u="${esc(n.u || '')}">${esc(n.t)}</a>`
  : /^https:\/\//.test(n.u || '') ? `<a href="${esc(n.u)}" target="_blank" rel="noopener">${esc(n.t)}</a>` : esc(n.t);
function rGundem() {
  const t = today(), M = (S.news || []).filter(n => n && n.t && n.d && n.kat === 'makro');
  const yak = M.filter(n => n.d >= t).sort((a, b) => a.d.localeCompare(b.d)).slice(0, 6);
  const son = M.filter(n => n.d < t).sort((a, b) => b.d.localeCompare(a.d)).slice(0, 6);
  const row = n => `<div class="gi"><span class="d">${esc(dgun(n.d))}</span><div>${nlink(n)}${n.s ? `<div class="s">${esc(n.s)}</div>` : ''}</div></div>`;
  $('#gYak').innerHTML = yak.length ? yak.map(row).join('') : '<p class="sm mut">Takvimde yaklaşan önemli karar yok.</p>';
  $('#gSon').innerHTML = son.length ? son.map(row).join('') : '<p class="sm mut">Henüz kayıt yok.</p>';
}
const KAP_TIP = { bilanco: 'Bilanço', anlasma: 'Anlaşma', temettu: 'Temettü', pdr: 'Portföy raporu', fon: 'Fon bildirimi', bildirim: 'Bildirim' };
function rSinifNews(type) {
  const syms = new Set(Object.values(S.assets).filter(a => a.type === type).map(a => a.sym));
  const L = (S.news || []).filter(n => n && n.t && n.d && n.kat === 'kap' && (n.ilgili || []).some(s => syms.has(s))).sort((a, b) => b.d.localeCompare(a.d)).slice(0, 20);
  $('#sNews').innerHTML = L.length ? `<div class="card" style="padding-block:6px">${L.map(n => `<div class="gi"><span class="d">${esc(dtr(n.d))}</span><div><span class="k">${esc((n.ilgili || []).filter(s => syms.has(s)).join(', '))} · ${esc(KAP_TIP[n.tip] || 'Bildirim')}</span>${nlink(n)}</div></div>`).join('')}</div>`
    : `<div class="empty">${type === 'hisse' ? 'Hisselerinin KAP bildirimleri (bilanço, anlaşma, temettü) burada listelenecek.' : type === 'fon' ? 'Fonlarının KAP bildirimleri (portföy dağılım raporu, izahname değişikliği, genel açıklamalar) bir sonraki güncellemede burada listelenecek.' : 'Bu sınıf için bildirim yok.'}</div>`;
}
function rAna() {
  clearRO();
  const P = portfolio(), open = P.pos.filter(p => p.qty > 0);
  $('#kpis').innerHTML = kpis(P, 'Portföy değeri');
  document.querySelectorAll('#totRng button').forEach(b => b.classList.toggle('on', +b.dataset.r === totRange));
  const ser = totalSeries();
  if (ser) drawTotal($('#fTot'), ser); else $('#fTot svg').innerHTML = '';
  const miss = open.filter(p => p.missing).map(p => p.sym);
  $('#totNote').innerHTML = !ser ? 'İşlem girildiğinde portföyün zaman içindeki değeri burada çizilir.' :
    [ser.est ? 'Fiyat geçmişi yüklenmemiş varlıklarda değer çizgisi alış fiyatları ve son girilen fiyat arasında tahmini çizildi.' : '',
     miss.length ? `${miss.length} varlıkta güncel fiyat yok (${miss.map(esc).join(', ')}); grafikte ve toplamda maliyetinden sayıldı.` : '',
     C.cpiMonths(S.cpi).length ? `"Gereken" çizgisi: yatırdığın her tutarın ${esc(cpiLabel())}'e kadarki TÜFE ile büyütülmüş hali.` : ''].filter(Boolean).join(' ');
  const byT = {}; open.forEach(p => byT[p.type] = (byT[p.type] || 0) + p.value);
  const ent = Object.entries(byT).sort((a, b) => b[1] - a[1]);
  $('#clsBar').innerHTML = P.value ? `<div class="stk" role="img" aria-label="Varlık sınıfı dağılımı">${ent.map(([k, v]) => `<i style="width:${(v / P.value * 100).toFixed(2)}%;background:${CLS_COL[k] || 'var(--mut)'}"></i>`).join('')}</div>
    <div class="lgd">${ent.map(([k, v]) => `<a href="#${CLS_HASH[k] || 'ana'}"><i style="background:${CLS_COL[k] || 'var(--mut)'}"></i>${CLS_AD[k] || esc(k)} <b>%${fmt(v / P.value * 100, 1)}</b> <span class="mut">${fm(v)}</span></a>`).join('')}</div>` : '';
  rMini(P, open, ser);
  rDikkat();
  rGundem();
}
function rMini(P, open, ser) {
  const from = new Date(Date.now() - totRange * 864e5).toISOString().slice(0, 10);
  const pts = ser ? ser.pts.filter(p => p.d >= from) : [];
  const cards = ['fon', 'hisse', 'emtia', 'coin'].map(k => {
    const ps = open.filter(p => p.type === k); if (!ps.length) return '';
    const v = ps.reduce((s, p) => s + p.value, 0), c = ps.reduce((s, p) => s + p.cost, 0), pl = v - c, pc = c ? pl / c : null;
    const ys = pts.map(p => (p.byT && p.byT[k]) || 0);
    let path = '';
    if (ys.length > 1) {
      const lo = Math.min(...ys), hi = Math.max(...ys), sp = hi - lo || 1;
      path = ys.map((y, i) => `${i ? 'L' : 'M'}${(i / (ys.length - 1) * 100).toFixed(2)},${(44 - (y - lo) / sp * 40).toFixed(2)}`).join(' ');
    }
    return `<a class="mc" href="#${CLS_HASH[k]}"><div class="h"><span class="sm">${CLS_AD[k]}</span><span class="xs mut">%${fmt(P.value ? v / P.value * 100 : 0, 1)}</span></div>
      <div class="h" style="margin-top:4px"><b>${fm(v)}</b><span class="sm ${cls(pl)}">${pc != null ? fpct(pc) : ''}</span></div>
      ${path ? `<svg viewBox="0 0 100 46" preserveAspectRatio="none" role="img" aria-label="${CLS_AD[k]} değer grafiği"><path d="${path}" fill="none" stroke="${CLS_COL[k]}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>` : '<svg viewBox="0 0 100 46"></svg>'}</a>`;
  }).join('');
  $('#clsMini').innerHTML = cards;
  $('#clsMini').hidden = !cards;
}
$('#totRng').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { totRange = +b.dataset.r; render(); } });

/* ---------------- Varlık sınıfı sekmesi ---------------- */
function rGold(type) {
  const box = $('#goldCard'); box.hidden = type !== 'emtia'; if (box.hidden) return;
  const mine = Object.values(S.assets).filter(a => GOLD_SET.has(a.sym) && a.sym !== 'GUMUS');
  box.innerHTML = `<h3>Fiziki altın</h3>
    <p class="sm mut" style="margin-top:0">İşlem eklerken sembol olarak birimi yaz: ${GOLD_UNITS.map(u => `<b>${u[0]}</b>`).join(', ')}. Fiyat, gram has altından birimin içerdiği saf altına göre hesaplanır (22 ayar = 0,916). Kuyumcu makası ve işçilik dahil değildir; aşağıdan her birime prim ekleyebilirsin.</p>
    ${mine.length ? `<div class="scroll"><table><thead><tr><th>Birim</th><th class="n">Hesaplanan fiyat</th><th class="n">Prim (%)</th></tr></thead><tbody>${mine.map(a => `<tr><td><b>${esc(a.sym)}</b> <span class="xs mut">${esc(a.name || '')}</span></td><td class="n">${fp(lastOf(a).v)}</td><td class="n"><input class="sm" style="width:80px;text-align:right" inputmode="decimal" data-prem="${esc(a.sym)}" value="${a.prem ? esc(String(a.prem).replace('.', ',')) : ''}" placeholder="0"></td></tr>`).join('')}</tbody></table></div><p class="xs mut" style="margin:8px 0 0">Prim değişince fiyat geçmişi bir sonraki güncellemede yeniden hesaplanır.</p>` : ''}`;
  box.querySelectorAll('[data-prem]').forEach(i => i.addEventListener('change', async () => {
    const x = ensureAsset(i.dataset.prem), v = C.num(i.value); x.prem = isFinite(v) ? v : 0; x.px = []; await putAsset(x);
    if (DESK) pRefresh([x.sym]).catch(() => { }); toast(`${x.sym} primi %${fmt(x.prem, 2)} olarak kaydedildi.`);
  }));
}
/* ---------- Plan ve risk ---------- */
const CLASSES = ['fon', 'hisse', 'emtia', 'coin'];
const dayDiff = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;
function xirr(flows) {             // flows: [{d, a}] a<0 yatırılan, a>0 alınan (son değer dahil)
  const F = flows.filter(f => f.d && isFinite(f.a) && f.a !== 0); if (F.length < 2 || !F.some(f => f.a < 0) || !F.some(f => f.a > 0)) return null;
  const d0 = F.reduce((m, f) => f.d < m ? f.d : m, F[0].d), t = F.map(f => dayDiff(d0, f.d) / 365);
  const npv = r => F.reduce((s, f, i) => s + f.a / Math.pow(1 + r, t[i]), 0);
  let lo = -0.99, hi = 10, flo = npv(lo), fhi = npv(hi); if (flo * fhi > 0) return null;
  for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2, fm = npv(m); if (Math.abs(fm) < 1e-6) return m; if (flo * fm < 0) { hi = m; fhi = fm; } else { lo = m; flo = fm; } }
  return (lo + hi) / 2;
}
function at(series, d) {           // [[tarih, kapanış]] içinde d gününe kadarki son değer
  if (!series || !series.length) return null; if (d <= series[0][0]) return series[0][1];
  let lo = 0, hi = series.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (series[m][0] <= d) lo = m; else hi = m - 1; } return series[lo][1];
}
function txFlows() { return Object.values(S.txns).filter(t => t.d).map(t => ({ d: t.d, a: t.side === 'AL' ? -(+t.qty * +t.price + (+t.fee || 0)) : (+t.qty * +t.price - (+t.fee || 0)) })); }
function benchmarks() {
  const P = portfolio(), F = txFlows(), td = today(); if (!F.length) return null;
  const rows = [{ k: 'Senin portföyün', v: P.value, x: xirr([...F, { d: td, a: P.value }]), me: 1 }];
  const B = S.bench || {};
  for (const [k, ser] of [['Dolar (USD/TL)', B.usd], ['Gram altın', B.gold], ['BIST 100', B.xu100]]) {
    if (!ser || !ser.length) { rows.push({ k, na: 1 }); continue; }
    let u = 0; for (const f of F) { const p = at(ser, f.d); if (p) u += -f.a / p; }
    const v = u * at(ser, td); rows.push({ k, v, x: xirr([...F, { d: td, a: v }]) });
  }
  const r = (C.num(S.settings.depRate) || 36) / 100;
  const dep = F.reduce((s, f) => s + -f.a * Math.pow(1 + r, dayDiff(f.d, td) / 365), 0);
  rows.push({ k: `Mevduat (net %${fmt(r * 100, 1)})`, v: dep, x: xirr([...F, { d: td, a: dep }]) });
  const ser = totalSeries(), last = ser && ser.pts[ser.pts.length - 1];
  if (last && last.need) rows.push({ k: 'Enflasyon (TÜFE)', v: last.need, x: xirr([...F, { d: td, a: last.need }]), cpi: 1 });
  return { rows, P };
}
function rBench() {
  const b = benchmarks();
  $('#bmAt').textContent = S.bench && S.bench.at ? '· seriler ' + new Date(S.bench.at).toLocaleDateString('tr-TR') : '';
  if (!b) { $('#bmTable').innerHTML = '<tbody><tr><td class="mut">İşlem girildiğinde hesaplanır.</td></tr></tbody>'; return; }
  const me = b.rows[0];
  $('#bmTable').innerHTML = `<thead><tr><th>Aynı alımlar şuraya yapılsaydı</th><th class="n">Bugünkü değer</th><th class="n">Yıllık getiri (XIRR)</th><th class="n">Seninkiyle fark</th></tr></thead><tbody>${b.rows.map(r => r.na ? `<tr><td>${esc(r.k)}</td><td colspan="3" class="mut sm">seri henüz çekilmedi (bir sonraki tam güncellemede gelir)</td></tr>` :
    `<tr${r.me ? ' style="font-weight:700"' : ''}><td>${esc(r.k)}</td><td class="n">${fm(r.v)}</td><td class="n">${r.x != null ? fpct(r.x) : '—'}</td><td class="n">${r.me ? '' : `<span class="${cls(me.v - r.v)}">${fm(me.v - r.v)}</span>`}</td></tr>`).join('')}</tbody>`;
  const best = b.rows.filter(r => !r.me && !r.na && !r.cpi).sort((x, y) => y.v - x.v)[0];
  $('#bmNote').innerHTML = best ? (me.v >= best.v ? 'Portföyün bu dönemde karşılaştırılan seçeneklerin hepsinden iyi gitmiş.' : `Bu dönemde en iyi seçenek <b>${esc(best.k)}</b> olurdu. Kısa dönem karşılaştırmalar yanıltıcı olabilir; anlamlı sonuç için en az 2–3 yıla bak.`) + ' Komisyonlar dahil, vergiler hariç.' : '';
}
const targets = () => ({ fon: 0, hisse: 0, emtia: 0, coin: 0, ...(S.settings.targets || {}) });
function dcaPlan(P, amount) {      // satış yapmadan, yeni parayı hedefe en çok yaklaştıracak şekilde dağıt
  const T = targets(), tsum = CLASSES.reduce((s, k) => s + (+T[k] || 0), 0); if (!(tsum > 0) || !(amount > 0)) return null;
  const V = {}; CLASSES.forEach(k => V[k] = 0); P.pos.filter(p => p.qty > 0).forEach(p => { if (V[p.type] != null) V[p.type] += p.value; });
  const tot = Object.values(V).reduce((a, b) => a + b, 0) + amount;
  const need = {}; CLASSES.forEach(k => need[k] = Math.max(0, tot * (+T[k] || 0) / tsum - V[k]));
  const ns = Object.values(need).reduce((a, b) => a + b, 0), out = {};
  CLASSES.forEach(k => out[k] = ns > 0 ? amount * need[k] / ns : amount * (+T[k] || 0) / tsum);
  return { out, V, tot, T, tsum };
}
function rTargets() {
  const P = portfolio(), T = targets(), tsum = CLASSES.reduce((s, k) => s + (+T[k] || 0), 0);
  $('#tgForm').innerHTML = CLASSES.map(k => `<div><label for="tg_${k}">${CLS_AD[k]} %</label><input id="tg_${k}" data-tg="${k}" inputmode="decimal" style="width:90px" value="${T[k] ? esc(String(T[k]).replace('.', ',')) : ''}" placeholder="0"></div>`).join('') +
    `<div><label for="tgMon">Aylık alım tutarı (TL)</label><input id="tgMon" inputmode="decimal" style="width:150px" value="${S.settings.monthly ? esc(String(S.settings.monthly)) : ''}" placeholder="ör. 20000"></div><div><label for="dcaDay">Alım günü (ayın kaçı)</label><input id="dcaDay" inputmode="numeric" style="width:90px" value="${S.settings.dcaDay ? esc(String(S.settings.dcaDay)) : ''}" placeholder="ör. 5"></div><span class="xs ${Math.abs(tsum - 100) > .01 && tsum ? 'dn' : 'mut'}">Toplam %${fmt(tsum, 0)}</span>`;
  const V = {}; CLASSES.forEach(k => V[k] = 0); P.pos.filter(p => p.qty > 0).forEach(p => { if (V[p.type] != null) V[p.type] += p.value; });
  const tot = Object.values(V).reduce((a, b) => a + b, 0);
  $('#tgTable').innerHTML = !tot ? '' : `<thead><tr><th>Sınıf</th><th class="n">Bugün</th><th class="n">Şu anki pay</th><th class="n">Hedef</th><th class="n">Sapma</th><th class="n">Hedefe göre fark</th></tr></thead><tbody>${CLASSES.map(k => {
    const w = V[k] / tot, t = tsum ? (+T[k] || 0) / tsum : null, dv = t != null ? t * tot - V[k] : null;
    return `<tr><td>${CLS_AD[k]}</td><td class="n">${fm(V[k])}</td><td class="n">%${fmt(w * 100, 1)}</td><td class="n">${t != null ? '%' + fmt(t * 100, 1) : '—'}</td><td class="n">${t != null ? `<span class="${Math.abs(w - t) > .05 ? 'dn' : 'mut'}">${(w - t >= 0 ? '+' : '−') + fmt(Math.abs(w - t) * 100, 1)} puan</span>` : '—'}</td><td class="n">${dv != null ? (dv >= 0 ? `${fm(dv)} eksik` : `${fm(-dv)} fazla`) : '—'}</td></tr>`;
  }).join('')}</tbody>`;
  const plan = dcaPlan(P, C.num(S.settings.monthly));
  if (!plan) { $('#dcaBox').innerHTML = `<p class="sm mut">${tsum ? 'Aylık tutarı girince öneri burada çıkar.' : 'Önce hedef yüzdelerini gir.'}</p>`; return; }
  // sınıf içinde mevcut ağırlıkla dağıt
  const lines = [];
  for (const k of CLASSES) {
    const amt = plan.out[k]; if (amt < 1) continue;
    const ps = P.pos.filter(p => p.qty > 0 && p.type === k), sv = ps.reduce((s, p) => s + p.value, 0);
    const sub = ps.length ? ps.sort((a, b) => b.value - a.value).map(p => `${esc(p.sym)} ${fm(amt * p.value / sv)}${p.last ? ` <span class="xs mut">(~${fmt(amt * p.value / sv / p.last, p.last > 100 ? 2 : 0)} adet)</span>` : ''}${assetHint(p.sym)}`).join(' · ') : '<span class="mut">bu sınıfta pozisyonun yok; seçtiğin bir varlığa</span>';
    lines.push(`<tr><td><b>${CLS_AD[k]}</b></td><td class="n"><b>${fm(amt)}</b></td><td class="sm">${sub}</td></tr>`);
  }
  $('#dcaBox').innerHTML = `<h3>Bu ayki ${fm(C.num(S.settings.monthly))} için öneri</h3><div class="scroll"><table><tbody>${lines.join('')}</tbody></table></div><p class="xs mut" style="margin:8px 0 0">Önce hedefin en çok altında kalan sınıflara para gider; sınıf içinde şimdiki ağırlıklarına göre bölünür. Kendi tercihine göre değiştirebilirsin. Parantez içindeki uyarılar (sinyal SAT, ısınmış) o varlığa bu ay daha az ayırmayı düşünmen içindir; düzenli alımda asıl önemli olan aksatmamaktır.</p>${(() => { const d = dcaStatus(); if (!d) return ''; return `<div class="note" style="margin-top:12px"><b>${AYADI[+today().slice(5, 7) - 1]} durumu:</b> ${d.done > 0 ? `bu ay ${fm(d.done)} alım girdin${d.left > 0 ? `, ${fm(d.left)} kaldı` : ' <span class="up">✓ hedef tamam</span>'}` : 'bu ay henüz alım girmedin'}. Son 11 ayın ${d.hit}'inde alım yaptın${d.streak > 1 ? ` (üst üste ${d.streak} ay)` : ''}.${d.day ? ` Alım günün ayın ${d.day}'i${d.due ? ' — <b>bugün ya da geçti</b>' : ''}.` : ' Alım gününü yazarsan ana sayfada hatırlatırım.'}</div>`; })()}`;
}
function riskData() {
  const { P, lt } = lookThroughNow(); if (!P.value) return null;
  const R = lt.rows, total = lt.total || 1;
  const sum = f => R.filter(f).reduce((s, r) => s + r.total, 0);
  const usEq = sum(r => r.cat === 'Hisse · yurt dışı'), trEq = sum(r => /^Hisse/.test(r.cat) && r.cat !== 'Hisse · yurt dışı'),
    gold = sum(r => /Altın/.test(r.cat)), crypto = sum(r => r.cat === 'Kripto'),
    fx = sum(r => (r.cc && r.cc !== 'TR') || /Altın/.test(r.cat) || r.cat === 'Kripto');
  const warns = [];
  for (const r of R) if (r.key !== 'DIGER' && !/Nakit|Borçlanma/.test(r.cat) && r.w > .10) warns.push(`<b>${esc(r.name || r.key)}</b> portföyünün %${fmt(r.w * 100, 1)}'i${Object.keys(r.via || {}).length > 1 ? ` (${Object.keys(r.via).length} fon üzerinden)` : ''}. Tek varlıkta %10'u aşan pay, o varlıktaki bir düşüşü büyütür.`);
  if (fx / total > .7) warns.push(`Portföyünün <b>%${fmt(fx / total * 100, 0)}</b>'i TL dışı (yabancı hisse, altın, kripto, döviz). TL güçlenirse ya da yurt dışı piyasalar düşerse etkisi büyük olur.`);
  const held = P.pos.filter(p => p.qty > 0 && S.assets[p.sym]?.type === 'fon' && C.latestHold(S.assets[p.sym])).map(p => p.sym);
  for (let i = 0; i < held.length; i++) for (let j = i + 1; j < held.length; j++) { const o = C.overlap(C.latestHold(S.assets[held[i]]), C.latestHold(S.assets[held[j]])); if (o > .5) warns.push(`<b>${esc(held[i])}</b> ile <b>${esc(held[j])}</b> fonlarının içeriği %${fmt(o * 100, 0)} aynı; ikisini birden tutmak çeşitlendirme sağlamıyor.`); }
  const T = targets(), tsum = CLASSES.reduce((s, k) => s + (+T[k] || 0), 0);
  if (tsum) { const V = {}; CLASSES.forEach(k => V[k] = 0); P.pos.filter(p => p.qty > 0).forEach(p => { if (V[p.type] != null) V[p.type] += p.value; }); for (const k of CLASSES) { const d = V[k] / P.value - (+T[k] || 0) / tsum; if (Math.abs(d) > .05) warns.push(`<b>${CLS_AD[k]}</b> hedefinden ${fmt(Math.abs(d) * 100, 1)} puan ${d > 0 ? 'fazla' : 'eksik'}.`); } }
  // zaman ağırlıklı getiri endeksi: en kötü düşüş ve oynaklık
  const ser = totalSeries(); let mdd = null, vol = null, ddFrom = null, ddTo = null;
  if (ser && ser.pts.length > 10) {
    const pts = ser.pts; let idx = 1, peak = 1, peakD = pts[0].d; const rs = [], gaps = []; mdd = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i]; if (!(a.val > 0)) continue;
      const flow = b.inv - a.inv, r = (b.val - flow) / a.val - 1; if (!isFinite(r) || Math.abs(r) > .8) continue;
      idx *= 1 + r; rs.push(r); gaps.push(Math.max(1, dayDiff(a.d, b.d)));
      if (idx > peak) { peak = idx; peakD = b.d; } const dd = idx / peak - 1; if (dd < mdd) { mdd = dd; ddFrom = peakD; ddTo = b.d; }
    }
    if (rs.length <= 5) { mdd = null; ddFrom = null; }
    if (rs.length > 5) { const m = rs.reduce((s, x) => s + x, 0) / rs.length, sd = Math.sqrt(rs.reduce((s, x) => s + (x - m) ** 2, 0) / (rs.length - 1)), g = gaps.reduce((s, x) => s + x, 0) / gaps.length; vol = sd / Math.sqrt(g / 365); }
  }
  const top = R.filter(r => r.key !== 'DIGER')[0];
  return { P, total, usEq, trEq, gold, crypto, fx, warns, mdd, vol, ddFrom, ddTo, top };
}
function rRisk() {
  const d = riskData();
  if (!d) { $('#riskWarn').innerHTML = '<p class="sm mut">Pozisyon girildiğinde hesaplanır.</p>'; $('#riskStats').innerHTML = ''; $('#scTable').innerHTML = ''; return; }
  $('#riskWarn').innerHTML = d.warns.length ? `<ul style="margin:0;padding-left:20px">${d.warns.map(w => `<li class="sm" style="margin-bottom:6px">${w}</li>`).join('')}</ul>` : '<p class="sm up">Belirgin bir yoğunlaşma uyarısı yok.</p>';
  const card = (t, v, s) => `<div class="kpi" style="background:var(--soft);border-radius:10px;padding:14px 16px"><div class="xs mut">${t}</div><b>${v}</b><div class="xs mut">${s}</div></div>`;
  $('#riskStats').innerHTML = [
    card('En kötü düşüş', d.mdd != null ? fpct(d.mdd) : '—', d.ddFrom ? `${dtr(d.ddFrom)} → ${dtr(d.ddTo)} (alımlar hariç)` : 'yeterli geçmiş yok'),
    card('Yıllık oynaklık', d.vol != null ? '%' + fmt(d.vol * 100, 0) : '—', 'değerin yılda tipik dalgalanması'),
    card('TL dışı varlık', '%' + fmt(d.fx / d.total * 100, 0), 'yabancı hisse, altın, kripto, döviz'),
    card('En büyük tek varlık', d.top ? '%' + fmt(d.top.w * 100, 1) : '—', d.top ? esc(d.top.name || d.top.key) : '')].join('');
  const sc = [
    ['Yurt dışı hisseler %30 düşer (dolar bazında)', d.usEq, -.30],
    ['Dolar/TL %20 yükselir', d.fx, .20],
    ['Kriz: yurt dışı hisse −%30, dolar/TL +%20 birlikte', null, null, d.usEq * (.7 * 1.2 - 1) + (d.fx - d.usEq) * .2],
    ['BIST hisseleri %20 düşer', d.trEq, -.20],
    ['Altın %15 düşer', d.gold, -.15],
    ['Kripto %50 düşer', d.crypto, -.50]].filter(s => (s[1] || 0) > 0 || s[3]);
  $('#scTable').innerHTML = `<thead><tr><th>Senaryo</th><th class="n">Etkilenen tutar</th><th class="n">Tahmini etki</th><th class="n">Portföye etkisi</th></tr></thead><tbody>${sc.map(([t, base, k, imp]) => { const e = imp != null ? imp : base * k; return `<tr><td>${esc(t)}</td><td class="n">${base != null ? fm(base) : '—'}</td><td class="n"><span class="${cls(e)}">${fm(e)}</span></td><td class="n"><span class="${cls(e)}">${fpct(e / d.total)}</span></td></tr>`; }).join('')}</tbody>`;
}
function rTax() {
  const P = portfolio('fon'), L = P.pos.filter(p => p.qty > 0);
  if (!L.length) { $('#taxTable').innerHTML = '<tbody><tr><td class="mut">Fon pozisyonun yok.</td></tr></tbody>'; return; }
  let tv = 0, tt = 0;
  const rows = L.map(p => { const a = S.assets[p.sym] || {}, rate = (C.num(a.stopaj) || 0) / 100, gain = p.value - p.cost, tax = Math.max(0, gain) * rate; tv += p.value; tt += tax; return `<tr><td><b>${esc(p.sym)}</b>${a.rank && a.rank.n ? `<br><span class="xs mut">kategori sırası ${a.rank.k}/${a.rank.n}</span>` : ''}</td><td class="n">${fm(p.value)}</td><td class="n"><span class="${cls(gain)}">${fm(gain)}</span></td><td class="n"><input class="sm" style="width:70px;text-align:right" inputmode="decimal" data-stopaj="${esc(p.sym)}" value="${a.stopaj != null && a.stopaj !== '' ? esc(String(a.stopaj).replace('.', ',')) : ''}" placeholder="0"></td><td class="n">${fm(tax)}</td><td class="n"><b>${fm(p.value - tax)}</b></td></tr>`; });
  $('#taxTable').innerHTML = `<thead><tr><th>Fon</th><th class="n">Değer</th><th class="n">Kazanç</th><th class="n">Stopaj %</th><th class="n">Tahmini vergi</th><th class="n">Net</th></tr></thead><tbody>${rows.join('')}<tr><td><b>Toplam</b></td><td class="n">${fm(tv)}</td><td></td><td></td><td class="n">${fm(tt)}</td><td class="n"><b>${fm(tv - tt)}</b></td></tr></tbody>`;
}
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const dueTx = () => Object.values(S.txns).filter(t => t.rev && t.rev <= today() && !t.revd && (t.note || t.exit));
function rJournal() {
  const L = Object.values(S.txns).filter(t => t.note || t.exit).sort((a, b) => { const da = a.rev && a.rev <= today() && !a.revd, db = b.rev && b.rev <= today() && !b.revd; return (db - da) || b.d.localeCompare(a.d); });
  if (!L.length) { $('#jrBox').innerHTML = '<p class="sm mut">Henüz not yok. İşlem eklerken ya da bir işlemi düzenlerken "Neden?" alanını doldur.</p>'; return; }
  $('#jrBox').innerHTML = L.map(t => {
    const a = S.assets[t.sym], now = a ? lastOf(a).v : null, ch = now && t.price ? now / t.price - 1 : null, due = t.rev && t.rev <= today() && !t.revd;
    return `<div style="border-top:1px solid var(--line);padding:12px 0"><div class="row" style="justify-content:space-between;gap:10px"><div><b>${esc(t.sym)}</b> <span class="sm mut">${t.side === 'AL' ? 'alış' : 'satış'} · ${dtr(t.d)} · ${fp(+t.price)}${ch != null ? ` → bugün ${fp(now)} <span class="${cls(ch)}">${fpct(ch)}</span>` : ''}</span>${due ? ' <span class="chip warn" style="display:inline-flex"><i></i><span>gözden geçirme zamanı</span></span>' : t.revd ? ` <span class="xs mut">gözden geçirildi ${dtr(t.revd)}</span>` : t.rev ? ` <span class="xs mut">gözden geçirme ${dtr(t.rev)}</span>` : ''}</div>
      <div class="row" style="gap:6px">${due ? `<button class="ghost sm" data-revok="${esc(t.id)}">Gözden geçirdim</button><button class="ghost sm" data-revlater="${esc(t.id)}">3 ay sonra</button>` : ''}<button class="ghost sm" data-edit="${esc(t.id)}" data-jr="1">Düzenle</button></div></div>
      ${t.chk && t.chk.length ? `<p class="xs ${t.chk.length >= 4 ? 'up' : 'mut'}" style="margin:4px 0 0">Kontrol listesi ${t.chk.length}/5</p>` : ''}${t.note ? `<p class="sm" style="margin:6px 0 0"><span class="mut">Neden:</span> ${esc(t.note)}</p>` : ''}${t.exit ? `<p class="sm" style="margin:4px 0 0"><span class="mut">Satarım / bakarım:</span> ${esc(t.exit)}</p>` : ''}</div>`;
  }).join('');
}
function rAlarms() {
  const list = Object.values(S.assets).sort((a, b) => a.sym.localeCompare(b.sym));
  $('#alSym').innerHTML = list.map(a => `<option value="${esc(a.sym)}">${esc(a.sym)}${lastOf(a).v ? ' · ' + fp(lastOf(a).v) : ''}</option>`).join('');
  const rows = []; for (const a of list) (a.alarms || []).forEach((x, i) => rows.push({ a, x, i }));
  $('#alTable').innerHTML = !rows.length ? '<tbody><tr><td class="mut sm">Alarm yok.</td></tr></tbody>' : `<thead><tr><th>Varlık</th><th>Koşul</th><th class="n">Seviye</th><th class="n">Şimdi</th><th>Durum</th><th></th></tr></thead><tbody>${rows.map(({ a, x, i }) => `<tr><td><b>${esc(a.sym)}</b></td><td class="sm">${x.dir === 'ust' ? 'üstüne çıkarsa' : 'altına düşerse'}</td><td class="n">${fp(x.px)}</td><td class="n">${lastOf(a).v ? fp(lastOf(a).v) : '—'}</td><td class="sm">${x.fired ? `<span class="up">tetiklendi ${dtr(x.fired)}</span>` : 'bekliyor'}</td><td><button class="ghost sm" data-aldel="${esc(a.sym)}|${i}">Sil</button></td></tr>`).join('')}</tbody>`;
}
function rPlan() { rBench(); rTargets(); rSim(); rDiv(); rRisk(); rJournal(); rAlarms(); $('#depRate').value = S.settings.depRate || ''; }
// ana sayfadaki "dikkat" kutusu
const staleDays = a => { const L = lastOf(a); if (!L.d || a.noAuto) return null; const d = Math.floor(dayDiff(L.d, today())); return d > (a.type === 'coin' ? 2 : 4) ? d : null; };
function rDikkat() {
  const items = [], P = portfolio(), open = P.pos.filter(p => p.qty > 0);
  const st = open.filter(p => S.assets[p.sym] && staleDays(S.assets[p.sym])).map(p => `${esc(p.sym)} (${staleDays(S.assets[p.sym])} gün)`);
  if (st.length) items.push(`Fiyatı eskimiş: ${st.join(', ')}. <a href="#veri">Verileri güncelle</a> ya da fiyatı elle gir.`);
  const man = open.filter(p => S.assets[p.sym]?.noAuto).map(p => esc(p.sym)); if (man.length) items.push(`Otomatik fiyatı olmayan: ${man.join(', ')} — son fiyatı elle güncel tut.`);
  const due = dueTx(); if (due.length) items.push(`${due.length} kararının gözden geçirme zamanı geldi (${[...new Set(due.map(t => esc(t.sym)))].join(', ')}). <a href="#plan">Yatırım günlüğü</a>`);
  const fired = []; Object.values(S.assets).forEach(a => (a.alarms || []).forEach(x => { if (x.fired && dayDiff(x.fired, today()) <= 3) fired.push(`${esc(a.sym)} ${x.dir === 'ust' ? '≥' : '≤'} ${fp(x.px)}`); }));
  if (fired.length) items.push(`Tetiklenen alarm: ${fired.join(', ')}.`);
  try { const d = dcaStatus(); if (d && d.due) items.push(`Aylık alım günün geldi: bu ay ${d.done > 0 ? fm(d.done) + ' alım girdin, ' + fm(d.left) + ' kaldı' : fm(d.mon) + ' alım planın var'}. <a href="#plan">Önerilen dağılım</a>`); } catch (e) { }
  if (+today().slice(8, 10) <= 7 && Object.keys(S.txns).length) items.push(`${AYADI[+prevYm(ymNow()).slice(5) - 1]} ayının raporu hazır. <a href="#rapor">Aylık rapor</a>`);
  try { const up = upcomingAll(); if (up.length) items.push('Yaklaşan: ' + up.slice(0, 5).map(x => `<b>${esc(x.sym)}</b> ${esc(x.t.toLocaleLowerCase('tr-TR'))} ${dtr(x.d)}`).join(' · ') + (up.length > 5 ? ` +${up.length - 5}` : '') + '.'); } catch (e) { }
  try { const r = riskData(); if (r) r.warns.slice(0, 2).forEach(w => items.push(w)); if (r && r.warns.length > 2) items.push(`+${r.warns.length - 2} risk notu daha. <a href="#plan">Plan ve risk</a>`); } catch (e) { }
  $('#dikkat').hidden = !items.length;
  $('#dikkat').innerHTML = items.length ? `<h3 style="margin-top:0">Dikkat</h3><ul style="margin:0;padding-left:20px">${items.map(x => `<li class="sm" style="margin-bottom:6px">${x}</li>`).join('')}</ul>` : '';
}
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset && t.dataset.tg) { S.settings.targets = { ...targets(), [t.dataset.tg]: C.num(t.value) || 0 }; await putSettings(); rTargets(); return; }
  if (t.id === 'dcaDay') { const v = Math.round(C.num(t.value)); S.settings.dcaDay = v >= 1 && v <= 28 ? v : null; await putSettings(); rTargets(); return; }
  if (t.id === 'tgMon') { S.settings.monthly = C.num(t.value) || null; await putSettings(); rTargets(); return; }
  if (t.id === 'depRate') { S.settings.depRate = t.value.trim(); await putSettings(); rBench(); return; }
  if (t.dataset && t.dataset.stopaj) { const a = ensureAsset(t.dataset.stopaj); const v = C.num(t.value); a.stopaj = isFinite(v) ? v : null; await putAsset(a); rTax(); return; }
});
document.addEventListener('click', async e => {
  const ok = e.target.closest('[data-revok]'); if (ok) { const t = S.txns[ok.dataset.revok]; if (t) { await putTx({ ...t, revd: today() }); rJournal(); } return; }
  const lt = e.target.closest('[data-revlater]'); if (lt) { const t = S.txns[lt.dataset.revlater]; if (t) { await putTx({ ...t, rev: addDays(today(), 90) }); rJournal(); toast('3 ay sonra yeniden hatırlatılacak.'); } return; }
  const ad = e.target.closest('[data-aldel]'); if (ad) { const [s, i] = ad.dataset.aldel.split('|'); const a = ensureAsset(s); a.alarms = (a.alarms || []).filter((x, k) => k !== +i); await putAsset(a); rAlarms(); return; }
  const jr = e.target.closest('[data-jr]'); if (jr) { const t = S.txns[jr.dataset.edit]; if (t) location.hash = CLS_HASH[S.assets[t.sym]?.type] || 'fonlar'; setTimeout(() => { const tt = S.txns[jr.dataset.edit]; if (tt) { $('#txHist').open = true; txEditMode(tt); } }, 150); }
});
document.addEventListener('submit', async e => {
  if (e.target.id !== 'alForm') return; e.preventDefault();
  const s = $('#alSym').value, px = C.num($('#alPx').value); if (!s || !(px > 0)) return;
  const a = ensureAsset(s); a.alarms = [...(a.alarms || []), { dir: $('#alDir').value, px, on: true, fired: null, at: today() }]; await putAsset(a);
  $('#alPx').value = ''; rAlarms(); toast(`${s} alarmı eklendi.`);
});
// alarm ve KAP bildirimi kontrolü (masaüstü)
async function checkAlarms() {
  for (const a of Object.values(S.assets)) {
    const v = lastOf(a).v; if (!v || !(a.alarms || []).some(x => x.on)) continue; let ch = false;
    for (const x of a.alarms) if (x.on && ((x.dir === 'ust' && v >= x.px) || (x.dir === 'alt' && v <= x.px))) { x.on = false; x.fired = today(); ch = true; if (DESK) window.pusula.notify(`${a.sym} alarmı`, `${a.sym} ${fp(v)} — ${x.dir === 'ust' ? 'üstüne çıktı' : 'altına düştü'}: ${fp(x.px)}`); }
    if (ch) await putAsset(a);
  }
}
function checkNews() {
  if (!DESK || !S.news) return;
  let seen; try { seen = JSON.parse(localStorage.getItem('gorulenHaber') || 'null'); } catch (e) { seen = null; }
  const ids = S.news.filter(n => n.kat === 'kap').map(n => n.u || n.t);
  if (!seen) { try { localStorage.setItem('gorulenHaber', JSON.stringify(ids.slice(0, 300))); } catch (e) { } return; }
  const held = new Set(C.positions(Object.values(S.txns)).filter(p => p.qty > 0).map(p => p.sym)), set = new Set(seen);
  const fresh = S.news.filter(n => n.kat === 'kap' && !set.has(n.u || n.t) && (n.ilgili || []).some(s => held.has(s)) && dayDiff(n.d, today()) <= 3);
  fresh.slice(0, 3).forEach(n => window.pusula.notify(`KAP · ${(n.ilgili || []).join(', ')}`, String(n.t).slice(0, 180)));
  try { localStorage.setItem('gorulenHaber', JSON.stringify([...new Set([...ids, ...seen])].slice(0, 400))); } catch (e) { }
}
// Excel'e aktar
function exportXlsx() {
  if (!window.XLSX) { toast('Excel kitaplığı yüklenemedi.'); return; }
  const P = portfolio(), wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(P.pos.map(p => ({ Sembol: p.sym, Ad: S.assets[p.sym]?.name || '', Tür: CLS_AD[p.type] || p.type, Adet: p.qty, 'Ort. maliyet': p.avg, 'Son fiyat': p.last, Değer: p.value, Maliyet: p.cost, 'Gerçekleşmemiş K/Z': p.unreal, 'Gerçekleşen K/Z': p.realized })));
  const ws2 = XLSX.utils.json_to_sheet(Object.values(S.txns).sort((a, b) => a.d.localeCompare(b.d)).map(t => ({ Tarih: t.d, Sembol: t.sym, İşlem: t.side, Adet: +t.qty, Fiyat: +t.price, Komisyon: +t.fee || 0, Tutar: +t.qty * +t.price, Neden: t.note || '', 'Satarım/bakarım': t.exit || '', 'Gözden geçirme': t.rev || '' })));
  const fin = []; Object.values(S.assets).filter(a => a.type === 'hisse').forEach(a => (a.fin || []).forEach(f => { const o = { Sembol: a.sym, Dönem: `${f.y}/${f.m}` }; C.FIN.forEach(([k, l]) => o[l] = f[k] ?? null); fin.push(o); }));
  const hold = []; Object.values(S.assets).filter(a => a.type === 'fon').forEach(a => { const h = C.latestHold(a); if (h) h.items.forEach(i => hold.push({ Fon: a.sym, Rapor: h.date, Kod: i.code || '', Ad: i.name || '', Grup: i.t || '', 'Ağırlık %': Math.round(i.w * 10000) / 100 })); });
  XLSX.utils.book_append_sheet(wb, ws1, 'Portföy'); XLSX.utils.book_append_sheet(wb, ws2, 'İşlemler');
  if (fin.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fin), 'Mali tablolar');
  if (hold.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hold), 'Fon içerikleri');
  XLSX.writeFile(wb, `yatirim-pusulasi-${today()}.xlsx`);
}
document.addEventListener('click', async e => {
  if (e.target.closest('#xlsOut')) { exportXlsx(); return; }
  if (e.target.closest('#bkPick') && DESK) { const d = await window.pusula.pickBackupDir(); if (d) { S.settings.backupDir = d; await putSettings(); await window.pusulaFlush?.(); const at = await window.pusula.backupNow(); toast('Yedek klasörü kaydedildi.'); rBk(at); } return; }
  if (e.target.closest('#bkNow') && DESK) { await window.pusulaFlush?.(); const at = await window.pusula.backupNow(); rBk(at); toast(at ? 'Yedeklendi.' : 'Yedeklenemedi; klasöre erişilebiliyor mu?'); return; }
  if (e.target.closest('#updChk') && DESK) { const b = e.target.closest('#updChk'); b.disabled = true; const r = await window.pusula.updateCheck(); b.disabled = false; toast(r.state === 'dev' ? 'Geliştirme sürümünde güncelleme denetlenmez.' : r.state === 'error' ? 'Denetlenemedi: ' + r.message : r.version && r.version !== r.current ? `Yeni sürüm ${r.version} indiriliyor; hazır olunca haber verilecek.` : 'Program güncel.'); }
});
function rBk(at) { const d = S.settings.backupDir; $('#bkInfo').textContent = d ? `${d}${at || S.settings.backupAt ? ' · son yedek ' + new Date(at || S.settings.backupAt).toLocaleString('tr-TR') : ''}` : 'Seçilmedi'; $('#bkNow').hidden = !d; }


/* ---------- İncele ve takip et ---------- */
const COINS = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'ADA', 'DOGE', 'AVAX', 'DOT', 'LINK', 'TRX', 'TON', 'MATIC', 'POL', 'LTC', 'BCH', 'SHIB', 'PEPE', 'ATOM', 'NEAR', 'APT', 'ARB', 'OP', 'SUI', 'XLM', 'UNI', 'FET', 'RNDR', 'RENDER', 'INJ', 'HBAR', 'ICP', 'FIL', 'ETC', 'AAVE', 'USDT', 'USDC']);
function guessMkt(sym) {
  if (GOLD_SET.has(trKey(sym))) return 'emtia';
  if (COINS.has(sym)) return 'coin';
  if (S.radar && S.radar.rows && S.radar.rows[sym]) return 'bist';
  if (/^[A-Z]{5,6}$/.test(sym)) return 'bist';
  if (/^[A-Z]{3}$/.test(sym)) return 'fon';
  return 'us';
}
const isWatch = a => !Object.values(S.txns).some(t => t.sym === a.sym);
function rIncele() {
  const L = Object.values(S.assets).filter(isWatch).sort((a, b) => a.sym.localeCompare(b.sym));
  const MK = a => a.type === 'hisse' ? (a.mkt === 'US' ? 'Yabancı hisse' + (a.cur ? ' · ' + a.cur : '') : 'BIST hisse') : CLS_AD[a.type] || a.type;
  $('#inTable').innerHTML = !L.length ? '<tbody><tr><td class="mut">Takip listen boş. Yukarıdan bir sembol getir ya da Fırsat radarındaki "Takibe al" düğmesini kullan.</td></tr></tbody>' :
    `<thead><tr><th>Varlık</th><th>Piyasa</th><th class="n">Son fiyat</th><th class="n">1 gün</th><th class="n">1 yıl</th><th>Sinyal</th><th class="n">F/K</th><th class="n">PD/DD</th><th class="n">ROE</th><th></th></tr></thead><tbody>${L.map(a => {
      const px = a.px || [], n = px.length, l = lastOf(a).v, s = sig(a), r = s?.rat;
      const d1 = n > 1 ? px[n - 1][4] / px[n - 2][4] - 1 : null, y1 = n > 250 ? px[n - 1][4] / px[n - 251][4] - 1 : null;
      const usd = a.mkt === 'US' && a.fx && l ? ` <br><span class="xs mut">${fmt(l / a.fx, 2)} ${esc(a.cur || 'USD')}</span>` : '';
      return `<tr><td><b>${esc(a.sym)}</b><br><span class="xs mut">${esc(a.name || '')}</span></td><td class="sm">${esc(MK(a))}</td>
      <td class="n">${l != null ? fp(l) : '<span class="mut xs">çekiliyor…</span>'}${usd}</td><td class="n">${d1 != null ? `<span class="${cls(d1)}">${fpct(d1)}</span>` : '—'}</td><td class="n">${y1 != null ? `<span class="${cls(y1)}">${fpct(y1)}</span>` : '—'}</td>
      <td>${s?.comb ? tagH(s.comb.label) : '<span class="xs mut">veri yok</span>'}</td>
      <td class="n">${r?.negNI ? '<span class="dn xs">zarar</span>' : r?.pe != null ? fmt(r.pe, 1) : '—'}</td><td class="n">${r?.pb != null ? fmt(r.pb, 1) : '—'}</td><td class="n">${r?.roe != null ? '%' + fmt(r.roe * 100, 0) : '—'}</td>
      <td style="white-space:nowrap"><button class="ghost sm" data-go="${esc(a.sym)}">Analiz</button> ${a.type === 'hisse' ? `<button class="ghost sm" data-gom="${esc(a.sym)}">Mali tablo</button> ` : ''}<button class="ghost sm" data-unwatch="${esc(a.sym)}">Kaldır</button></td></tr>`;
    }).join('')}</tbody>`;
}
document.addEventListener('submit', async e => {
  if (e.target.id !== 'inForm') return; e.preventDefault();
  let sym = $('#inSym').value.trim().toLocaleUpperCase('tr-TR').replace(/\s+/g, ''); if (!sym) return;
  let mkt = $('#inMkt').value; if (mkt === 'auto') mkt = guessMkt(trKey(sym) && GOLD_SET.has(trKey(sym)) ? trKey(sym) : sym);
  if (mkt === 'emtia' && GOLD_SET.has(trKey(sym))) sym = trKey(sym);
  sym = sym.replace(/\.IS$/, '');
  if (S.assets[sym]) { toast(`${sym} zaten listende.`); selA = sym; location.hash = 'analiz'; return; }
  const type = { bist: 'hisse', us: 'hisse', coin: 'coin', fon: 'fon', emtia: 'emtia' }[mkt];
  const a = ensureAsset(sym, type); if (mkt === 'us') a.mkt = 'US';
  const gu = GOLD_UNITS.find(u => u[0] === sym); if (gu) a.name = gu[1];
  if (mkt === 'bist' && S.radar?.rows?.[sym]) a.name = S.radar.rows[sym].ad;
  await putAsset(a); $('#inSym').value = ''; rIncele();
  $('#inMsg').textContent = `${sym} getiriliyor (${{ bist: 'BIST', us: 'yabancı borsa', coin: 'coin', fon: 'TEFAS', emtia: 'emtia' }[mkt]})…`;
  if (DESK) { try { const r = await pRefresh([sym]); const errs = (r && r.errors || []).filter(x => x.startsWith(sym)); $('#inMsg').textContent = r && r.busy ? 'Başka bir güncelleme sürüyor; bittiğinde ' + sym + ' de çekilecek.' : errs.length ? errs.join(' · ') : `${sym} hazır. Analiz ve mali tablo düğmelerinden inceleyebilirsin.`; } catch (er) { $('#inMsg').textContent = 'Çekilemedi: ' + (er.message || er); } }
});
document.addEventListener('click', async e => {
  const u = e.target.closest('[data-unwatch]'); if (!u) return;
  const k = u.dataset.unwatch; if (!isWatch(S.assets[k] || {})) { toast('Bu varlıkta işlem var; önce işlemleri sil.'); return; }
  if (!u.dataset.arm) { u.dataset.arm = 1; u.textContent = 'Emin misin?'; setTimeout(() => { if (u.isConnected) { delete u.dataset.arm; u.textContent = 'Kaldır'; } }, 3000); return; }
  await delAsset(k); toast(`${k} takip listesinden kaldırıldı.`); rIncele();
});

/* ---------- Fırsat radarı ---------- */
let rdUni = 'top', rdPre = 'skor', rdSek = '', rdSort = null;
const med = a => { const v = a.filter(x => x != null && isFinite(x)).sort((x, y) => x - y); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
function radarRows() {
  const R = S.radar; if (!R || !R.rows) return [];
  const all = Object.values(R.rows).filter(r => r.px);
  const uni = rdUni === 'top' && R.top100 ? all.filter(r => R.top100.includes(r.k)) : all;
  // sektör medyanları tüm BIST üzerinden (kâr edenler)
  const bySek = {}; for (const r of all) (bySek[r.sek] = bySek[r.sek] || []).push(r);
  const sm = {}; for (const [k, L] of Object.entries(bySek)) sm[k] = { fk: med(L.filter(r => r.fk > 0).map(r => r.fk)), pddd: med(L.filter(r => r.pddd > 0).map(r => r.pddd)), n: L.length };
  const rows = uni.map(r => {
    const t = (R.tech || {})[r.k] || {};
    const roe = r.fk > 0 && r.pddd > 0 ? r.pddd / r.fk : null;
    const s = sm[r.sek] || {};
    return { ...r, ...t, roe, sfk: s.fk, spd: s.pddd, sn: s.n, iFk: r.fk > 0 && s.fk ? r.fk / s.fk - 1 : null, iPd: r.pddd > 0 && s.pddd ? r.pddd / s.pddd - 1 : null };
  });
  // ucuzluk skoru: evren içinde yüzdelik (düşük F/K, düşük PD/DD, düşük FD/FAVÖK, yüksek ROE); zarar edenler F/K'dan puan alamaz
  const pr = (key, asc, ok) => { const v = rows.filter(ok).map(r => r[key]).sort((a, b) => a - b); return r => { if (!ok(r)) return null; const i = v.findIndex(x => x >= r[key]); const p = v.length > 1 ? i / (v.length - 1) : .5; return asc ? 1 - p : p; }; };
  const pFk = pr('fk', true, r => r.fk > 0), pPd = pr('pddd', true, r => r.pddd > 0), pEv = pr('fdf', true, r => r.fdf > 0), pRoe = pr('roe', false, r => r.roe != null);
  for (const r of rows) {
    const parts = [pFk(r), pPd(r), pEv(r), pRoe(r)].filter(x => x != null);
    r.skor = parts.length >= 2 ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length * 100) : null;
    if (!(r.fk > 0)) r.skor = r.skor != null ? Math.round(r.skor * .5) : null;   // zarar eden: değer tuzağı riski
  }
  return rows;
}
const RD_PRE = {
  skor: ['Ucuzluk skoru', 'F/K, PD/DD, FD/FAVÖK düşüklüğü ve özkaynak kârlılığının evren içindeki sırasına göre 0–100 puan. Zarar eden şirketlerin puanı yarıya iner.', r => r.skor != null, (a, b) => b.skor - a.skor],
  sektor: ['Sektörüne göre iskontolu', 'F/K ve PD/DD\'si kendi sektörünün medyanından en az %30 düşük, kâr eden şirketler (sektörde en az 4 şirket varsa).', r => r.iFk != null && r.iPd != null && r.iFk < -.3 && r.iPd < -.3 && r.sn >= 4, (a, b) => (a.iFk + a.iPd) - (b.iFk + b.iPd)],
  kalite: ['Ucuz + kârlı', 'F/K 10\'un, PD/DD 2\'nin altında ve özkaynak kârlılığı (PD/DD ÷ F/K) %20\'nin üstünde.', r => r.fk > 0 && r.fk < 10 && r.pddd > 0 && r.pddd < 2 && r.roe > .2, (a, b) => b.roe - a.roe],
  dusen: ['Zirveden uzak', '52 haftalık zirvesinin en az %30 altında, kâr eden şirketler. Düşüşün sebebine mutlaka bak.', r => r.dHi != null && r.dHi < -.3 && r.fk > 0, (a, b) => a.dHi - b.dHi],
  tahmin: ['Kârı artması beklenen', 'İş Yatırım analistlerinin tahmini F/K\'sı bugünkü F/K\'nın en az %25 altında: kârın artması bekleniyor. Tahminler yanılabilir; yalnız İş Yatırım\'ın izlediği ~70 hisse.', r => r.fkT > 0 && r.fk > 0 && r.fkT < r.fk * .75, (a, b) => a.fkT / a.fk - b.fkT / b.fk],
  rsi: ['Aşırı satım', '14 günlük RSI 30\'un altında: kısa vadede sert satılmış hisseler. Trendin dönmesi garanti değildir.', r => r.rsi != null && r.rsi < 30, (a, b) => a.rsi - b.rsi]
};
function rRadar() {
  const R = S.radar;
  $('#rdInfo').innerHTML = R ? `Kaynak: İş Yatırım temel değerler ve oranlar · teknik: Yahoo · güncelleme ${esc(new Date(R.at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }))} · ${Object.keys(R.rows || {}).length} hisse` : 'Henüz radar verisi yok. "Radarı güncelle" ile çek (1–2 dakika sürer); sonra her akşamki güncellemede kendiliğinden yenilenir.';
  $('#rdBtn').hidden = !DESK;
  document.querySelectorAll('#rdUni button').forEach(b => b.classList.toggle('on', b.dataset.u === rdUni));
  document.querySelectorAll('#rdPre button').forEach(b => b.classList.toggle('on', b.dataset.p === rdPre));
  const rows = radarRows();
  const seks = [...new Set(rows.map(r => r.sek).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  $('#rdSek').innerHTML = '<option value="">Tüm sektörler</option>' + seks.map(x => `<option${x === rdSek ? ' selected' : ''}>${esc(x)}</option>`).join('');
  const [, desc, ok, cmp] = RD_PRE[rdPre];
  $('#rdDesc').textContent = desc + (rdUni === 'top' ? ' Evren: halka açık piyasa değerine göre en büyük 100 şirket (BIST 100\'e yakın bir liste).' : '');
  let L = rows.filter(r => (!rdSek || r.sek === rdSek) && ok(r)).sort(cmp);
  if (rdSort) { const [k, dir] = rdSort; L.sort((a, b) => ((a[k] ?? (dir > 0 ? Infinity : -Infinity)) - (b[k] ?? (dir > 0 ? Infinity : -Infinity))) * dir); }
  L = L.slice(0, 60);
  const f1 = v => v == null ? '<span class="mut">—</span>' : fmt(v, 1), pc = v => v == null ? '<span class="mut">—</span>' : `<span class="${cls(v)}">${fpct(v)}</span>`;
  const iso = v => v == null ? '' : `<br><span class="xs ${v < 0 ? 'up' : 'mut'}">${v < 0 ? 'sektöre göre ' + fpct(v) : 'sektör üstü'}</span>`;
  const th = (k, t) => `<th class="n"><button type="button" class="linkbtn" data-sort="${k}" style="all:unset;cursor:pointer">${t}${rdSort && rdSort[0] === k ? (rdSort[1] > 0 ? ' ↑' : ' ↓') : ''}</button></th>`;
  $('#rdTable').innerHTML = !R ? '' : !L.length ? '<tbody><tr><td class="mut">Bu filtreye uyan hisse yok.</td></tr></tbody>' :
    `<thead><tr><th>Hisse</th><th>Sektör</th>${th('px', 'Fiyat')}${th('mc', 'Piyasa değeri')}${th('fk', 'F/K')}${th('pddd', 'PD/DD')}${th('fdf', 'FD/FAVÖK')}${th('roe', 'ROE*')}${th('gy', 'Yıl içi')}${th('dHi', 'Zirveden')}${th('rsi', 'RSI')}${th('skor', 'Skor')}<th></th></tr></thead><tbody>${L.map(r => {
      const mine = S.assets[r.k];
      return `<tr><td><b>${esc(r.k)}</b><br><span class="xs mut">${esc(r.ad || '')}</span></td><td class="sm">${esc(r.sek || '')}</td>
      <td class="n">${fp(r.px)}</td><td class="n">${r.mc != null ? fmt(r.mc / 1000, 1) + ' mr' : '—'}</td>
      <td class="n">${r.fk > 0 ? fmt(r.fk, 1) : '<span class="dn xs">zarar</span>'}${iso(r.iFk)}${r.fkT > 0 ? `<br><span class="xs mut" title="İş Yatırım analist tahminine göre ileriye dönük F/K">tahmin ${fmt(r.fkT, 1)}</span>` : ''}</td><td class="n">${f1(r.pddd)}${iso(r.iPd)}</td><td class="n">${f1(r.fdf)}</td>
      <td class="n">${r.roe != null ? '%' + fmt(r.roe * 100, 0) : '—'}</td><td class="n">${r.gy != null ? pc(r.gy / 100) : '—'}</td><td class="n">${pc(r.dHi)}</td>
      <td class="n">${r.rsi != null ? `<span class="${r.rsi < 30 ? 'up' : r.rsi > 70 ? 'dn' : ''}">${fmt(r.rsi, 0)}</span>` : '—'}</td>
      <td class="n"><b>${r.skor ?? '—'}</b></td>
      <td>${mine ? `<span class="xs mut">${mine.type === 'hisse' ? 'takipte' : ''}</span>` : `<button class="ghost sm" style="white-space:nowrap" data-watch="${esc(r.k)}" data-ad="${esc(r.ad || '')}">Takibe al</button>`}</td></tr>`;
    }).join('')}</tbody>`;
}
document.addEventListener('click', async e => {
  const u = e.target.closest('#rdUni [data-u]'); if (u) { rdUni = u.dataset.u; rRadar(); return; }
  const p = e.target.closest('#rdPre [data-p]'); if (p) { rdPre = p.dataset.p; rdSort = null; rRadar(); return; }
  const so = e.target.closest('#rdTable [data-sort]'); if (so) { const k = so.dataset.sort; rdSort = rdSort && rdSort[0] === k ? [k, -rdSort[1]] : [k, ['px', 'mc', 'roe', 'skor', 'rsi', 'gy'].includes(k) && k !== 'rsi' ? -1 : 1]; rRadar(); return; }
  const w = e.target.closest('[data-watch]');
  if (w) { const k = w.dataset.watch; const a = ensureAsset(k, 'hisse'); if (!a.name) a.name = w.dataset.ad; await putAsset(a); toast(`${k} Hisseler sekmesine eklendi; fiyat ve mali tablolar çekiliyor.`); if (DESK) pRefresh([k]).catch(() => { }); rRadar(); return; }
  if (e.target.closest('#rdBtn')) { const b = $('#rdBtn'); b.disabled = true; b.textContent = 'Güncelleniyor…'; try { const r = await pRefresh(['__RADAR']); if (r && r.busy) toast('Başka bir güncelleme sürüyor, biraz sonra tekrar dene.'); else if (r && r.errors && r.errors.length) toast(r.errors.join(' · ')); } catch (er) { toast('Radar güncellenemedi: ' + (er.message || er)); } b.disabled = false; b.textContent = 'Radarı güncelle'; }
});
document.addEventListener('change', e => { if (e.target.id === 'rdSek') { rdSek = e.target.value; rRadar(); } });

function rSinif(type) {
  clearRO();
  if (!$('#txDate').value) $('#txDate').value = today();
  const P = portfolio(type), list = P.pos.slice().sort((a, b) => (b.qty > 0) - (a.qty > 0) || b.value - a.value), open = P.pos.filter(p => p.qty > 0);
  $('#sKpis').innerHTML = kpis(P, CLS_AD[type] + ' toplamı');
  $('#tefasCard').hidden = type !== 'fon';
  rGold(type);
  rSinifNews(type);
  const held = new Set(open.map(p => p.sym));
  const assets = Object.values(S.assets).filter(a => a.type === type).map(a => ({ a, s: sig(a) }))
    .sort((x, y) => (y.s.comb ? 1 : 0) - (x.s.comb ? 1 : 0) || (y.s.comb?.score ?? 0) - (x.s.comb?.score ?? 0) || x.a.sym.localeCompare(y.a.sym));
  $('#sSig').innerHTML = assets.length ? `<table class="stack"><thead><tr><th>Varlık</th><th class="n">Son fiyat</th><th class="n">1 ay</th><th class="n">RSI</th><th class="n">Skor</th><th>Sinyal</th><th></th></tr></thead><tbody>${assets.map(({ a, s }) => `
    <tr><td><b>${esc(a.sym)}</b>${held.has(a.sym) ? ' <span class="xs mut">· portföyde</span>' : ''}${a.name ? `<br><span class="xs mut">${esc(a.name)}</span>` : ''}</td><td class="n">${fp(lastOf(a).v)}</td>
    <td class="n ${cls(s.st?.r1m)}">${fpct(s.st?.r1m)}</td><td class="n">${s.comb?.t?.rsi != null ? fmt(s.comb.t.rsi, 0) : '—'}</td><td class="n">${s.comb ? `<b>${s.comb.score > 0 ? '+' : ''}${s.comb.score}</b>` : '—'}</td>
    <td>${s.comb ? tagH(s.comb.label) : `<span class="xs mut">${(a.px || []).length} gün fiyat; en az 30 gerekli</span>`}</td>
    <td class="n" style="white-space:nowrap"><button class="ghost sm" data-go="${esc(a.sym)}">Analiz</button>${type === 'hisse' ? ` <button class="ghost sm" data-gom="${esc(a.sym)}">Mali tablo</button>` : ''}</td></tr>`).join('')}</tbody></table>`
    : `<div class="empty">Bu sınıfta varlık yok. Aşağıdaki formla ilk işlemini gir ya da <a href="#veri">Excel'den yükle</a>.</div>`;
  $('#posTable').innerHTML = list.length ? `<table class="stack"><thead><tr><th>Varlık</th><th class="n">Adet</th><th class="n">Ort. maliyet</th><th class="n">Son fiyat</th><th class="n">Değer</th><th class="n">K/Z</th><th class="n">Ağırlık</th><th>Sinyal</th><th class="n">Stop</th></tr></thead><tbody>${list.map(p => {
    const a = S.assets[p.sym], s = a ? sig(a) : null, t = s?.comb?.t, kz = p.qty > 0 ? p.unreal : p.realized;
    return `<tr><td><b>${esc(p.sym)}</b>${p.qty > 0 ? '' : ' <span class="xs mut">kapalı</span>'}${a && a.noAuto && p.qty > 0 ? `<br><span class="xs mut" title="Bu araç için otomatik fiyat kaynağı yok; fiyatı yandaki kutuya yaz">elle fiyat${a.lastDate ? ' · ' + esc(dtr(a.lastDate)) : ''}</span>` : ''}${a && p.qty > 0 && staleDays(a) ? `<br><span class="xs dn">fiyat ${staleDays(a)} gün eski</span>` : ''}${a && a.rank && a.rank.n ? `<br><span class="xs mut" title="TEFAS kategori sıralaması">kategoride ${a.rank.k}/${a.rank.n}</span>` : ''}</td>
    <td class="n">${p.qty > 0 ? fmt(p.qty, p.qty % 1 ? 4 : 0) : '—'}</td><td class="n">${fp(p.avg)}</td>
    <td class="n">${p.qty > 0 ? `<input class="lp" data-s="${esc(p.sym)}" inputmode="decimal" value="${p.last != null ? esc(fmt(p.last, Math.abs(p.last) < 10 ? 4 : 2)) : ''}" placeholder="fiyat gir" style="width:9.5em;min-height:36px;padding:6px 8px;text-align:right" aria-label="${esc(p.sym)} son fiyat">` : '—'}</td>
    <td class="n">${p.qty > 0 ? fmt(p.value, 0) : '—'}</td>
    <td class="n ${cls(kz)}">${kz != null ? fmt(kz, 0) : '—'}${p.qty > 0 && p.cost && p.unreal != null ? `<br><span class="xs">${fpct(p.unreal / p.cost)}</span>` : p.qty > 0 ? '' : '<br><span class="xs mut">gerçekleşen</span>'}</td>
    <td class="n">${p.qty > 0 ? '%' + fmt(p.w * 100, 1) : ''}</td><td>${s?.comb ? tagH(s.comb.label) : '<span class="xs mut">veri yok</span>'}</td>
    <td class="n">${t && p.qty > 0 ? fp(t.stop) + `<br><span class="xs ${p.last < t.stop ? 'dn' : 'mut'}">${p.last < t.stop ? 'stop altında' : fpct(t.stop / p.last - 1)}</span>` : '—'}</td></tr>`;
  }).join('')}</tbody></table>` : `<div class="empty">Bu sınıfta pozisyon yok.</div>`;
  rInf(P);
  const tx = Object.values(S.txns).filter(t => (S.assets[t.sym]?.type || guessType(t.sym)) === type).sort((a, b) => (b.d || '').localeCompare(a.d || ''));
  $('#txTable').innerHTML = tx.length ? `<table class="stack"><thead><tr><th>Tarih</th><th>Varlık</th><th>İşlem</th><th class="n">Adet</th><th class="n">Fiyat</th><th class="n">Komisyon</th><th class="n">Tutar</th><th></th></tr></thead><tbody>${tx.map(t => `
    <tr><td>${dtr(t.d)}</td><td><b>${esc(t.sym)}</b></td><td class="${t.side === 'AL' ? 'up' : 'dn'}">${t.side === 'AL' ? 'Alış' : 'Satış'}</td><td class="n">${fmt(+t.qty, +t.qty % 1 ? 4 : 0)}</td><td class="n">${fp(+t.price)}</td><td class="n">${fmt(+t.fee || 0)}</td><td class="n">${fmt(t.qty * t.price, 2)}</td>
    <td class="n" style="white-space:nowrap"><button class="ghost sm" data-edit="${esc(t.id)}">Düzenle</button> <button class="x" data-del="${esc(t.id)}" aria-label="İşlemi sil">×</button></td></tr>`).join('')}</tbody></table>` : '<p class="mut sm">Bu sınıfta kayıtlı işlem yok.</p>';
  $('#txSum').textContent = `İşlem geçmişi (${tx.length})`;
}

/* ---------------- Enflasyon ---------------- */
const AYADI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const cpiLabel = () => { const ms = C.cpiMonths(S.cpi), l = ms[ms.length - 1]; return l ? `${AYADI[+l.slice(5) - 1]} ${l.slice(0, 4)}` : ''; };
function realNow(P) {
  if (!C.cpiMonths(S.cpi).length) return null;
  const R = C.realPositions(Object.values(S.txns), S.cpi), byS = Object.fromEntries(R.map(r => [r.sym, r]));
  let rcost = 0, value = 0, missing = 0, rows = [];
  for (const p of P.pos.filter(p => p.qty > 0)) {
    const r = byS[p.sym]; if (!r) continue;
    const has = p.last != null; if (!has) missing++;
    rows.push({ ...r, last: p.last, value: has ? p.qty * p.last : null, type: p.type });
    if (has) { rcost += r.rcost; value += p.qty * p.last; }
  }
  return { rows, rcost, value, real: value - rcost, missing, gap: R.some(r => r.gap && r.qty > 0) };
}
function rInf(P) {
  const box = $('#infBox'), R = realNow(P);
  if (!R) { box.innerHTML = `<h2>Enflasyona karşı</h2><div class="empty">Karşılaştırma için <a href="#veri">Veri ve ayarlar</a> sekmesine aylık TÜFE oranlarını gir.</div>`; return; }
  if (!R.rows.length) { box.innerHTML = ''; return; }
  const tot = R.rows.reduce((s, r) => ({ c: s.c + r.cost, rc: s.rc + r.rcost }), { c: 0, rc: 0 });
  const beat = R.rows.filter(r => r.value != null && r.value >= r.rcost).length, priced = R.rows.filter(r => r.value != null).length;
  box.innerHTML = `<h2>Enflasyona karşı</h2>
  <p class="sm mut" style="margin-top:-6px">Her alım, alış ayından ${esc(cpiLabel())}'e kadarki TÜFE ile bugünün parasına çevrildi (ayın 1–15'i arası alımlarda o ayın enflasyonu da sayılır). Yatırdığın <b>${fm(tot.c)}</b>, enflasyonla bugün <b>${fm(tot.rc)}</b> ediyor; portföyün bunun üstündeyse alım gücün artmış demektir.${priced ? ` Fiyatı girilen ${priced} varlıktan <b>${beat}</b> tanesi enflasyonu geçiyor.` : ''}${R.gap ? ' <span class="dn">TÜFE tablosunda eksik ay var; sonuçlar eksik olabilir.</span>' : ''}</p>
  <div class="scroll"><table class="stack"><thead><tr><th>Varlık</th><th class="n">Yatırılan</th><th class="n">Enflasyonla karşılığı</th><th class="n">Başabaş fiyat</th><th class="n">Son fiyat</th><th class="n">Nominal K/Z</th><th class="n">Reel K/Z</th><th>Durum</th></tr></thead><tbody>
  ${R.rows.sort((a, b) => b.rcost - a.rcost).map(r => { const nom = r.value != null ? r.value - r.cost : null, real = r.value != null ? r.value - r.rcost : null;
    return `<tr><td><b>${esc(r.sym)}</b></td><td class="n">${fm(r.cost)}</td><td class="n">${fm(r.rcost)} <span class="xs mut">+%${fmt((r.rcost / r.cost - 1) * 100, 1)}</span></td><td class="n">${esc(fp(r.be))}</td><td class="n">${r.last != null ? esc(fp(r.last)) : '<span class="xs mut">fiyat gir</span>'}</td>
    <td class="n ${cls(nom)}">${nom != null ? fm(nom) + `<br><span class="xs">${fpct(nom / r.cost)}</span>` : '—'}</td><td class="n ${cls(real)}"><b>${real != null ? fm(real) : '—'}</b>${real != null ? `<br><span class="xs">${fpct(r.value / r.rcost - 1)}</span>` : ''}</td>
    <td>${real == null ? `<span class="xs mut">fiyat ${esc(fp(r.be))} üstündeyse geçiyor</span>` : real >= 0 ? '<span class="tag t-AL">Enflasyonu geçti</span>' : '<span class="tag t-SAT">Enflasyonun altında</span>'}</td></tr>`; }).join('')}
  </tbody></table></div>
  <p class="xs mut">Başabaş fiyat: fiyat bu seviyenin üzerindeyse o varlıktaki birikimin enflasyondan daha hızlı büyümüş demektir. Kasım enflasyonu 3 Aralık'ta açıklanınca tabloya eklenmeli.</p>`;
}

let editTx = null;
function txEditMode(t) {
  editTx = t ? t.id : null;
  $('#txTitle').textContent = t ? `İşlemi düzenle · ${t.sym} ${dtr(t.d)}` : 'İşlem ekle';
  $('#txBtn').textContent = t ? 'Değişiklikleri kaydet' : 'Kaydet'; $('#txCancel').hidden = !t;
  if (t) {
    $('#txSym').value = t.sym; $('#txType').value = S.assets[t.sym]?.type || guessType(t.sym); $('#txSide').value = t.side; $('#txDate').value = t.d;
    const dec = v => String(v).replace('.', ',');
    $('#txQty').value = dec(t.qty); $('#txPrice').value = dec(t.price); $('#txFee').value = +t.fee ? dec(t.fee) : '';
    $('#txNote').value = t.note || ''; $('#txExit').value = t.exit || ''; $('#txRev').value = t.rev || '';
    document.querySelectorAll('[data-chk]').forEach(x => x.checked = (t.chk || []).includes(+x.dataset.chk));
    $('#txForm').closest('.card').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else { $('#txQty').value = ''; $('#txPrice').value = ''; $('#txFee').value = ''; $('#txNote').value = ''; $('#txExit').value = ''; $('#txRev').value = ''; document.querySelectorAll('[data-chk]').forEach(x => x.checked = false); }
  try { txInfo(); } catch (e) { }
}
$('#txCancel').addEventListener('click', () => txEditMode(null));
$('#txForm').addEventListener('submit', async e => {
  e.preventDefault();
  const sym0 = $('#txSym').value.trim().toLocaleUpperCase('tr-TR'), sym = GOLD_SET.has(trKey(sym0)) ? trKey(sym0) : sym0.toUpperCase(), qty = C.num($('#txQty').value), price = C.num($('#txPrice').value), fee = C.num($('#txFee').value) || 0, side = $('#txSide').value, d = $('#txDate').value, type = $('#txType').value;
  if (!sym || !(qty > 0) || !(price > 0) || !d) { toast('Sembol, tarih, adet ve fiyat gerekli.'); return; }
  const others = Object.values(S.txns).filter(t => t.id !== editTx);
  if (side === 'SAT') { const p = C.positions(others.filter(t => t.d <= d)).find(p => p.sym === sym); if (!p || p.qty + 1e-9 < qty) { toast(`${dtr(d)} tarihinde elinde ${p ? fmt(p.qty, 4) : 0} adet ${sym} vardı; daha fazlası satılamaz.`); return; } }
  const isNew = !S.assets[sym];
  if (isNew) { const a = ensureAsset(sym, type); a.last = price; a.lastDate = d; const gu = GOLD_UNITS.find(u => u[0] === sym); if (gu) a.name = gu[1]; await putAsset(a); }
  else {
    const a = ensureAsset(sym); let ch = false;
    if (a.type !== type) { a.type = type; ch = true; }
    if (!a.px.length && (!a.lastDate || d >= a.lastDate)) { a.last = price; a.lastDate = d; ch = true; }
    if (ch) await putAsset(a);
  }
  const wasEdit = !!editTx, old = editTx && S.txns[editTx];
  const note = $('#txNote').value.trim(), exit = $('#txExit').value.trim(); let rev = $('#txRev').value || '';
  if ((note || exit) && !rev) rev = addDays(d > today() ? d : today(), 90);
  const chk = side === 'AL' ? [...document.querySelectorAll('[data-chk]')].filter(x => x.checked).map(x => +x.dataset.chk) : [];
  await putTx({ ...(old || {}), id: editTx || newId(), sym, side, d, qty, price, fee, note, exit, rev, chk: chk.length ? chk : (old && old.chk) || null, ...(old && old.rev !== rev ? { revd: null } : {}) });
  if (old && old.sym !== sym && !Object.values(S.txns).some(t => t.sym === old.sym) && S.assets[old.sym] && !(S.assets[old.sym].px || []).length) await delAsset(old.sym);
  txEditMode(null);
  if (DESK && (isNew || (old && old.sym !== sym))) setTimeout(() => pRefresh([sym]).catch(() => { }), 900);  // yeni varlık: fiyat geçmişi + (hisse ise) mali tablolar
  toast(wasEdit ? `${sym} işlemi güncellendi.` : `${sym} ${side === 'AL' ? 'alışı' : 'satışı'} kaydedildi.`);
  if (CLS_HASH[type] && CLS_HASH[type] !== hash) location.hash = CLS_HASH[type]; else render();
});
$('#txSym').addEventListener('change', () => { const v = $('#txSym').value.trim(), a = S.assets[v.toUpperCase()] || S.assets[trKey(v)]; if (a) $('#txType').value = a.type; else if (GOLD_SET.has(trKey(v))) $('#txType').value = 'emtia'; });
document.addEventListener('click', e => {
  const del = e.target.closest('[data-del]');
  if (del) { if (del.dataset.arm) { delTx(del.dataset.del); toast('İşlem silindi.'); render(); } else { del.dataset.arm = 1; del.textContent = 'Sil?'; del.classList.add('dn'); setTimeout(() => { if (del.isConnected) { delete del.dataset.arm; del.textContent = '×'; } }, 3000); } return; }
  const ed = e.target.closest('[data-edit]'); if (ed) { const t = S.txns[ed.dataset.edit]; if (t) { $('#txHist').open = true; txEditMode(t); } return; }
  const go = e.target.closest('[data-go]'); if (go) { selA = go.dataset.go; location.hash = 'analiz'; }
  const gm = e.target.closest('[data-gom]'); if (gm) { selM = gm.dataset.gom; location.hash = 'mali'; }
});
document.addEventListener('change', e => {
  if (e.target.matches('input.lp')) {
    const v = C.num(e.target.value); if (!(v > 0)) return; const a = ensureAsset(e.target.dataset.s);
    a.last = v; a.lastDate = today(); putAsset(a); toast(`${a.sym} son fiyatı güncellendi.`); render();
  }
});

/* ---------------- Grafikler ---------------- */
let ROs = [];
const clearRO = () => { ROs.forEach(r => r.disconnect()); ROs = []; };
function observe(el, fn) { const r = new ResizeObserver(() => { try { fn(); } catch (e) { console.error(e); } }); r.observe(el); ROs.push(r); }
function ticks(lo, hi, n) {
  const raw = (hi - lo) / n, st = Math.pow(10, Math.floor(Math.log10(raw))), e = raw / st;
  const step = st * (e >= 7.5 ? 10 : e >= 3.5 ? 5 : e >= 1.5 ? 2 : 1), out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toPrecision(12));
  return out;
}
const COL = { ink: 'var(--ink)', mut: 'var(--mut)', line: 'var(--line)', up: 'var(--up)', dn: 'var(--dn)', blue: 'var(--blue)', s200: 'var(--cpi)', soft: 'var(--soft)' };
function frame(a, t) {
  const n = a.px.length, st = Math.max(0, n - range);
  return { n, st, idx: Array.from({ length: n - st }, (_, k) => k + st) };
}
function drawPrice(fig, a, t, txns) {
  const svg = fig.querySelector('svg'), tip = fig.querySelector('.tip'), px = a.px, { n, st, idx } = frame(a, t), { s50, s200, B } = t.series;
  let geo = null;
  const draw = () => {
    const W = svg.clientWidth, H = svg.clientHeight; if (!W || !H) return;
    const nar = W < 520, L = nar ? 52 : 66, R = nar ? 74 : 104, T = 12, Bm = 26, iw = W - L - R, ih = H - T - Bm;
    let lo = Infinity, hi = -Infinity;
    for (const i of idx) { lo = Math.min(lo, px[i][3] ?? px[i][4], B.lo[i] ?? Infinity); hi = Math.max(hi, px[i][2] ?? px[i][4], B.up[i] ?? -Infinity); }
    lo = Math.min(lo, t.stop); hi = Math.max(hi, t.t1); const pd = (hi - lo) * .04; lo -= pd; hi += pd;
    const X = i => L + (i - st) / Math.max(1, n - 1 - st) * iw, Y = v => T + (hi - v) / (hi - lo) * ih;
    const path = arr => { let s = '', pen = false; for (const i of idx) { const v = arr[i]; if (v == null) { pen = false; continue; } s += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); pen = true; } return s; };
    const bi = idx.filter(i => B.up[i] != null);
    const band = bi.length ? 'M' + bi.map(i => X(i).toFixed(1) + ' ' + Y(B.up[i]).toFixed(1)).join('L') + 'L' + bi.reverse().map(i => X(i).toFixed(1) + ' ' + Y(B.lo[i]).toFixed(1)).join('L') + 'Z' : '';
    let g = '';
    for (const v of ticks(lo, hi, nar ? 4 : 6)) g += `<line x1="${L}" x2="${L + iw}" y1="${Y(v)}" y2="${Y(v)}" stroke="${COL.line}"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="12" fill="${COL.mut}">${esc(nar && Math.abs(v) >= 1e6 ? fmt(v / 1e6, 1) + 'mn' : fc(v))}</text>`;
    const every = Math.max(1, Math.ceil(idx.length / Math.max(2, Math.floor(iw / (nar ? 80 : 110)))));
    for (let k = 0; k < idx.length; k += every) { const i = idx[k]; g += `<text x="${X(i)}" y="${H - 7}" text-anchor="middle" font-size="12" fill="${COL.mut}">${esc(dshort(px[i][0]))}</text>`; }
    g += `<rect x="${L}" width="${iw}" y="${Y(t.zone[1])}" height="${Math.max(2, Y(t.zone[0]) - Y(t.zone[1]))}" fill="${COL.up}" opacity=".14"/>`;
    if (band) g += `<path d="${band}" fill="${COL.blue}" opacity=".07"/>`;
    g += `<path d="${path(s200)}" fill="none" stroke="${COL.s200}" stroke-width="1.5"/><path d="${path(s50)}" fill="none" stroke="${COL.blue}" stroke-width="1.5"/>`;
    g += `<path d="${path(px.map(r => r[4]))}" fill="none" stroke="${COL.ink}" stroke-width="1.8" stroke-linejoin="round"/>`;
    const lines = [{ v: t.stop, c: COL.dn, l: 'Stop' }, { v: t.t1, c: COL.up, l: 'Hedef 1' }];
    for (const x of lines) g += `<line x1="${L}" x2="${L + iw}" y1="${Y(x.v)}" y2="${Y(x.v)}" stroke="${x.c}" stroke-dasharray="4 4"/>`;
    for (const x of txns) {
      let i = idx.find(j => px[j][0] >= x.d); if (i == null) continue;
      const cx = X(i), cy = Y(+x.price), s = 6;
      g += x.side === 'AL' ? `<path d="M${cx} ${cy + 2}l${s} ${s * 1.6}h${-2 * s}z" fill="${COL.up}"/>` : `<path d="M${cx} ${cy - 2}l${s} ${-s * 1.6}h${-2 * s}z" fill="${COL.dn}"/>`;
    }
    const labs = [{ v: t.last, l: fc(t.last), bg: COL.ink, fg: 'var(--bg)' }, { v: t.stop, l: 'Stop ' + fc(t.stop), fg: COL.dn }, { v: t.t1, l: 'H1 ' + fc(t.t1), fg: COL.up }, { v: (t.zone[0] + t.zone[1]) / 2, l: 'Alım', fg: COL.up }]
      .map(o => ({ ...o, y: Y(o.v) })).sort((a, b) => a.y - b.y);
    for (let k = 1; k < labs.length; k++) labs[k].y = Math.max(labs[k].y, labs[k - 1].y + 17);
    const over = labs[labs.length - 1].y - (T + ih); if (over > 0) labs.forEach(o => o.y -= over);
    for (const o of labs) g += (o.bg ? `<rect x="${L + iw + 4}" y="${o.y - 10}" width="${R - 6}" height="19" rx="4" fill="${o.bg}"/>` : '') + `<text x="${L + iw + 9}" y="${o.y + 4}" font-size="12" font-weight="700" fill="${o.fg}">${esc(nar ? o.l.replace('Stop ', 'S ').replace('Alım', 'Alım') : o.l)}</text>`;
    g += `<g id="hv"></g><rect x="${L}" y="${T}" width="${iw}" height="${ih}" fill="transparent" id="hit"/>`;
    svg.innerHTML = g; geo = { L, iw, T, ih, X, Y, W };
  };
  observe(svg, draw);
  svg.addEventListener('mousemove', e => {
    if (!geo) return; const r = svg.getBoundingClientRect(), x = e.clientX - r.left;
    if (x < geo.L || x > geo.L + geo.iw) { tip.style.display = 'none'; svg.querySelector('#hv').innerHTML = ''; return; }
    const i = Math.round(st + (x - geo.L) / geo.iw * Math.max(1, n - 1 - st)), p = px[i];
    svg.querySelector('#hv').innerHTML = `<line x1="${geo.X(i)}" x2="${geo.X(i)}" y1="${geo.T}" y2="${geo.T + geo.ih}" stroke="${COL.mut}" stroke-dasharray="2 3"/><circle cx="${geo.X(i)}" cy="${geo.Y(p[4])}" r="4" fill="${COL.ink}"/>`;
    tip.innerHTML = `<b>${esc(dtr(p[0]))}</b><br>Kapanış ${esc(fp(p[4]))}${p[2] != p[3] ? `<br>Y ${esc(fp(p[2]))} · D ${esc(fp(p[3]))}` : ''}${s50[i] ? `<br><span style="color:var(--blue)">50G ${esc(fp(s50[i]))}</span>` : ''}${s200[i] ? `<br><span style="color:var(--cpi)">200G ${esc(fp(s200[i]))}</span>` : ''}${t.series.R[i] != null ? `<br>RSI ${fmt(t.series.R[i], 0)}` : ''}`;
    tip.style.display = 'block'; const tw = tip.offsetWidth;
    tip.style.left = (x + 14 + tw > geo.W ? x - tw - 14 : x + 14) + 'px'; tip.style.top = '10px';
  });
  svg.addEventListener('mouseleave', () => { tip.style.display = 'none'; const h = svg.querySelector('#hv'); if (h) h.innerHTML = ''; });
}
function drawSub(svg, a, t, kind) {
  const { n, st, idx } = frame(a, t);
  observe(svg, () => {
    const W = svg.clientWidth, H = svg.clientHeight; if (!W || !H) return;
    const nar = W < 520, L = nar ? 52 : 66, R = nar ? 74 : 104, T = 8, Bm = 8, iw = W - L - R, ih = H - T - Bm;
    const X = i => L + (i - st) / Math.max(1, n - 1 - st) * iw;
    let g = '';
    if (kind === 'rsi') {
      const Y = v => T + (100 - v) / 100 * ih, R2 = t.series.R;
      g += `<rect x="${L}" width="${iw}" y="${Y(70)}" height="${Y(30) - Y(70)}" fill="${COL.soft}"/>`;
      for (const v of [30, 50, 70]) g += `<line x1="${L}" x2="${L + iw}" y1="${Y(v)}" y2="${Y(v)}" stroke="${COL.line}"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="12" fill="${COL.mut}">${v}</text>`;
      let s = '', pen = false; for (const i of idx) { if (R2[i] == null) { pen = false; continue; } s += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(R2[i]).toFixed(1); pen = true; }
      g += `<path d="${s}" fill="none" stroke="${COL.ink}" stroke-width="1.5"/><text x="${L + iw + 9}" y="${Y(t.rsi ?? 50) + 4}" font-size="12" font-weight="700" fill="${COL.ink}">RSI ${t.rsi != null ? fmt(t.rsi, 0) : '—'}</text>`;
    } else {
      const M = t.series.M; let mx = 0; for (const i of idx) mx = Math.max(mx, Math.abs(M.m[i] || 0), Math.abs(M.s[i] || 0), Math.abs(M.h[i] || 0));
      mx = mx || 1; const Y = v => T + (mx - v) / (2 * mx) * ih, bw = Math.max(1, iw / idx.length * .7);
      g += `<line x1="${L}" x2="${L + iw}" y1="${Y(0)}" y2="${Y(0)}" stroke="${COL.line}"/><text x="${L - 8}" y="${Y(0) + 4}" text-anchor="end" font-size="12" fill="${COL.mut}">0</text>`;
      for (const i of idx) { const h = M.h[i]; if (h == null) continue; g += `<rect x="${X(i) - bw / 2}" width="${bw}" y="${Math.min(Y(h), Y(0))}" height="${Math.abs(Y(h) - Y(0))}" fill="${h >= 0 ? COL.up : COL.dn}" opacity=".55"/>`; }
      const p = arr => { let s = '', pen = false; for (const i of idx) { if (arr[i] == null) { pen = false; continue; } s += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(arr[i]).toFixed(1); pen = true; } return s; };
      g += `<path d="${p(M.m)}" fill="none" stroke="${COL.ink}" stroke-width="1.4"/><path d="${p(M.s)}" fill="none" stroke="${COL.s200}" stroke-width="1.4"/><text x="${L + iw + 9}" y="${T + 14}" font-size="12" font-weight="700" fill="${COL.ink}">MACD</text>`;
    }
    svg.innerHTML = g;
  });
}

/* ---------------- Teknik analiz ---------------- */
function fillSel(sel, list, cur) {
  sel.innerHTML = list.length ? list.map(a => `<option value="${esc(a.sym)}"${a.sym === cur ? ' selected' : ''}>${esc(a.sym)}${a.name ? ' · ' + esc(a.name) : ''} (${TYPES[a.type] || ''})</option>`).join('') : '<option value="">Varlık yok</option>';
}
function rAnaliz() {
  clearRO();
  const list = Object.values(S.assets).sort((a, b) => a.sym.localeCompare(b.sym));
  if (!selA || !S.assets[selA]) selA = (list.find(a => a.px && a.px.length >= 30) || list[0] || {}).sym || null;
  fillSel($('#aSel'), list, selA);
  document.querySelectorAll('#rng button').forEach(b => b.classList.toggle('on', +b.dataset.r === range));
  const a = S.assets[selA], body = $('#aBody');
  { const t = a?.type; $('#aBack').href = '#' + (CLS_HASH[t] || 'ana'); $('#aBack').textContent = '← ' + (CLS_AD[t] || 'Ana sayfa'); document.querySelectorAll('#nav a').forEach(x => x.classList.toggle('on', x.dataset.t === CLS_HASH[t])); }
  if (!a) { body.innerHTML = `<div class="empty">Henüz varlık yok. <a href="#veri">Excel yükle</a> ya da <a href="#fonlar">işlem ekle</a>.</div>`; return; }
  const s = sig(a), t = s.comb?.t;
  if (!t) { body.innerHTML = `<div class="empty">${esc(a.sym)} için ${a.px?.length || 0} günlük fiyat var; teknik analiz için en az 30 gün gerekli. <a href="#veri">Fiyat geçmişi ekle</a>.</div>${insightGrid(a)}`; return; }
  const comb = s.comb, f = comb.f, st = s.st || {}, tx = Object.values(S.txns).filter(x => x.sym === a.sym);
  const pos = C.positions(tx)[0];
  const real = st.cagr != null && infl() ? (1 + st.cagr) / (1 + infl()) - 1 : null;
  body.innerHTML = `
  <div class="grid g3">
    <div class="card"><span class="sm mut">${esc(a.sym)} · ${dtr(t.date)} kapanışı ${esc(fp(t.last))}</span>
      <div class="row" style="margin:8px 0 14px;gap:14px"><span class="big">${comb.label}</span><span class="sm mut">skor ${comb.score > 0 ? '+' : ''}${comb.score} / 100</span></div>
      <div class="meter" role="img" aria-label="Skor ${comb.score}"><i style="left:${(comb.score + 100) / 2}%"></i></div>
      <div class="row xs mut" style="justify-content:space-between;margin-top:6px"><span>Güçlü sat</span><span>Tut</span><span>Güçlü al</span></div>
      <p class="sm" style="margin:12px 0 0">Teknik skor <b>${t.score > 0 ? '+' : ''}${t.score}</b>${f ? ` · temel skor <b>${f.score > 0 ? '+' : ''}${f.score}</b> (ağırlık %60 / %40)` : a.type === 'hisse' ? ' · <a href="#mali">mali tablo ekle</a>, temel skor da katılsın' : ''}</p>
    </div>
    <div class="card"><h3>Al-sat seviyeleri</h3><div class="lv">
      <span>Alım bölgesi</span><span class="up">${esc(fp(t.zone[0]))} – ${esc(fp(t.zone[1]))}</span>
      <span>Zarar kes (stop)</span><span class="dn">${esc(fp(t.stop))} <span class="xs">${fpct(t.stop / t.last - 1)}</span></span>
      <span>Hedef 1</span><span class="up">${esc(fp(t.t1))} <span class="xs">${fpct(t.t1 / t.last - 1)}</span></span>
      <span>Hedef 2</span><span class="up">${esc(fp(t.t2))} <span class="xs">${fpct(t.t2 / t.last - 1)}</span></span>
      <span>Risk / ödül</span><span>${t.rr != null ? '1 : ' + fmt(t.rr, 1) : '—'}</span>
      <span>ATR (14)</span><span>${esc(fp(t.atr))} <span class="xs mut">%${fmt(t.atr / t.last * 100, 1)}</span></span>
      ${pos && pos.qty > 0 ? `<span>Senin maliyetin</span><span>${esc(fp(pos.avg))} <span class="xs ${cls(t.last - pos.avg)}">${fpct(t.last / pos.avg - 1)}</span></span>` : ''}
    </div><p class="xs mut" style="margin:10px 0 0">Stop en yakın desteğin 0,75 ATR altına, hedefler sıradaki dirençlere konur.${t.rr != null && t.rr < 1.5 ? ' Risk/ödül 1,5\'in altında: yeni alım için cazip değil.' : ''}</p></div>
    <div class="card"><h3>Getiri</h3><div class="lv">
      ${[['1 hafta', st.r1w], ['1 ay', st.r1m], ['3 ay', st.r3m], ['6 ay', st.r6m], ['1 yıl', st.r1y], ['Yılbaşından beri', st.ytd]].map(([k, v]) => `<span>${k}</span><span class="${cls(v)}">${fpct(v)}</span>`).join('')}
    </div></div>
  </div>
  <div class="card" style="margin-top:24px">
    <div class="row sm" style="gap:18px;margin-bottom:6px"><span><b style="color:var(--ink)">━</b> Kapanış</span><span style="color:var(--blue)">━ 50 gün</span><span style="color:var(--cpi)">━ 200 gün</span><span class="mut">▒ Bollinger</span><span class="up">▲ alış</span><span class="dn">▼ satış</span></div>
    <div class="fig" id="fP"><svg role="img" aria-label="${esc(a.sym)} fiyat grafiği"></svg><div class="tip"></div></div>
    <div class="fig s" id="fR"><svg role="img" aria-label="RSI"></svg></div>
    <div class="fig s" id="fM"><svg role="img" aria-label="MACD"></svg></div>
  </div>
  <div class="grid g2" style="margin-top:24px">
    <div class="card"><h3>Sinyalin gerekçeleri</h3><ul class="why">${t.why.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <table style="margin-top:14px"><thead><tr><th>Bileşen</th><th class="n">Ağırlık</th><th class="n">Katkı</th></tr></thead><tbody>${t.parts.map(p => `<tr><td>${p.k}</td><td class="n">%${p.w}</td><td class="n ${cls(p.v)}">${p.v * p.w > 0 ? '+' : ''}${fmt(p.v * p.w, 0)}</td></tr>`).join('')}</tbody></table></div>
    <div class="card"><h3>Risk</h3><div class="lv">
      <span>Yıllık volatilite</span><span>${fpc(st.vol)}</span>
      <span>Yıllık bileşik getiri</span><span class="${cls(st.cagr)}">${fpct(st.cagr)}</span>
      ${real != null ? `<span>Reel getiri (enflasyon sonrası)</span><span class="${cls(real)}">${fpct(real)}</span>` : ''}
      <span>Sharpe</span><span>${st.sharpe != null ? fmt(st.sharpe, 2) : '—'}</span><span>Sortino</span><span>${st.sortino != null ? fmt(st.sortino, 2) : '—'}</span>
      <span>En büyük düşüş</span><span class="dn">${fpct(st.mdd)}</span>
      <span>Ortalama 50 / 200 gün</span><span>${esc(fp(t.s50))} / ${esc(fp(t.s200))}</span>
    </div>
    <h3 style="margin-top:18px">Destek ve dirençler</h3><div class="lv">
      ${t.res.slice().reverse().map(x => `<span class="dn">Direnç</span><span>${esc(fp(x.v))} <span class="xs mut">${fpct(x.v / t.last - 1)}</span></span>`).join('')}
      ${t.sup.map(x => `<span class="up">Destek</span><span>${esc(fp(x.v))} <span class="xs mut">${fpct(x.v / t.last - 1)}</span></span>`).join('')}
    </div><p class="xs mut" style="margin:10px 0 0">${(a.px || []).length} günlük veri, ${dtr(a.px[0][0])} – ${dtr(t.date)}. ${S.settings.rf ? `Risksiz faiz %${esc(S.settings.rf)}.` : 'Sharpe için risksiz faizi Ayarlar\'dan gir.'}</p></div>
  </div>${insightGrid(a)}`;
  drawPrice($('#fP'), a, t, tx); drawSub($('#fR svg'), a, t, 'rsi'); drawSub($('#fM svg'), a, t, 'macd');
}
$('#aSel').addEventListener('change', e => { selA = e.target.value; render(); });
$('#rng').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { range = +b.dataset.r; render(); } });

/* ---------------- Analist beklentileri, karne ve takvim ---------------- */
// Rasyoların kısa açıklamaları (hap bilgi): kartın üzerine gelince ve "?" işaretinde görünür
const HAP = {
  pe: 'Şirketin bugünkü değeri kaç yıllık kârına eşit. Düşükse ucuz olabilir; ama kâr düşecekse düşük F/K yanıltır. Aynı sektördeki şirketlerle karşılaştır.',
  pb: 'Piyasa değeri / özkaynak. 1\'in altı, şirketin defterdeki değerinden ucuza satıldığını gösterir. Bankalar ve holdinglerde en çok bakılan çarpan.',
  evEbitda: 'Borç dahil şirket değeri / faaliyet nakit kârı. Borçlu ve borçsuz şirketleri karşılaştırmak için F/K\'dan daha adil.',
  evSales: 'Şirket değeri / satışlar. Henüz kâr etmeyen veya marjı dalgalı şirketlerde işe yarar.',
  roe: 'Ortakların koyduğu her 100 TL\'ye yılda ne kadar kâr ettiği. Enflasyonun üstünde olması gerekir; yoksa şirket reelde değer kaybettiriyor.',
  roa: 'Tüm varlıklar üzerinden kârlılık. Bankalarda %2 iyi sayılır; sanayide %8+ güçlüdür.',
  gm: 'Satıştan, malın maliyeti düşüldükten sonra kalan pay. Yüksek ve istikrarlıysa fiyatlama gücü var demektir.',
  em: 'FAVÖK / satış: faaliyetin nakit yaratma gücü. Sektör içinde karşılaştır.',
  om: 'Esas faaliyetlerden (finansman ve tek seferlikler hariç) kalan kâr payı.',
  nm: 'Satışların ne kadarı net kâra dönüşüyor. Kur farkı, faiz ve vergi dahil son satır.',
  cr: 'Bir yıl içinde nakde dönecek varlıkların, bir yıl içinde ödenecek borçlara oranı. 1\'in altı kısa vadede sıkışma riski demek.',
  qr: 'Stoklar hariç cari oran: stok satılamazsa borçlar ödenebilir mi?',
  de: 'Toplam yükümlülük / özkaynak. Yüksekse şirket borçla büyüyor; faiz arttığında kârı daha çok etkilenir.',
  ndEbitda: 'Net borcu kaç yıllık FAVÖK ile kapatabilir. 3\'ün üstü yüksek borç; eksi değer net nakit demek.',
  revG: 'Satışların geçen yılın aynı dönemine göre değişimi. Türkiye\'de enflasyonun altında kalan büyüme reel küçülmedir.',
  niG: 'Net kârın yıllık değişimi. Tek seferlik gelirler (arsa satışı, kur farkı) bunu şişirebilir.',
  ebG: 'FAVÖK\'ün yıllık değişimi: faaliyet kârındaki gerçek eğilim.',
  fcfY: 'Serbest nakit akışı / piyasa değeri. Şirket bugünkü fiyatla her yıl ne kadar "cebe giren nakit" üretiyor. %8+ güçlü.',
  cfoNi: 'İşletme nakit akışı / net kâr. 1\'in üstüyse kâr nakde dönüyor (kaliteli kâr); çok altındaysa kâr kâğıt üstünde kalıyor olabilir.',
  capexRev: 'Satışların ne kadarı yeni yatırıma (makine, tesis) gidiyor. Yüksek oran büyüme isteğini ama nakit tüketimini de gösterir.',
  fxpEq: 'Net döviz pozisyonu / özkaynak. Eksi ve büyükse TL değer kaybettiğinde şirket zarar yazar; artı ise kurdan kazanır.',
  pio: 'Piotroski F-skoru (0–9): kârlılık, borçluluk ve verimlilikte geçen yıla göre iyileşme. 7+ güçlü, 3 ve altı zayıf.'
};
const hapI = k => HAP[k] ? ` <span class="hap" tabindex="0" title="${esc(HAP[k])}" aria-label="${esc(HAP[k])}">?</span>` : '';
const REC_TR = { strong_buy: 'GÜÇLÜ AL', buy: 'AL', hold: 'TUT', underperform: 'SAT', sell: 'SAT', strong_sell: 'GÜÇLÜ SAT' };
const isBist = a => a.type === 'hisse' && a.mkt !== 'US';
// Sektör medyanları (İş Yatırım radar verisi, kâr eden BIST şirketleri)
function sektorOf(a) {
  const R = S.radar; if (!R || !R.rows || !isBist(a)) return null;
  const me = R.rows[a.sym]; if (!me) return null;
  const L = Object.values(R.rows).filter(r => r.sek === me.sek && r.px);
  const m = k => med(L.filter(r => r[k] > 0).map(r => r[k]));
  return { ad: me.sek, n: L.length, fk: m('fk'), pddd: m('pddd'), fdf: m('fdf'), roe: med(L.filter(r => r.fk > 0 && r.pddd > 0).map(r => r.pddd / r.fk)), me };
}
// KAP takvim adı eşleştirme: "Oyak Çimento" ↔ "OYAK ÇİMENTO FABRİKALARI A.Ş."
const normAd = s => String(s || '').toLocaleUpperCase('tr-TR').replace(/\bGYO\b/g, 'GAYRİMENKUL YATIRIM ORTAKLIĞI').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/I/g, 'I').replace(/[^A-Z0-9 ]+/g, ' ').replace(/\b(VE|A S|T A S|A O|AS|TAS)\b/g, ' ').replace(/\s+/g, ' ').trim();
function calFor(a) {
  const out = [], td = today();
  const names = [S.radar?.rows?.[a.sym]?.ad, a.name].map(normAd).filter(n => n.length >= 4);
  if (names.length) for (const x of (S.cal?.items || [])) { if (x.d < td) continue; const k = normAd(x.firma); if (names.some(n => k === n || k.startsWith(n + ' '))) out.push({ d: x.d, t: x.tip, idx: x.idx }); }
  const e = a.ins?.y?.earn; if (e && e.d >= td) out.push({ d: e.d, t: (a.mkt === 'US' ? 'Bilanço/kâr açıklaması' : 'Finansal sonuç açıklaması') + (e.est ? ' (tahmini tarih)' : '') });
  const seen = new Set(); return out.filter(x => { const k = x.d + x.t; if (seen.has(k)) return false; seen.add(k); return true; }).sort((p, q) => p.d.localeCompare(q.d));
}
function calHtml(a) {
  const L = calFor(a); if (!L.length) return '';
  return `<div class="lv">${L.slice(0, 6).map(x => `<span>${x.idx && DESK ? `<a href="#" data-det="${esc(x.idx)}">${esc(x.t)}</a>` : x.idx ? `<a href="https://www.kap.org.tr/tr/Bildirim/${esc(x.idx)}" target="_blank" rel="noopener">${esc(x.t)}</a>` : esc(x.t)}</span><span>${dtr(x.d)} <span class="xs mut">${dayDiff(today(), x.d) === 0 ? 'bugün' : dayDiff(today(), x.d) + ' gün'}</span></span>`).join('')}</div>`;
}
function analystHtml(a) {
  const y = a.ins?.y, i = a.ins?.i; if (!y && !i) return '';
  let h = '';
  if (y && y.n) {
    const tr0 = (y.trend || [])[0] || {}, tot = ['sb', 'b', 'h', 's', 'ss'].reduce((s, k) => s + (tr0[k] || 0), 0);
    const tr3 = (y.trend || []).find(t => t.p === '-3m');
    const bull = t => t ? ((t.sb || 0) + (t.b || 0)) / Math.max(1, (t.sb || 0) + (t.b || 0) + (t.h || 0) + (t.s || 0) + (t.ss || 0)) : null;
    const up = y.mean && y.px ? y.mean / y.px - 1 : null;
    const rm = y.recMean || (tot ? ((tr0.sb || 0) + (tr0.b || 0) * 2 + (tr0.h || 0) * 3 + (tr0.s || 0) * 4 + (tr0.ss || 0) * 5) / tot : null);
    const rl = REC_TR[y.rec] || (rm == null ? null : rm < 1.5 ? 'GÜÇLÜ AL' : rm < 2.5 ? 'AL' : rm < 3.5 ? 'TUT' : rm < 4.5 ? 'SAT' : 'GÜÇLÜ SAT');
    const pos = y.lo != null && y.hi > y.lo && y.px ? Math.max(0, Math.min(100, (y.px - y.lo) / (y.hi - y.lo) * 100)) : null;
    const mp = y.lo != null && y.hi > y.lo && y.mean ? (y.mean - y.lo) / (y.hi - y.lo) * 100 : null;
    const cur = y.cur && y.cur !== 'TRY' ? ' ' + esc(y.cur) : ' TL', n2 = v => v == null ? '—' : fmt(v, v >= 100 ? 0 : 2) + cur;
    const dB = bull(tr0) != null && bull(tr3) != null ? bull(tr0) - bull(tr3) : null;
    h += `<div class="row" style="gap:12px;align-items:center;margin-bottom:10px">${rl ? tagH(rl) : ''}<span class="sm"><b>${y.n}</b> analistin ortalaması${rm ? ` <span class="mut">(1 = güçlü al … 5 = güçlü sat: ${fmt(rm, 1)})</span>` : ''}</span></div>
    ${tot ? `<div class="cbar" role="img" aria-label="Öneri dağılımı">${[['sb', 'Güçlü al', 'up'], ['b', 'Al', 'up2'], ['h', 'Tut', 'mid'], ['s', 'Sat', 'dn2'], ['ss', 'Güçlü sat', 'dn']].filter(([k]) => tr0[k]).map(([k, l, c]) => `<i class="${c}" style="flex:${tr0[k]}" title="${l}: ${tr0[k]}">${tr0[k]}</i>`).join('')}</div>
    <div class="row xs mut" style="gap:12px;margin:5px 0 12px;flex-wrap:wrap"><span><i class="lg" style="background:var(--up)"></i>güçlü al</span><span><i class="lg" style="background:color-mix(in srgb,var(--up) 60%,var(--card))"></i>al</span><span><i class="lg" style="background:var(--mut)"></i>tut</span><span><i class="lg" style="background:var(--dn)"></i>sat</span></div>` : ''}
    <div class="lv"><span>Ortalama hedef fiyat</span><span>${n2(y.mean)} <span class="xs ${cls(up)}">${fpct(up)}</span></span>
      ${y.med ? `<span>Medyan hedef</span><span>${n2(y.med)}</span>` : ''}<span>En düşük – en yüksek</span><span>${n2(y.lo)} – ${n2(y.hi)}</span></div>
    ${pos != null ? `<div class="trng" role="img" aria-label="Fiyatın hedef aralığındaki yeri"><b style="left:${mp}%" title="ortalama hedef"></b><i style="left:${pos}%" title="bugünkü fiyat"></i></div><div class="row xs mut" style="justify-content:space-between"><span>en düşük hedef</span><span>▲ bugünkü fiyat · ┃ ortalama</span><span>en yüksek</span></div>` : ''}
    ${dB != null && Math.abs(dB) >= .08 ? `<p class="xs" style="margin:8px 0 0">Son 3 ayda "al" diyenlerin payı ${dB > 0 ? '<span class="up">arttı</span>' : '<span class="dn">azaldı</span>'} (${fpc(bull(tr3), 0)} → ${fpc(bull(tr0), 0)}).</p>` : ''}`;
  }
  if (i && i.oneri) {
    const ch = i.oHedef && i.hedef ? i.hedef / i.oHedef - 1 : null;
    h += `<div style="${h ? 'margin-top:16px;padding-top:14px;border-top:1px solid var(--line)' : ''}"><div class="row" style="gap:10px;align-items:center;margin-bottom:8px"><b>İş Yatırım</b>${tagH(/^(AL|TUT|SAT)$/.test(i.oneri) ? i.oneri : 'TUT').replace(/>[^<]*</, '>' + esc(i.oneri) + '<')}<span class="xs mut">${esc(i.tarih || '')}${i.analist ? ' · ' + esc(i.analist) : ''}</span></div>
    <div class="lv">${i.hedef ? `<span>Hedef fiyat</span><span>${fmt(i.hedef, 2)} TL <span class="xs ${cls(lastOf(a).v ? i.hedef / lastOf(a).v - 1 : null)}">${lastOf(a).v ? fpct(i.hedef / lastOf(a).v - 1) : ''}</span></span>` : ''}
      ${i.oHedef ? `<span>Önceki hedef</span><span>${fmt(i.oHedef, 2)} TL <span class="xs mut">${esc(i.oTarih || '')}${ch != null ? ' · ' + fpct(ch) : ''}</span></span>` : ''}
      ${i.carpan?.fk ? `<span>Tahmini F/K · FD/FAVÖK</span><span>${fx(i.carpan.fk, 1)} · ${fx(i.carpan.fdfavok, 1)}</span>` : ''}
      ${i.tahmin?.netkar ? `<span>Yıl sonu net kâr tahmini</span><span>${fbig(i.tahmin.netkar * 1e6)}</span>` : ''}</div>
    ${i.tema ? `<p class="sm" style="margin:10px 0 0"><span class="mut">Yatırım teması:</span> ${esc(i.tema)}</p>` : ''}
    <p class="xs mut" style="margin:6px 0 0">Kaynak: <a href="https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/sirket-karti.aspx?hisse=${encodeURIComponent(a.sym)}" target="_blank" rel="noopener">İş Yatırım şirket kartı</a></p></div>`;
  }
  return h + `<p class="xs mut" style="margin:12px 0 0">${y && y.n ? 'Konsensüs: Yahoo Finance (aracı kurum tahminlerinin derlemesi). ' : ''}Hedefler genelde 12 aylıktır ve sık güncellenir; tek başına alım-satım sebebi değildir.${a.insAt ? ' Güncelleme ' + new Date(a.insAt).toLocaleDateString('tr-TR') + '.' : ''}</p>`;
}
// Kural tabanlı karne: güçlü yanlar ve dikkat edilecekler, sade dille
function karne(a) {
  const r = C.ratios(a), good = [], bad = [], info = [];
  const y = a.ins?.y, i = a.ins?.i, sk = sektorOf(a), inf = infl(), pio = isBist(a) ? C.piotroski(a) : null;
  if (r) {
    if (r.negNI) bad.push('Son 12 ayda <b>zarar</b> etmiş; F/K hesaplanamıyor, değerleme varlıklara (PD/DD) dayanır.');
    if (sk && r.pe && sk.fk) { const d = r.pe / sk.fk - 1; if (d < -.3) good.push(`F/K (${fx(r.pe, 1)}) ${esc(sk.ad)} sektörü medyanının (${fx(sk.fk, 1)}) <b>%${fmt(-d * 100, 0)} altında</b>.`); else if (d > .4) bad.push(`F/K (${fx(r.pe, 1)}) sektör medyanının (${fx(sk.fk, 1)}) %${fmt(d * 100, 0)} üstünde: piyasa yüksek büyüme fiyatlıyor.`); }
    if (sk && r.pb && sk.pddd) { const d = r.pb / sk.pddd - 1; if (d < -.3) good.push(`PD/DD (${fx(r.pb)}) sektör medyanının (${fx(sk.pddd)}) %${fmt(-d * 100, 0)} altında.`); }
    if (!sk && r.pe && r.pe < 8) good.push(`F/K ${fx(r.pe, 1)}: kârına göre düşük fiyatlı.`);
    if (r.roe != null && inf) { const real = (1 + r.roe) / (1 + inf) - 1; if (real > .05) good.push(`Özkaynak kârlılığı ${fpc(r.roe)}, enflasyon beklentisinin (${esc(inflSrc())}) üstünde: <b>reel kâr</b> üretiyor.`); else if (real < -.05) bad.push(`Özkaynak kârlılığı ${fpc(r.roe)}, enflasyon beklentisinin (${esc(inflSrc())}) altında: ortakların parası reelde eriyor.`); }
    else if (r.roe != null && r.roe > .25) good.push(`Özkaynak kârlılığı yüksek (${fpc(r.roe)}).`);
    if (r.revG != null && inf) { if (r.revG < inf - .05) bad.push(`Satışlar yıllık ${fpct(r.revG)} büyümüş; enflasyonun altında, yani <b>reel küçülme</b> var.`); else if (r.revG > inf + .1) good.push(`Satışlar enflasyonun üstünde büyüyor (${fpct(r.revG)}).`); }
    if (r.nd != null && r.nd < 0) good.push('<b>Net nakit</b> pozisyonunda: nakdi finansal borcundan fazla.');
    else if (r.ndEbitda != null && r.ndEbitda > 3) bad.push(`Net borç ${fx(r.ndEbitda, 1)} yıllık FAVÖK'e eşit: borç yükü yüksek, faiz artışlarına duyarlı.`);
    if (r.cr != null && r.cr < 1) bad.push(`Cari oran ${fx(r.cr)}: kısa vadeli borçlar dönen varlıklardan fazla.`);
    if (r.cfoNi != null) { if (r.cfoNi >= 1) good.push(`Kâr nakde dönüyor (işletme nakit akışı net kârın ${fmt(r.cfoNi, 1)} katı).`); else if (r.cfoNi < .5) bad.push(`İşletme nakit akışı net kârın yalnız ${fpc(r.cfoNi, 0)}'i: kârın bir kısmı kâğıt üstünde (tek seferlik gelir, kur farkı ya da tahsil edilmemiş alacak) olabilir.`); }
    if (r.fcfY != null) { if (r.fcfY > .08) good.push(`Serbest nakit akışı verimi ${fpc(r.fcfY)}: fiyatına göre güçlü nakit üretiyor.`); else if (r.fcf < 0) info.push('Serbest nakit akışı eksi: yatırım harcamaları nakit üretimini aşıyor (büyüme dönemi ya da sıkışma).'); }
    if (r.fxpEq != null && r.fxpEq < -.3) bad.push(`Net döviz açığı özkaynağın ${fpc(-r.fxpEq, 0)}'i: TL'deki ani değer kaybı kârı vurabilir.`);
    else if (r.fxpEq != null && r.fxpEq > .3) info.push('Net döviz fazlası var: kur artışından olumlu etkilenir.');
  }
  if (pio) (pio.score >= 7 ? good : pio.score <= 3 ? bad : info).push(`Piotroski skoru <b>${pio.score}/${pio.n}</b>: ${pio.score >= 7 ? 'finansallar geçen yıla göre belirgin iyileşmiş' : pio.score <= 3 ? 'finansallar geçen yıla göre zayıflamış' : 'karışık tablo'}.`);
  if (i?.tahmin?.netkar && r) { const cur = C.finSorted(a.fin).slice(-1)[0]; const ttmNi = (() => { const s = C.finSorted(a.fin); const c = s[s.length - 1]; if (!c || c.ni == null) return null; if (c.m === 12) return c.ni; const fy = s.find(f => f.y === c.y - 1 && f.m === 12), py = s.find(f => f.y === c.y - 1 && f.m === c.m); return fy && py ? c.ni + fy.ni - py.ni : null; })(); if (ttmNi > 0 && cur) { const g = i.tahmin.netkar * 1e6 / ttmNi - 1; info.push(`İş Yatırım yıl sonu net kâr tahmini son 12 aya göre ${fpc(Math.abs(g))} ${g >= 0 ? 'artış' : 'düşüş'} öngörüyor.`); } }
  if (y && y.mean && y.px && y.n >= 3) { const up = y.mean / y.px - 1; (up > .25 ? good : up < -.05 ? bad : info).push(`${y.n} analistin ortalama hedefi bugünkü fiyatın ${fpct(up)} ${up >= 0 ? 'üstünde' : 'altında'}.`); }
  if (y?.beta != null && a.mkt === 'US') info.push(`Beta ${fmt(y.beta, 2)}: endeks %10 hareket ettiğinde bu hisse geçmişte ortalama %${fmt(y.beta * 10, 0)} oynamış${y.beta > 1.3 ? ' (oynak)' : y.beta < .7 ? ' (sakin)' : ''}.`);
  const dvv = i?.temettu?.filter(d => /\d{4}$/.test(d.d)); if (dvv && dvv.length) { const yrs = new Set(dvv.map(d => d.d.slice(-4))); const last = dvv[0]; info.push(`Son temettü ${esc(last.d)} (verim %${fmt(last.verim, 2)}); listede son ${yrs.size} dağıtım yılı var.`); }
  else if (y?.divY) info.push(`Temettü verimi %${fmt(y.divY * 100, 2)}.`);
  if (y?.ins != null && y.ins > .5) info.push(`Payların ${fpc(y.ins, 0)}'i içeridekilerde (ana ortak): halka açık kısım dar, fiyat sert oynayabilir.`);
  return { good, bad, info, pio };
}
function karneHtml(a) {
  const k = karne(a); if (!k.good.length && !k.bad.length && !k.info.length) return '';
  const ul = (L, c) => L.length ? `<ul class="why ${c}">${L.map(x => `<li>${x}</li>`).join('')}</ul>` : '';
  return `${k.good.length ? '<h4 class="up" style="margin:0 0 4px">Güçlü yanlar</h4>' + ul(k.good, 'g') : ''}${k.bad.length ? '<h4 class="dn" style="margin:12px 0 4px">Dikkat edilecekler</h4>' + ul(k.bad, 'b') : ''}${k.info.length ? '<h4 class="mut" style="margin:12px 0 4px">Bilgi notları</h4>' + ul(k.info, '') : ''}
  <p class="xs mut" style="margin:10px 0 0">Kurallara dayalı otomatik yorum; yatırım tavsiyesi değildir. Sektör medyanları İş Yatırım verisinden, enflasyon beklentisi Ayarlar'dan ya da TCMB piyasa katılımcıları anketinden.</p>`;
}
function insightGrid(a) {
  if (a.type !== 'hisse') return '';
  const an = analystHtml(a), kn = karneHtml(a), cl = calHtml(a);
  if (!an && !kn && !cl) return `<div class="note" style="margin-top:24px">Analist beklentileri ve otomatik yorumlar günlük güncellemeyle gelir${DESK ? ' (sağ üstten "Verileri güncelle")' : ''}.</div>`;
  return `<div class="grid g2" style="margin-top:24px">
    <div class="card"><h3>Analist beklentileri</h3>${an || '<p class="sm mut">Bu hisseyi izleyen analist verisi bulunamadı.</p>'}</div>
    <div class="card"><h3>Karne · otomatik yorum</h3>${kn || '<p class="sm mut">Yorum için mali tablo gerekli.</p>'}${cl ? `<h3 style="margin-top:18px">Yaklaşan olaylar</h3>${cl}` : ''}</div>
  </div>`;
}
// Ana sayfa için: portföy ve takip listesindeki hisselerin 14 gün içindeki olayları
function upcomingAll() {
  const out = []; for (const a of Object.values(S.assets)) { if (a.type !== 'hisse') continue; for (const x of calFor(a)) if (dayDiff(today(), x.d) <= 14) out.push({ ...x, sym: a.sym }); }
  return out.sort((p, q) => p.d.localeCompare(q.d));
}

/* ================= Aylık alım asistanı, simülatör, temettü, fon seçici, vergi, rapor ================= */
const MAC = () => S.macro || {};
const cpiN = n => { const ms = C.cpiMonths(S.cpi); if (ms.length < n) return null; return ms.slice(-n).reduce((f, m) => f * (1 + (+S.cpi[m] || 0) / 100), 1) - 1; };
const depNet = () => (C.num(S.settings.depRate) || 36) / 100;
const ymNow = () => today().slice(0, 7);
const monthBuys = ym => Object.values(S.txns).filter(t => t.side === 'AL' && t.d && t.d.slice(0, 7) === ym).reduce((s, t) => s + +t.qty * +t.price + (+t.fee || 0), 0);
function dcaStatus() {
  const mon = C.num(S.settings.monthly); if (!(mon > 0)) return null;
  const ym = ymNow(), done = monthBuys(ym); let streak = 0, y = ym;
  const months = []; for (let i = 0; i < 12; i++) { months.push(y); y = prevYm(y); }
  const hit = months.slice(1).filter(m => monthBuys(m) >= mon * .5).length;
  for (const m of months.slice(1)) { if (monthBuys(m) >= mon * .5) streak++; else break; }
  const day = +S.settings.dcaDay || null, td = +today().slice(8, 10);
  return { mon, done, left: Math.max(0, mon - done), hit, streak, day, due: day && td >= day && done < mon * .5 };
}
function assetHint(sym) {
  const a = S.assets[sym]; if (!a) return '';
  const s = sig(a), l = s?.comb?.label, out = [];
  if (l === 'SAT' || l === 'GÜÇLÜ SAT') out.push(`<span class="dn" title="Teknik ve temel sinyal">sinyal ${l}</span>`);
  const t = s?.comb?.t; if (t && t.rsi != null && t.rsi > 75) out.push('<span class="dn" title="RSI 75 üstü: kısa vadede sert yükselmiş">ısınmış</span>');
  if (staleDays(a)) out.push('<span class="mut">fiyat eski</span>');
  return out.length ? ' <span class="xs">(' + out.join(', ') + ')</span>' : '';
}

/* ---- Düzenli alım simülatörü ---- */
function simSeries(key) {
  const B = S.bench || {};
  if (key === '@usd') return { ad: 'Dolar (USD/TL)', s: B.usd }; if (key === '@gold') return { ad: 'Gram altın', s: B.gold }; if (key === '@xu') return { ad: 'BIST 100', s: B.xu100 };
  const a = S.assets[key]; return a && a.px && a.px.length > 60 ? { ad: key, s: a.px.map(r => [r[0], r[4]]) } : null;
}
function dcaSim(ser, amt, yrs) {
  if (!ser || ser.length < 30) return null;
  const end = ser[ser.length - 1][0], startD = new Date(Date.parse(end) - yrs * 365.25 * 864e5).toISOString().slice(0, 10);
  const first = ser.find(r => r[0] >= startD); if (!first) return null;
  const buys = []; let ym = null;
  for (const r of ser) { if (r[0] < first[0]) continue; const m = r[0].slice(0, 7); if (m !== ym) { ym = m; if (r[0].slice(0, 7) !== end.slice(0, 7) || buys.length === 0) buys.push({ d: r[0], p: r[1] }); } }
  if (buys.length < 2) return null;
  const last = ser[ser.length - 1][1]; let units = 0; buys.forEach(b => units += amt / b.p);
  const inv = amt * buys.length, val = units * last;
  const x = xirr([...buys.map(b => ({ d: b.d, a: -amt })), { d: end, a: val }]);
  const lump = inv / buys[0].p * last;   // aynı toplamı ilk ay tek seferde
  let need = null; if (C.cpiMonths(S.cpi).length) { const upTo = C.cpiMonths(S.cpi).slice(-1)[0]; need = buys.reduce((s, b) => s + amt * (C.cpiFactor(S.cpi, b.d, upTo) ?? 1), 0); }
  const best = buys.reduce((m, b) => b.p < m.p ? b : m), worst = buys.reduce((m, b) => b.p > m.p ? b : m);
  const avgCost = inv / units;
  return { n: buys.length, from: buys[0].d, end, inv, val, x, lump, need, best, worst, avgCost, avgPx: buys.reduce((s, b) => s + b.p, 0) / buys.length, last };
}
function rSim() {
  const sel = $('#simSym'); if (!sel) return;
  const opts = [['@xu', 'BIST 100'], ['@gold', 'Gram altın'], ['@usd', 'Dolar (USD/TL)'], ...Object.values(S.assets).filter(a => a.px && a.px.length > 60).sort((a, b) => a.sym.localeCompare(b.sym)).map(a => [a.sym, `${a.sym}${a.name ? ' · ' + a.name.slice(0, 28) : ''}`])];
  const cur = sel.value || S.settings.simSym || '@xu';
  sel.innerHTML = opts.map(([k, l]) => `<option value="${esc(k)}"${k === cur ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const ss = simSeries(sel.value), amt = C.num($('#simAmt').value) || 0, yrs = +$('#simYrs').value;
  const r = ss && amt > 0 ? dcaSim(ss.s, amt, yrs) : null;
  if (!r) { $('#simBox').innerHTML = '<p class="sm mut">Bu varlık için yeterli fiyat geçmişi yok (karşılaştırma serileri tam güncellemede gelir).</p>'; return; }
  const short = dayDiff(r.from, r.end) < yrs * 365 - 45;
  $('#simBox').innerHTML = `<div class="rpk">
    <div><span class="xs mut">${r.n} ay × ${fm(amt)}</span><b>${fm(r.inv)}</b><span class="xs mut">toplam yatırılan</span></div>
    <div><span class="xs mut">Bugünkü değer</span><b class="${cls(r.val - r.inv)}">${fm(r.val)}</b><span class="xs ${cls(r.val - r.inv)}">${fpct(r.val / r.inv - 1)} · yıllık ${fpct(r.x)}</span></div>
    ${r.need ? `<div><span class="xs mut">Enflasyonu yakalamak için</span><b>${fm(r.need)}</b><span class="xs ${cls(r.val - r.need)}">${r.val >= r.need ? 'enflasyonu yendi' : 'enflasyonun gerisinde'} (${fm(r.val - r.need)})</span></div>` : ''}
    <div><span class="xs mut">Tek seferde ilk ay yatırsaydın</span><b>${fm(r.lump)}</b><span class="xs mut">${r.lump > r.val ? 'tek seferlik daha iyi olurdu' : 'düzenli alım daha iyi oldu'}</span></div>
  </div>
  <p class="sm" style="margin:12px 0 0">Ortalama maliyetin <b>${fmt(r.avgCost, 2)}</b>, aynı ayların ortalama fiyatı ${fmt(r.avgPx, 2)}: düzenli alım, ucuz aylarda daha çok adet aldırdığı için ortalama maliyeti fiyat ortalamasının ${r.avgCost <= r.avgPx ? 'altına' : 'üstüne'} çeker. En ucuz alım ${dtr(r.best.d)} (${fmt(r.best.p, 2)}), en pahalı ${dtr(r.worst.d)} (${fmt(r.worst.p, 2)}).${short ? ` <span class="mut">Fiyat geçmişi ${dtr(r.from)} tarihinden başlıyor.</span>` : ''}</p>`;
}
document.addEventListener('change', e => { if (['simSym', 'simYrs'].includes(e.target.id)) { if (e.target.id === 'simSym') { S.settings.simSym = e.target.value; } rSim(); } });
document.addEventListener('input', e => { if (e.target.id === 'simAmt') rSim(); });

/* ---- Temettü ---- */
const trD = s => { const m = String(s || '').match(/^(\d{2})\.(\d{2})\.(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
function divRows() {
  const P = portfolio(), out = [];
  for (const p of P.pos.filter(p => p.qty > 0)) {
    const a = S.assets[p.sym]; if (!a || a.type !== 'hisse') continue;
    const px = lastOf(a).v; let hb = null, src = '';
    const L = (a.ins?.i?.temettu || []).map(d => ({ d: trD(d.d), hb: d.hb })).filter(d => d.d && d.hb > 0 && dayDiff(d.d, today()) <= 380);
    if (L.length) { hb = L.reduce((s, d) => s + d.hb, 0); src = 'İş Yatırım'; }
    else if (a.ins?.y?.divY > 0 && px) { hb = a.ins.y.divY * px; src = 'Yahoo verim'; }
    const up = calFor(a).filter(x => /Temettü/.test(x.t));
    out.push({ sym: p.sym, qty: p.qty, px, hb, src, gross: hb != null ? hb * p.qty : null, net: hb != null ? hb * p.qty * (a.mkt === 'US' ? 1 : .85) : null, y: hb && px ? hb / px : null, us: a.mkt === 'US', up, last: L[0]?.d });
  }
  return out;
}
function rDiv() {
  const R = divRows(); if (!$('#divTable')) return;
  if (!R.length) { $('#divTable').innerHTML = '<tbody><tr><td class="mut">Portföyünde hisse yok.</td></tr></tbody>'; $('#divNote').textContent = ''; return; }
  const tot = R.reduce((s, r) => s + (r.net || 0), 0);
  $('#divTable').innerHTML = `<thead><tr><th>Hisse</th><th class="n">Adet</th><th class="n">Son 12 ay hisse başı</th><th class="n">Verim</th><th class="n">Yıllık tahmini (net)</th><th>Yaklaşan</th></tr></thead><tbody>${R.map(r => `<tr><td><b>${esc(r.sym)}</b>${r.src ? `<br><span class="xs mut">${r.src}${r.last ? ' · son ' + dtr(r.last) : ''}</span>` : ''}</td><td class="n">${fmt(r.qty, r.qty % 1 ? 4 : 0)}</td><td class="n">${r.hb != null ? fmt(r.hb, r.hb < 10 ? 3 : 2) + (r.us ? ' TL*' : ' TL') : '<span class="mut">dağıtmamış</span>'}</td><td class="n">${r.y != null ? '%' + fmt(r.y * 100, 2) : '—'}</td><td class="n">${r.net != null ? fm(r.net) : '—'}</td><td class="sm">${r.up.length ? r.up.map(x => `${dtr(x.d)} ${x.idx && DESK ? `<a href="#" data-det="${esc(x.idx)}">KAP</a>` : ''}`).join('<br>') : '<span class="mut">—</span>'}</td></tr>`).join('')}<tr><td colspan="4"><b>Toplam</b></td><td class="n"><b>${fm(tot)}</b></td><td></td></tr></tbody>`;
  $('#divNote').innerHTML = `Tahmin geçen yılın temettüsüne dayanır; şirket bu yıl daha az ya da hiç dağıtmayabilir. ${R.some(r => r.us) ? '* Yabancı hisselerde Yahoo temettü verimi bugünkü fiyata uygulanır; ABD %15–30 kaynak vergisi keser ve Türkiye\'de beyan gerekebilir (Vergi sekmesi). ' : ''}Ayda ortalama ${fm(tot / 12)}.`;
}

/* ---- Fon seçici ---- */
let fsSort = 'g1y', fsDir = -1;
function fonRows() { const F = S.fonlar; if (!F || !F.rows) return []; const c = F.cols; return F.rows.map(r => Object.fromEntries(c.map((k, i) => [k, r[i]]))); }
function rFonsec() {
  const F = S.fonlar, all = fonRows(), c12 = cpiN(12), c36 = cpiN(36), dep = depNet();
  $('#fsInfo').innerHTML = F ? `Kaynak: TEFAS · ${all.length} fon · güncelleme ${esc(new Date(F.at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }))}${c12 != null ? ` · son 12 ay TÜFE %${fmt(c12 * 100, 1)}` : ''}` : 'Fon kataloğu ilk tam güncellemede gelir (sağ üstten "Verileri güncelle").';
  // senin fonların
  const P = portfolio(), held = P.pos.filter(p => p.qty > 0 && S.assets[p.sym]?.type === 'fon').map(p => p.sym), byK = Object.fromEntries(all.map(r => [r.kod, r]));
  const turMed = {}; for (const r of all) (turMed[r.tip + r.tur] = turMed[r.tip + r.tur] || []).push(r.g1y);
  const mm = k => { const v = (turMed[k] || []).filter(x => x != null).sort((a, b) => a - b); return v.length ? v[v.length >> 1] : null; };
  const rankIn = r => { const L = all.filter(x => x.tip === r.tip && x.tur === r.tur && x.g1y != null).sort((a, b) => b.g1y - a.g1y); const i = L.findIndex(x => x.kod === r.kod); return i >= 0 ? [i + 1, L.length] : null; };
  const mine = held.map(k => byK[k]).filter(Boolean);
  $('#fsMine').innerHTML = !F ? '<p class="sm mut">Katalog bekleniyor.</p>' : !held.length ? '<p class="sm mut">Portföyünde fon yok.</p>' : `<div class="scroll"><table><thead><tr><th>Fon</th><th class="n">1 yıl</th><th class="n">Türünün medyanı</th><th class="n">Türünde sıra</th><th class="n">Reel (TÜFE sonrası)</th><th class="n">Mevduata göre</th><th class="n">3 yıl (yıllık)</th><th>Değerlendirme</th></tr></thead><tbody>${mine.map(r => {
      const g = r.g1y != null ? r.g1y / 100 : null, real = g != null && c12 != null ? (1 + g) / (1 + c12) - 1 : null, vsDep = g != null ? g - dep : null, rk = rankIn(r), md = mm(r.tip + r.tur);
      const g3 = r.g3y != null ? Math.pow(1 + r.g3y / 100, 1 / 3) - 1 : null, c3 = c36 != null ? Math.pow(1 + c36, 1 / 3) - 1 : null;
      const v = g == null ? '<span class="mut">1 yıllık geçmiş yok</span>' : real > 0 && vsDep > 0 ? '<span class="up">Enflasyonu ve mevduatı yendi</span>' : real > 0 ? '<span>Enflasyonu yendi, mevduatın gerisinde</span>' : '<span class="dn">Enflasyonun gerisinde</span>';
      return `<tr><td><b>${esc(r.kod)}</b><br><span class="xs mut">${esc(r.tur)} · risk ${r.risk ?? '—'}</span></td><td class="n ${cls(g)}">${fpct(g)}</td><td class="n">${md != null ? fpct(md / 100) : '—'}</td><td class="n">${rk ? `${rk[0]} / ${rk[1]}` : '—'}</td><td class="n ${cls(real)}">${fpct(real)}</td><td class="n ${cls(vsDep)}">${vsDep != null ? (vsDep >= 0 ? '+' : '−') + fmt(Math.abs(vsDep) * 100, 1) + ' puan' : '—'}</td><td class="n">${g3 != null ? fpct(g3) + (c3 != null ? `<br><span class="xs ${cls(g3 - c3)}">TÜFE ${fpct(c3)}</span>` : '') : '—'}</td><td class="sm">${v}</td></tr>`;
    }).join('')}</tbody></table></div><p class="xs mut" style="margin:8px 0 0">Mevduat karşılaştırması net yıllık %${fmt(dep * 100, 1)} ile (Plan sekmesinden değiştirilebilir). ${MAC().pka?.tufe12 ? `Piyasa katılımcıları önümüzdeki 12 ay için %${fmt(MAC().pka.tufe12, 1)} enflasyon bekliyor; bundan sonra reel kazanç için fonun bunun üstünde getirmesi gerekir.` : ''}</p>`;
  // filtreler
  const tip = $('#fsTip').value || 'YAT', turs = [...new Set(all.filter(r => r.tip === tip).map(r => r.tur))].sort();
  const tsel = $('#fsTur'), tv = tsel.value; tsel.innerHTML = '<option value="">Tümü</option>' + turs.map(t => `<option${t === tv ? ' selected' : ''}>${esc(t)}</option>`).join('');
  const q = C.norm($('#fsQ').value), maxR = +$('#fsRisk').value || 7;
  let L = all.filter(r => r.tip === tip && (!tsel.value || r.tur === tsel.value) && ($('#fsSerbest').checked || tsel.value === 'Serbest' || r.tur !== 'Serbest') && (r.risk == null || r.risk <= maxR) && (!q || C.norm(r.kod + ' ' + r.ad).includes(q)));
  L.forEach(r => r.real = r.g1y != null && c12 != null ? (1 + r.g1y / 100) / (1 + c12) - 1 : null);
  L.sort((a, b) => { const x = a[fsSort], y = b[fsSort]; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * fsDir; });
  const th = (k, l) => `<th class="n" data-fss="${k}" style="cursor:pointer">${l}${fsSort === k ? (fsDir < 0 ? ' ↓' : ' ↑') : ''}</th>`;
  const pc = v => v == null ? '—' : `<span class="${cls(v)}">${fpct(v / 100)}</span>`;
  $('#fsTable').innerHTML = !F ? '' : `<thead><tr><th>Fon</th>${th('risk', 'Risk')}${th('g1a', '1 ay')}${th('g3a', '3 ay')}${th('g6a', '6 ay')}${th('gyb', 'Yıl başı')}${th('g1y', '1 yıl')}${th('real', 'Reel 1 yıl')}${th('g3y', '3 yıl')}${th('g5y', '5 yıl')}<th></th></tr></thead><tbody>${L.slice(0, 150).map(r => `<tr${held.includes(r.kod) ? ' style="background:var(--soft)"' : ''}><td style="min-width:300px"><b>${esc(r.kod)}</b> <span class="xs mut">${esc(r.tur)}</span><br><span class="xs">${esc(r.ad)}</span></td><td class="n">${r.risk ?? '—'}</td><td class="n">${pc(r.g1a)}</td><td class="n">${pc(r.g3a)}</td><td class="n">${pc(r.g6a)}</td><td class="n">${pc(r.gyb)}</td><td class="n"><b>${pc(r.g1y)}</b></td><td class="n">${r.real != null ? `<span class="${cls(r.real)}">${fpct(r.real)}</span>` : '—'}</td><td class="n">${pc(r.g3y)}</td><td class="n">${pc(r.g5y)}</td><td>${S.assets[r.kod] ? '<span class="xs mut">listede</span>' : `<button class="ghost sm" style="white-space:nowrap" data-fwatch="${esc(r.kod)}" data-ad="${esc(r.ad)}">Takibe al</button>`}</td></tr>`).join('')}</tbody>${L.length > 150 ? `<tfoot><tr><td colspan="11" class="xs mut">${L.length} fondan ilk 150'si gösteriliyor; aramayı daralt.</td></tr></tfoot>` : ''}`;
}
document.addEventListener('click', async e => {
  const h = e.target.closest('[data-fss]'); if (h) { const k = h.dataset.fss; if (fsSort === k) fsDir *= -1; else { fsSort = k; fsDir = k === 'risk' ? 1 : -1; } rFonsec(); return; }
  const w = e.target.closest('[data-fwatch]'); if (w) { const k = w.dataset.fwatch; const a = ensureAsset(k, 'fon'); if (!a.name) a.name = w.dataset.ad; await putAsset(a); toast(`${k} İncele sekmesine eklendi; fiyat geçmişi ve içeriği çekiliyor.`); if (DESK) pRefresh([k]).catch(() => { }); rFonsec(); }
});
document.addEventListener('change', e => { if (['fsTip', 'fsTur', 'fsRisk', 'fsSerbest'].includes(e.target.id)) rFonsec(); });
document.addEventListener('input', e => { if (e.target.id === 'fsQ') rFonsec(); });

/* ---- Vergi ---- */
const isForeign = sym => S.assets[sym]?.type === 'hisse' && S.assets[sym]?.mkt === 'US';
function rVergi() {
  const yNow = +today().slice(0, 4), ysel = $('#vgYil');
  const years = [...new Set([yNow, yNow - 1, ...Object.values(S.txns).map(t => +String(t.d).slice(0, 4))])].filter(y => y >= 2020 && y <= yNow).sort((a, b) => b - a);
  const def = +today().slice(5, 7) <= 3 ? yNow - 1 : yNow, cur = +ysel.value || def;
  ysel.innerHTML = years.map(y => `<option${y === cur ? ' selected' : ''}>${y}</option>`).join('');
  const Y = +ysel.value || cur;
  $('#vgDue').innerHTML = `${Y} gelirleri için beyanname <b>1–31 Mart ${Y + 1}</b> arasında verilir; vergi Mart ve Temmuz'da iki taksitte ödenir.`;
  const ufe = MAC().ufe || null;
  const tx = Object.values(S.txns).filter(t => isForeign(t.sym));
  const L = C.taxFifo(tx, Y, ufe);
  const tg = L.reduce((s, r) => s + r.gain, 0), miss = L.some(r => r.miss);
  $('#vgFor').innerHTML = !L.length ? `<tbody><tr><td class="mut">${Y} yılında yurt dışı hisse satışın yok.${tx.length ? '' : ' (Yabancı hisse işlemi girilmemiş.)'}</td></tr></tbody>` : `<thead><tr><th>Hisse</th><th>Alış → satış</th><th class="n">Adet</th><th class="n">Alış bedeli</th><th class="n">Yİ-ÜFE artışı</th><th class="n">Endeksli maliyet</th><th class="n">Satış bedeli</th><th class="n">Kazanç</th></tr></thead><tbody>${L.map(r => `<tr><td><b>${esc(r.sym)}</b></td><td class="sm">${dtr(r.buy)} → ${dtr(r.sell)}</td><td class="n">${fmt(r.q, r.q % 1 ? 4 : 0)}</td><td class="n">${fm(r.cost)}</td><td class="n">${r.f != null ? `${fpc(r.f - 1)}${r.idx ? '' : ' <span class="xs mut">(%10 altı)</span>'}` : '<span class="dn xs">endeks eksik</span>'}</td><td class="n">${fm(r.icost)}</td><td class="n">${fm(r.proc)}</td><td class="n ${cls(r.gain)}">${fm(r.gain)}</td></tr>`).join('')}<tr><td colspan="7"><b>Toplam (zararlar kârdan düşülür)</b></td><td class="n ${cls(tg)}"><b>${fm(tg)}</b></td></tr></tbody>`;
  $('#vgForNote').innerHTML = `Tutarlar işlemi girdiğin TL fiyatlarıyla hesaplandı. Beyanda alış ve satış bedeli, işlem günündeki <b>TCMB döviz alış kuruyla</b> TL'ye çevrilir; aracı kurumunun dökümündeki dolar tutarlarla karşılaştır. Komisyonlar maliyete eklendi, satış tutarından düşüldü.${miss ? ' <span class="dn">Bazı aylar için Yİ-ÜFE verisi yok (tam güncellemede TCMB\'den gelir).</span>' : ''}${ufe ? '' : ' <span class="dn">Yİ-ÜFE verisi henüz çekilmedi.</span>'}`;
  // temettü
  const fd = (S.settings.fdiv || {})[Y]; const est = divRows().filter(r => r.us).reduce((s, r) => s + (r.gross || 0), 0);
  const lim = Y >= 2026 ? 22000 : 18000;
  $('#vgDiv').innerHTML = `<p class="sm" style="margin-top:0">Yurt dışı hisselerden aldığın temettüler (vergi kesintisi Türkiye'de yapılmadığı için) toplamı <b>${fm(lim)}</b>'yi aşarsa tamamı beyan edilir; yurt dışında ödenen vergi, Türkiye'de hesaplanan vergiden belirli sınırlarla mahsup edilebilir.</p>
    <div class="row" style="gap:10px;align-items:flex-end;flex-wrap:wrap"><div><label for="vgFdiv">${Y} yılında aldığın yurt dışı temettü (brüt, TL)</label><input id="vgFdiv" inputmode="decimal" style="width:170px" value="${fd != null ? esc(String(fd)) : ''}" placeholder="${est ? fmt(est, 0) : '0'}"></div>${est ? `<span class="xs mut">Yahoo verimine göre tahmini yıllık ${fm(est)}; gerçek tutarı aracı kurum dökümünden yaz.</span>` : ''}</div>`;
  // özet
  const div = fd != null ? +fd : 0, divIn = div > lim ? div : 0, other = C.num(S.settings.vgOther) || 0;
  const matrah = Math.max(0, tg) + divIn, base = C.incomeTax(other, Y), tax = C.incomeTax(matrah + other, Y) - base;
  $('#vgSum').innerHTML = `<div class="row" style="gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px"><div><label for="vgOther">Beyana girecek diğer gelirin (kira vb., TL)</label><input id="vgOther" inputmode="decimal" style="width:170px" value="${other ? esc(String(other)) : ''}" placeholder="0"></div><span class="xs mut">Tek işverenden alınan ve sınırı aşmayan maaş genelde beyana girmez.</span></div>
    <div class="lv"><span>Yurt dışı hisse kazancı</span><span>${fm(Math.max(0, tg))}</span><span>Yurt dışı temettü ${div && !divIn ? '<span class="xs mut">(sınırın altında, beyan yok)</span>' : ''}</span><span>${fm(divIn)}</span><span><b>Bu gelirlerden doğan tahmini vergi</b></span><span><b>${fm(tax)}</b></span>${matrah + other > 0 ? `<span>Ortalama oran</span><span>${fpc(matrah ? tax / matrah : 0)}</span>` : ''}</div>
    <p class="xs mut" style="margin:10px 0 0">${Y} ücret dışı gelir tarifesiyle (${C.TARIFE[Y] ? '' : 'tarife bilinmediği için 2026 tarifesi, '}%15–%40) hesaplandı. ${matrah === 0 ? 'Beyan gerektiren kazanç görünmüyor.' : 'Beyan zorunlu görünüyor.'} Yurt dışında kesilen vergiler ve yıl içinde ödenen geçici vergiler hesaba katılmadı.</p>`;
  rTax();
}
document.addEventListener('change', async e => {
  if (e.target.id === 'vgYil') { rVergi(); return; }
  if (e.target.id === 'vgFdiv') { const Y = +$('#vgYil').value; const v = C.num(e.target.value); S.settings.fdiv = { ...(S.settings.fdiv || {}), [Y]: isFinite(v) ? v : null }; await putSettings(); rVergi(); return; }
  if (e.target.id === 'vgOther') { S.settings.vgOther = C.num(e.target.value) || null; await putSettings(); rVergi(); return; }
});

/* ---- Alım öncesi kontrol listesi ---- */
function txInfo() {
  const box = $('#txInfo'); if (!box) return;
  const side = $('#txSide').value, v = $('#txSym').value.trim(), sym = S.assets[v.toUpperCase()] ? v.toUpperCase() : S.assets[trKey(v)] ? trKey(v) : v.toUpperCase();
  $('#txChk').hidden = side !== 'AL';
  const n = [...document.querySelectorAll('[data-chk]')].filter(x => x.checked).length; $('#txChkN').textContent = n ? `${n}/5` : '';
  const a = S.assets[sym], qty = C.num($('#txQty').value), pr = C.num($('#txPrice').value), out = [];
  if (a) {
    const s = sig(a); if (s?.comb) out.push(`Sinyal: ${tagH(s.comb.label)}`);
    const y = a.ins?.y; if (y?.mean && y?.px && y.n >= 3) out.push(`${y.n} analistin ortalama hedefi ${fpct(y.mean / y.px - 1)}`);
    if (a.ins?.i?.oneri) out.push(`İş Yatırım: ${esc(a.ins.i.oneri)}`);
    const k = karne(a); if (k.bad.length) out.push(`<span class="dn">${k.bad.length} dikkat notu</span> (<a href="#analiz" data-goa="${esc(sym)}">karneye bak</a>)`);
  }
  if (qty > 0 && pr > 0) {
    const P = portfolio(), amt = qty * pr, tot = P.value + amt, cur = (P.pos.find(p => p.sym === sym)?.value) || 0, w = (cur + amt) / tot;
    out.push(`Alımdan sonra ${esc(sym)} portföyün <b class="${w > .1 ? 'dn' : ''}">%${fmt(w * 100, 1)}</b>'i olur`);
  }
  box.hidden = !out.length; box.innerHTML = out.join(' · ');
}
['txSym', 'txQty', 'txPrice', 'txSide'].forEach(id => { $('#' + id)?.addEventListener('input', txInfo); $('#' + id)?.addEventListener('change', txInfo); });
document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.chk != null) txInfo(); });
document.addEventListener('click', e => { const g = e.target.closest('[data-goa]'); if (g) { selA = g.dataset.goa; } });

/* ---- Aylık rapor ---- */
function qtyAt(sym, d) { let q = 0; for (const t of Object.values(S.txns)) if (t.sym === sym && t.d && t.d <= d) q += t.side === 'AL' ? +t.qty : -t.qty; return Math.max(0, q); }
function valuesAt(d) {
  const out = { tot: 0, cls: {}, sym: {} }; const syms = [...new Set(Object.values(S.txns).map(t => t.sym))];
  for (const s of syms) { const q = qtyAt(s, d); if (q <= 0) continue; const p = priceFn(s).f(d); if (p == null) continue; const v = q * p, ty = S.assets[s]?.type || 'fon'; out.tot += v; out.cls[ty] = (out.cls[ty] || 0) + v; out.sym[s] = { v, p, q }; }
  return out;
}
function rRapor() {
  const sel = $('#rpAy'); const first = Object.values(S.txns).map(t => t.d).filter(Boolean).sort()[0];
  if (!first) { $('#rpBody').innerHTML = '<div class="empty">Rapor için önce işlem gir.</div>'; sel.innerHTML = ''; return; }
  const months = []; let y = ymNow(); while (y >= first.slice(0, 7) && months.length < 24) { months.push(y); y = prevYm(y); }
  const cur = sel.value && months.includes(sel.value) ? sel.value : (+today().slice(8, 10) <= 7 && months[1] ? months[1] : months[0]);
  sel.innerHTML = months.map(m => `<option value="${m}"${m === cur ? ' selected' : ''}>${AYADI[+m.slice(5) - 1]} ${m.slice(0, 4)}</option>`).join('');
  const M = sel.value || cur, ad = `${AYADI[+M.slice(5) - 1]} ${M.slice(0, 4)}`;
  const d0 = (() => { const p = prevYm(M); const [yy, mm] = p.split('-').map(Number); return `${p}-${pad(new Date(yy, mm, 0).getDate())}`; })();
  const isCur = M === ymNow(), d1 = isCur ? today() : (() => { const [yy, mm] = M.split('-').map(Number); return `${M}-${pad(new Date(yy, mm, 0).getDate())}`; })();
  const V0 = valuesAt(d0), V1 = valuesAt(d1);
  const txm = Object.values(S.txns).filter(t => t.d && t.d.slice(0, 7) === M).sort((a, b) => a.d.localeCompare(b.d));
  const flow = txm.reduce((s, t) => s + (t.side === 'AL' ? 1 : -1) * (+t.qty * +t.price) + (t.side === 'AL' ? (+t.fee || 0) : 0), 0);
  const gain = V1.tot - V0.tot - flow, ret = V0.tot + flow / 2 > 0 ? gain / (V0.tot + flow / 2) : null;
  const cm = S.cpi[M] != null ? +S.cpi[M] / 100 : null, real = ret != null && cm != null ? (1 + ret) / (1 + cm) - 1 : null;
  const ch = Object.keys(V1.sym).filter(s => V0.sym[s] && V0.sym[s].p).map(s => ({ s, r: V1.sym[s].p / V0.sym[s].p - 1, v: V1.sym[s].v })).sort((a, b) => b.r - a.r);
  const ds = dcaStatus(), buys = monthBuys(M);
  const nws = (S.news || []).filter(n => n.d && String(n.d).slice(0, 7) === M).length;
  const upNext = upcomingAll ? Object.values(S.assets).filter(a => a.type === 'hisse').flatMap(a => calFor(a).map(x => ({ ...x, sym: a.sym }))).filter(x => x.d.slice(0, 7) > M).slice(0, 6) : [];
  $('#rpBody').innerHTML = `<div class="card"><h2 style="margin-top:0">${ad} raporu ${isCur ? '<span class="sm mut">(ay devam ediyor, bugüne kadar)</span>' : ''}</h2>
    <div class="rpk">
      <div><span class="xs mut">Ay başı değer</span><b>${fm(V0.tot)}</b><span class="xs mut">${dtr(d0)}</span></div>
      <div><span class="xs mut">${isCur ? 'Bugünkü' : 'Ay sonu'} değer</span><b>${fm(V1.tot)}</b><span class="xs mut">${dtr(d1)}</span></div>
      <div><span class="xs mut">Net para girişi</span><b>${fm(flow)}</b><span class="xs mut">${txm.length} işlem</span></div>
      <div><span class="xs mut">Piyasa kaynaklı değişim</span><b class="${cls(gain)}">${fm(gain)}</b><span class="xs ${cls(ret)}">${ret != null ? 'aylık ' + fpct(ret) : ''}</span></div>
      <div><span class="xs mut">${ad} TÜFE</span><b>${cm != null ? '%' + fmt(cm * 100, 2) : '—'}</b><span class="xs ${cls(real)}">${real != null ? 'reel ' + fpct(real) : cm == null ? 'henüz açıklanmadı' : ''}</span></div>
    </div>
    <div class="grid g2" style="margin-top:18px">
      <div><h3>Varlık sınıfları</h3><table><thead><tr><th>Sınıf</th><th class="n">Ay başı</th><th class="n">${isCur ? 'Bugün' : 'Ay sonu'}</th><th class="n">Pay</th></tr></thead><tbody>${CLASSES.filter(k => V0.cls[k] || V1.cls[k]).map(k => `<tr><td>${CLS_AD[k]}</td><td class="n">${fm(V0.cls[k] || 0)}</td><td class="n">${fm(V1.cls[k] || 0)}</td><td class="n">%${fmt((V1.cls[k] || 0) / (V1.tot || 1) * 100, 1)}</td></tr>`).join('')}</tbody></table></div>
      <div><h3>Ayın en iyileri ve en kötüleri</h3>${ch.length ? `<div class="lv">${[...ch.slice(0, 3), ...ch.slice(-3).filter(x => !ch.slice(0, 3).includes(x))].map(x => `<span>${esc(x.s)}</span><span class="${cls(x.r)}">${fpct(x.r)}</span>`).join('')}</div>` : '<p class="sm mut">Karşılaştırılacak fiyat yok.</p>'}</div>
    </div>
    <div class="grid g2" style="margin-top:18px">
      <div><h3>Bu ayki işlemler</h3>${txm.length ? `<table><tbody>${txm.map(t => `<tr><td class="sm">${dtr(t.d)}</td><td><b>${esc(t.sym)}</b> <span class="xs ${t.side === 'AL' ? 'up' : 'dn'}">${t.side}</span></td><td class="n">${fm(+t.qty * +t.price)}</td></tr>`).join('')}</tbody></table>` : '<p class="sm mut">İşlem yok.</p>'}
        ${ds ? `<p class="sm" style="margin:10px 0 0">Aylık alım hedefi ${fm(ds.mon)} · bu ay ${fm(buys)} ${buys >= ds.mon * .95 ? '<span class="up">✓ tamam</span>' : buys > 0 ? '<span class="mut">(kısmen)</span>' : '<span class="dn">(alım yok)</span>'}</p>` : ''}</div>
      <div><h3>Notlar</h3><ul class="why">${[nws ? `${nws} yeni KAP bildirimi/haber geldi.` : '', upNext.length ? 'Gelecek ay: ' + upNext.map(x => `${esc(x.sym)} ${esc(x.t.toLocaleLowerCase('tr-TR'))} ${dtr(x.d)}`).join(', ') + '.' : '', MAC().pka?.tufe12 ? `Piyasanın 12 ay sonrası enflasyon beklentisi %${fmt(MAC().pka.tufe12, 1)} (${esc(MAC().pka.ay || '')} anketi).` : '', cm == null ? `${ad} enflasyonu ayın 3'ünde açıklanır; o zaman reel getiri hesaplanır.` : ''].filter(Boolean).map(x => `<li>${x}</li>`).join('') || '<li class="mut">Not yok.</li>'}</ul></div>
    </div>
    <p class="xs mut" style="margin:14px 0 0">Aylık getiri yaklaşık hesaptır (ay içindeki para girişlerinin yarısı ay başında sayılır). Fiyatı olmayan günlerde en yakın bilinen fiyat kullanılır.</p></div>`;
}
document.addEventListener('change', e => { if (e.target.id === 'rpAy') rRapor(); });
document.addEventListener('click', e => { if (e.target.id === 'rpPrint') window.print(); });

/* ---------------- Mali tablolar ---------------- */
let editP = null;
function rMali() {
  const list = Object.values(S.assets).filter(a => a.type === 'hisse').sort((a, b) => a.sym.localeCompare(b.sym));
  if (!selM || !S.assets[selM] || S.assets[selM].type !== 'hisse') selM = (list.find(a => a.fin && a.fin.length) || list[0] || {}).sym || null;
  fillSel($('#mSel'), list, selM);
  const a = S.assets[selM], body = $('#mBody');
  if (!a) { body.innerHTML = `<div class="empty">Hisse türünde varlık yok. Portföye bir hisse ekle ya da Excel'in <b>Mali</b> sayfasını yükle.</div>`; return; }
  const s = sig(a), r = s.rat, f = r ? C.fundScore(r) : null, fin = C.finSorted(a.fin), pts = {};
  if (f) f.items.forEach(x => pts[x.k] = x.p);
  const LK = { 'FD/Satışlar': 'evSales', 'Aktif kârlılığı': 'roa', 'Brüt marj': 'gm', 'FAVÖK marjı': 'em', 'Esas faaliyet marjı': 'om', 'Asit-test oranı': 'qr', 'Borç / özkaynak': 'de', 'FAVÖK': 'ebG', 'Net kâr': 'niG' };
  const sk = sektorOf(a), pio = isBist(a) ? C.piotroski(a) : null;
  const SKN = { pe: sk?.fk && `sektör medyanı ${fx(sk.fk, 1)}`, pb: sk?.pddd && `sektör medyanı ${fx(sk.pddd)}`, evEbitda: sk?.fdf && `sektör medyanı ${fx(sk.fdf, 1)}`, roe: sk?.roe && `sektör medyanı ${fpc(sk.roe)}` };
  const card = (k, l, v, note, cl) => `<div class="rat ${cl != null ? cl : pts[k] > 0 ? 'g' : pts[k] < 0 ? 'b' : ''}" title="${esc(HAP[k || LK[l]] || '')}"><span class="xs mut">${l}${hapI(k || LK[l])}</span><b>${v}</b><span class="xs mut">${note}${SKN[k] ? ' · ' + SKN[k] : ''}</span></div>`;
  const ep = editP ? fin.find(x => C.pkey(x) === editP) : null;
  body.innerHTML = `
  <div class="card"><div class="form">
    <div><label for="mName">Şirket adı</label><input id="mName" value="${esc(a.name || '')}" placeholder="Türk Hava Yolları"></div>
    <div><label for="mSh">Pay sayısı (adet)</label><input id="mSh" inputmode="decimal" value="${a.shares ? esc(fmt(a.shares, 0)) : ''}" placeholder="1.380.000.000"></div>
    <div><label>Son fiyat</label><input disabled value="${esc(fp(lastOf(a).v))}"></div>
    <div><label>Piyasa değeri</label><input disabled value="${r && r.mcap ? esc(fbig(r.mcap)) : 'pay sayısı gerekli'}"></div>
  </div>${DESK ? `<div class="row" style="gap:10px;margin-top:12px;align-items:center"><button type="button" class="ghost sm" id="mFetch">Mali tabloları KAP raporlarından çek</button><span class="xs mut">${a.finAt ? 'Son kontrol ' + esc(dtr(a.finAt.slice(0, 10))) + ' · ' : ''}Kaynak: KAP'a bildirilen finansal raporlar (İş Yatırım mali tablo servisi). Elle düzelttiğin dönemlerin üzerine yazılmaz.</span></div>` : ''}</div>
  ${r ? `<div class="row" style="justify-content:space-between;margin:24px 0 12px"><h2 style="margin:0">Rasyolar · ${esc(r.period)}</h2><span class="sm mut">Gelir tablosu kalemleri ${r.ttmHow === 'son 12 ay' ? 'son 12 aya çevrildi' : r.ttmHow === 'yıllık' ? 'yıllık' : 'yıllıklandırıldı (geçen yılın aynı dönemi yok)'}</span></div>
  ${f ? `<div class="note" style="margin-bottom:16px">Temel skor <b>${f.score > 0 ? '+' : ''}${f.score}</b> / 100 → ${tagH(C.label(f.score))}. Yeşil çerçeve olumlu, kırmızı olumsuz puanlanan rasyo.</div>` : ''}
  <h3>Değerleme</h3><div class="rgrid">${card('pe', 'F/K', r.negNI ? 'zarar' : fx(r.pe, 1), 'piyasa değeri / net kâr')}${card('pb', 'PD/DD', fx(r.pb), 'piyasa / defter değeri')}${card('evEbitda', 'FD/FAVÖK', fx(r.evEbitda, 1), 'firma değeri / FAVÖK')}${card('', 'FD/Satışlar', fx(r.evSales), 'firma değeri / hasılat')}${card('', 'Hisse başı kâr', fp(r.eps), 'TL')}${card('', 'Hisse başı defter değeri', fp(r.bvps), 'TL')}</div>
  <h3 style="margin-top:18px">Kârlılık</h3><div class="rgrid">${card('roe', 'Özkaynak kârlılığı', fpc(r.roe), 'ROE')}${card('', 'Aktif kârlılığı', fpc(r.roa), 'ROA')}${card('', 'Brüt marj', fpc(r.gm), 'brüt kâr / hasılat')}${card('', 'FAVÖK marjı', fpc(r.em), 'FAVÖK / hasılat')}${card('', 'Esas faaliyet marjı', fpc(r.om), 'faaliyet kârı / hasılat')}${card('nm', 'Net kâr marjı', fpc(r.nm), 'net kâr / hasılat')}</div>
  <h3 style="margin-top:18px">Bilanço sağlığı</h3><div class="rgrid">${card('cr', 'Cari oran', fx(r.cr), 'dönen varlık / KV borç')}${card('', 'Asit-test oranı', fx(r.qr), 'stoksuz cari oran')}${card('', 'Borç / özkaynak', fx(r.de), 'toplam yükümlülük / özkaynak')}${card('', 'Net borç', r.nd != null ? fbig(r.nd) : '—', r.nd < 0 ? 'net nakit pozisyonu' : 'finansal borç − nakit')}${card('ndEbitda', 'Net borç / FAVÖK', r.nd != null && r.nd < 0 ? 'net nakit' : fx(r.ndEbitda, 1), 'borç ödeme gücü')}</div>
  <h3 style="margin-top:18px">Büyüme (geçen yılın aynı dönemine göre)</h3><div class="rgrid">${card('revG', 'Hasılat', fpct(r.revG), infl() ? `enflasyon %${esc(S.settings.infl)}` : 'nominal')}${card('', 'FAVÖK', fpct(r.ebG), 'nominal')}${card('', 'Net kâr', fpct(r.niG), 'nominal')}</div>` : `<div class="empty" style="margin-top:24px">${esc(a.sym)} için mali tablo dönemi yok. Aşağıdan ilk dönemi gir ya da Excel'in <b>Mali</b> sayfasını yükle.</div>`}
  ${r.cfo != null || r.fxp != null ? `<h3 style="margin-top:18px">Nakit akışı ve kur riski</h3><div class="rgrid">${card('', 'İşletme nakit akışı', fbig(r.cfo), 'son 12 ay', r.cfo > 0 ? '' : 'b')}${card('', 'Serbest nakit akışı', fbig(r.fcf), 'nakit akışı − yatırım', r.fcf > 0 ? 'g' : r.fcf < 0 ? 'b' : '')}${card('fcfY', 'Serbest nakit verimi', fpc(r.fcfY), 'SNA / piyasa değeri', r.fcfY > .08 ? 'g' : '')}${card('cfoNi', 'Nakit / net kâr', fx(r.cfoNi, 2), 'kâr kalitesi', r.cfoNi >= 1 ? 'g' : r.cfoNi != null && r.cfoNi < .5 ? 'b' : '')}${card('capexRev', 'Yatırım / satış', fpc(r.capexRev), 'capex yoğunluğu', '')}${card('fxpEq', 'Net döviz poz. / özkaynak', fpc(r.fxpEq), r.fxp != null ? 'net ' + fbig(r.fxp) : '', r.fxpEq < -.3 ? 'b' : '')}</div>` : ''}
  ${pio ? `<h3 style="margin-top:18px">Piotroski F-skoru${hapI('pio')} <span class="tag ${pio.score >= 7 ? 't-AL' : pio.score <= 3 ? 't-SAT' : 't-TUT'}">${pio.score} / ${pio.n}</span></h3><div class="pio">${pio.items.map(x => `<span class="${x.ok == null ? 'mut' : x.ok ? 'up' : 'dn'}">${x.ok == null ? '–' : x.ok ? '✓' : '✗'} ${esc(x.l)}</span>`).join('')}</div><p class="xs mut" style="margin:6px 0 0">${esc(r.period)} ile ${esc(pio.vs)} karşılaştırması. Bankalarda bazı kalemler anlamsız olabilir.</p>` : ''}
  ${(() => { const k = karneHtml(a); return k ? `<div class="card" style="margin-top:22px"><h3>Karne · otomatik yorum</h3>${k}</div>` : ''; })()}
  ${fin.length ? `<h2 style="margin-top:28px">Dönemler <span class="sm mut">(milyon TL, kümülatif)</span></h2><div class="scroll"><table><thead><tr><th>Kalem</th>${fin.map(p => `<th class="n">${esc(C.pkey(p))} <button class="x" data-ep="${esc(C.pkey(p))}" aria-label="Düzenle">✎</button></th>`).join('')}</tr></thead><tbody>${C.FIN.map(([k, l]) => `<tr><td>${l}</td>${fin.map(p => `<td class="n">${p[k] != null ? fmt(p[k] / 1e6, 0) : '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
  <div class="card" style="margin-top:24px"><h3>${ep ? esc(editP) + ' dönemini düzenle' : 'Dönem ekle'}</h3>
    <p class="xs mut" style="margin-top:0">KAP'taki tutarları TL olarak gir (ör. 12.450.000.000 ya da 12450 mn için 12450M). Gelir tablosu yıl başından itibaren kümülatif girilir.</p>
    <form id="finForm" class="form"><div><label for="fPer">Dönem</label><input id="fPer" required placeholder="2026/09" value="${ep ? esc(editP) : ''}"></div>
    ${C.FIN.map(([k, l]) => `<div><label for="f_${k}">${l}</label><input id="f_${k}" inputmode="decimal" value="${ep && ep[k] != null ? esc(fmt(ep[k], 0)) : ''}"></div>`).join('')}
    <div class="row"><button type="submit">Kaydet</button>${ep ? '<button type="button" class="ghost" id="finDel">Dönemi sil</button><button type="button" class="ghost" id="finCancel">Vazgeç</button>' : ''}</div></form></div>`;
  $('#finForm').addEventListener('submit', e => {
    e.preventDefault(); const p = C.parsePeriod($('#fPer').value); if (!p) { toast('Dönem biçimi: 2026/09 ya da 2026Q3'); return; }
    const row = { y: p.y, m: p.m, man: 1 }; for (const [k] of C.FIN) { const v = C.num($('#f_' + k).value); if (isFinite(v)) row[k] = v; }
    const x = ensureAsset(a.sym); x.fin = (x.fin || []).filter(q => !(q.y === p.y && q.m === p.m)).concat([row]); editP = null; putAsset(x); toast(C.pkey(p) + ' kaydedildi.'); render();
  });
  $('#finDel')?.addEventListener('click', e => { if (!e.target.dataset.arm) { e.target.dataset.arm = 1; e.target.textContent = 'Emin misin?'; return; } const x = ensureAsset(a.sym); x.fin = x.fin.filter(q => C.pkey(q) !== editP); editP = null; putAsset(x); render(); });
  $('#finCancel')?.addEventListener('click', () => { editP = null; render(); });
  $('#mName').addEventListener('change', e => { const x = ensureAsset(a.sym); x.name = e.target.value.trim(); putAsset(x); render(); });
  $('#mFetch')?.addEventListener('click', async e => { e.target.disabled = true; e.target.textContent = 'Çekiliyor…'; try { const r = await pRefresh([a.sym]); if (r && r.busy) toast('Güncelleme sürüyor; bittiğinde ' + a.sym + ' de çekilecek.'); else if (r && r.errors && r.errors.length) toast(r.errors.join(' · ')); else toast(a.sym + ' mali tabloları güncellendi.'); } catch (er) { toast('Çekilemedi: ' + (er.message || er)); } });
  $('#mSh').addEventListener('change', e => { const v = C.num(e.target.value); const x = ensureAsset(a.sym); x.shares = v > 0 ? v : null; x.sharesMan = v > 0 ? 1 : 0; putAsset(x); render(); });
}
$('#mSel').addEventListener('change', e => { selM = e.target.value; editP = null; render(); });
document.addEventListener('click', e => { const b = e.target.closest('[data-ep]'); if (b) { editP = b.dataset.ep; render(); setTimeout(() => $('#finForm')?.scrollIntoView({ behavior: 'smooth' }), 60); } });

/* ---------------- Dolaylı portföy (fon içeriği) ---------------- */
function lookThroughNow() {
  const P = portfolio(), open = P.pos.filter(p => p.qty > 0);
  return { P, open, lt: C.lookThrough(open.map(p => ({ sym: p.sym, value: p.value })), S.assets) };
}
const viaTxt = r => Object.entries(r.via).sort((a, b) => b[1] - a[1]).map(([f, v]) => `${esc(f)} ${fm(v)}`).join(' · ');
function bars(list, total, fmtL = k => esc(k)) {
  return list.map(([k, v]) => `<div class="brow"><span>${fmtL(k)}</span><div class="bar"><i style="width:${Math.max(.5, v / total * 100).toFixed(1)}%"></i></div><span class="n" style="text-align:right">%${fmt(v / total * 100, 1)}</span></div>`).join('');
}
function rDolayli() {
  if (!$('#hDate').value) $('#hDate').value = today();
  const { open, lt } = lookThroughNow(), body = $('#dBody');
  const funds = Object.values(S.assets).filter(a => a.type === 'fon').sort((a, b) => a.sym.localeCompare(b.sym));
  const heldFunds = open.filter(p => S.assets[p.sym]?.type === 'fon').map(p => p.sym);
  const missing = heldFunds.filter(f => !C.latestHold(S.assets[f]));
  const detail = funds.filter(a => C.latestHold(a)).map(a => {
    const h = C.latestHold(a), ch = C.holdChange(a), top = h.items.slice().sort((x, y) => y.w - x.w);
    const sw = h.items.reduce((s, i) => s + i.w, 0);
    return `<details class="card" style="margin-top:12px"${heldFunds.includes(a.sym) ? ' open' : ''}><summary>${esc(a.sym)}${a.name ? ' · ' + esc(a.name) : ''} <span class="sm mut">· rapor ${dtr(h.date)} · ${h.items.length} kalem${h.src === 'kap' ? ' · KAP' : ''}${heldFunds.includes(a.sym) ? ' · portföyde' : ''}</span></summary>
      ${h.src === 'kap' && h.idx ? `<p class="xs mut" style="margin:10px 0 0">Kaynak: KAP portföy dağılım raporu${DESK ? ` · <a href="#" data-det="${esc(h.idx)}">raporu aç</a>` : ` · <a href="https://www.kap.org.tr/tr/Bildirim/${esc(h.idx)}" target="_blank" rel="noopener">KAP'ta aç</a>`}</p>` : ''}
      <div style="margin-top:12px">${bars(top.slice(0, 15).map(i => [i.name || i.code, i.w]), 1)}
      ${top.length > 15 ? `<p class="xs mut">+${top.length - 15} kalem daha, toplam %${fmt(top.slice(15).reduce((s, i) => s + i.w, 0) * 100, 1)}</p>` : ''}
      ${sw < .97 ? `<p class="xs mut">Ağırlıkların toplamı %${fmt(sw * 100, 1)}; kalan %${fmt((1 - sw) * 100, 1)} "açıklanmayan / diğer" sayıldı.</p>` : ''}
      <div class="grid g3" style="margin-top:14px">${[['Sınıflar', C.lookThrough([{ sym: a.sym, value: 1 }], S.assets).byCat], ['Ülke', C.lookThrough([{ sym: a.sym, value: 1 }], S.assets).byCc]].map(([t, l]) => `<div><h3>${t}</h3>${bars(l, 1)}</div>`).join('')}
      ${ch ? `<div><h3>${dtr(ch.from)} raporuna göre</h3><ul class="why sm">${ch.added.slice(0, 6).map(i => `<li class="up">Girdi: ${esc(i.name || i.code)} %${fmt(i.w * 100, 1)}</li>`).join('')}${ch.removed.slice(0, 6).map(i => `<li class="dn">Çıktı: ${esc(i.name || i.code)} (%${fmt(i.w * 100, 1)} idi)</li>`).join('')}${ch.moved.slice(0, 6).map(i => `<li>${esc(i.name || i.code)} ${i.d > 0 ? '<span class="up">artırıldı</span>' : '<span class="dn">azaltıldı</span>'} ${fpct(i.d, 1).replace('%', '')} puan → %${fmt(i.w * 100, 1)}</li>`).join('')}${!ch.added.length && !ch.removed.length && !ch.moved.length ? '<li>Kayda değer değişiklik yok</li>' : ''}</ul></div>` : '<div><h3>Değişim</h3><p class="sm mut">Önceki ayın raporunu da girersen fon yöneticisinin ne alıp sattığını burada görürsün.</p></div>'}</div></div></details>`;
  }).join('');
  if (!open.length) { body.innerHTML = `<div class="empty">Açık pozisyon yok. Fon alımlarını <a href="#fonlar">Fonlar</a> sekmesinden ya da Excel'den gir, sonra fonların içeriğini aşağıdan ekle.</div>${detail ? '<h2 style="margin-top:28px">Fon içerikleri</h2>' + detail : ''}`; return; }
  const real = lt.rows.filter(r => r.key !== 'DIGER'), top = real[0], conc = real.filter(r => r.w > .10);
  const fx = lt.byCc.filter(([k]) => k !== 'Türkiye' && k !== 'Bilinmiyor').reduce((s, [, v]) => s + v, 0);
  const held = heldFunds.filter(f => C.latestHold(S.assets[f]));
  const ov = held.length > 1 ? `<h2 style="margin-top:28px">Fonlar arası örtüşme</h2><p class="sm mut" style="margin-top:-6px">İki fonun ortak varlıklarındaki küçük ağırlıkların toplamı. %30'un üzeri, iki fonun büyük ölçüde aynı şeyi aldığı anlamına gelir.</p>
    <div class="scroll"><table><thead><tr><th></th>${held.map(f => `<th class="n">${esc(f)}</th>`).join('')}</tr></thead><tbody>${held.map(a => `<tr><td><b>${esc(a)}</b></td>${held.map(b => { if (a === b) return '<td class="n mut">—</td>'; const o = C.overlap(C.latestHold(S.assets[a]), C.latestHold(S.assets[b])); return `<td class="n${o > .3 ? ' dn' : ''}"><b>%${fmt(o * 100, 0)}</b></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>` : '';
  body.innerHTML = `
  <h2 style="font-size:clamp(22px,3vw,30px)">${top ? `En büyük gerçek maruziyetin <span style="background:var(--y);color:var(--yi);padding:0 6px;border-radius:4px">${esc(top.name)}</span>: portföyün %${fmt(top.w * 100, 1)}'i` : 'Gerçek maruziyet'}</h2>
  <p class="sm mut" style="margin-top:-6px">Fon pozisyonlarının içeriği son portföy dağılım raporuna göre senin payın oranında dağıtıldı. İçeriği girilen fonlar portföyün %${fmt(lt.total ? lt.covered / lt.total * 100 : 0, 0)}'i.${missing.length ? ` İçeriği eksik fonlar: <b>${missing.map(esc).join(', ')}</b>.` : ''}</p>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Varlık sınıfı (fon içleri dahil)</h3>${bars(lt.byCat, lt.total)}</div>
    <div class="card"><h3>Ülke</h3>${bars(lt.byCc, lt.total)}<p class="note" style="margin:12px 0 0">Portföyün yaklaşık <b>%${fmt(fx / lt.total * 100, 0)}</b>'i yurt dışı ya da dolar bazlı varlıklarda: TL değer kaybettiğinde bu kısım TL karşılığında kazandırır, TL güçlendiğinde kaybettirir.</p></div>
  </div>
  ${conc.length ? `<p class="note" style="margin-top:16px">Tek bir varlığa %10'dan fazla maruz kalıyorsun: ${conc.map(r => `<b>${esc(r.name)}</b> %${fmt(r.w * 100, 1)}${Object.keys(r.via).length > 1 ? ` (${Object.keys(r.via).length} fon üzerinden)` : ''}`).join(', ')}. Fon üzerinden gelen kısım da dahil; farklı fonlar alsan da aynı hisseye yoğunlaşmış olabilirsin.</p>` : ''}
  <h2 style="margin-top:28px">Varlık bazında gerçek dağılım</h2>
  <div class="scroll"><table class="stack"><thead><tr><th>Varlık</th><th>Sınıf</th><th class="n">Doğrudan</th><th>Fonlar üzerinden</th><th class="n">Toplam</th><th class="n">Portföy payı</th></tr></thead><tbody>
  ${lt.rows.slice(0, 30).map(r => `<tr${S.assets[r.key] ? ` class="click" data-go="${esc(r.key)}"` : ''}><td><b>${esc(r.name)}</b>${r.key !== 'DIGER' && !r.key.startsWith('N:') && r.key !== String(r.name).toUpperCase() ? ` <span class="xs mut">${esc(r.key)}</span>` : ''}</td><td class="sm">${esc(r.cat)}${r.cc && r.cc !== 'TR' ? ' · ' + esc(C.ULKE[r.cc] || r.cc) : ''}</td>
    <td class="n">${r.direct ? fm(r.direct) : '—'}</td><td class="sm">${r.indirect ? viaTxt(r) : '—'}</td><td class="n"><b>${fm(r.total)}</b></td><td class="n">%${fmt(r.w * 100, 1)}</td></tr>`).join('')}
  </tbody></table></div>${lt.rows.length > 30 ? `<p class="xs mut">İlk 30 kalem gösteriliyor; toplam ${lt.rows.length}.</p>` : ''}
  ${ov}
  ${detail ? '<h2 style="margin-top:28px">Fon içerikleri</h2>' + detail : ''}`;
}
$('#hBtn').addEventListener('click', async () => {
  const fund = $('#hFund').value.trim().toUpperCase(), txt = $('#hTxt').value.trim(), d = $('#hDate').value || today();
  if (!fund || !txt) { $('#hMsg').textContent = 'Fon kodu ve varlık listesi gerekli.'; return; }
  const R = parseBook({ ['Icerik_' + fund]: csvToAoa(txt) }, fund, d), snaps = R.hold[fund];
  if (!snaps || !snaps.length) { $('#hMsg').textContent = 'Liste okunamadı. İlk satır başlık olmalı ve Ad (ya da Kod) ile Ağırlık sütunları bulunmalı.'; return; }
  const x = ensureAsset(fund, 'fon'); x.type = 'fon'; mergeHold(x, snaps); await putAsset(x);
  const n = snaps.reduce((s, h) => s + h.items.length, 0), sw = snaps[snaps.length - 1].items.reduce((s, i) => s + i.w, 0);
  $('#hMsg').textContent = `${fund}: ${n} kalem kaydedildi, ağırlık toplamı %${fmt(sw * 100, 1)}.`; $('#hTxt').value = ''; render();
});

/* ---------------- Veri içe aktarma ---------------- */
const H = {
  fund: ['fon', 'fonkod'], w: ['agirlik', 'agirlikyuzde', 'oran', 'yuzde', 'portfoyorani', 'fondegerineorani', 'fonportfoydegerineorani', 'toplamdegereorani', 'fptdorani', 'weight', 'pay'],
  cc: ['ulke', 'ulkekodu', 'country'], sec: ['sektor', 'sector'],
  date: ['tarih', 'date', 'islemtarihi', 'alistarihi', 'gun'], sym: ['sembol', 'symbol', 'kod', 'hisse', 'varlik', 'fonkodu', 'ticker', 'hissekodu', 'isin', 'isinkodu', 'varlikkodu', 'menkulkiymetkodu'],
  name: ['ad', 'isim', 'name', 'unvan', 'fonadi', 'sirket', 'sirketadi', 'varlikadi', 'menkulkiymet', 'menkulkiymetadi', 'ihracci', 'aciklama'], type: ['tur', 'tip', 'type', 'varlikturu', 'sinif'],
  side: ['islem', 'yon', 'side', 'alsat', 'islemturu', 'islemtipi'], qty: ['adet', 'miktar', 'lot', 'qty', 'quantity', 'nominal'],
  price: ['fiyat', 'price', 'birimfiyat', 'islemfiyati', 'alisfiyati', 'maliyet', 'ortmaliyet', 'ortalamamaliyet', 'birimmaliyet'], fee: ['komisyon', 'fee', 'masraf', 'ucret', 'komisyontutari'],
  open: ['acilis', 'open', 'ac', 'acilisfiyati'], high: ['yuksek', 'high', 'enyuksek'], low: ['dusuk', 'low', 'endusuk'],
  close: ['kapanis', 'close', 'son', 'simdi', 'kapanisfiyati', 'sonfiyat', 'fiyat', 'price', 'adjclose', 'fonfiyati'],
  vol: ['hacim', 'vol', 'volume', 'hacimtl', 'islemhacmi'], last: ['sonfiyat', 'guncelfiyat', 'fiyat', 'last', 'kapanis'],
  shares: ['paysayisi', 'hissesayisi', 'toplampaysayisi', 'sermaye', 'shares', 'odenmissermaye'], period: ['donem', 'period', 'ceyrek', 'bilancodonemi']
};
function headerMap(row) {
  const m = {}, n = row.map(C.norm);
  for (const [k, al] of Object.entries(H)) { for (const a of al) { const i = n.indexOf(a); if (i > -1 && !Object.values(m).includes(i)) { m[k] = i; break; } } }
  for (const [k, al] of Object.entries(C.FIN_ALIAS)) { for (const a of al) { const i = n.indexOf(a); if (i > -1) { m['f_' + k] = i; break; } } }
  // Esnek eşleşme: "Fon Toplam Değerine Oranı (%)" → oran, "Türü" → tur
  const used = new Set(Object.values(m));
  for (const [k, al] of Object.entries(H)) {
    if (m[k] != null) continue;
    for (const a of al) {
      const i = n.findIndex((h, j) => h && !used.has(j) && (a.length >= 4 ? h.includes(a) : h.startsWith(a) && h.length <= a.length + 2));
      if (i > -1) { m[k] = i; used.add(i); break; }
    }
  }
  return m;
}
function findHeader(aoa) {
  let best = { i: -1, m: {}, c: 0 };
  for (let i = 0; i < Math.min(12, aoa.length); i++) { const m = headerMap(aoa[i] || []), c = Object.keys(m).length; if (c > best.c) best = { i, m, c }; }
  return best.c >= 2 ? best : null;
}
const NOTFIN = /^(mali|malitablolar|bilanco|financials|fin)/;
function parseBook(sheets, fallbackSym, fallbackDate) {
  const R = { txns: [], assets: {}, prices: {}, fin: {}, hold: {}, warn: [] }, HG = {};
  const A = sym => R.assets[sym] || (R.assets[sym] = {});
  for (const [name, aoa] of Object.entries(sheets)) {
    const nn = C.norm(name), rows = aoa.filter(r => r && r.some(v => v !== '' && v != null));
    if (!rows.length) continue;
    // Geniş mali tablo: satırlar kalem, sütunlar dönem
    const wideRow = rows.slice(0, 12).findIndex(r => r.slice(1).filter(v => v !== '' && C.parsePeriod(v)).length >= 2);
    if (wideRow > -1 && rows.some(r => Object.values(C.FIN_ALIAS).some(al => al.includes(C.norm(r[0]))))) {
      const sym = (String(name).replace(/mali|bilan[cç]o|tablo(lar)?|financials|[_\-\s]/gi, '').toUpperCase()) || fallbackSym;
      if (!sym) { R.warn.push(`"${name}" sayfası geniş formatta mali tablo; sembol bulunamadı (sayfa adını Mali_THYAO yap).`); continue; }
      const hdr = rows[wideRow], cols = hdr.map((v, i) => ({ i, p: C.parsePeriod(v) })).filter(x => x.p && x.i > 0);
      const per = cols.map(c => ({ y: c.p.y, m: c.p.m }));
      for (const r of rows.slice(wideRow + 1)) {
        const nk = C.norm(r[0]); const key = Object.entries(C.FIN_ALIAS).find(([, al]) => al.includes(nk))?.[0]; if (!key) continue;
        cols.forEach((c, j) => { const v = C.num(r[c.i]); if (isFinite(v) && per[j][key] == null) per[j][key] = v; });
      }
      (R.fin[sym] = R.fin[sym] || []).push(...per.filter(p => Object.keys(p).length > 2)); A(sym); continue;
    }
    const h = findHeader(rows); if (!h) { if (!/^(okubeni|readme|aciklama)/.test(nn)) R.warn.push(`"${name}" sayfasında tanınan başlık yok, atlandı.`); continue; }
    const m = h.m, body = rows.slice(h.i + 1), g = (r, k) => m[k] != null ? r[m[k]] : undefined;
    const isHold = /^(fonicerik|icerik|portfoydagilim|dagilim|holdings)/.test(nn) || (m.w != null && (m.name != null || m.sym != null) && m.qty == null && m.side == null && m.close == null && m.period == null);
    if (isHold) {
      const fromName = String(name).replace(/fon[_\-\s]*i[cç]eri[gğ]i?|i[cç]erik|portf[oö]y[_\-\s]*da[gğ][iı]l[iı]m[iı]?|da[gğ][iı]l[iı]m|holdings|[_\-\s]/gi, '').toUpperCase();
      const ds = C.parseDates(body.map(r => g(r, 'date'))); let n0 = Object.keys(HG).length;
      body.forEach((r, i) => {
        const fund = String(g(r, 'fund') || fromName || fallbackSym || '').trim().toUpperCase();
        const code = String(g(r, 'sym') ?? '').trim(), nm = String(g(r, 'name') ?? '').trim(), w = C.num(g(r, 'w'));
        if (!fund || (!code && !nm) || !isFinite(w) || /^(toplam|total|genel toplam)/i.test(nm || code)) return;
        const d = ds[i] || fallbackDate || today(), k = fund + '|' + d;
        const it = { w }; if (code) it.code = code; if (nm) it.name = nm;
        if (g(r, 'type')) it.t = String(g(r, 'type')).trim(); if (g(r, 'cc')) it.cc = String(g(r, 'cc')).trim(); if (g(r, 'sec')) it.sec = String(g(r, 'sec')).trim();
        (HG[k] = HG[k] || { fund, date: d, items: [] }).items.push(it);
      });
      if (Object.keys(HG).length === n0) R.warn.push(`"${name}" fon içeriği gibi görünüyor ama satır okunamadı (Fon sütunu ekle ya da sayfa adını Icerik_AFT yap; Ağırlık sütunu gerekli).`);
      continue;
    }
    const kind = /^(islem|transactions|trades|alimsatim)/.test(nn) ? 'tx' : /^(varlik|assets|semboller)/.test(nn) ? 'as' : /^(fiyat|prices|kapanis)/.test(nn) ? 'px' : NOTFIN.test(nn) ? 'fin'
      : (m.side != null && m.qty != null) ? 'tx' : (m.period != null && Object.keys(m).some(k => k.startsWith('f_'))) ? 'fin' : (m.date != null && (m.close != null || (m.price != null && m.qty == null))) ? 'px1' : 'as';
    if (kind === 'tx') {
      const ds = C.parseDates(body.map(r => g(r, 'date')));
      body.forEach((r, i) => {
        const sym = String(g(r, 'sym') || '').trim().toUpperCase(), sd = C.norm(g(r, 'side')), qty = Math.abs(C.num(g(r, 'qty'))), price = C.num(g(r, 'price'));
        const side = /^(al|alis|buy|b|a|alim)$/.test(sd) ? 'AL' : /^(sat|satis|sell|s)$/.test(sd) ? 'SAT' : (C.num(g(r, 'qty')) < 0 ? 'SAT' : m.side == null ? 'AL' : null);
        if (!sym || !side || !(qty > 0) || !(price > 0) || !ds[i]) { R.warn.push(`${name} satır ${h.i + i + 2}: eksik veya hatalı alan, atlandı.`); return; }
        R.txns.push({ sym, side, d: ds[i], qty, price, fee: C.num(g(r, 'fee')) || 0 });
        const as = A(sym); if (g(r, 'type') && !as.type) as.type = normType(g(r, 'type'), sym);
      });
    } else if (kind === 'as') {
      body.forEach(r => {
        const sym = String(g(r, 'sym') || '').trim().toUpperCase(); if (!sym) return; const as = A(sym);
        if (g(r, 'name')) as.name = String(g(r, 'name')).trim(); if (g(r, 'type')) as.type = normType(g(r, 'type'), sym);
        const l = C.num(m.last != null ? g(r, 'last') : g(r, 'close')); if (l > 0) as.last = l; const s = C.num(g(r, 'shares')); if (s > 0) as.shares = s;
        const q = Math.abs(C.num(g(r, 'qty'))), pr = C.num(g(r, 'price'));
        if (q > 0 && pr > 0) R.txns.push({ sym, side: 'AL', d: C.toISO(g(r, 'date')) || today(), qty: q, price: pr, fee: C.num(g(r, 'fee')) || 0 });
      });
    } else if (kind === 'px' || kind === 'px1') {
      const ds = C.parseDates(body.map(r => g(r, 'date')));
      body.forEach((r, i) => {
        const sym = kind === 'px' ? String(g(r, 'sym') || fallbackSym || '').trim().toUpperCase() : (m.sym != null && g(r, 'sym') ? String(g(r, 'sym')).trim().toUpperCase() : (fallbackSym || String(name).trim().toUpperCase()));
        const c = C.num(m.close != null ? g(r, 'close') : g(r, 'price')); if (!sym || !ds[i] || !(c > 0)) return;
        const o = C.num(g(r, 'open')), hi = C.num(g(r, 'high')), lo = C.num(g(r, 'low')), v = C.num(g(r, 'vol'));
        (R.prices[sym] = R.prices[sym] || []).push([ds[i], o > 0 ? o : c, hi > 0 ? Math.max(hi, c) : c, lo > 0 ? Math.min(lo, c) : c, c, isFinite(v) ? v : 0]); A(sym);
      });
    } else if (kind === 'fin') {
      body.forEach(r => {
        const p = C.parsePeriod(g(r, 'period')); const sym = String(g(r, 'sym') || fallbackSym || '').trim().toUpperCase(); if (!p || !sym) return;
        const row = { y: p.y, m: p.m }; for (const [k] of C.FIN) { const v = C.num(m['f_' + k] != null ? r[m['f_' + k]] : undefined); if (isFinite(v)) row[k] = v; }
        (R.fin[sym] = R.fin[sym] || []).push(row); A(sym);
      });
    }
  }
  for (const g of Object.values(HG)) { (R.hold[g.fund] = R.hold[g.fund] || []).push({ date: g.date, items: C.normWeights(g.items) }); const as = A(g.fund); as.type = 'fon'; }
  return R;
}
function mergeHold(a, snaps) {
  const m = new Map((a.hold || []).map(h => [h.date, h]));
  for (const h of snaps) m.set(h.date, h);
  a.hold = [...m.values()].sort((x, y) => x.date.localeCompare(y.date)).slice(-12);
}
function csvToAoa(text) {
  const first = text.split(/\r?\n/)[0] || ''; const cnt = ch => first.split(ch).length - 1;
  const sep = cnt('\t') >= Math.max(cnt(';'), cnt(',')) && cnt('\t') > 0 ? '\t' : cnt(';') > cnt(',') ? ';' : ',';
  const out = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); out.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); out.push(row); }
  return out.map(r => r.map(v => v.trim()));
}
let pending = null;
async function readFile(file) {
  const base = file.name.replace(/\.[^.]+$/, ''), isCsv = /\.(csv|txt)$/i.test(file.name);
  let sheets = {};
  if (isCsv) sheets[base] = csvToAoa(await file.text());
  else {
    if (typeof XLSX === 'undefined') { $('#impPrev').innerHTML = '<p class="note">Excel okuyucu yüklenemedi. Dosyayı CSV olarak kaydedip tekrar dene.</p>'; return; }
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    for (const n of wb.SheetNames) sheets[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' });
  }
  const single = Object.keys(sheets).length === 1 ? base.split(/[\s_(-]/)[0].toUpperCase() : null;
  pending = parseBook(sheets, single);
  const P = pending, pxN = Object.values(P.prices).reduce((s, a) => s + a.length, 0), finN = Object.values(P.fin).reduce((s, a) => s + a.length, 0);
  const newSyms = Object.keys(P.assets).filter(s => !S.assets[s]);
  $('#impPrev').innerHTML = `<div class="note"><b>${esc(file.name)}</b> okundu:<br>${P.txns.length} işlem · ${Object.keys(P.assets).length} varlık (${newSyms.length} yeni) · ${Object.keys(P.prices).length} varlık için ${pxN} günlük fiyat · ${finN} mali dönem · ${Object.keys(P.hold).length} fon için içerik raporu
    ${newSyms.length ? `<br><span class="xs">Yeni: ${newSyms.slice(0, 20).map(s => `${esc(s)} (${TYPES[P.assets[s].type || guessType(s)]})`).join(', ')}${newSyms.length > 20 ? '…' : ''}</span>` : ''}
    ${P.warn.length ? `<details style="margin-top:6px"><summary class="xs">${P.warn.length} uyarı</summary><ul class="xs">${P.warn.slice(0, 40).map(w => `<li>${esc(w)}</li>`).join('')}</ul></details>` : ''}</div>
    <div class="row" style="margin-top:10px"><button id="impGo"${P.txns.length + Object.keys(P.assets).length + Object.keys(P.hold).length ? '' : ' disabled'}>İçe aktar</button><span class="xs mut">Aynı tarih, sembol, adet ve fiyattaki işlemler tekrar eklenmez.</span></div>`;
  $('#impGo')?.addEventListener('click', applyImport);
}
async function applyImport() {
  const P = pending; if (!P) return; pending = null; $('#impPrev').innerHTML = '<p class="sm mut">Kaydediliyor…</p>';
  const syms = new Set([...Object.keys(P.assets), ...Object.keys(P.prices), ...Object.keys(P.fin), ...Object.keys(P.hold), ...P.txns.map(t => t.sym)]);
  for (const sym of syms) {
    const x = ensureAsset(sym), info = P.assets[sym] || {};
    if (info.type) x.type = info.type; if (info.name) x.name = info.name; if (info.shares) x.shares = info.shares;
    if (info.last) { x.last = info.last; x.lastDate = today(); }
    if (P.prices[sym]) mergePx(x, P.prices[sym]);
    if (P.hold[sym]) mergeHold(x, P.hold[sym]);
    if (P.fin[sym]) { const m = new Map((x.fin || []).map(f => [C.pkey(f), f])); for (const f of P.fin[sym]) m.set(C.pkey(f), { ...(m.get(C.pkey(f)) || {}), ...f }); x.fin = [...m.values()]; }
    if (x.last == null) { const t = P.txns.filter(t => t.sym === sym).sort((a, b) => b.d.localeCompare(a.d))[0]; if (t) { x.last = t.price; x.lastDate = t.d; } }
    await putAsset(x);
  }
  const key = t => [t.d, t.sym, t.side, +t.qty, +t.price].join('|'), have = new Set(Object.values(S.txns).map(key)); let added = 0;
  for (const t of P.txns) { if (have.has(key(t))) continue; have.add(key(t)); await putTx({ id: newId(), ...t }); added++; }
  $('#impPrev').innerHTML = `<p class="note">${syms.size} varlık güncellendi, ${added} yeni işlem eklendi. <a href="#ana">Ana sayfaya git</a></p>`; render();
}
async function quickImport(file) {
  const msg = $('#tefasMsg'); msg.className = 'sm'; msg.textContent = 'Okunuyor…';
  try {
    await readFile(file); const P = pending;
    if (!P) { msg.textContent = 'Dosya okunamadı.'; return; }
    const n = Object.values(P.prices).reduce((s, a) => s + a.length, 0);
    if (!n) { pending = null; msg.className = 'sm dn'; msg.textContent = "Dosyada fiyat bulunamadı. TEFAS Tarihsel Veriler sayfasındaki \"Excel'e Aktar\" çıktısını kullan."; return; }
    const funds = Object.keys(P.prices); await applyImport();
    msg.className = 'sm up'; msg.textContent = `${funds.length} fon için ${n} günlük fiyat eklendi: ${funds.slice(0, 12).join(', ')}${funds.length > 12 ? '…' : ''}`;
  } catch (e) { msg.className = 'sm dn'; msg.textContent = 'Dosya okunamadı: ' + (e.message || e); }
}
$('#tefasFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) quickImport(f); e.target.value = ''; });
{ const td = $('#tefasDrop');
  ['dragover', 'dragenter'].forEach(ev => td.addEventListener(ev, e => { e.preventDefault(); td.classList.add('on'); }));
  ['dragleave', 'drop'].forEach(ev => td.addEventListener(ev, e => { e.preventDefault(); td.classList.remove('on'); }));
  td.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) quickImport(f); }); }
$('#file').addEventListener('change', e => { const f = e.target.files[0]; if (f) readFile(f).catch(err => { $('#impPrev').innerHTML = `<p class="note">Dosya okunamadı: ${esc(err.message || err)}</p>`; }); });
const drop = $('#drop');
['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('on'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('on'); }));
drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) readFile(f).catch(err => { $('#impPrev').innerHTML = `<p class="note">Dosya okunamadı: ${esc(err.message || err)}</p>`; }); });

$('#pBtn').addEventListener('click', async () => {
  const sym = $('#pSym').value.trim().toUpperCase(), txt = $('#pTxt').value.trim();
  if (!sym || !txt) { $('#pMsg').textContent = 'Sembol ve veri gerekli.'; return; }
  const R = parseBook({ [sym]: csvToAoa(txt) }, sym), rows = R.prices[sym] || [];
  if (!rows.length) { $('#pMsg').textContent = 'Tarih ve kapanış sütunu bulunamadı. İlk satır başlık olmalı.'; return; }
  const x = ensureAsset(sym, $('#pType').value); mergePx(x, rows); await putAsset(x);
  $('#pMsg').textContent = `${rows.length} gün eklendi; toplam ${x.px.length} gün.`; $('#pTxt').value = ''; render();
});
$('#qBtn').addEventListener('click', async () => {
  let n = 0, bad = [];
  for (const line of $('#qTxt').value.split(/\n/)) {
    const m = line.trim().match(/^(\S+)[\s;:=\t]+(.+)$/); if (!m) { if (line.trim()) bad.push(line.trim()); continue; }
    const sym = m[1].toUpperCase(), v = C.num(m[2]); if (!(v > 0)) { bad.push(line.trim()); continue; }
    const x = ensureAsset(sym), d = today(); x.last = v; x.lastDate = d;
    if (x.px.length && x.px[x.px.length - 1][0] <= d) mergePx(x, [[d, v, v, v, v, 0]]);
    await putAsset(x); n++;
  }
  $('#qMsg').textContent = `${n} fiyat güncellendi.` + (bad.length ? ` Okunamayan: ${bad.slice(0, 3).join(', ')}` : ''); if (n) $('#qTxt').value = ''; render();
});
function rVeri() {
  if (DESK) try { rBk(); } catch (e) { }
  if (DESK) { const lr = S.settings.lastRefresh; $('#deskErr').innerHTML = lr ? `<b>Son güncelleme:</b> ${esc(new Date(lr.at).toLocaleString('tr-TR'))}${(lr.updated || []).length ? ` · güncellenen: ${lr.updated.map(esc).join(', ')}` : ''}${(lr.errors || []).length ? `<ul class="dn" style="margin:6px 0 0;padding-left:18px">${lr.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}` : 'Henüz güncelleme yapılmadı.'; }
  $('#rf').value = S.settings.rf || ''; $('#infl').value = S.settings.infl || '';
  if (document.activeElement !== $('#cpiTxt')) $('#cpiTxt').value = C.cpiMonths(S.cpi).map(m => `${m} ${fmt(S.cpi[m], 2)}`).join('\n');
}
$('#cpiBtn').addEventListener('click', async () => {
  const o = {}, bad = [];
  for (const line of $('#cpiTxt').value.split(/\n/)) {
    const t = line.trim(); if (!t) continue;
    const m = t.match(/^(\d{4})[-./](\d{1,2})[\s;:=\t]+(-?[\d.,]+)/) || t.match(/^(\d{1,2})[-./](\d{4})[\s;:=\t]+(-?[\d.,]+)/);
    if (!m) { bad.push(t); continue; }
    const [y, mo] = m[1].length === 4 ? [m[1], m[2]] : [m[2], m[1]], v = C.num(m[3]);
    if (+mo < 1 || +mo > 12 || !isFinite(v)) { bad.push(t); continue; }
    o[`${y}-${String(mo).padStart(2, '0')}`] = v;
  }
  if (!Object.keys(o).length) { $('#cpiMsg').textContent = 'Okunabilir satır yok. Biçim: 2026-10 2,58'; return; }
  S.cpi = o; cache = new WeakMap(); await putCpi(); $('#cpiMsg').textContent = `${Object.keys(o).length} ay kaydedildi.` + (bad.length ? ` Okunamayan: ${bad.slice(0, 3).join(', ')}` : ''); render();
});
['rf', 'infl'].forEach(k => $('#' + k).addEventListener('change', e => { S.settings[k] = e.target.value.trim(); cache = new WeakMap(); putSettings(); toast('Ayar kaydedildi.'); }));
$('#bkCopy').addEventListener('click', async () => {
  const j = JSON.stringify({ v: 1, assets: S.assets, txns: S.txns, settings: S.settings, cpi: S.cpi });
  try { await navigator.clipboard.writeText(j); toast('Yedek panoya kopyalandı.'); } catch (e) { $('#bkTxt').value = j; $('#bkTxt').select(); toast('Kutudaki metni kopyalayıp sakla.'); }
});
$('#bkLoad').addEventListener('click', async () => {
  let j; try { j = JSON.parse($('#bkTxt').value); } catch (e) { toast('Geçerli bir yedek değil.'); return; }
  for (const a of Object.values(j.assets || {})) if (a && a.sym) await putAsset(a);
  for (const t of Object.values(j.txns || {})) if (t && t.id) await putTx(t);
  if (j.settings) { S.settings = { ...S.settings, ...j.settings }; await putSettings(); }
  if (j.cpi) { S.cpi = j.cpi; await putCpi(); }
  $('#bkTxt').value = ''; toast('Yedek yüklendi.'); render();
});
$('#wipe').addEventListener('click', async e => {
  const b = e.target; if (!b.dataset.arm) { b.dataset.arm = 1; b.textContent = 'Eminim, hepsini sil'; b.classList.add('dn'); $('#wipeMsg').textContent = 'Geri alınamaz. Önce yedek kopyalaman önerilir.'; return; }
  for (const s of Object.keys(S.assets)) await delAsset(s); for (const id of Object.keys(S.txns)) await delTx(id);
  delete b.dataset.arm; b.textContent = 'Tüm veriyi sil'; $('#wipeMsg').textContent = 'Silindi.'; render();
});


/* ---------------- Masaüstü ---------------- */
if (DESK) {
  const btn = $('#refBtn'), msg = $('#refMsg'); btn.hidden = false; $('#deskCard').hidden = false;
  const fmtT = iso => { const d = new Date(iso); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  window.deskStatus = () => { const lr = S.settings.lastRefresh; if (!lr) return ['Bu bilgisayarda · henüz güncellenmedi', 'warn']; const n = (lr.errors || []).length; return [`Bu bilgisayarda · güncelleme ${fmtT(lr.at)}${n ? ` · ${n} uyarı` : ''}`, n ? 'warn' : 'ok']; };
  const busy = on => { btn.disabled = on; btn.textContent = on ? 'Güncelleniyor…' : 'Verileri güncelle'; if (!on) msg.textContent = ''; };
  btn.addEventListener('click', async () => { busy(true); try { await pRefresh(); } catch (e) { toast('Güncelleme başarısız: ' + (e.message || e)); } busy(false); });
  window.pusula.onRefresh(s => { busy(!!s.running); if (s.running && s.msg) msg.textContent = s.msg; });
  window.pusula.loginItem(null).then(v => { $('#deskLogin').checked = !!v; }).catch(() => { });
  $('#deskLogin').addEventListener('change', e => window.pusula.loginItem(e.target.checked).then(v => toast(v ? 'Program Windows açılışında arka planda başlayacak.' : 'Otomatik başlatma kapatıldı.')));
  $('#deskFolder').addEventListener('click', () => window.pusula.openFolder());
  window.pusula.version().then(v => { $('#deskVer').textContent = 'Sürüm ' + v; }).catch(() => { });
  let prev = null;
  window.checkSignals = () => {
    try {
      const held = C.positions(Object.values(S.txns)).filter(p => p.qty > 0).map(p => p.sym), cur = {};
      for (const s of held) { const a = S.assets[s], c = a && sig(a).comb; if (c) cur[s] = c.label; }
      if (prev) for (const [s, l] of Object.entries(cur)) if (prev[s] && prev[s] !== l) window.pusula.notify(`${s}: ${l}`, `Sinyal ${prev[s]} → ${l} olarak değişti.`);
      prev = cur;
      checkAlarms(); checkNews();
    } catch (e) { console.error(e); }
  };
}
/* ---------------- Başlangıç ---------------- */
const hadLocal = DESK ? false : loadLocal();
setSt(DESK ? 'Yükleniyor…' : 'Bu tarayıcıda saklanıyor', DESK ? '' : 'warn');
window.addEventListener('hashchange', route); route();
(async () => {
  let api = null; try { api = window.claude && window.claude.use ? await window.claude.use('db') : null; } catch (e) { }
  if (!api) { setSt(hadLocal ? 'Bu tarayıcıda saklanıyor' : 'Hesap kaydı yok; bu tarayıcıda saklanıyor', 'warn'); return; }
  db = api; setSt('Bağlanıyor…');
  const local = hadLocal ? JSON.parse(JSON.stringify(S)) : null;
  const got = { a: false, t: false }; let migrated = false;
  const timer = setTimeout(() => setSt('Kayda ulaşılamıyor; veriler güncel olmayabilir', 'warn'), 10000);
  const done = (k, snap) => {
    if (!snap.metadata.fromCache) got[k] = true;
    if (got.a && got.t) {
      clearTimeout(timer); if (DESK && window.deskStatus) setSt(...window.deskStatus()); else setSt('Hesabında saklanıyor', 'ok');
      if (!migrated && local && !Object.keys(S.assets).length && !Object.keys(S.txns).length && (Object.keys(local.assets).length || Object.keys(local.txns).length)) {
        migrated = true; (async () => { for (const a of Object.values(local.assets)) await putAsset(a); for (const t of Object.values(local.txns)) await putTx(t); toast('Tarayıcıdaki veriler hesabına taşındı.'); render(); })();
      }
      migrated = true;
    }
  };
  const fail = e => { clearTimeout(timer); setSt('Kayıt hatası: ' + (e && e.code || 'bilinmiyor'), 'warn'); };
  S.assets = {}; S.txns = {};
  db.collection('assets').onSnapshot(s => { const o = {}; s.docs.forEach(d => { const v = d.data(); if (v && v.sym) o[v.sym] = JSON.parse(JSON.stringify(v)); }); S.assets = o; done('a', s); render(); if (window.checkSignals) setTimeout(window.checkSignals, 60); }, fail);
  db.collection('txns').onSnapshot(s => { const o = {}; s.docs.forEach(d => { const v = d.data(); if (v && v.id) o[v.id] = { ...v }; }); S.txns = o; done('t', s); render(); }, fail);
  db.collection('bench').onSnapshot(s => { const d = s.docs.find(x => x.id === 'main'); S.bench = d ? d.data() : null; if (view === 'plan') render(); }, () => { });
  db.collection('fonlar').onSnapshot(s => { const d = s.docs.find(x => x.id === 'main'); S.fonlar = d ? d.data() : null; if (view === 'fonsec') render(); }, () => { });
  db.collection('macro').onSnapshot(s => { const d = s.docs.find(x => x.id === 'main'); S.macro = d ? d.data() : null; if (['vergi', 'fonsec', 'rapor', 'analiz', 'mali'].includes(view)) render(); }, () => { });
  db.collection('cal').onSnapshot(s => { const d = s.docs.find(x => x.id === 'main'); S.cal = d ? d.data() : null; if (view === 'ana' || view === 'analiz') render(); }, () => { });
  db.collection('radar').onSnapshot(s => { const d = s.docs.find(x => x.id === 'main'); S.radar = d ? d.data() : null; if (view === 'radar') render(); }, () => { });
  db.collection('news').orderBy('d', 'desc').limit(60).onSnapshot(s => { S.news = s.docs.map(d => ({ ...d.data() })); render(); }, () => { });
  db.doc('settings/cpi').onSnapshot(s => { const d = s.exists ? s.data() : null; S.cpi = d && d.m ? { ...d.m } : {}; render(); }, () => { });
  db.doc('settings/main').onSnapshot(s => { if (s.exists) { S.settings = { ...S.settings, ...s.data() }; if (view === 'veri') rVeri(); render(); } }, () => { });
})();

/* ---------- Tema (Açık / Koyu / Sistem) ---------- */
(function tema() {
  const set = t => {
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('tema', t); } catch (e) { }
    document.querySelectorAll('#thm button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  };
  let cur = 'auto'; try { cur = localStorage.getItem('tema') || 'auto'; } catch (e) { }
  set(cur);
  document.querySelectorAll('#thm button').forEach(b => b.addEventListener('click', () => { set(b.dataset.t); render(); }));
})();


/* ---------- Bildirim detayı: sağdan açılan panel ---------- */
(function detay() {
  const box = $('#det'); if (!box) return;
  const close = () => { box.classList.remove('on'); box.setAttribute('aria-hidden', 'true'); };
  box.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && box.classList.contains('on')) close(); });
  async function open(idx, title, u) {
    const n = (S.news || []).find(x => String(kapIdx(x)) === String(idx)) || {};
    $('#detT').textContent = n.t || (title && title.length > 14 ? title : '') || 'KAP bildirimi';
    $('#detM').textContent = [n.d ? dtr(n.d) : '', (n.ilgili || []).join(', '), KAP_TIP[n.tip] || 'KAP'].filter(Boolean).join(' · ');
    $('#detB').innerHTML = '<p class="mut">Bildirim KAP\'tan alınıyor…</p>';
    box.classList.add('on'); box.setAttribute('aria-hidden', 'false');
    const actions = `<div class="row" style="margin-top:18px"><button class="ghost sm" data-pdf="${esc(idx)}">Bildirimin tamamını PDF olarak aç</button><a class="btn ghost" style="min-height:36px;font-size:14px" href="${esc(u || ('https://www.kap.org.tr/tr/Bildirim/' + idx))}" target="_blank" rel="noopener">KAP'ta aç</a></div>`;
    try {
      const d = await window.pusula.detail(idx);
      if (!n.t && d.summary) $('#detT').textContent = d.summary;
      const parts = [];
      if (d.summary) parts.push(`<p><b>${esc(d.summary)}</b></p>`);
      for (const b of d.blocks || []) parts.push(`<div>${b}</div>`);
      if (d.html) parts.push(`<div class="kapx">${d.html}</div>`);
      if (d.fields && d.fields.length) parts.push(`<table><tbody>${d.fields.map(([k, v]) => `<tr><th style="white-space:normal;width:45%">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`);
      if (d.files && d.files.length) parts.push(`<h3 style="margin-top:18px">Ekler</h3><div class="att">${d.files.map(f => `<button class="ghost sm" data-att="${esc(f.id)}" data-name="${esc(f.name)}">${esc(f.name)}</button>`).join(' ')}</div>`);
      if (!d.blocks?.length && !d.fields?.length && !d.html) parts.push(`<p class="mut">${d.files && d.files.length ? 'Bu bildirimin içeriği ek dosyada; yukarıdaki eke tıklayınca program içinde açılır.' : 'Bu bildirimin metni yok; tamamını aşağıdan PDF olarak açabilirsin.'}</p>`);
      $('#detB').innerHTML = parts.join('') + actions;
    } catch (e) {
      $('#detB').innerHTML = `<p>İçerik alınamadı: ${esc(e.message || String(e))}</p>` + actions;
    }
  }
  document.addEventListener('click', async e => {
    const a = e.target.closest('[data-det]'); if (a) { e.preventDefault(); open(a.dataset.det, a.textContent, a.dataset.u); return; }
    const f = e.target.closest('[data-att],[data-pdf]'); if (!f || !box.contains(f)) return;
    f.disabled = true; const t0 = f.textContent; f.textContent = 'Açılıyor…';
    try { await window.pusula.attachment(f.dataset.pdf ? { index: f.dataset.pdf } : { id: f.dataset.att, name: f.dataset.name }); }
    catch (er) { toast('Açılamadı: ' + (er.message || er)); }
    f.disabled = false; f.textContent = t0;
  });
})();

/* ---------- Otomatik güncelleme bildirimi ---------- */
if (DESK && window.pusula.onUpdate) {
  const show = d => { if (!d || d.state !== 'ready') return; $('#updMsg').innerHTML = `<b>Yeni sürüm hazır: ${esc(d.version)}</b><br><span class="xs mut">İndirildi. Şimdi kurabilir ya da programı kapattığında otomatik kurulmasını bekleyebilirsin.</span>`; $('#upd').hidden = false; };
  window.pusula.onUpdate(show); window.pusula.updateStatus().then(v => v && show({ state: 'ready', version: v.version })).catch(() => { });
  $('#updGo').addEventListener('click', () => { $('#updGo').disabled = true; $('#updGo').textContent = 'Kuruluyor…'; window.pusula.updateInstall(); });
  $('#updLater').addEventListener('click', () => { $('#upd').hidden = true; });
}

}
