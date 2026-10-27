/* Leitura incremental em worker: JSONL/gzip e ZIP não bloqueiam a tela. */
importScripts('core.js?v=14', 'playalong-core.js?v=14', 'tabs-core.js?v=14', 'storage.js?v=14', 'vendor/fflate.min.js');
const C = self.CifraCore, DB = self.CifraDB;
let importInstrument='guitarra';
let batch = [], received = 0, written = 0, total = 0, ignored = 0;
async function flush() {
  if (!batch.length) return;
  const rows = batch; batch = [];
  written += await DB.bulkPut(rows);
  postMessage({ type: 'progress', received, written, total, ignored });
}
async function add(raw) {
  if (!raw || typeof raw.sheet !== 'string' || !raw.sheet.trim()) { ignored++; return; }
  if (!raw.key && raw.artist) raw.key = C.normKey(raw.artist, raw.title);
  batch.push(raw); received++;
  if (batch.length >= 500) await flush();
}
async function line(text) {
  if (!text.trim()) return;
  const row = JSON.parse(text);
  if (row.app === 'cifra-sync-catalog' && !row.sheet) { total = +row.total || 0; return; }
  await add(row);
}
async function lines(stream) {
  const reader = stream.getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
  let rest = '';
  while (true) {
    const { value, done } = await reader.read();
    rest += decoder.decode(value, { stream: !done });
    let end;
    while ((end = rest.indexOf('\n')) >= 0) { const s = rest.slice(0, end); rest = rest.slice(end + 1); await line(s); }
    if (rest.length > 2 * 1024 * 1024) throw new Error('Linha muito grande no catálogo.');
    if (done) break;
  }
  if (rest.trim()) await line(rest);
}
async function textFile(name, text, strict = true) {
  if (/\.json$/i.test(name)) {
    const data = JSON.parse(text);
    if(data.tabs){const tabs=Object.values(data.tabs).map(t=>({...t,origin:'personal'}));written+=await DB.tabsPut(tabs);received+=tabs.length;}
    const rows = data.songs ? Object.values(data.songs) : Array.isArray(data) ? data : data.sheet ? [data] : null;
    if(!rows&&data.tabs)return;
    if (!rows) { ignored++; if (strict) throw new Error('JSON sem músicas no formato do Cifra Sync.'); return; }
    total += rows.length;
    for (const s of rows) await add(s);
    if (Array.isArray(data.queue)) postMessage({ type: 'queue', queue: data.queue.slice(0, 5000) });
  } else if (/\.(tab|txt|cho|chopro|chordpro|crd|pro)$/i.test(name)) {
    for (const s of C.parseImportFile(name, text)) {
      const tab=self.CifraTabsCore.normalize({...s,body:s.sheet,instrument:importInstrument});
      if(tab){written+=await DB.tabsPut([tab]);received++;}
      if (!s.hasChords) { ignored++; continue; }
      s.id = 'file:' + hash(C.normKey(s.artist, s.title) + '|' + s.sheet);
      s.kind = 'personal'; await add(s);
    }
  } else ignored++;
}
function hash(text) { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return (h >>> 0).toString(16); }
async function zip(file) {
  let jobs = Promise.resolve(), recognized = 0, archiveError = null;
  const unzip = new fflate.Unzip(entry => {
    if (entry.name.endsWith('/')) return;
    if (!/\.(json|tab|txt|cho|chopro|chordpro|crd|pro)$/i.test(entry.name)) { ignored++; return; }
    recognized++;
    const chunks = []; let size = 0;
    entry.ondata = (error, bytes, final) => {
      if (error) { archiveError = error; return; }
      size += bytes.length;
      if (size > 20 * 1024 * 1024) { archiveError = new Error('Um arquivo dentro do ZIP excede 20 MB. Use JSONL.gz para bases grandes.'); return; }
      chunks.push(bytes.slice());
      if (final) {
        const all = new Uint8Array(size); let at = 0; for (const b of chunks) { all.set(b, at); at += b.length; }
        let text;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(all); } catch { text = new TextDecoder('windows-1252').decode(all); }
        jobs = jobs.then(() => textFile(entry.name.split('/').pop(), text, false));
      }
    };
    entry.start();
  });
  unzip.register(fflate.UnzipInflate);
  const reader = file.stream().getReader();
  while (true) {
    const r = await reader.read(); unzip.push(r.value || new Uint8Array(0), r.done);
    await jobs; if (archiveError) throw archiveError;
    if (r.done) break;
  }
  if (!recognized) throw new Error('O ZIP não contém cifras TXT/ChordPro/JSON. Banco SQLite precisa ser convertido para JSONL.gz.');
}
self.onmessage = async ({ data }) => {
  try {
    importInstrument=data.instrument||'guitarra';
    await DB.open();
    const files = data.files || [];
    if (data.url) {
      const response = await fetch(data.url, { cache: 'no-cache' });
      if (!response.ok || !response.body) throw new Error('Não consegui baixar o lote do catálogo.');
      if (typeof DecompressionStream === 'undefined') throw new Error('Atualize o navegador para importar gzip.');
      await lines(response.body.pipeThrough(new DecompressionStream('gzip')));
    }
    for (const file of files) {
      if (/\.zip$/i.test(file.name)) await zip(file);
      else if (/\.jsonl(?:\.gz)?$/i.test(file.name)) {
        let stream = file.stream();
        if (/\.gz$/i.test(file.name)) {
          if (typeof DecompressionStream === 'undefined') throw new Error('Atualize o navegador para importar gzip.');
          stream = stream.pipeThrough(new DecompressionStream('gzip'));
        }
        await lines(stream);
      } else {
        if (file.size > 20 * 1024 * 1024) throw new Error('Para arquivos maiores que 20 MB, use JSONL.gz.');
        const bytes = await file.arrayBuffer(); let text;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { text = new TextDecoder('windows-1252').decode(bytes); }
        await textFile(file.name, text);
      }
    }
    await flush();
    postMessage({ type: 'done', received, written, ignored, total });
  } catch (error) {
    postMessage({ type: 'error', message: error.message || 'Falha na importação.', received, written });
  }
};
