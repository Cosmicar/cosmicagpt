(() => {
  const BRAND_ROOT = '/brand/official';
  const BRAND_VERSION = '7';
  const STYLESHEET = '/marketing/brand-v2.css';

  if (!document.querySelector(`link[href^="${STYLESHEET}"]`)) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = `${STYLESHEET}?v=${BRAND_VERSION}`;
    document.head.appendChild(stylesheet);
  }

  document.documentElement.classList.add('cosmica-brand-official');

  document.querySelectorAll('.brand').forEach(brand => {
    const isDarkContext = Boolean(
      brand.closest('.footer, [data-brand-theme="dark"], .dark')
    );
    const variant = isDarkContext ? 'dark' : 'light';

    brand.classList.remove('brand-v2');
    brand.classList.add('brand-official');
    brand.setAttribute('aria-label', 'Cósmica');
    brand.innerHTML = `<img class="brand-official-logo" src="${BRAND_ROOT}/cosmica-logo-${variant}.png?v=${BRAND_VERSION}" alt="Cósmica" width="3798" height="1851" decoding="async">`;
  });

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
  favicon.type = 'image/png';
  favicon.href = `${BRAND_ROOT}/cosmica-symbol.png?v=${BRAND_VERSION}`;
  document.head.appendChild(favicon);

  const appleIcon = document.createElement('link');
  appleIcon.rel = 'apple-touch-icon';
  appleIcon.href = `${BRAND_ROOT}/avatar-light.png?v=${BRAND_VERSION}`;
  document.head.appendChild(appleIcon);

  const applicationName = document.querySelector('meta[name="application-name"]') ?? document.createElement('meta');
  applicationName.setAttribute('name', 'application-name');
  applicationName.setAttribute('content', 'Cósmica');
  if (!applicationName.parentNode) document.head.appendChild(applicationName);
})();
