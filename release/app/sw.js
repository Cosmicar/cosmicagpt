self.addEventListener('install', () => {
  console.log('[SW] Instalado');
  self.skipWaiting(); // Activa el SW inmediatamente sin esperar al cierre de pestañas
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim()); // Toma control de todas las pestañas abiertas al activarse
});

self.addEventListener('fetch', () => {
  // Requisito mínimo para que el navegador reconozca la app como PWA instalable.
  // Sin handler de caché aquí: la app siempre consulta Firestore en tiempo real.
});

// ── Handler de clic en notificación (crítico para Android) ──────────
// Sin esto, tocar la notificación en móvil no hace nada.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Si ya hay una pestaña del panel abierta, enfocarla
      const panelClient = windowClients.find((c) => c.url.includes('panel.html'));
      if (panelClient) return panelClient.focus();
      // Si no, abrir el panel en una nueva pestaña
      return clients.openWindow('/panel.html');
    })
  );
});
