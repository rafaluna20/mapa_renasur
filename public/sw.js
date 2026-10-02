// ============================================================
// Service Worker - Mapa Renasur (Terra Lima)
// Estrategia: Cache-First para tiles del mapa, Network-First para API
// ============================================================

// v2: la v1 guardó la página '/' (que redirige al login) y la devolvía como respaldo de CUALQUIER navegación
// con mala conexión, incluida /venta. Cambiar el nombre hace que el 'activate' de abajo borre esa caché vieja.
const CACHE_NAME = 'renasur-v2';
const MAP_TILES_CACHE = 'map-tiles-v1';
const STATIC_CACHE = 'static-assets-v1';

// Recursos estáticos a pre-cachear al instalar
// OJO: NO precachear '/': para un visitante sin sesión es una redirección a /login.
const PRECACHE_ASSETS = [
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/plano_general.webp',
];

// ---- Instalación: pre-cachear recursos esenciales ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache error (non-fatal):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ---- Activación: limpiar caches antiguas ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![CACHE_NAME, MAP_TILES_CACHE, STATIC_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ---- Fetch: estrategia por tipo de recurso ----
// Páginas para clientes anónimos (enlaces del bot de ventas y de los anuncios): el service worker NO las toca,
// así nunca puede sustituirlas por otra página. Mantener igual que RUTAS_PUBLICAS en app/utils/rutasPublicas.ts.
const RUTAS_PUBLICAS_SW = ['/venta', '/portal'];
const esRutaPublica = (pathname) => RUTAS_PUBLICAS_SW.some((base) => pathname === base || pathname.startsWith(base + '/'));

const PAGINA_SIN_CONEXION = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title></head><body style="font-family:system-ui,sans-serif;text-align:center;padding:3rem 1.5rem;color:#1e293b"><h1 style="font-size:1.4rem">Sin conexión</h1><p>No pudimos cargar la página. Revisa tu internet e inténtalo de nuevo.</p></body></html>';

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.origin === self.location.origin && esRutaPublica(url.pathname)) return;

  // 1. TILES DEL MAPA → Cache-First (30 días)
  if (
    url.hostname.includes('cartocdn.com') ||
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('arcgisonline.com') ||
    url.hostname.includes('basemaps.cartocdn.com')
  ) {
    event.respondWith(
      caches.open(MAP_TILES_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        } catch {
          return new Response('Tile no disponible offline', { status: 503 });
        }
      })
    );
    return;
  }

  // 2. IMÁGENES ESTÁTICAS (.png .jpg .webp .svg) → Cache-First (7 días)
  if (/\.(png|jpg|jpeg|webp|svg|gif|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        } catch {
          return cached || new Response('Imagen no disponible', { status: 503 });
        }
      })
    );
    return;
  }

  // 3. API CALLS → Network-First (sin cache, siempre datos frescos)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'Sin conexión' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  // 4. PÁGINAS HTML → Network-First con fallback a cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => new Response(PAGINA_SIN_CONEXION, {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }))
    );
    return;
  }

  // 5. RESTO (JS, CSS, fuentes) → Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      const networkFetch = fetch(event.request).then((response) => {
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
