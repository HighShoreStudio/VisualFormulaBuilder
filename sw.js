/* Formula Builder — service worker
   Always asks the server for the latest files (so updates show up right away)
   and falls back to the saved copy only when the device is offline. */
const VERSION = '1.3';
const CACHE = 'formula-builder-' + VERSION;
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './css/styles.css?v=' + VERSION,
  './js/i18n.js?v=' + VERSION, './js/functions.js?v=' + VERSION,
  './js/engine.js?v=' + VERSION, './js/app.js?v=' + VERSION,
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    // 'no-cache' = check with the server every time (cheap: unchanged files answer "not modified")
    fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
