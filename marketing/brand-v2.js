(() => {
  const BRAND_ROOT = '/brand/official';
  const BRAND_VERSION = '10';
  const ICON_ROOT = `${BRAND_ROOT}/icons`;
  const STYLESHEET = '/marketing/brand-v2.css';

  if (!document.querySelector(`link[href^="${STYLESHEET}"]`)) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = `${STYLESHEET}?v=${BRAND_VERSION}`;
    document.head.appendChild(stylesheet);
  }

  document.documentElement.classList.add('cosmica-brand-official');

  const plusHeader = document.querySelector('.plus-header');
  if (plusHeader) {
    const plusHeaderFix = document.createElement('style');
    plusHeaderFix.dataset.cosmicaPlusHeaderFix = 'true';
    plusHeaderFix.textContent = `
      body { padding-top: 76px; }
      .plus-header {
        position: fixed !important;
        inset: 0 0 auto !important;
        width: 100%;
        background: #0F121A !important;
        -webkit-backdrop-filter: none !important;
        backdrop-filter: none !important;
      }
      @media (max-width: 590px) {
        body { padding-top: 68px; }
      }
    `;
    document.head.appendChild(plusHeaderFix);
  }

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
    .querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')
    .forEach(icon => icon.remove());

  for (const icon of [
    { rel: 'icon', type: 'image/png', sizes: '16x16', href: `${ICON_ROOT}/cosmica-c-v10-16.png` },
    { rel: 'icon', type: 'image/png', sizes: '32x32', href: `${ICON_ROOT}/cosmica-c-v10-32.png` },
    { rel: 'icon', type: 'image/x-icon', href: `${ICON_ROOT}/favicon-c-v10.ico` },
    { rel: 'apple-touch-icon', sizes: '180x180', href: `${ICON_ROOT}/cosmica-c-v10-180.png` },
    { rel: 'manifest', href: `/site.webmanifest?v=${BRAND_VERSION}` },
  ]) {
    const link = document.createElement('link');
    Object.entries(icon).forEach(([name, value]) => link.setAttribute(name, value));
    document.head.appendChild(link);
  }

  const themeColor = document.querySelector('meta[name="theme-color"]') ?? document.createElement('meta');
  themeColor.setAttribute('name', 'theme-color');
  themeColor.setAttribute('content', '#0F121A');
  if (!themeColor.parentNode) document.head.appendChild(themeColor);

  const applicationName = document.querySelector('meta[name="application-name"]') ?? document.createElement('meta');
  applicationName.setAttribute('name', 'application-name');
  applicationName.setAttribute('content', 'Cósmica');
  if (!applicationName.parentNode) document.head.appendChild(applicationName);
})();
