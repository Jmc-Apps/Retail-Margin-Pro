const CACHE_NAME = "retail-margin-pro-v2.10";
const APP_SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "assets/title-logo.png",
  "assets/apple-touch-icon.png",
  "assets/favicon.png",
  "assets/icon-192.png",
  "assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => key === CACHE_NAME ? undefined : caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Cache-first startup. Settings > Force Reload from Server clears this cache,
// unregisters the service worker, and reloads with a cache-busting URL.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.searchParams.has("serverReload")) {
    event.respondWith(fetch(event.request, { cache: "reload" }));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => cache.put(event.request, copy))
          .catch(() => undefined);
        return response;
      });
    })
  );
});
