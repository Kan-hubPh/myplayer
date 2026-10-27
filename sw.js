// Caches the app shell so the page opens with no network after the first visit.
// Pages and the worker script go network-first, so a new build shows up on the next launch; the cache is the offline fallback.
const CACHE = 'spike-v10';
const SHELL = ['./', 'index.html', 'worker.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'testpack-meta.json'];
const FRESH_MS = 4000;

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's 10-minute HTTP cache, so the copy stored is really the newest one.
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.all(SHELL.map((u) => fetch(new Request(u, { cache: 'reload' })).then((r) => { if (!r.ok) throw new Error(u + ' ' + r.status); return c.put(u, r); }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

function networkFirst(req) {
  return new Promise((resolve) => {
    let done = false;
    const fromCache = () => caches.match(req, { ignoreSearch: true });
    const timer = setTimeout(() => fromCache().then((hit) => { if (hit && !done) { done = true; resolve(hit); } }), FRESH_MS);
    fetch(new Request(req, { cache: 'reload' })).then((res) => {
      clearTimeout(timer);
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      if (!done) { done = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      fromCache().then((hit) => { if (!done) { done = true; resolve(hit || Response.error()); } });
    });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const path = new URL(req.url).pathname;
  const isPage = req.mode === 'navigate' || path.endsWith('/') || path.endsWith('index.html') || path.endsWith('worker.js') || path.endsWith('testpack-meta.json');
  if (isPage) { e.respondWith(networkFirst(req)); return; }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
