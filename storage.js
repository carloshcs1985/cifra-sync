/* IndexedDB: cifras grandes ficam no banco; a interface carrega apenas as necessárias. */
(function (root) {
  'use strict';
  const NAME = 'cifrasync-library';
  let opened;
  const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function request(req) { return new Promise((yes, no) => { req.onsuccess = () => yes(req.result); req.onerror = () => no(req.error); }); }
  function done(tx) { return new Promise((yes, no) => { tx.oncomplete = yes; tx.onabort = tx.onerror = () => no(tx.error || new Error('Falha no armazenamento')); }); }
  function open() {
    if (opened) return opened;
    opened = new Promise((yes, no) => {
      const req = indexedDB.open(NAME, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if(!db.objectStoreNames.contains('tabs')){const tabs=db.createObjectStore('tabs',{keyPath:'id'});tabs.createIndex('instrument','instrument');}
        if(db.objectStoreNames.contains('songs'))return;
        const songs = db.createObjectStore('songs', { keyPath: 'id' });
        songs.createIndex('trackIds', 'trackIds', { multiEntry: true });
        songs.createIndex('key', 'key'); songs.createIndex('sortKey', 'sortKey');
        songs.createIndex('words', 'words', { multiEntry: true }); songs.createIndex('kind', 'kind');
        db.createObjectStore('lyrics', { keyPath: 'id' });
        db.createObjectStore('meta');
      };
      req.onsuccess = () => { req.result.onversionchange = () => { req.result.close(); opened = null; }; yes(req.result); };
      req.onerror = () => { opened = null; no(req.error); };
      req.onblocked = () => no(new Error('Feche outras abas do Cifra Sync e tente novamente.'));
    });
    return opened;
  }
  function normalize(s) {
    if (!s || typeof s.sheet !== 'string' || !s.sheet.trim()) return null;
    const title = String(s.title || 'Sem título').slice(0, 200), artist = String(s.artist || '').slice(0, 200);
    const named = !!artist && !/^Faixa Spotify /.test(title);
    const search = fold(artist + ' ' + title).replace(/[^a-z0-9]+/g, ' ').trim();
    return { ...s, id: String(s.id || ('s_' + Date.now() + Math.random().toString(36).slice(2))).replace(/[^\w:-]/g, '').slice(0, 64),
      title, artist, sheet: s.sheet.slice(0, 200000),
      trackIds: [...new Set(Array.isArray(s.trackIds) ? s.trackIds.filter(x => typeof x === 'string').map(x => x.slice(0, 120)) : [])].slice(0, 20),
      anchors: (Array.isArray(s.anchors) ? s.anchors : []).filter(a => a && Number.isInteger(a.line) && a.line >= 0 && Number.isFinite(a.t) && a.t >= 0).map(a => ({ line: a.line, t: Math.round(a.t) })).slice(0, 500),
      transpose: ((((Number(s.transpose) || 0) + 5) % 12 + 12) % 12) - 5,
      chordTiming: root.CifraPlayCore?.normalizeTiming(s.chordTiming) || null,
      chordTimingHistory: (Array.isArray(s.chordTimingHistory)?s.chordTimingHistory:[]).slice(0,20).map(x=>root.CifraPlayCore?.normalizeTiming(x)).filter(Boolean),
      key: named ? String(s.key || '') : '', sortKey: named ? fold(artist) + '|' + fold(title) : '\uffff' + s.id,
      words: named ? [...new Set(search.split(/\s+/).filter(Boolean))] : [],
      kind: s.kind === 'catalog' ? 'catalog' : 'personal',
      hasLyrics: s.kind !== 'catalog' && !!root.CifraCore && s.sheet.split('\n').some(l => root.CifraCore.classifyLine(l) === 'lyric'),
      createdAt: +s.createdAt || Date.now(), updatedAt: +s.updatedAt || Date.now() };
  }
  async function bulkPut(rows) {
    const valid = rows.map(normalize).filter(Boolean), db = await open();
    const tx = db.transaction('songs', 'readwrite'), finished = done(tx), os = tx.objectStore('songs');
    let written = 0;
    for (const s of valid) {
      const r = os.get(s.id);
      r.onsuccess = () => {
        const old = r.result;
        if (old && ((s.kind === 'catalog' && old.kind === 'personal') || (old.kind === s.kind && old.updatedAt > s.updatedAt))) return;
        os.put(s); written++;
      };
    }
    await finished; return written;
  }
  async function get(id) { const db = await open(); return request(db.transaction('songs').objectStore('songs').get(id)); }
  async function remove(id) { const db = await open(), tx = db.transaction('songs', 'readwrite'); tx.objectStore('songs').delete(id); await done(tx); }
  // Delete only untouched catalogue rows; never clear the database or personal stores.
  async function removeCatalog(onProgress) {
    const db=await open(),tx=db.transaction(['songs','meta'],'readwrite'),finished=done(tx),os=tx.objectStore('songs');
    let removed=0,preserved=0;
    tx.objectStore('meta').put(true,'catalog:removed');
    const r=os.index('kind').openCursor(IDBKeyRange.only('catalog'));
    r.onsuccess=()=>{const c=r.result;if(!c)return;const s=c.value;
      const protectedRow=s.anchors?.length || s.transpose || s.chordTiming?.cues?.length || s.chordTimingHistory?.some(t=>t.cues?.length) || s.hasLyrics;
      if(protectedRow){c.update({...s,kind:'personal'});preserved++;}else{c.delete();removed++;}
      if((removed+preserved)%1000===0)onProgress?.({removed,preserved});
      c.continue();
    };
    await finished;return {removed,preserved};
  }
  async function count() { const db = await open(); return request(db.transaction('songs').objectStore('songs').count()); }
  async function find(trackId, key) {
    const db = await open(), os = db.transaction('songs').objectStore('songs');
    const byTrack = trackId ? await request(os.index('trackIds').getAll(trackId, 20)) : [];
    // A new transaction is necessary after awaiting an empty IndexedDB result.
    const rows = byTrack.length ? byTrack : key ? await request(db.transaction('songs').objectStore('songs').index('key').getAll(key, 20)) : [];
    return rows.sort((a, b) => (a.kind === 'catalog') - (b.kind === 'catalog') || (+!!b.hasLyrics)-(+!!a.hasLyrics) || b.updatedAt - a.updatedAt)[0] || null;
  }
  async function hasMany(items) {
    const db = await open(), os = db.transaction('songs').objectStore('songs');
    return Promise.all(items.map(q => {
      if (q.needLyrics) {
        const a=q.trackId?request(os.index('trackIds').getAll(q.trackId,20)):Promise.resolve([]);
        const b=q.key?request(os.index('key').getAll(q.key,20)):Promise.resolve([]);
        return Promise.all([a,b]).then(v=>v.flat().some(s=>s.hasLyrics));
      }
      const a = q.trackId ? request(os.index('trackIds').count(q.trackId)) : Promise.resolve(0);
      const b = q.key ? request(os.index('key').count(q.key)) : Promise.resolve(0);
      return Promise.all([a, b]).then(v => !!(v[0] || v[1]));
    }));
  }
  async function search(query, limit = 100) {
    const db = await open(), os = db.transaction('songs').objectStore('songs');
    const terms = fold(query).replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    const index = os.index(terms.length ? 'words' : 'sortKey');
    const range = terms.length ? IDBKeyRange.bound(terms[0], terms[0] + '\uffff') : IDBKeyRange.upperBound('\ufffe');
    return new Promise((yes, no) => {
      const results = [], seen = new Set(), r = index.openCursor(range);
      r.onerror = () => no(r.error);
      r.onsuccess = () => {
        const c = r.result;
        if (!c || results.length === limit) { yes(results); return; }
        const s = c.value;
        if (!seen.has(s.id) && terms.every(t => s.words.some(w => w.startsWith(t)))) { results.push(s); seen.add(s.id); }
        c.continue();
      };
    });
  }
  async function personal() {
    const db = await open(); return request(db.transaction('songs').objectStore('songs').index('kind').getAll('personal'));
  }
  async function meta(key, value) {
    const db = await open();
    if (arguments.length === 1) return request(db.transaction('meta').objectStore('meta').get(key));
    const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put(value, key); await done(tx);
  }
  async function lyrics(id, value) {
    const db = await open();
    if (arguments.length === 1) return request(db.transaction('lyrics').objectStore('lyrics').get(id));
    const tx = db.transaction('lyrics', 'readwrite'); tx.objectStore('lyrics').put({ ...value, id }); await done(tx);
  }
  async function tabsPut(values) {const rows=values.map(v=>root.CifraTabsCore.normalize(v)).filter(Boolean),db=await open(),tx=db.transaction('tabs','readwrite'),finished=done(tx),os=tx.objectStore('tabs');for(const row of rows)os.put(row);await finished;return rows.length;}
  // Automatic extraction merges inside one transaction so a concurrent backup restore
  // cannot lose section marks to an earlier, stale snapshot of the cache.
  async function tabsCapture(value) {
    const row=root.CifraTabsCore.normalize(value);if(!row)return;
    const db=await open(),tx=db.transaction('tabs','readwrite'),finished=done(tx),os=tx.objectStore('tabs'),r=os.get(row.id);
    r.onsuccess=()=>{const old=r.result;if(old&&old.body===row.body){os.put({...row,timings:old.timings,timingTrackId:old.timingTrackId,timingSignature:old.timingSignature,timingDuration:old.timingDuration,trackIds:[...new Set([...old.trackIds,...row.trackIds])]});}else os.put(row);};
    await finished;
  }
  async function tabsList(instrument) {const db=await open(),os=db.transaction('tabs').objectStore('tabs');return request(instrument?os.index('instrument').getAll(instrument):os.getAll());}
  async function tabsRemove(id) {const db=await open(),tx=db.transaction('tabs','readwrite');tx.objectStore('tabs').delete(id);await done(tx);}
  root.CifraDB = { tabsPut,tabsList,tabsRemove,tabsCapture, open, normalize, bulkPut, get, remove, removeCatalog, count, find, hasMany, search, personal, meta, lyrics };
})(typeof self !== 'undefined' ? self : globalThis);
