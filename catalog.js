(function () {
  'use strict';
  const DB = window.CifraDB;
  let manifestPromise, importBusy = false;
  function hash(text) { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0; }
  async function manifest() {
    if (!manifestPromise) manifestPromise = fetch('catalog/manifest.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('Catálogo indisponível.'); return r.json(); }).catch(e => { manifestPromise = null; throw e; });
    return manifestPromise;
  }
  function runImport(payload, onProgress) {
    if (importBusy) return Promise.reject(new Error('Aguarde a importação atual terminar.'));
    importBusy = true;
    return new Promise((yes, no) => {
      const worker = new Worker('import-worker.js?v=6');
      let settled = false;
      const finish = (error, value) => { if (settled) return; settled = true; worker.terminate(); importBusy = false; if (error) no(error); else yes(value); };
      const cancel = () => finish(new Error('Importação interrompida. Os lotes já salvos foram mantidos.'));
      const button = document.querySelector('#import-cancel'); button.onclick = cancel;
      worker.onmessage = ({ data }) => {
        if (data.type === 'progress') onProgress?.(data);
        if (data.type === 'queue') window.dispatchEvent(new CustomEvent('cifra-import-queue', { detail: data.queue }));
        if (data.type === 'done') finish(null, data);
        if (data.type === 'error') finish(new Error(data.message + (data.written ? ` ${data.written} registros já foram salvos.` : '')));
      };
      worker.onerror = () => finish(new Error('Não consegui executar o importador. Reabra o app atualizado.'));
      worker.postMessage(payload);
    });
  }
  function progress(data) {
    const p = document.querySelector('#import-progress'); p.hidden = false;
    document.querySelector('#import-status').textContent = `${data.written.toLocaleString('pt-BR')} registros salvos${data.total ? ' de ' + data.total.toLocaleString('pt-BR') : ''}`;
    const meter = document.querySelector('#import-meter');
    if (data.total) { meter.max = data.total; meter.value = data.received; } else meter.removeAttribute('value');
  }
  async function importFiles(files) {
    progress({ written:0, received:0, total:0 });
    try { return await runImport({ files }, progress); }
    finally { document.querySelector('#import-progress').hidden = true; }
  }
  async function seed() {
    const m = await manifest();
    if (await DB.meta('seed:' + m.version)) return;
    const r = await fetch('catalog/seed.json'); if (!r.ok) throw new Error('Biblioteca inicial indisponível.');
    const payload = await r.json(); await DB.bulkPut(payload.songs);
    await DB.meta('seed:' + m.version, true);
  }
  // O catálogo completo é importado uma vez pelo usuário e fica apenas no aparelho.
  async function ensure() { return false; }
  window.CifraCatalog = { manifest, seed, ensure, importFiles, busy: () => importBusy };
})();
