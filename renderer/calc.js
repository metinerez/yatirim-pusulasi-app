/* ---- Hesap çekirdeği: saf fonksiyonlar (Node'da test edilir) ---- */
const C = (() => {
  const norm = s => String(s ?? '').replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase().replace(/ı/g, 'i')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

  function num(v) {
    if (v == null || v === '') return NaN;
    if (typeof v === 'number') return v;
    let s = String(v).trim().replace(/\s|₺|\$|€|TL|TRY|USD|%/gi, '');
    if (!s || s === '-' || s === '—') return NaN;
    const neg = /^\(.*\)$/.test(s); if (neg) s = s.slice(1, -1);
    let mult = 1; const m = s.match(/([KMBkmb])$/);
    if (m) { mult = { k: 1e3, m: 1e6, b: 1e9 }[m[1].toLowerCase()]; s = s.slice(0, -1); }
    const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    if (lc > -1 && ld > -1) s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (lc > -1) { const p = s.split(','); s = p.length > 2 ? p.join('') : p[0] + '.' + p[1]; }
    else if (ld > -1) { const p = s.split('.'); if (p.length > 2) s = p.join(''); }
    const n = parseFloat(s);
    return isNaN(n) ? NaN : (neg ? -n : n) * mult;
  }

  const pad = n => String(n).padStart(2, '0');
  const iso = (y, m, d) => {
    y = +y; m = +m; d = +d;
    if (!(y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
  };
  const excelDate = n => new Date(Math.round((n - 25569) * 864e5)).toISOString().slice(0, 10);
  const AY = { oca: 1, sub: 2, sbt: 2, mar: 3, nis: 4, may: 5, haz: 6, tem: 7, agu: 8, eyl: 9, eki: 10, kas: 11, ara: 12,
    jan: 1, feb: 2, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  function toISO(v, order = 'dmy') {
    if (v instanceof Date && !isNaN(v)) return iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
    if (typeof v === 'number') return v > 20000 && v < 80000 ? excelDate(v) : null;
    const s = String(v || '').trim();
    let m = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (m) return iso(m[1], m[2], m[3]);
    m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
    if (m) { let y = +m[3]; if (y < 100) y += 2000; return order === 'mdy' ? iso(y, m[1], m[2]) : iso(y, m[2], m[1]); }
    m = norm(s).match(/^([a-z]{3})[a-z]*(\d{1,2})(\d{4})$/);           // "Nov 24, 2026"
    if (m && AY[m[1]]) return iso(m[3], AY[m[1]], m[2]);
    m = norm(s).match(/^(\d{1,2})([a-z]{3})[a-z]*(\d{4})$/);           // "24 Kasım 2026"
    if (m && AY[m[2]]) return iso(m[3], AY[m[2]], m[1]);
    if (/^\d{5}$/.test(s)) return toISO(+s);
    return null;
  }
  function parseDates(vals) {
    let order = 'dmy';
    for (const v of vals) {
      const m = typeof v === 'string' && v.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
      if (m) { if (+m[1] > 12) { order = 'dmy'; break; } if (+m[2] > 12) { order = 'mdy'; break; } }
    }
    return vals.map(v => toISO(v, order));
  }

  /* ---------- Teknik göstergeler ---------- */
  function sma(a, n) {
    const o = Array(a.length).fill(null); let s = 0;
    for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1) o[i] = s / n; }
    return o;
  }
  function ema(a, n) {
    const o = Array(a.length).fill(null), k = 2 / (n + 1); let cnt = 0, sum = 0, e = null;
    for (let i = 0; i < a.length; i++) {
      const v = a[i]; if (v == null) continue;
      if (e == null) { sum += v; cnt++; if (cnt === n) { e = sum / n; o[i] = e; } }
      else { e = v * k + e * (1 - k); o[i] = e; }
    }
    return o;
  }
  function rsi(c, n = 14) {
    const o = Array(c.length).fill(null); if (c.length <= n) return o;
    let g = 0, l = 0;
    for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; }
    g /= n; l /= n; o[n] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    for (let i = n + 1; i < c.length; i++) {
      const d = c[i] - c[i - 1];
      g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n;
      o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    }
    return o;
  }
  function macd(c) {
    const a = ema(c, 12), b = ema(c, 26);
    const m = c.map((_, i) => a[i] != null && b[i] != null ? a[i] - b[i] : null);
    const s = ema(m, 9);
    return { m, s, h: m.map((v, i) => v != null && s[i] != null ? v - s[i] : null) };
  }
  function boll(c, n = 20, k = 2) {
    const mid = sma(c, n), up = [], lo = [];
    for (let i = 0; i < c.length; i++) {
      if (mid[i] == null) { up.push(null); lo.push(null); continue; }
      let v = 0; for (let j = i - n + 1; j <= i; j++) v += (c[j] - mid[i]) ** 2;
      const sd = Math.sqrt(v / n); up.push(mid[i] + k * sd); lo.push(mid[i] - k * sd);
    }
    return { mid, up, lo };
  }
  function atr(h, l, c, n = 14) {
    const tr = c.map((_, i) => i === 0 ? h[0] - l[0] : Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])));
    const o = Array(c.length).fill(null);
    if (c.length <= n) { if (c.length > 1) { const a = tr.slice(1).reduce((x, y) => x + y, 0) / (c.length - 1); o[c.length - 1] = a; } return o; }
    let a = 0; for (let i = 1; i <= n; i++) a += tr[i]; a /= n; o[n] = a;
    for (let i = n + 1; i < c.length; i++) { a = (a * (n - 1) + tr[i]) / n; o[i] = a; }
    return o;
  }
  function levels(h, l, c, A, k = 5, look = 250) {
    const n = c.length, st = Math.max(0, n - look), pts = [];
    for (let i = st + k; i < n - k; i++) {
      let isH = true, isL = true;
      for (let j = i - k; j <= i + k; j++) { if (h[j] > h[i]) isH = false; if (l[j] < l[i]) isL = false; }
      if (isH) pts.push(h[i]); if (isL) pts.push(l[i]);
    }
    const win = c.slice(st);
    pts.push(Math.min(...l.slice(st)), Math.max(...h.slice(st)));
    pts.sort((a, b) => a - b);
    const out = [], tol = Math.max(A * 0.6, (win[win.length - 1] || 1) * 0.004);
    for (const v of pts) {
      const last = out[out.length - 1];
      if (last && Math.abs(v - last.v) <= tol) { last.sum += v; last.n++; last.v = last.sum / last.n; }
      else out.push({ v, sum: v, n: 1 });
    }
    const cl = c[n - 1];
    return {
      sup: out.filter(x => x.v < cl - tol * 0.25).sort((a, b) => b.v - a.v).map(x => ({ v: x.v, n: x.n })),
      res: out.filter(x => x.v > cl + tol * 0.25).sort((a, b) => a.v - b.v).map(x => ({ v: x.v, n: x.n }))
    };
  }

  /* ---------- Getiri / risk ---------- */
  function closeAt(d, c, iso) { let r = null; for (let i = 0; i < d.length; i++) { if (d[i] <= iso) r = c[i]; else break; } return r; }
  function shift(isoDate, days) { const t = new Date(isoDate + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - days); return t.toISOString().slice(0, 10); }
  function stats(d, c, type, rf = 0) {
    const n = c.length; if (n < 2) return null;
    const per = type === 'coin' ? 365 : 252, r = [];
    for (let i = 1; i < n; i++) r.push(c[i] / c[i - 1] - 1);
    const mean = r.reduce((a, b) => a + b, 0) / r.length;
    const sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, r.length - 1));
    const vol = sd * Math.sqrt(per);
    const days = (Date.parse(d[n - 1]) - Date.parse(d[0])) / 864e5;
    const cagr = days >= 30 ? (c[n - 1] / c[0]) ** (365 / days) - 1 : null;
    let peak = c[0], mdd = 0;
    for (const v of c) { peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); }
    const down = r.filter(x => x < 0);
    const dsd = down.length > 1 ? Math.sqrt(down.reduce((a, b) => a + b * b, 0) / down.length) * Math.sqrt(per) : null;
    const last = d[n - 1], lc = c[n - 1];
    const ret = days => { if ((Date.parse(last) - Date.parse(d[0])) / 864e5 < days - 3) return null; const p = closeAt(d, c, shift(last, days)); return p ? lc / p - 1 : null; };
    const ytdBase = closeAt(d, c, (+last.slice(0, 4) - 1) + '-12-31');
    return {
      vol, cagr, mdd, days,
      sharpe: cagr != null && vol > 0 ? (cagr - rf) / vol : null,
      sortino: cagr != null && dsd ? (cagr - rf) / dsd : null,
      r1w: ret(7), r1m: ret(30), r3m: ret(91), r6m: ret(182), r1y: ret(365),
      ytd: ytdBase ? lc / ytdBase - 1 : null
    };
  }

  /* ---------- Teknik sinyal ---------- */
  function technical(px) {
    if (!px || px.length < 30) return null;
    const d = px.map(r => r[0]), c = px.map(r => r[4]);
    const h = px.map(r => (r[2] ?? r[4])), l = px.map(r => (r[3] ?? r[4]));
    const n = c.length, i = n - 1, cl = c[i];
    const s20 = sma(c, 20), s50 = sma(c, 50), s200 = sma(c, 200), R = rsi(c), M = macd(c), B = boll(c), A = atr(h, l, c);
    const a = A[i] || Math.abs(cl * 0.02);
    const lv = levels(h, l, c, a);
    const parts = [], why = [];
    // 1) Trend (30)
    let t = 0;
    if (s200[i] != null) {
      t += cl > s200[i] ? .5 : -.5; t += s50[i] > s200[i] ? .5 : -.5;
      why.push(cl > s200[i] ? 'Fiyat 200 günlük ortalamanın üstünde: uzun vadeli trend yukarı' : 'Fiyat 200 günlük ortalamanın altında: uzun vadeli trend aşağı');
      const cross = (() => { for (let j = i; j > Math.max(200, i - 20); j--) { const a1 = s50[j] - s200[j], a0 = s50[j - 1] - s200[j - 1]; if (a1 > 0 && a0 <= 0) return 'Son 20 günde altın kesişim (50G, 200G\'yi yukarı kesti)'; if (a1 < 0 && a0 >= 0) return 'Son 20 günde ölüm kesişimi (50G, 200G\'yi aşağı kesti)'; } return null; })();
      if (cross) why.push(cross);
    } else if (s50[i] != null) {
      t += cl > s50[i] ? .5 : -.5; t += s20[i] > s50[i] ? .5 : -.5;
      why.push((cl > s50[i] ? 'Fiyat 50 günlük ortalamanın üstünde' : 'Fiyat 50 günlük ortalamanın altında') + ' (200 gün için veri yetersiz)');
    } else {
      t += cl > s20[i] ? .5 : -.5;
      why.push(cl > s20[i] ? 'Fiyat 20 günlük ortalamanın üstünde' : 'Fiyat 20 günlük ortalamanın altında');
    }
    parts.push({ k: 'Trend', w: 30, v: t });
    // 2) MACD (20)
    let mc = 0;
    if (M.h[i] != null) {
      mc += M.h[i] > 0 ? .5 : -.5; mc += M.h[i] > M.h[i - 1] ? .5 : -.5;
      why.push(M.h[i] > 0 ? (M.h[i] > M.h[i - 1] ? 'MACD sinyal çizgisinin üstünde ve güçleniyor' : 'MACD pozitif ama ivme zayıflıyor') : (M.h[i] > M.h[i - 1] ? 'MACD negatif ama toparlanıyor' : 'MACD negatif ve zayıflıyor'));
    }
    parts.push({ k: 'Momentum (MACD)', w: 20, v: mc });
    // 3) RSI (20)
    const r = R[i]; let rv = 0;
    if (r != null) {
      rv = r < 30 ? 1 : r < 40 ? .5 : r > 75 ? -1 : r > 65 ? -.5 : 0;
      why.push(`RSI ${r.toFixed(0)}: ` + (r < 30 ? 'aşırı satım, tepki alımı ihtimali' : r < 40 ? 'zayıf bölge, ucuzlamış' : r > 75 ? 'aşırı alım, düzeltme riski' : r > 65 ? 'yükselişte ısınıyor' : 'nötr bölge'));
    }
    parts.push({ k: 'RSI', w: 20, v: rv });
    // 4) Bollinger %B (15)
    let pb = null, bv = 0;
    if (B.up[i] != null && B.up[i] > B.lo[i]) {
      pb = (cl - B.lo[i]) / (B.up[i] - B.lo[i]);
      bv = pb < 0 ? 1 : pb < .2 ? .5 : pb > 1 ? -1 : pb > .8 ? -.5 : 0;
      if (pb < .2) why.push('Fiyat Bollinger alt bandına yakın'); else if (pb > .8) why.push('Fiyat Bollinger üst bandına yakın');
    }
    parts.push({ k: 'Bollinger', w: 15, v: bv });
    // 5) Destek/direnç yakınlığı (15)
    const S1 = lv.sup[0]?.v, R1 = lv.res[0]?.v; let sv = 0;
    if (S1 != null && cl - S1 < a) { sv += 1; why.push('Fiyat güçlü bir desteğe yakın'); }
    if (R1 != null && R1 - cl < a) { sv -= 1; why.push('Fiyat dirence dayanmış'); }
    parts.push({ k: 'Destek/Direnç', w: 15, v: Math.max(-1, Math.min(1, sv)) });
    const score = Math.round(parts.reduce((s, p) => s + p.w * p.v, 0));
    // Seviyeler
    const S2 = lv.sup[1]?.v, R2 = lv.res[1]?.v;
    const useS = S1 != null && cl - S1 <= 3 * a;
    const zone = useS ? [S1, Math.min(cl, S1 + .5 * a)] : [cl - a, cl];
    const stop = useS ? S1 - .75 * a : cl - 2 * a;
    const t1 = R1 != null ? R1 : cl + 2 * a, t2 = R2 != null ? R2 : t1 + 2 * a;
    const rr = cl > stop ? (t1 - cl) / (cl - stop) : null;
    return {
      score, parts, why, last: cl, date: d[i], atr: a, rsi: r, pb, macdH: M.h[i],
      s20: s20[i], s50: s50[i], s200: s200[i], sup: lv.sup.slice(0, 3), res: lv.res.slice(0, 3),
      zone, stop, t1, t2, rr, series: { s20, s50, s200, R, M, B }
    };
  }

  /* ---------- Mali tablolar ---------- */
  const FIN = [
    ['rev', 'Hasılat', 'flow'], ['gp', 'Brüt kâr', 'flow'], ['ebitda', 'FAVÖK', 'flow'], ['op', 'Esas faaliyet kârı', 'flow'], ['ni', 'Net kâr (ana ortaklık)', 'flow'],
    ['ca', 'Dönen varlıklar', 'stock'], ['inv', 'Stoklar', 'stock'], ['cash', 'Nakit ve benzerleri', 'stock'], ['ta', 'Toplam varlıklar', 'stock'],
    ['cl', 'KV yükümlülükler', 'stock'], ['tl', 'Toplam yükümlülükler', 'stock'], ['debt', 'Finansal borç', 'stock'], ['eq', 'Özkaynak (ana ortaklık)', 'stock'],
    ['cfo', 'İşletme faaliyetlerinden nakit', 'flow'], ['capex', 'Yatırım harcaması (capex)', 'flow'], ['fcf', 'Serbest nakit akışı', 'flow'], ['fxp', 'Net döviz pozisyonu', 'stock']
  ];
  const FIN_ALIAS = {
    rev: ['hasilat', 'satislar', 'satisgelirleri', 'netsatislar', 'revenue', 'sales', 'gelir'],
    gp: ['brutkar', 'brutkarzarar', 'brutesasfaaliyetkari', 'grossprofit'],
    ebitda: ['favok', 'ebitda'],
    op: ['esasfaaliyetkari', 'faaliyetkari', 'esasfaaliyetkarizarari', 'operatingprofit', 'ebit'],
    ni: ['netkar', 'donemkari', 'netdonemkari', 'anaortaklikpaylari', 'netkarzarar', 'netincome', 'anaortakliknetkar'],
    ca: ['donenvarliklar', 'currentassets'], inv: ['stoklar', 'stok', 'inventory'],
    cash: ['nakit', 'nakitvenakitbenzerleri', 'cash'], ta: ['toplamvarliklar', 'aktiftoplami', 'varliklartoplami', 'totalassets'],
    cl: ['kvyukumlulukler', 'kisavadeliyukumlulukler', 'currentliabilities'], tl: ['toplamyukumlulukler', 'yukumluluklertoplami', 'totalliabilities'],
    debt: ['finansalborc', 'finansalborclar', 'toplamfinansalborc', 'borclanmalar', 'debt'],
    eq: ['ozkaynak', 'ozkaynaklar', 'anaortaklikaitozkaynaklar', 'equity'],
    cfo: ['isletmefaaliyetlerindennakit', 'isletmefaaliyetlerindenkaynaklanannetnakit', 'operatingcashflow'], capex: ['sabitsermayeyatirimlari', 'capex', 'yatirimharcamasi'],
    fcf: ['serbestnakitakim', 'serbestnakitakisi', 'freecashflow'], fxp: ['netyabanciparapozisyonu', 'netdovizpozisyonu']
  };
  function parsePeriod(s) {
    if (typeof s === 'number') { if (s > 20000 && s < 80000) s = excelDate(s); else if (!(s >= 1990 && s <= 2100)) return null; }
    const t = String(s || '').trim().toUpperCase().replace(/\s/g, '');
    let m = t.match(/^(\d{4})[/.\-]?(Q|Ç|C)?([1-4])(Q|Ç|C)?$/);
    if (m && (m[2] || m[4])) return { y: +m[1], m: +m[3] * 3 };
    m = t.match(/^(\d{4})[/.\-](\d{1,2})(?:[/.\-]\d{1,2})?$/); if (m && +m[2] >= 1 && +m[2] <= 12) return { y: +m[1], m: +m[2] };
    m = t.match(/^(\d{1,2})[/.\-](\d{4})$/); if (m) return { y: +m[2], m: +m[1] };
    m = t.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/); if (m) return { y: +m[3], m: +m[2] };
    m = t.match(/^(\d{4})$/); if (m) return { y: +m[1], m: 12 };
    return null;
  }
  const pkey = p => `${p.y}/${pad(p.m)}`;
  function finSorted(fin) { return (fin || []).filter(f => f.y && f.m).slice().sort((a, b) => a.y - b.y || a.m - b.m); }
  function ttm(fin, key) {
    const s = finSorted(fin); const cur = s[s.length - 1]; if (!cur || cur[key] == null) return null;
    if (cur.m === 12) return { v: cur[key], how: 'yıllık' };
    const fy = s.find(f => f.y === cur.y - 1 && f.m === 12), py = s.find(f => f.y === cur.y - 1 && f.m === cur.m);
    if (fy && py && fy[key] != null && py[key] != null) return { v: cur[key] + fy[key] - py[key], how: 'son 12 ay' };
    return { v: cur[key] * 12 / cur.m, how: 'yıllıklandırıldı' };
  }
  function yoy(fin, key) {
    const s = finSorted(fin); const cur = s[s.length - 1]; if (!cur) return null;
    const py = s.find(f => f.y === cur.y - 1 && f.m === cur.m);
    return py && py[key] && cur[key] != null ? cur[key] / Math.abs(py[key]) - (py[key] < 0 ? -1 : 1) : null;
  }
  function ratios(asset) {
    const s = finSorted(asset.fin); const cur = s[s.length - 1]; if (!cur) return null;
    const P = asset.last, N = asset.shares, mcap = P && N ? P * N : null;
    const T = k => ttm(s, k)?.v ?? null;
    const ni = T('ni'), rev = T('rev'), eb = T('ebitda'), gp = T('gp'), op = T('op');
    const nd = cur.debt != null ? cur.debt - (cur.cash || 0) : null;
    const ev = mcap != null && nd != null ? mcap + nd : null;
    const dv = (a, b) => a != null && b != null && b !== 0 ? a / b : null;
    const pos = (a, b) => (b != null && b > 0) ? dv(a, b) : null;
    return {
      period: pkey(cur), ttmHow: ttm(s, 'ni')?.how, mcap, ev, nd,
      pe: pos(mcap, ni), pb: pos(mcap, cur.eq), evEbitda: pos(ev, eb), evSales: pos(ev, rev),
      roe: dv(ni, cur.eq), roa: dv(ni, cur.ta),
      gm: dv(gp, rev), em: dv(eb, rev), om: dv(op, rev), nm: dv(ni, rev),
      cr: dv(cur.ca, cur.cl), qr: cur.ca != null && cur.cl ? (cur.ca - (cur.inv || 0)) / cur.cl : null,
      de: dv(cur.tl, cur.eq), ndEbitda: dv(nd, eb), eps: dv(ni, N), bvps: dv(cur.eq, N),
      revG: yoy(s, 'rev'), niG: yoy(s, 'ni'), ebG: yoy(s, 'ebitda'), negNI: ni != null && ni < 0,
      cfo: T('cfo'), fcf: T('fcf'), capex: T('capex'), fcfY: pos(T('fcf'), mcap), cfoNi: ni > 0 && T('cfo') != null ? T('cfo') / ni : null,
      fxp: cur.fxp ?? null, fxpEq: dv(cur.fxp, cur.eq), capexRev: dv(T('capex') != null ? Math.abs(T('capex')) : null, rev)
    };
  }
  /* Piotroski F-skoru (0–9): kârlılık, kaldıraç/likidite ve verimlilikte iyileşme. Bir yıl önceki aynı döneme göre. */
  function piotroski(asset) {
    const s = finSorted(asset.fin); const cur = s[s.length - 1]; if (!cur) return null;
    const pyIdx = s.findIndex(f => f.y === cur.y - 1 && f.m === cur.m); if (pyIdx < 0) return null;
    const ps = s.slice(0, pyIdx + 1), py = s[pyIdx];
    const T = (arr, k) => ttm(arr, k)?.v ?? null;
    const ni = T(s, 'ni'), ni0 = T(ps, 'ni'), cfo = T(s, 'cfo'), rev = T(s, 'rev'), rev0 = T(ps, 'rev'), gp = T(s, 'gp'), gp0 = T(ps, 'gp');
    const q = (a, b) => a != null && b ? a / b : null;
    const roa = q(ni, cur.ta), roa0 = q(ni0, py.ta), lev = q(cur.debt, cur.ta), lev0 = q(py.debt, py.ta), crr = q(cur.ca, cur.cl), crr0 = q(py.ca, py.cl);
    const gm = q(gp, rev), gm0 = q(gp0, rev0), at = q(rev, cur.ta), at0 = q(rev0, py.ta);
    const C = [
      ['Net kâr pozitif', roa != null ? roa > 0 : null],
      ['İşletme nakit akışı pozitif', cfo != null ? cfo > 0 : null],
      ['Aktif kârlılığı arttı', roa != null && roa0 != null ? roa > roa0 : null],
      ['Nakit akışı net kârdan büyük (kâr kalitesi)', cfo != null && ni != null ? cfo > ni : null],
      ['Borçluluk azaldı', lev != null && lev0 != null ? lev < lev0 : null],
      ['Cari oran yükseldi', crr != null && crr0 != null ? crr > crr0 : null],
      ['Yeni pay ihracı yok (sermaye artmadı)', cur.cap && py.cap ? cur.cap <= py.cap * 1.001 : null],
      ['Brüt marj arttı', gm != null && gm0 != null ? gm > gm0 : null],
      ['Aktif devir hızı arttı', at != null && at0 != null ? at > at0 : null]];
    const known = C.filter(c => c[1] != null); if (known.length < 6) return null;
    return { score: known.filter(c => c[1]).length, n: known.length, items: C.map(([l, ok]) => ({ l, ok })), vs: pkey(py) };
  }
  /* Eşikler; her biri -2..+2 puan */
  const RULES = [
    ['pe', 'F/K', r => r.negNI ? -2 : r.pe == null ? null : r.pe < 8 ? 2 : r.pe < 15 ? 1 : r.pe > 25 ? -1 : 0],
    ['pb', 'PD/DD', r => r.pb == null ? null : r.pb < 1.5 ? 2 : r.pb < 3 ? 1 : r.pb > 6 ? -1 : 0],
    ['evEbitda', 'FD/FAVÖK', r => r.evEbitda == null ? null : r.evEbitda < 6 ? 2 : r.evEbitda < 10 ? 1 : r.evEbitda > 15 ? -1 : 0],
    ['roe', 'Özkaynak kârlılığı', r => r.roe == null ? null : r.roe > .3 ? 2 : r.roe > .15 ? 1 : r.roe < .05 ? -1 : 0],
    ['nm', 'Net kâr marjı', r => r.nm == null ? null : r.nm > .15 ? 1 : r.nm < 0 ? -2 : 0],
    ['cr', 'Cari oran', r => r.cr == null ? null : r.cr > 1.5 ? 1 : r.cr < 1 ? -1 : 0],
    ['ndEbitda', 'Net borç/FAVÖK', r => r.nd == null ? null : r.nd < 0 ? 2 : r.ndEbitda == null ? null : r.ndEbitda < 1 ? 1 : r.ndEbitda > 3 ? -2 : 0],
    ['revG', 'Satış büyümesi', r => r.revG == null ? null : r.revG > .3 ? 1 : r.revG < 0 ? -1 : 0]
  ];
  function fundScore(r) {
    if (!r) return null;
    let s = 0, mx = 0; const items = [];
    for (const [k, label, f] of RULES) { const p = f(r); if (p == null) continue; s += p; mx += 2; items.push({ k, label, p }); }
    if (mx < 6) return null;
    return { score: Math.round(s / mx * 100), items };
  }
  const label = s => s >= 50 ? 'GÜÇLÜ AL' : s >= 20 ? 'AL' : s > -20 ? 'TUT' : s > -50 ? 'SAT' : 'GÜÇLÜ SAT';
  function combined(asset) {
    const t = technical(asset.px);
    const f = asset.type === 'hisse' ? fundScore(ratios(asset)) : null;
    if (!t && !f) return null;
    const score = t && f ? Math.round(.6 * t.score + .4 * f.score) : (t ? t.score : f.score);
    return { score, label: label(score), t, f };
  }

  /* ---------- Portföy ---------- */
  function positions(txns) {
    const P = {};
    for (const x of txns.slice().sort((a, b) => (a.d || '').localeCompare(b.d || '') || (a.side === 'AL' ? -1 : 1))) {
      const p = P[x.sym] || (P[x.sym] = { sym: x.sym, qty: 0, cost: 0, realized: 0, fees: 0, n: 0, first: x.d });
      const q = +x.qty, pr = +x.price, fee = +x.fee || 0; p.n++; p.fees += fee;
      if (x.side === 'AL') { p.qty += q; p.cost += q * pr + fee; }
      else { const avg = p.qty > 0 ? p.cost / p.qty : 0, qq = Math.min(q, p.qty); p.realized += qq * pr - fee - avg * qq; p.cost -= avg * qq; p.qty -= qq; }
      if (Math.abs(p.qty) < 1e-9) { p.qty = 0; p.cost = 0; }
    }
    return Object.values(P).map(p => ({ ...p, avg: p.qty > 0 ? p.cost / p.qty : null }));
  }

  /* ---------- Fon içeriği (look-through) ---------- */
  const ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/;
  function ccOf(it) {
    if (it.cc) return String(it.cc).toUpperCase().slice(0, 2);
    const c = String(it.code || '').toUpperCase();
    return ISIN.test(c) ? c.slice(0, 2) : null;
  }
  function catOf(it) {
    const t = norm(it.t), c = String(it.code || '').toUpperCase(), cc = ccOf(it), nm = norm(it.name);
    if (/katilmapay|katilmabelge|yatirimfon|borsayatirim|byf|etf|yfonu/.test(t)) return 'Fon / BYF';
    if (/maden|altin|gumus|kiymetli/.test(t) || /^(altin|gumus|xau|xag)/.test(nm)) return 'Altın / kıymetli maden';
    if (/hisse|pay|equity|stock|share/.test(t)) return cc && cc !== 'TR' ? 'Hisse · yurt dışı' : cc === 'TR' ? 'Hisse · Türkiye' : 'Hisse';
    if (/tahvil|bono|borclanma|eurobond|ozelsektor|kirasertifika|sukuk|bond|finansmanbonosu|ytb/.test(t)) return 'Borçlanma araçları';
    if (/repo|mevduat|nakit|parapiyasa|vadeli mevduat|katilimhesabi|cash|takasbank/.test(t)) return 'Nakit / para piyasası';
    if (/altin|gumus|kiymetlimaden|gold|silver/.test(t)) return 'Altın / kıymetli maden';
    if (/fon|byf|etf|fund/.test(t)) return 'Fon / BYF';
    if (/vadeli|opsiyon|turev|future|option|varant/.test(t)) return 'Türev';
    if (ISIN.test(c)) {
      if (/^TRA/.test(c)) return 'Hisse · Türkiye';
      if (/^TR[TSFDB]/.test(c)) return 'Borçlanma araçları';
      return 'Hisse · yurt dışı';
    }
    if (/^[A-Z]{4,6}$/.test(c) && !t) return 'Hisse · Türkiye';
    return t ? 'Diğer' : 'Hisse';
  }
  const holdKey = it => it.code ? String(it.code).toUpperCase().trim() : 'N:' + norm(it.name);
  function normWeights(items) {
    const ws = items.map(i => i.w).filter(v => isFinite(v));
    const sum = ws.reduce((a, b) => a + b, 0);
    const k = sum > 1.5 || Math.max(0, ...ws) > 1 ? 100 : 1;
    return items.filter(i => isFinite(i.w) && i.w !== 0).map(i => ({ ...i, w: i.w / k }));
  }
  function latestHold(a) { const h = a && a.hold; return h && h.length ? h[h.length - 1] : null; }
  const DIRECT_CAT = { hisse: 'Hisse · Türkiye', emtia: 'Altın / kıymetli maden', coin: 'Kripto', fon: 'Fon (içerik girilmemiş)' };
  /* pos: [{sym, value}] açık pozisyonlar; assets: {sym: asset} */
  function lookThrough(pos, assets) {
    const R = new Map(); let total = 0, covered = 0;
    const syms = new Set(Object.keys(assets).map(s => s.toUpperCase()));
    const canon = it => {   // TRATHYAO91M5 → THYAO (doğrudan pozisyonla birleşsin)
      const c = String(it.code || '').toUpperCase();
      if (ISIN.test(c) && c.startsWith('TRA')) { const t5 = c.slice(3, 8), t4 = c.slice(3, 7); return syms.has(t5) ? t5 : syms.has(t4) ? t4 : t5; }
      if (c && syms.has(c)) return c;
      return holdKey(it);
    };
    const add = (key, name, cat, cc, val, via, direct) => {
      const r = R.get(key) || { key, name, cat, cc, direct: 0, indirect: 0, via: {} };
      if ((!r.name || direct) && name) r.name = name; if ((!r.cc) && cc) r.cc = cc;
      if (direct) r.direct += val; else { r.indirect += val; r.via[via] = (r.via[via] || 0) + val; }
      R.set(key, r);
    };
    for (const p of pos) {
      if (!(p.value > 0)) continue; total += p.value;
      const a = assets[p.sym] || {}, h = a.type === 'fon' ? latestHold(a) : null;
      if (h && h.items.length) {
        covered += p.value; let sw = 0;
        for (const it of h.items) { sw += it.w; add(canon(it), it.name || it.code, catOf(it), ccOf(it), p.value * it.w, p.sym, false); }
        if (sw < .995) add('DIGER', 'Açıklanmayan / diğer', 'Diğer', null, p.value * (1 - sw), p.sym, false);
      } else {
        add(String(p.sym).toUpperCase(), a.name || p.sym, a.type === 'hisse' && a.mkt === 'US' ? 'Hisse · yurt dışı' : (DIRECT_CAT[a.type] || 'Diğer'), a.type === 'hisse' ? (a.mkt === 'US' ? (/\.(AS|DE|PA|L|MI|SW|MC|BR|ST|CO|HE|OL)$/.test(p.sym) ? 'EU' : 'US') : 'TR') : null, p.value, null, true);
      }
    }
    const rows = [...R.values()].map(r => ({ ...r, total: r.direct + r.indirect, w: total ? (r.direct + r.indirect) / total : 0 })).sort((x, y) => y.total - x.total);
    const by = f => { const o = {}; rows.forEach(r => { const k = f(r); o[k] = (o[k] || 0) + r.total; }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
    return { rows, total, covered, byCat: by(r => r.cat), byCc: by(region) };
  }
  const ULKE = { TR: 'Türkiye', US: 'ABD', DE: 'Almanya', NL: 'Hollanda', IE: 'İrlanda', GB: 'Birleşik Krallık', FR: 'Fransa', CH: 'İsviçre', LU: 'Lüksemburg', CN: 'Çin', HK: 'Hong Kong', TW: 'Tayvan', JP: 'Japonya', KR: 'Güney Kore', CA: 'Kanada', KY: 'Cayman Adaları', DK: 'Danimarka', SE: 'İsveç', IL: 'İsrail', IN: 'Hindistan', AU: 'Avustralya', BM: 'Bermuda', JE: 'Jersey' };
  function region(r) {
    if (r.cat === 'Kripto') return 'Kripto (dolar bazlı)';
    if (r.cat === 'Altın / kıymetli maden') return 'Altın (dolar bazlı)';
    if (r.cc) return ULKE[r.cc] || r.cc;
    if (/Türkiye|Borçlanma|Nakit/.test(r.cat)) return 'Türkiye';
    return 'Bilinmiyor';
  }
  function overlap(ha, hb) {
    if (!ha || !hb) return null;
    const m = new Map(ha.items.map(i => [holdKey(i), i.w])); let s = 0;
    for (const i of hb.items) { const w = m.get(holdKey(i)); if (w != null) s += Math.min(w, i.w); }
    return s;
  }
  function holdChange(a) {
    const h = a && a.hold; if (!h || h.length < 2) return null;
    const cur = h[h.length - 1], prev = h[h.length - 2];
    const P = new Map(prev.items.map(i => [holdKey(i), i])), Cm = new Map(cur.items.map(i => [holdKey(i), i]));
    const added = cur.items.filter(i => !P.has(holdKey(i))), removed = prev.items.filter(i => !Cm.has(holdKey(i)));
    const moved = cur.items.filter(i => P.has(holdKey(i))).map(i => ({ ...i, d: i.w - P.get(holdKey(i)).w })).filter(i => Math.abs(i.d) >= .005).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
    return { from: prev.date, to: cur.date, added, removed, moved };
  }

  /* ---------- Enflasyon (TÜFE) ---------- */
  /* cpi: {'2026-10': 2.58, ...} aylık % değişim. Ayın 1-15'i arası alımda o ayın enflasyonu da sayılır. */
  function cpiMonths(cpi) { return Object.keys(cpi || {}).filter(k => /^\d{4}-\d{2}$/.test(k) && isFinite(cpi[k])).sort(); }
  function cpiFactor(cpi, d, upTo) {
    const ms = cpiMonths(cpi); if (!ms.length || !d) return null;
    const ym = d.slice(0, 7), day = +d.slice(8, 10); let f = 1;
    for (const m of ms) { if (m < ym || (upTo && m > upTo)) continue; if (m === ym && day > 15) continue; f *= 1 + cpi[m] / 100; }
    return f;
  }
  function cpiGap(cpi, d) {   // alış ayından son veriye kadar eksik ay var mı
    const ms = cpiMonths(cpi); if (!ms.length || !d) return true;
    const ym = d.slice(0, 7); if (ym < ms[0]) return true;
    const [y0, m0] = ms[0].split('-').map(Number), [y1, m1] = ms[ms.length - 1].split('-').map(Number);
    return ms.length < (y1 - y0) * 12 + (m1 - m0) + 1;
  }
  function realPositions(txns, cpi) {
    const P = {};
    for (const x of txns.slice().sort((a, b) => (a.d || '').localeCompare(b.d || '') || (a.side === 'AL' ? -1 : 1))) {
      const p = P[x.sym] || (P[x.sym] = { sym: x.sym, qty: 0, cost: 0, rcost: 0, realized: 0, rrealized: 0, gap: false });
      const q = +x.qty, pr = +x.price, fee = +x.fee || 0, f = cpiFactor(cpi, x.d) ?? 1;
      if (cpiGap(cpi, x.d)) p.gap = true;
      if (x.side === 'AL') { p.qty += q; p.cost += q * pr + fee; p.rcost += (q * pr + fee) * f; }
      else {
        const qq = Math.min(q, p.qty), sh = p.qty > 0 ? qq / p.qty : 0, c = p.cost * sh, rc = p.rcost * sh, net = qq * pr - fee;
        p.realized += net - c; p.rrealized += net * f - rc; p.cost -= c; p.rcost -= rc; p.qty -= qq;
      }
      if (Math.abs(p.qty) < 1e-9) { p.qty = 0; p.cost = 0; p.rcost = 0; }
    }
    return Object.values(P).map(p => ({ ...p, be: p.qty > 0 ? p.rcost / p.qty : null }));
  }


  /* ---------- Vergi: FIFO ile satış kazancı ve Yİ-ÜFE endekslemesi ---------- */
  // ufe: { 'YYYY-MM': aylık % değişim }. Endeks oranı = alış ayı dahil, satış ayı hariç aylık değişimlerin çarpımı
  const ymOf = d => String(d).slice(0, 7);
  const ymNext = ym => { let [y, m] = ym.split('-').map(Number); m++; if (m > 12) { m = 1; y++; } return `${y}-${String(m).padStart(2, '0')}`; };
  function ufeFactor(ufe, buyD, sellD) {
    let f = 1, ym = ymOf(buyD); const end = ymOf(sellD); let n = 0;
    while (ym < end) { const v = ufe && ufe[ym]; if (v == null) return null; f *= 1 + v / 100; ym = ymNext(ym); if (++n > 600) return null; }
    return f;
  }
  function taxFifo(txns, year, ufe) {
    const out = [], lots = {};
    for (const x of txns.slice().sort((a, b) => (a.d || '').localeCompare(b.d || '') || (a.side === 'AL' ? -1 : 1))) {
      const L = lots[x.sym] || (lots[x.sym] = []), q = +x.qty, pr = +x.price, fee = +x.fee || 0;
      if (x.side === 'AL') { L.push({ d: x.d, q, unit: (q * pr + fee) / q }); continue; }
      let rem = q; const unitS = (q * pr - fee) / q;
      while (rem > 1e-12 && L.length) {
        const l = L[0], take = Math.min(rem, l.q);
        if (String(x.d).slice(0, 4) === String(year)) {
          const cost = take * l.unit, f = ufeFactor(ufe, l.d, x.d), idx = f != null && f - 1 >= 0.10;
          const icost = idx ? cost * f : cost, proc = take * unitS;
          out.push({ sym: x.sym, buy: l.d, sell: x.d, q: take, cost, f, idx, icost, proc, gain: proc - icost, miss: f == null });
        }
        l.q -= take; rem -= take; if (l.q <= 1e-12) L.shift();
      }
    }
    return out;
  }
  // Gelir vergisi (ücret dışı gelirler tarifesi)
  const TARIFE = {
    2025: [[158000, .15], [330000, .20], [800000, .27], [4300000, .35], [Infinity, .40]],
    2026: [[190000, .15], [400000, .20], [1000000, .27], [5300000, .35], [Infinity, .40]]
  };
  function incomeTax(m, year) {
    const T = TARIFE[year] || TARIFE[2026]; let t = 0, lo = 0;
    for (const [hi, r] of T) { if (m <= lo) break; t += (Math.min(m, hi) - lo) * r; lo = hi; }
    return Math.max(0, t);
  }
  return { cpiMonths, cpiFactor, cpiGap, realPositions, ULKE, region, ISIN, ccOf, catOf, holdKey, normWeights, latestHold, lookThrough, overlap, holdChange, norm, num, toISO, parseDates, sma, ema, rsi, macd, boll, atr, levels, stats, technical, FIN, FIN_ALIAS, parsePeriod, pkey, finSorted, ttm, yoy, ratios, piotroski, ufeFactor, taxFifo, incomeTax, TARIFE, fundScore, RULES, label, combined, positions };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = C;
