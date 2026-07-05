/* Root service worker: caches the Someday shell served at the root.
   Network-first AND revalidating (cache: 'no-cache'), so a new deploy is picked
   up on the next load instead of being masked by the browser's HTTP cache. The
   cache is only an offline fallback. */
const CACHE = 'someday-root-v3';
const SHELL = ['./', 'index.html', 'v4/styles.css', 'v4/app.js', 'v4/engine.js', 'v4/manifest.json'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    // Always ask the server (revalidate), bypassing the stale HTTP disk cache.
    fetch(e.request, { cache: 'no-cache' }).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request))
  );
});
