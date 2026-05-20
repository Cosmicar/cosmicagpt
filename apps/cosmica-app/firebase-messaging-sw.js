// firebase-messaging-sw.js — SaaS Cósmica App
// Service Worker para FCM (mensajes en background).
// Debe estar en la misma carpeta que index.html del SaaS.

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyBgRCLYvSPLG4PIqPjHFGsPhu0EoxTLKCU",
  authDomain:        "cosmica-clientes.firebaseapp.com",
  projectId:         "cosmica-clientes",
  storageBucket:     "cosmica-clientes.appspot.com",
  messagingSenderId: "875572379632",
  appId:             "1:875572379632:web:db73498c6ffc9ec679a735"
});

const messaging = firebase.messaging();

// Mensajes recibidos con la app en background o cerrada
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || '🔔 Cósmica';
  const body  = payload.notification?.body  || payload.data?.body  || 'Nueva notificación';
  self.registration.showNotification(title, {
    body,
    icon:  '/assets/icon-192.png',
    badge: '/assets/icon-192.png',
    data:  { url: self.location.pathname.replace('firebase-messaging-sw.js', '') }
  });
});

// Clic en la notificación → abrir/enfocar el SaaS
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.startsWith(targetUrl));
      if (existing) return existing.focus();
      return clients.openWindow(targetUrl);
    })
  );
});
