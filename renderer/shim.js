/* Masaüstü depolama katmanı: uygulamanın kullandığı belge veritabanı arayüzünü
   bilgisayardaki JSON dosyasıyla karşılar. Veri yapısı: data[koleksiyon][id] = belge */
(function () {
  if (!window.pusula) return;
  let data = {};
  const listeners = [];
  const ready = window.pusula.load().then(d => { data = d || {}; });
  const split = p => { const i = p.lastIndexOf('/'); return [p.slice(0, i), p.slice(i + 1)]; };
  const meta = { fromCache: false, hasPendingWrites: false };
  const clone = v => JSON.parse(JSON.stringify(v));
  function snapCol(path, o) {
    let items = Object.entries(data[path] || {}).map(([id, v]) => ({ id, v }));
    if (o.orderBy) { const [f, dir] = o.orderBy; items.sort((a, b) => (a.v[f] > b.v[f] ? 1 : a.v[f] < b.v[f] ? -1 : 0) * (dir === 'desc' ? -1 : 1)); }
    else items.sort((a, b) => a.id.localeCompare(b.id));
    if (o.limit) items = items.slice(0, o.limit);
    const docs = items.map(({ id, v }) => ({ id, exists: true, data: () => v, metadata: meta }));
    return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: meta };
  }
  function snapDoc(path) { const [c, id] = split(path); const v = (data[c] || {})[id]; return { id, exists: v !== undefined, data: () => v, metadata: meta }; }
  let t = null;
  function persist() { clearTimeout(t); t = setTimeout(() => { t = null; window.pusula.save(data); }, 250); }
  // Veri çekmeden önce bekleyen kaydı hemen diske yaz (yeni eklenen sembol ana sürece ulaşsın)
  window.pusulaFlush = async () => { if (t) { clearTimeout(t); t = null; await window.pusula.save(data); } };
  function notify() { for (const l of listeners.slice()) { try { l.next(l.kind === 'col' ? snapCol(l.path, l.o) : snapDoc(l.path)); } catch (e) { console.error(e); } } }
  function sub(l) { listeners.push(l); ready.then(() => l.next(l.kind === 'col' ? snapCol(l.path, l.o) : snapDoc(l.path))); return () => { const i = listeners.indexOf(l); if (i > -1) listeners.splice(i, 1); }; }
  function docRef(path) {
    const [c, id] = split(path);
    return {
      id, path,
      get: async () => { await ready; return snapDoc(path); },
      set: async v => { await ready; (data[c] = data[c] || {})[id] = clone(v); persist(); notify(); },
      update: async v => { await ready; const cur = (data[c] || {})[id]; if (!cur) throw { code: 'invalid_argument', message: 'belge yok' }; data[c][id] = { ...cur, ...clone(v) }; persist(); notify(); },
      delete: async () => { await ready; if (data[c]) delete data[c][id]; persist(); notify(); },
      onSnapshot: next => sub({ kind: 'doc', path, next }),
      collection: p => query(path + '/' + p, {})
    };
  }
  function query(path, o) {
    return {
      path,
      where() { return this; },
      orderBy: (f, dir) => query(path, { ...o, orderBy: [f, dir || 'asc'] }),
      limit: n => query(path, { ...o, limit: n }),
      get: async () => { await ready; return snapCol(path, o); },
      onSnapshot: next => sub({ kind: 'col', path, o, next }),
      doc: id => docRef(path + '/' + (id || ('d' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)))),
      add: async v => { const r = docRef(path + '/d' + Date.now().toString(36)); await r.set(v); return r; }
    };
  }
  const db = { collection: p => query(p, {}), doc: p => docRef(p) };
  window.pusula.onData(d => { clearTimeout(t); data = d || {}; notify(); });
  window.claude = { use: async n => (n === 'db' ? db : null) };
})();
