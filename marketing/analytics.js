(() => {
  // Solo producción: las previews y el desarrollo no contaminan la propiedad.
  if (!['cosmica.ar', 'www.cosmica.ar'].includes(window.location.hostname) || window.cosmicaAnalyticsLoaded) return;
  window.cosmicaAnalyticsLoaded = true;
  const measurementId = 'G-LM3ZVTL6YW';
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  const cleanUrl = value => {
    try { const url = new URL(value); return url.origin + url.pathname; } catch { return ''; }
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    page_location: cleanUrl(window.location.href),
    page_referrer: cleanUrl(document.referrer),
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  // Un único listener cubre también los enlaces creados dinámicamente.
  document.addEventListener('click', event => {
    const control = event.target.closest?.('a, button');
    if (!control) return;
    let name;
    if (control.matches('.wa-trigger')) name = 'whatsapp_click';
    else if (control.tagName === 'A') {
      const url = new URL(control.href, window.location.href);
      if (url.hostname === 'wa.me' && url.pathname.replace(/\/$/, '') === '/5493883298736') name = 'whatsapp_click';
      else if (url.origin === window.location.origin && /^\/asistencia(?:\.html)?\/?$/.test(url.pathname)) name = 'assistance_click';
    }
    if (!name) return;
    // No enviar mensajes, IDs de asistencia ni URLs de WhatsApp con texto.
    window.gtag('event', name, {
      send_to: measurementId,
      source: control.dataset.source || control.id || 'website',
      page_path: window.location.pathname,
      transport_type: 'beacon'
    });
  });
})();
