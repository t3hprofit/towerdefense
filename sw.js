// Offline-first service worker: precache the whole game, serve from cache, refresh in background.
const CACHE = 'ncb-v3';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './src/main.js', './src/config/tokens.js', './src/core/rng.js', './src/core/save.js', './src/core/session.js', './src/core/audio.js',
  './src/data/towers.js', './src/data/enemies.js', './src/data/quickhacks.js', './src/data/daemons.js', './src/data/districts.js',
  './src/game/path.js', './src/game/waves.js', './src/game/breach.js', './src/game/game.js',
  './src/render/renderer.js', './src/ui/ui.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Cache-first from the versioned precache. Runtime responses are never written back, so the
// cache can only ever hold one complete version; bump CACHE to ship a new one.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(cached => cached || fetch(e.request, { cache: 'no-cache' })));
});
