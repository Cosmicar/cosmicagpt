(() => {
  // Fuente: Mi cuenta > Inicio > Etapa 3, snippet de Remotto, 2026-11-07.
  // No hay credenciales, IDs de cuenta, API propia ni lectura del código.
  const status = document.getElementById('widgetStatus');
  let failed = false;
  const fail = () => {
    failed = true;
    status.textContent = 'No pudimos cargar el formulario. Usá la descarga oficial o volvé a la guía para pedir ayuda.';
  };
  const timeout = setTimeout(fail, 15000);
  function loadScript(src, integrity) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.referrerPolicy = 'no-referrer';
      if (integrity) {
        script.integrity = integrity;
        script.crossOrigin = 'anonymous';
      }
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  (async () => {
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js', 'sha256-/xUj+3OJU5yExlq6GSYGSHk7tPXikynS7ogEvDej/m4=');
      if (failed) return;
      await loadScript('https://www.islonline.com/static/v7/scripts/islonline-join.jquery-v2.min.js');
      if (failed) return;
      if (typeof window.jQuery?.fn?.ISLOnlineJoin !== 'function') throw new Error('Widget no disponible');
      window.jQuery('#remotto-connectbox').ISLOnlineJoin({
        serverUrl: 'https://www.islonline.net',
        languageCode: 'es',
        showBubble: false
      });
      // Inicialización no equivale a conexión: la descarga y el código los gestiona ISL.
      status.textContent = 'Ingresá únicamente el código que te dio el técnico de Cósmica.';
    } catch (_) { fail(); }
    finally { clearTimeout(timeout); }
  })();
})();
