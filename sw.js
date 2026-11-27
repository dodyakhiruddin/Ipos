// Service Worker DONET CELL: cache offline + menerima gambar dari menu "Bagikan" (WhatsApp, galeri, dll)
const CACHE = 'donet-app-v14';
const SHARE_CACHE = 'share-target-v1';
const CACHEABLE_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'cdn.tailwindcss.com', 'code.jquery.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => e.waitUntil((async () => {
    for (const k of await caches.keys()) {
        if (k !== CACHE && k !== SHARE_CACHE) await caches.delete(k);
    }
    await self.clients.claim();
})()));

self.addEventListener('fetch', e => {
    const req = e.request;
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/') || url.hostname.endsWith('.supabase.co')) return;
    if (req.method === 'POST' && url.pathname.endsWith('/share-target')) {
        e.respondWith(handleShare(req));
        return;
    }
    if (req.method !== 'GET') return;
    const sameOrigin = url.origin === self.location.origin;
    if (!sameOrigin && !CACHEABLE_HOSTS.includes(url.hostname)) return; // mis. Supabase: jangan di-cache
    e.respondWith(networkFirst(req, sameOrigin));
});

async function handleShare(req) {
    try {
        const fd = await req.formData();
        const c = await caches.open(SHARE_CACHE);
        const proofKey = new URL('shared-proof', self.registration.scope).href;
        const metaKey = new URL('shared-proof-meta', self.registration.scope).href;

        let file = fd.get('bukti');
        if (!(file && typeof file === 'object' && file.size)) {
            for (const [, v] of fd.entries()) {
                if (v && typeof v === 'object' && typeof v.arrayBuffer === 'function' && v.size > 0) {
                    file = v;
                    break;
                }
            }
        }
        if (file && file.size) {
            await c.put(proofKey, new Response(file, { headers: { 'Content-Type': file.type || 'image/jpeg' } }));
        } else {
            await c.delete(proofKey);
        }

        const title = String(fd.get('title') || '').trim();
        const text = String(fd.get('text') || '').trim();
        const sharedUrl = String(fd.get('url') || '').trim();
        if (title || text || sharedUrl) {
            await c.put(metaKey, new Response(JSON.stringify({ title, text, url: sharedUrl, receivedAt: Date.now() }), {
                headers: { 'Content-Type': 'application/json' }
            }));
        } else {
            await c.delete(metaKey);
        }
    } catch (err) { /* lanjut: aplikasi tetap dibuka */ }
    return Response.redirect(new URL('./?share-target=1', self.registration.scope).href, 303);
}

async function networkFirst(req, sameOrigin) {
    const cache = await caches.open(CACHE);
    try {
        const res = await fetch(sameOrigin ? new Request(req, { cache: 'no-store' }) : req);
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
    } catch (err) {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') {
            const page = await cache.match(new URL('./', self.registration.scope).href, { ignoreSearch: true });
            if (page) return page;
        }
        throw err;
    }
}
