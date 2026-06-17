const CACHE_NAME = "retail-margin-pro-v2.07";
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

// Cache-first startup: the app opens from cache and only checks online
// when the Settings > Check for Updates button calls registration.update().
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

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
