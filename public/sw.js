/*
 * mon-farm service worker (E01-S23): the app opens with no network once it has been opened online.
 * The data already lives on the device; this keeps the app's own files there too.
 *
 * - Pages and other files: the network first, so a phone online always gets the newest build (PW-3);
 *   the last copy from the cache when the network is gone (PW-2).
 * - /_expo/static/: file names carry a content hash and never change, so the cache first.
 * - Only same-origin GETs, never Firebase's reserved /__/ paths; everything else goes to the network.
 * - The home is /v2/ with the slash: Firebase Hosting redirects /v2 there, and a redirected response
 *   cannot answer a navigation, so none is ever kept (review of PR 195 B1).
 *
 * To retire it, deploy a sw.js that only unregisters itself and deletes its caches (docs/architecture.md).
 */
const CACHE = 'mon-farm-v1';
const HOME = '/v2/';
const SHELL = ['/', HOME];
const STATIC = '/_expo/static/';

self.addEventListener('install', (event) => {
  event.waitUntil(Promise.all(SHELL.map((path) => fetchAndKeep(path, true))).then(() => self.skipWaiting()));
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
// the list of what it loaded and the worker keeps the same-origin ones (PW-2). Bundles of older builds
// that the page no longer uses are dropped, so the cache does not grow with every deploy (N1).
self.addEventListener('message', (event) => {
  const urls = event.data && Array.isArray(event.data.keep) ? event.data.keep : [];
  const mine = urls.map(sameOrigin).filter((u) => u !== null);
  const keep = new Set(mine.map((u) => u.href));
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all([
        ...mine.map((u) => c.match(u.href).then((hit) => hit || fetchAndKeep(u.href).catch(() => undefined))),
        c.keys().then((reqs) => Promise.all(reqs.filter((r) => new URL(r.url).pathname.startsWith(STATIC) && !keep.has(r.url)).map((r) => c.delete(r)))),
      ]),
    ),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = sameOrigin(req.url);
  if (url === null || url.pathname.startsWith('/__/')) return;

  if (url.pathname.startsWith(STATIC)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetchAndKeep(req)));
    return;
  }
  event.respondWith(
    fetchAndKeep(req).catch(() =>
      caches
        .match(req)
        .then((hit) => hit || (req.mode === 'navigate' ? caches.match(HOME).then((home) => home || caches.match('/')) : undefined))
        .then((r) => r || Response.error()),
    ),
  );
});

/** A URL of this site, or null for another site or something that is not a URL (N4). */
function sameOrigin(u) {
  try {
    const url = new URL(u, self.location.href);
    return url.origin === self.location.origin ? url : null;
  } catch {
    return null;
  }
}

/** Fetch, keep a same-origin OK copy, and answer with a response that is never marked redirected; `wait` holds the answer until the copy is stored (install). */
function fetchAndKeep(req, wait) {
  return fetch(req).then((res) => {
    if (!res.ok || res.type !== 'basic') return res;
    const clean = res.redirected ? new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers }) : res;
    const copy = clean.clone();
    const stored = caches.open(CACHE).then((c) => c.put(req, copy));
    return wait ? stored.then(() => clean) : clean;
  });
}
