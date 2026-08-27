// Service worker — deixa o roteiro utilizável offline depois da primeira visita.
// HTML: network-first (pega atualizações; cache é o fallback offline).
// Resto (tiles, fontes, Leaflet, fotos, rotas OSRM): cache-first com
// atualização em segundo plano.
const CACHE = 'islandia-v1';
const PRECACHE = ['/', '/index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Navegação / HTML principal: network-first
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return r;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/index.html')))
    );
    return;
  }

  // Demais recursos: cache-first, revalidando em segundo plano
  e.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((r) => {
          if (r && (r.ok || r.type === 'opaque')) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return r;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
