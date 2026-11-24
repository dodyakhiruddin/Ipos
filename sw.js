// Service worker: simpan library CDN ke cache saat pertama kali dimuat, lalu pakai cache saat offline.
const CACHE = 'donet-cdn-v1';
const CDN_HOSTS = [
  'cdn.tailwindcss.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net',
  'fonts.googleapis.com', 'fonts.gstatic.com', 'tessdata.projectnaptha.com'
];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isPage = url.origin === location.origin && (req.mode === 'navigate' || url.pathname.endsWith('/index.html'));
  const isCdn = CDN_HOSTS.includes(url.hostname);
  if (!isCdn && !isPage) return;

  // CDN: cache dulu. Halaman utama: jaringan dulu supaya update tetap masuk, cache sebagai cadangan offline.
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (isCdn) {
      const hit = await cache.match(req);
      if (hit) return hit;
    }
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const fallback = await cache.match(req);
      if (fallback) return fallback;
      throw err;
    }
  })());
});
