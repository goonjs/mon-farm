/*
 * mon-farm service worker (E01-S23): the app opens with no network once it has been opened online.
 * The data already lives on the device; this keeps the app's own files there too.
 *
 * - Pages and other files: the network first, so a phone online always gets the newest build (PW-3);
 *   the last copy from the cache when the network is gone (PW-2).
 * - /_expo/static/: file names carry a content hash and never change, so the cache first.
 * Only same-origin GETs; everything else goes straight to the network.
 */
const CACHE = 'mon-farm-v1';
const SHELL = ['/', '/v2'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The first visit loads the bundle and fonts before this worker controls the page, so the page sends
// the list of what it already loaded and the worker keeps the same-origin ones (PW-2).
self.addEventListener('message', (event) => {
  const urls = event.data && Array.isArray(event.data.keep) ? event.data.keep : [];
  const mine = urls.filter((u) => typeof u === 'string' && new URL(u).origin === self.location.origin);
  event.waitUntil(caches.open(CACHE).then((c) => Promise.all(mine.map((u) => c.match(u).then((hit) => hit || c.add(u).catch(() => undefined))))));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_expo/static/')) {
    event.respondWith(caches.match(req).then((hit) => hit || fetchAndKeep(req)));
    return;
  }
  event.respondWith(
    fetchAndKeep(req).catch(() =>
      caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('/v2').then((v2) => v2 || caches.match('/')) : undefined)).then((r) => r || Response.error()),
    ),
  );
});

function fetchAndKeep(req) {
  return fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  });
}
