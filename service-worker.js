/* ═══════════════════════════════════════════
   service-worker.js — Butterfly Kingdom PWA
   Cambiá CACHE_NAME a v2, v3, etc. cada vez
   que quieras forzar una actualización
   ═══════════════════════════════════════════ */

const CACHE_NAME = 'bk-game-v2';
const SHELL = [
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;700;800&display=swap'
];

/* INSTALL: cachear shell completo */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] install error:', err))
  );
});

/* ACTIVATE: borrar caches viejos → esto dispara la actualización en los usuarios */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* FETCH: Cache-First para assets propios */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached || new Response('Sin conexión', { status: 503 }));
    })
  );
});
