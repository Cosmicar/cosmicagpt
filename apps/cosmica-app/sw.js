const CACHE_NAME = 'cosmica-saas-v2.1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon.svg',
  './assets/favicon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  '../../styles/design-system.css',
  '../../styles/variables.css',
  '../../components/ui/Navbar.css',
  '../../components/ui/Sidebar.css',
  '../../components/ui/Backgrounds.css',
  './core/app.js',
  './core/router.js',
  './core/session.js',
  './core/base-view.js',
  './core/chaos-guard.js',
  './core/intelligence.js',
  './components/app-state.js',
  './components/command-palette.js',
  './components/drawer.js',
  './components/ticket-card.js',
  './services/tickets.js',
  './services/clientes.js',
  './services/inventario.js',
  './services/finanzas.js',
  './views/login.js',
  './views/dashboard.js',
  './views/tickets.js',
  './views/clientes.js',
  './views/inventario.js',
  './views/finanzas.js',
  './views/configuracion.js',
  './views/ticket-form.js',
  './views/cliente-form.js',
  './views/inventario-form.js'
];

// Instalar SW y cachear assets estáticos iniciales
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW-SaaS] Pre-cacheando App Shell estático');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[SW-SaaS] Fallo en precaché de algunos recursos:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activar SW y limpiar cachés viejas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW-SaaS] Limpiando caché antigua:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia de Fetch inteligente: Caching seguro libre de datos dinámicos
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // EXCLUIR estrictamente Firestore, APIs, Auth de Firebase y cualquier método no GET
  if (
    event.request.method !== 'GET' ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.pathname.includes('/_/auth/') ||
    url.search.includes('apiKey=')
  ) {
    return; // Dejar que el navegador maneje la petición en red directamente
  }

  // Identificar si la solicitud es para el App Shell (index.html o raíz)
  const isAppShell = url.pathname.endsWith('/apps/cosmica-app/') || 
                     url.pathname.endsWith('/index.html') ||
                     url.pathname === '/apps/cosmica-app';

  if (isAppShell) {
    // Red-primero (Network-First) para el App Shell (garantizar actualizaciones en tiempo real si hay conexión)
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
          }
          return networkResponse;
        })
        .catch(() => {
          // Si falla la red (offline), servir desde caché
          return caches.match(event.request);
        })
    );
  } else {
    // Usar stale-while-revalidate para el resto de recursos estáticos (CSS, JS, imágenes, fuentes)
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseCopy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
            }
            return networkResponse;
          })
          .catch(() => {
            // Ignorar errores de red en segundo plano para stale-while-revalidate
          });

        return cachedResponse || fetchPromise;
      })
    );
  }
});
