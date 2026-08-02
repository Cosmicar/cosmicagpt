(() => {
  const BRAND_ROOT = '/brand/v2';
  const STYLESHEET = '/marketing/brand-v2.css';

  if (!document.querySelector(`link[href="${STYLESHEET}"]`)) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = STYLESHEET;
    document.head.appendChild(stylesheet);
  }

  document.documentElement.classList.add('cosmica-brand-v2');

  document.querySelectorAll('.brand').forEach(brand => {
    const isDarkContext = Boolean(brand.closest('.footer'));
    brand.classList.add('brand-v2');
    brand.setAttribute('aria-label', 'Cósmica');
    brand.innerHTML = `<img class="brand-v2-logo" src="${BRAND_ROOT}/cosmica-logo-integrado-${isDarkContext ? 'dark' : 'light'}.svg" alt="Cósmica">`;
  });

  document.querySelectorAll('link[rel~="icon"]').forEach(icon => icon.remove());
  const favicon = document.createElement('link');
  favicon.rel = 'icon';
  favicon.type = 'image/svg+xml';
  favicon.href = `${BRAND_ROOT}/cosmica-isotipo-micro.svg?v=2`;
  document.head.appendChild(favicon);

  const shortcut = document.createElement('link');
  shortcut.rel = 'shortcut icon';
  shortcut.href = `${BRAND_ROOT}/cosmica-isotipo-micro.svg?v=2`;
  document.head.appendChild(shortcut);

  const applicationName = document.querySelector('meta[name="application-name"]') ?? document.createElement('meta');
  applicationName.setAttribute('name', 'application-name');
  applicationName.setAttribute('content', 'Cósmica');
  if (!applicationName.parentNode) document.head.appendChild(applicationName);
})();
