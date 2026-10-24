/* =============================================================================
 * SERVICE WORKER — offline-first for the static shell, network-only for APIs.
 * Bump CACHE_VERSION on every deploy that changes assets.
 * ========================================================================== */
const CACHE_VERSION = 'sb-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './css/styles.css',
  './js/main.js',
  './js/booking.js',
  './js/config.js',
  './js/i18n.js',
  './js/translations/index.js',
  './img/icon.svg',
  './manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // bookings/auth always hit the network
  const url = new URL(request.url);
  if (url.origin !== location.origin) return; // fonts, Supabase, maps: browser handles

  // Pages: network first (fresh content), cache fallback (offline).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => { caches.open(CACHE_VERSION).then((c) => c.put(request, res.clone())); return res; })
        .catch(() => caches.match(request).then((r) => r || caches.match('./index.html'))),
    );
    return;
  }

  // Static assets: cache first, refresh in background.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((res) => {
      if (res.ok) caches.open(CACHE_VERSION).then((c) => c.put(request, res.clone()));
      return res;
    })),
  );
});
