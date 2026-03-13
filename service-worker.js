/* ═══════════════════════════════════════════════════════
   service-worker.js — Butterfly Kingdom PWA
   Estrategia: Cache-First para assets, Network-First para imágenes
   ═══════════════════════════════════════════════════════ */

const CACHE_NAME   = 'bk-game-v1';
const IMAGE_CACHE  = 'bk-images-v1';

/* Archivos que se cachean al instalar (shell de la app) */
const SHELL_FILES = [
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800&display=swap'
];

/* ── INSTALL: pre-cachear el shell ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())   // activar de inmediato
      .catch(err => console.warn('[SW] Error cacheando shell:', err))
  );
});

/* ── ACTIVATE: limpiar caches viejos ── */
self.addEventListener('activate', event => {
  const VALID = [CACHE_NAME, IMAGE_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => !VALID.includes(k))
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())  // tomar control de todas las pestañas
  );
});

/* ── FETCH: estrategia por tipo de recurso ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo manejar GET
  if (request.method !== 'GET') return;

  // Imágenes externas (Wikipedia, etc.) → Network-First con fallback a cache
  if (url.hostname.includes('wikipedia.org') || url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    event.respondWith(networkFirstImage(request));
    return;
  }

  // Fuentes de Google → Cache-First
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // Assets propios (HTML, JS, CSS, iconos) → Cache-First
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }
});

/* ─── Helpers de estrategia ─── */

/** Cache-First: sirve desde cache; si no existe, va a red y cachea */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Sin conexión y sin cache → respuesta vacía con status de error
    return new Response('Sin conexión', { status: 503, statusText: 'Service Unavailable' });
  }
}

/** Network-First para imágenes: intenta red primero; si falla usa cache */
async function networkFirstImage(request) {
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(5000) });
    if (response && response.status === 200) {
      const cache = await caches.open(IMAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('', { status: 503 });
  }
}
