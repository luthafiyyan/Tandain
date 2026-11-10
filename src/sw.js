/**
 * sw.js
 * Service Worker untuk PWA Offline Cache.
 * Meng-cache seluruh shell aplikasi (HTML, CSS, JS, font, ikon).
 * TIDAK PERNAH menyimpan file dokumen pengguna ke dalam cache.
 */

const CACHE_NAME = 'tandain-v1';

// workbox-build will inject the build manifest here:
const PRECACHE_ASSETS = self.__WB_MANIFEST || [];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Precache built assets injected by Vite
      const urlsToCache = PRECACHE_ASSETS.map(entry => typeof entry === 'string' ? entry : entry.url);
      urlsToCache.push('./', './index.html', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png');
      return cache.addAll([...new Set(urlsToCache)]);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Jangan tangani skema non-http (misal blob:, data:)
  if (!url.protocol.startsWith('http')) return;

  // ATURAN KEAMANAN: Jangan pernah cache request upload atau file user
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Cache aset statis aplikasi jika ada yang belum tercache
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (url.pathname.endsWith('.js') ||
           url.pathname.endsWith('.mjs') ||
           url.pathname.endsWith('.css') ||
           url.pathname.endsWith('.woff2') ||
           url.pathname.endsWith('.woff') ||
           url.pathname.endsWith('.svg') ||
           url.pathname.endsWith('.png'))
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});
