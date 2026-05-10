// ── firebase-messaging-sw.js ──────────────────────────────────────────────
// Este Service Worker SOLO maneja mensajes FCM en segundo plano.
// NO reemplaza ni altera sw.js (que gestiona las notificaciones nativas existentes).
// ─────────────────────────────────────────────────────────────────────────────

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// ── IMPORTANTE: Reemplazá estos valores con los de tu proyecto Firebase ──
// Son los mismos valores que ya están en js/config.js
firebase.initializeApp({
  apiKey:            "AIzaSyBgRCLYvSPLG4PIqPjHFGsPhu0EoxTLKCU",
  authDomain:        "cosmica-clientes.firebaseapp.com",
  projectId:         "cosmica-clientes",
  storageBucket:     "cosmica-clientes.appspot.com",
  messagingSenderId: "875572379632",
  appId:             "1:875572379632:web:db73498c6ffc9ec679a735"
});

const messaging = firebase.messaging();

// ── Mensajes en Segundo Plano ─────────────────────────────────────────────
// Se dispara cuando la app está cerrada o en background.
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW] Mensaje en background recibido:', payload);

  const titulo   = payload.notification?.title || payload.data?.title || '🔔 Cósmica';
  const opciones = {
    body:  payload.notification?.body  || payload.data?.body  || 'Nueva notificación',
    icon:  '/cosmica-logo.png',
    badge: '/cosmica-logo.png',
    data:  { url: '/panel.html' }
  };

  self.registration.showNotification(titulo, opciones);
});

// ── Clic en la notificación: llevar al panel ──────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/panel.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const panel = windowClients.find((c) => c.url.includes('panel.html'));
      if (panel) return panel.focus();
      return clients.openWindow(targetUrl);
    })
  );
});
