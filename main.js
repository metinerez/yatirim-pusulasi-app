// Yatırım Pusulası — masaüstü ana süreç
const { app, BrowserWindow, ipcMain, shell, Notification, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const sources = require('./sources');
let autoUpdater = null; try { ({ autoUpdater } = require('electron-updater')); } catch (e) { }

const SELFTEST = process.argv.includes('--selftest');
const HIDDEN = process.argv.includes('--gizli');
if (SELFTEST) app.setPath('userData', path.join(process.cwd(), 'selftest-data'));
app.setAppUserModelId('com.metinerez.yatirimpusulasi');

if (!SELFTEST && !app.requestSingleInstanceLock()) { app.quit(); }

let win = null, data = null, refreshing = false;
const DATA = () => path.join(app.getPath('userData'), 'pusula-veri.json');
const send = (ch, payload) => { if (win && !win.isDestroyed()) win.webContents.send(ch, payload); };

/* ---------- Yerel depolama ---------- */
function load() {
  try { data = JSON.parse(fs.readFileSync(DATA(), 'utf8')); } catch (e) { data = null; }
  if (!data) {
    try { data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'baslangic.json'), 'utf8')); } catch (e) { data = {}; }
    write();
  }
  return data;
}
function write() {
  const f = DATA(), tmp = f + '.tmp';
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, f);
  backup();
}
function backup() {
  try {
    const dir = path.join(app.getPath('userData'), 'yedek'); fs.mkdirSync(dir, { recursive: true });
    const name = `pusula-${new Date().toISOString().slice(0, 10)}.json`, f = path.join(dir, name);
    if (!fs.existsSync(f)) fs.copyFileSync(DATA(), f);
    const all = fs.readdirSync(dir).filter(x => x.startsWith('pusula-')).sort();
    for (const old of all.slice(0, Math.max(0, all.length - 30))) fs.unlinkSync(path.join(dir, old));
  } catch (e) { }
  extBackup();
}
// Kullanıcının seçtiği klasöre (OneDrive / Google Drive gibi) ikinci yedek: güncel kopya + günlük kopyalar
let extAt = 0;
function extBackup(force) {
  try {
    const dir = data && data.settings && data.settings.main && data.settings.main.backupDir; if (!dir || !fs.existsSync(dir)) return;
    if (!force && Date.now() - extAt < 10 * 60e3) return; extAt = Date.now();
    const sub = path.join(dir, 'YatirimPusulasi'); fs.mkdirSync(sub, { recursive: true });
    fs.copyFileSync(DATA(), path.join(sub, 'pusula-veri.json'));
    const day = path.join(sub, `pusula-${new Date().toISOString().slice(0, 10)}.json`); if (!fs.existsSync(day)) fs.copyFileSync(DATA(), day);
    const all = fs.readdirSync(sub).filter(x => /^pusula-\d{4}/.test(x)).sort();
    for (const old of all.slice(0, Math.max(0, all.length - 30))) fs.unlinkSync(path.join(sub, old));
    data.settings.main.backupAt = new Date().toISOString();
  } catch (e) { }
}
ipcMain.handle('pick-backup-dir', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Yedek klasörünü seç (ör. OneDrive)', properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('backup-now', () => { extBackup(true); return data.settings && data.settings.main && data.settings.main.backupAt; });

/* ---------- Veri güncelleme ---------- */
function lastRefresh() { return data && data.settings && data.settings.main && data.settings.main.lastRefresh; }
function due() {
  const lr = lastRefresh(); if (!lr) return true;
  const last = new Date(lr.at), now = new Date();
  if ((now - last) / 36e5 >= 12) return true;
  return now.getHours() >= 19 && last.toDateString() !== now.toDateString();
}
let queued = null;
async function refresh(why, only) {
  if (refreshing) { if (only && only.length) queued = [...new Set([...(queued || []), ...only])]; return { busy: true }; }
  refreshing = true; send('refresh-state', { running: true, msg: 'Veriler çekiliyor…' });
  let res;
  try { res = await sources.refreshAll(JSON.parse(JSON.stringify(data)), msg => send('refresh-state', { running: true, msg }), only); }
  catch (e) { res = { patches: {}, errors: [String(e && e.message || e)], updated: [] }; }
  // Yamaları güncel veriye uygula (kullanıcı bu sırada düzenleme yapmış olabilir)
  data.assets = data.assets || {};
  for (const [id, p] of Object.entries(res.patches || {})) data.assets[id] = { ...(data.assets[id] || {}), ...p };
  for (const [id, n] of Object.entries(res.news || {})) { data.news = data.news || {}; data.news[id] = n; }
  if (res.radar) { data.radar = { main: res.radar }; }
  if (res.bench) { data.bench = { main: res.bench }; }
  if (res.cal) { data.cal = { main: res.cal }; }
  data.settings = data.settings || {};
  const kapOk = !only && !(res.errors || []).some(e => e.startsWith('KAP'));
  const info = { at: new Date().toISOString(), why, errors: res.errors || [], updated: res.updated || [] };
  data.settings.main = { ...(data.settings.main || {}), [only ? 'lastPartial' : 'lastRefresh']: info, ...(kapOk ? { kapSince: new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10) } : {}) };
  write(); send('data', data);
  refreshing = false; send('refresh-state', { running: false });
  if (queued) { const q = queued; queued = null; setTimeout(() => refresh('yeni varlık', q), 500); }
  return { errors: res.errors, updated: res.updated };
}

/* ---------- IPC ---------- */
ipcMain.handle('load', () => data);
ipcMain.handle('save', (e, d) => { if (d && typeof d === 'object') { data = d; write(); } return true; });
ipcMain.handle('refresh', (e, only) => refresh(Array.isArray(only) && only.length ? (only[0] === '__RADAR' ? 'fırsat radarı' : 'yeni varlık') : 'elle', Array.isArray(only) ? only.map(String).slice(0, 50) : null));
ipcMain.handle('open-folder', () => shell.openPath(app.getPath('userData')));
ipcMain.handle('version', () => app.getVersion());
ipcMain.handle('login-item', (e, on) => {
  if (on === true || on === false) app.setLoginItemSettings({ openAtLogin: on, args: ['--gizli'] });
  return app.getLoginItemSettings({ args: ['--gizli'] }).openAtLogin;
});
// KAP bildirim detayı ve ekleri (uygulama içinde)
const detCache = new Map();
ipcMain.handle('detail', async (e, index) => {
  index = parseInt(index, 10); if (!(index > 0)) throw new Error('geçersiz bildirim');
  if (detCache.has(index)) return detCache.get(index);
  const d = await sources.kapDetail(index); detCache.set(index, d); return d;
});
// Genel güvenlik: hiçbir pencere uzak sayfaya gitmesin, yeni pencere açmasın, izin (kamera, konum…) istemesin
app.on('web-contents-created', (e, wc) => {
  wc.on('will-attach-webview', ev => ev.preventDefault());
  wc.on('will-navigate', (ev, url) => { if (!url.startsWith('file://')) { ev.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
  wc.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
});
app.whenReady().then(() => { try { require('electron').session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(perm === 'notifications')); } catch (e) { } });
function viewer(file, title) {
  const w = new BrowserWindow({ width: 1000, height: 860, title, icon: path.join(__dirname, 'build', 'icon.png'), autoHideMenuBar: true, parent: win || undefined,
    webPreferences: { plugins: true, contextIsolation: true, nodeIntegration: false, sandbox: true } });
  w.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  w.loadFile(file);
}
const safeName = s => String(s || 'ek').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);
ipcMain.handle('attachment', async (e, { id, name, index }) => {
  const dir = path.join(app.getPath('userData'), 'ekler'); fs.mkdirSync(dir, { recursive: true });
  let r, fname;
  if (index) { const buf = Buffer.from(await (await fetch(`https://www.kap.org.tr/tr/api/BildirimPdf/${parseInt(index, 10)}`, { signal: AbortSignal.timeout(60000) })).arrayBuffer()); const p = require('./pdr').unwrap(buf); r = { kind: p ? 'pdf' : 'bin', buf: p || buf }; fname = `KAP-${parseInt(index, 10)}.pdf`; }
  else { if (!/^[0-9a-fA-F]{20,64}$/.test(String(id))) throw new Error('geçersiz ek'); r = await sources.kapAttachment(id); fname = safeName(name || id); if (r.kind === 'pdf' && !/\.pdf$/i.test(fname)) fname += '.pdf'; }
  const file = path.join(dir, fname); fs.writeFileSync(file, r.buf);
  if (r.kind === 'pdf') viewer(file, fname); else await shell.openPath(file);
  return { ok: true, file };
});
// Otomatik güncelleme: GitHub Releases (latest.yml) → arka planda indir → kullanıcı onayıyla kur
let updateInfo = null;
function setupUpdater() {
  if (!autoUpdater || !app.isPackaged || SELFTEST) return;
  autoUpdater.autoDownload = true; autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', info => { updateInfo = { version: info.version }; send('update', { state: 'ready', version: info.version }); });
  autoUpdater.on('download-progress', p => send('update', { state: 'downloading', percent: Math.round(p.percent || 0) }));
  autoUpdater.on('error', e => send('update', { state: 'error', message: String(e && e.message || e).slice(0, 200) }));
  const check = () => autoUpdater.checkForUpdates().catch(() => { });
  setTimeout(check, 15000); setInterval(check, 6 * 3600e3);
}
ipcMain.handle('update-status', () => updateInfo);
ipcMain.handle('update-install', () => { if (autoUpdater && updateInfo) { setImmediate(() => autoUpdater.quitAndInstall(true, true)); return true; } return false; });
ipcMain.handle('update-check', async () => { if (!autoUpdater || !app.isPackaged) return { state: 'dev' }; try { const r = await autoUpdater.checkForUpdates(); return { state: 'checked', version: r && r.updateInfo && r.updateInfo.version, current: app.getVersion() }; } catch (e) { return { state: 'error', message: String(e.message || e) }; } });
ipcMain.handle('notify', (e, { title, body }) => { if (Notification.isSupported()) new Notification({ title, body, icon: path.join(__dirname, 'build', 'icon.png') }).show(); });

/* ---------- Pencere ---------- */
function createWindow() {
  win = new BrowserWindow({
    width: 1320, height: 900, minWidth: 900, minHeight: 600, title: 'Yatırım Pusulası',
    icon: path.join(__dirname, 'build', 'icon.png'), autoHideMenuBar: true, show: false,
    backgroundColor: '#f4f2ed',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => { if (HIDDEN) { win.showInactive(); win.minimize(); } else win.show(); });
  win.on('closed', () => { win = null; });
}
Menu.setApplicationMenu(null);

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
app.whenReady().then(async () => {
  load();
  createWindow();
  if (SELFTEST) return selftest();
  setupUpdater();
  setTimeout(() => { if (due()) refresh('açılış'); }, 6000);
  setInterval(() => { if (due()) refresh('akşam'); }, 20 * 60e3);
});
app.on('window-all-closed', () => app.quit());

/* ---------- Otomatik test (derleme sırasında) ---------- */
async function selftest() {
  const out = path.join(process.cwd(), process.env.SELFTEST_OUT || 'selftest'); fs.mkdirSync(out, { recursive: true });
  const logs = [];
  win.webContents.on('console-message', (e, level, message, line, src) => logs.push({ level, message, line, src: String(src || '').split('/').pop() }));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const shot = async name => { try { const img = await win.webContents.capturePage(); fs.writeFileSync(path.join(out, name + '.png'), img.toPNG()); } catch (e) { logs.push({ level: 9, message: 'shot ' + e }); } };
  const result = { started: new Date().toISOString() };
  try {
    await new Promise(r => win.webContents.once('did-finish-load', r));
    await wait(4000); await shot('1-ana');
    // Uydurma test portföyü (gerçek veri değil) + canlı kaynakları deneyen geçici varlıklar (yalnızca test klasöründe)
    try { const demo = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'ornek-test.json'), 'utf8')); data.txns = { ...(data.txns || {}), ...demo.txns }; data.assets = { ...(data.assets || {}), ...demo.assets }; } catch (e) { }
    data.assets = { ...data.assets, THYAO: { sym: 'THYAO', name: 'Test hissesi', type: 'hisse', px: [], fin: [], hold: [] }, ALTIN: { sym: 'ALTIN', name: 'Gram altın', type: 'emtia', px: [], fin: [], hold: [] }, BTC: { sym: 'BTC', name: 'Bitcoin', type: 'coin', px: [], fin: [], hold: [] }, AKBNK: { sym: 'AKBNK', name: 'Test bankası', type: 'hisse', px: [], fin: [], hold: [] }, NVDA: { sym: 'NVDA', name: '', type: 'hisse', mkt: 'US', px: [], fin: [], hold: [] }, 'ASML.AS': { sym: 'ASML.AS', name: '', type: 'hisse', mkt: 'US', px: [], fin: [], hold: [] }, CEYREK: { sym: 'CEYREK', name: '', type: 'emtia', px: [], fin: [], hold: [] }, CUMHURIYET: { sym: 'CUMHURIYET', name: '', type: 'emtia', px: [], fin: [], hold: [], prem: 2 } };
    data.settings = data.settings || {}; data.settings.main = { ...(data.settings.main || {}), kapSince: new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10) };
    send('data', data);
    const t0 = Date.now(); result.refresh = await refresh('test'); result.refreshMs = Date.now() - t0;
    result.news = Object.entries(data.news || {}).filter(([k]) => k.startsWith('k')).slice(0, 10);
    try { result.kapLink = (await fetch('https://www.kap.org.tr/tr/Bildirim/1702071', { signal: AbortSignal.timeout(20000) })).status; } catch (e) { result.kapLink = String(e); }
    await wait(3000); await shot('2-ana-guncel');
    await win.webContents.executeJavaScript("location.hash='fonlar'"); await wait(2500); await shot('3-fonlar');
    await win.webContents.executeJavaScript("location.hash='veri'"); await wait(1500); await shot('4-veri');
    await win.webContents.executeJavaScript("location.hash='emtia'"); await wait(2000); await shot('7-emtia');
    await win.webContents.executeJavaScript("location.hash='ana'"); await wait(1500); await win.webContents.executeJavaScript("document.querySelector('#clsMini').scrollIntoView()"); await wait(800); await shot('8-ana-mini');
    await win.webContents.executeJavaScript("location.hash='hisseler'"); await wait(2000); await shot('5-hisseler');
    await win.webContents.executeJavaScript("location.hash='mali'"); await wait(2000); await shot('6-mali');
    await win.webContents.executeJavaScript("location.hash='dolayli'"); await wait(2500); await shot('9-dolayli');
    await win.webContents.executeJavaScript("location.hash='plan'"); await wait(2500); await shot('15-plan');
    result.plan = await win.webContents.executeJavaScript("(()=>({bm:[...document.querySelectorAll('#bmTable tbody tr')].map(r=>r.innerText.replace(/\\s+/g,' ')),risk:document.querySelector('#riskWarn')?.innerText.slice(0,400),sc:[...document.querySelectorAll('#scTable tbody tr')].map(r=>r.innerText.replace(/\\s+/g,' '))}))()");
    await win.webContents.executeJavaScript("location.hash='radar'"); await wait(2000); await shot('12-radar');
    await win.webContents.executeJavaScript("location.hash='incele'"); await wait(2000); await shot('13-incele');
    await win.webContents.executeJavaScript("document.querySelector('[data-gom=NVDA]')?.click()"); await wait(2000); await shot('14-nvda-mali');
    result.radar = data.radar && data.radar.main ? { n: Object.keys(data.radar.main.rows || {}).length, top: (data.radar.main.top100 || []).length, tech: Object.keys(data.radar.main.tech || {}).length, ornek: data.radar.main.rows.THYAO } : null;
    // Analist beklentileri / karne / takvim
    await win.webContents.executeJavaScript("location.hash='analiz'; setTimeout(()=>{const s=document.querySelector('#aSel'); s.value='THYAO'; s.dispatchEvent(new Event('change'));},300)"); await wait(2500);
    await win.webContents.executeJavaScript("[...document.querySelectorAll('#aBody h3')].find(h=>h.textContent.startsWith('Analist'))?.scrollIntoView()"); await wait(800); await shot('16-analist-thyao');
    await win.webContents.executeJavaScript("{const s=document.querySelector('#aSel'); s.value='NVDA'; s.dispatchEvent(new Event('change'));}"); await wait(1500);
    await win.webContents.executeJavaScript("[...document.querySelectorAll('#aBody h3')].find(h=>h.textContent.startsWith('Analist'))?.scrollIntoView()"); await wait(800); await shot('17-analist-nvda');
    await win.webContents.executeJavaScript("location.hash='mali'; setTimeout(()=>{const s=document.querySelector('#mSel'); s.value='THYAO'; s.dispatchEvent(new Event('change'));},300)"); await wait(2500);
    await win.webContents.executeJavaScript("[...document.querySelectorAll('#mBody h3')].find(h=>h.textContent.startsWith('Nakit'))?.scrollIntoView()"); await wait(800); await shot('18-mali-nakit');
    result.ins = Object.fromEntries(Object.entries(data.assets || {}).filter(([, a]) => a.ins).map(([k, a]) => [k, { y: a.ins.y && { n: a.ins.y.n, mean: a.ins.y.mean, rec: a.ins.y.rec, earn: a.ins.y.earn }, i: a.ins.i && { oneri: a.ins.i.oneri, hedef: a.ins.i.hedef, tahmin: !!a.ins.i.tahmin }, finVer: a.finVer, cfo: (a.fin || []).slice(-1)[0]?.cfo }]));
    result.cal = data.cal && data.cal.main ? { n: data.cal.main.items.length, ornek: data.cal.main.items.slice(0, 3) } : null;
    result.karne = await win.webContents.executeJavaScript("document.querySelector('#mBody')?.innerText.split('Karne')[1]?.slice(0,900)||null");
    await win.webContents.executeJavaScript("location.hash='dolayli'"); await wait(1500);
    // Bildirim detayı paneli: ilk KAP bildirimine tıkla
    result.detailClick = await win.webContents.executeJavaScript("(()=>{const a=[...document.querySelectorAll('[data-det]')].find(x=>x.offsetParent); if(!a) return 'görünür bağlantı yok'; a.click(); return a.dataset.det;})()");
    await wait(5000); await shot('10-detay');
    try { const idx = (Object.values(data.news || {}).find(n => n.kat === 'kap' && n.tip !== 'pdr') || {}).u?.match(/(\d+)$/)?.[1]; if (idx) { const d = await sources.kapDetail(+idx); result.detail = { idx, summary: d.summary, blocks: d.blocks.length, fields: d.fields.length, files: d.files, first: (d.blocks[0] || '').slice(0, 300) }; } } catch (e) { result.detail = String(e); }
    await win.webContents.executeJavaScript("document.querySelector('#det [data-close]')?.click(); document.querySelector('#thm [data-t=dark]')?.click(); location.hash='ana'"); await wait(2000); await shot('11-koyu');
    result.assets = Object.fromEntries(Object.entries(data.assets || {}).map(([k, a]) => [k, { type: a.type, name: a.name, px: (a.px || []).length, last: a.last, lastDate: a.lastDate, shares: a.shares, fin: (a.fin || []).map(f => `${f.y}/${f.m} rev=${f.rev} ni=${f.ni} ta=${f.ta} eq=${f.eq} tl=${f.tl}`), hold: (a.hold || []).map(h => ({ date: h.date, src: h.src, n: h.items.length, sum: h.sum, top: h.items.slice().sort((x, y) => y.w - x.w).slice(0, 5).map(i => `${i.code || ''} ${i.name} ${i.w}`) })) }]));
    result.status = await win.webContents.executeJavaScript("document.querySelector('#st').textContent");
  } catch (e) { result.error = String(e && e.stack || e); }
  result.logs = logs;
  fs.writeFileSync(path.join(out, 'sonuc.json'), JSON.stringify(result, null, 1));
  app.quit();
}
