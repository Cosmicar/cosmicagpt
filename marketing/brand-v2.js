(() => {
  const BRAND_ROOT = '/brand/v2';
  const BRAND_VERSION = '5';
  const STYLESHEET = '/marketing/brand-v2.css';

  if (!document.querySelector(`link[href^="${STYLESHEET}"]`)) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = `${STYLESHEET}?v=${BRAND_VERSION}`;
    document.head.appendChild(stylesheet);
  }

  document.documentElement.classList.add('cosmica-brand-v2');

  document.querySelectorAll('.brand').forEach(brand => {
    const isDarkContext = Boolean(
      brand.closest('.footer, [data-brand-theme="dark"], .dark')
    );
    const variant = isDarkContext ? 'dark' : 'light';

    brand.classList.add('brand-v2');
    brand.setAttribute('aria-label', 'Cósmica');
    brand.innerHTML = `<img class="brand-v2-logo" src="${BRAND_ROOT}/cosmica-logo-integrado-${variant}.svg?v=${BRAND_VERSION}" alt="Cósmica" decoding="async">`;
  });

  /* El Resumen Visual Oficial A1.1 prohíbe cohetes en toda pieza.
   * Las páginas provinciales existentes comparten este módulo, por lo que la
   * limpieza se aplica de forma central sin reescribir archivos generados a mano.
   */
  const textWalker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest('script, style, noscript, textarea')) {
          return NodeFilter.FILTER_REJECT;
        }
        return node.nodeValue?.includes('🚀')
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    }
  );

  const rocketNodes = [];
  while (textWalker.nextNode()) rocketNodes.push(textWalker.currentNode);
  rocketNodes.forEach(node => {
    node.nodeValue = node.nodeValue.replaceAll('🚀', '').replace(/\s{2,}/g, ' ');
  });

  document
    .querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')
    .forEach(icon => icon.remove());

  const favicon = document.createElement('link');
  favicon.rel = 'icon';
  favicon.type = 'image/svg+xml';
  favicon.href = `${BRAND_ROOT}/cosmica-isotipo-micro.svg?v=${BRAND_VERSION}`;
  document.head.appendChild(favicon);

  const shortcut = document.createElement('link');
  shortcut.rel = 'shortcut icon';
  shortcut.href = `${BRAND_ROOT}/cosmica-isotipo-micro.svg?v=${BRAND_VERSION}`;
  document.head.appendChild(shortcut);

  const applicationName = document.querySelector('meta[name="application-name"]') ?? document.createElement('meta');
  applicationName.setAttribute('name', 'application-name');
  applicationName.setAttribute('content', 'Cósmica');
  if (!applicationName.parentNode) document.head.appendChild(applicationName);
})();
