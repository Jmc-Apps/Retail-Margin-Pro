const CACHE = 'retail-margin-pro-v1-02';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './assets/title-logo.png',
  './assets/logo-cropped.png',
  './assets/retail-margin-pro-logo.png',
  './assets/apple-touch-icon.png',
  './assets/favicon.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
  'assets/master-banner.png',
  'assets/master-icon.png',
  'assets/icon-1024.png',
  'assets/icon-384.png',
  'assets/favicon-32.png',
  'assets/favicon-16.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match('./index.html')))
  );
});
