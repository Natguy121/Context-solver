// Minimal service worker: exists mainly to satisfy the browser's PWA
// installability requirement (a valid manifest isn't enough on its own),
// and as a bonus it makes the "works with no connection" promise this page
// already makes actually hold up for a real install too, not just the old
// manual "Save this page" download.
//
// Bump CACHE_NAME whenever contexto.html/index.html changes in a way that
// matters offline — old caches are dropped automatically on activate.
const CACHE_NAME = "contexto-v1";
const CORE_ASSETS = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for navigation (so a signed-in player always gets the
// latest build when online), falling back to the cached shell the moment
// the network is unreachable — that's the actual offline case this exists
// for. Everything else (icons, manifest) is cache-first since it never
// changes without a new CACHE_NAME.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("./index.html"))
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
