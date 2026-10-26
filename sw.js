/* Cifra Sync — funciona offline (a interface; o Spotify precisa de internet). */
const VERSION = '7';
const CACHE = 'cifrasync-v' + VERSION;
const ASSETS = ['./', './index.html', './styles.css?v=' + VERSION, './core.js?v=' + VERSION, './app.js?v=' + VERSION,
  './storage.js?v=' + VERSION, './study-core.js?v=' + VERSION, './playalong-core.js?v=' + VERSION, './together.js?v=' + VERSION, './study.js?v=' + VERSION,
  './catalog.js?v=' + VERSION, './import-worker.js?v=' + VERSION, './vendor/fflate.min.js',
  './assets/chord-shapes.json', './catalog/manifest.json', './catalog/seed.json',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.all(ASSETS.map((a) => c.add(new Request(a, { cache: 'reload' })).catch(() => {}))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Sempre confere com o servidor quando há internet (no-cache = revalida, nunca usa cópia velha).
// Sem internet, usa a cópia guardada. Só arquivos do próprio app.
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((r) => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match(e.request, { ignoreSearch: true })).then((r) => r || caches.match('./')))
  );
});
