// ===== Forklift PWA Service Worker =====
// Bump this on every deploy to force an update:
const SW_VERSION = "v12";                     // <— increment (v13, v14, …)
const CACHE_NAME = `forklift-${SW_VERSION}`;

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// Install: cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting(); // activate immediately
});

// Activate: purge old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim(); // control existing pages
});

// Fetch strategy:
// - HTML: network-first (fallback to cache offline)
// - Other: stale-while-revalidate
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const accept = req.headers.get("accept") || "";

  // HTML/doc requests
  if (accept.includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((netRes) => {
          const copy = netRes.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return netRes;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }

  // Non-HTML: stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((netRes) => {
          // Don’t cache opaque cross-origin errors or invalid responses
          if (netRes && netRes.status === 200 && netRes.type !== "opaque") {
            const copy = netRes.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return netRes;
        })
        .catch(() => cached); // if network fails, fall back to cache
      return cached || fetchPromise;
    })
  );
});