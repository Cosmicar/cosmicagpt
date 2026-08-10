(() => {
  for (const href of ['/marketing/header-polish.css', '/marketing/coverage.css']) {
    if (!document.querySelector(`link[href="${href}"]`)) {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = href;
      document.head.appendChild(stylesheet);
    }
  }

  const brandScript = '/marketing/brand-v2.js';
  if (!document.querySelector(`script[src="${brandScript}"]`)) {
    const script = document.createElement('script');
    script.src = brandScript;
    script.defer = true;
    document.head.appendChild(script);
  }

  const provinces = [
    ['Buenos Aires','buenos-aires'],['CABA','caba'],['Catamarca','catamarca'],['Chaco','chaco'],
    ['Chubut','chubut'],['Córdoba','cordoba'],['Corrientes','corrientes'],['Entre Ríos','entre-rios'],
    ['Formosa','formosa'],['Jujuy','jujuy'],['La Pampa','la-pampa'],['La Rioja','la-rioja'],
    ['Mendoza','mendoza'],['Misiones','misiones'],['Neuquén','neuquen'],['Río Negro','rio-negro'],
    ['Salta','salta'],['San Juan','san-juan'],['San Luis','san-luis'],['Santa Cruz','santa-cruz'],
    ['Santa Fe','santa-fe'],['Santiago del Estero','santiago-del-estero'],
    ['Tierra del Fuego','tierra-del-fuego'],['Tucumán','tucuman']
  ];

  const footer = document.querySelector('.footer');
  if (footer && !document.getElementById('cobertura-nacional')) {
    const coverage = document.createElement('section');
    coverage.className = 'home-coverage';
    coverage.id = 'cobertura-nacional';
    coverage.setAttribute('aria-labelledby', 'coverage-title');
    coverage.innerHTML = `
      <div class="container">
        <div class="home-coverage-head">
          <div>
            <span class="eyebrow">Cobertura nacional</span>
            <h2 id="coverage-title">Soporte técnico remoto en las <span class="gradient-text">24 jurisdicciones de Argentina.</span></h2>
            <p>Nuestra base física está en San Salvador de Jujuy. Si estás cerca, conocé nuestro <a href="/serviciotecnico">servicio técnico presencial en Jujuy</a>. En el resto del país atendemos por conexión remota, sin inventar sucursales.</p>
          </div>
          <a href="/soporte-tecnico-remoto-argentina.html">Ver cómo funciona la cobertura →</a>
        </div>
        <nav class="home-province-grid" aria-label="Soporte técnico por provincia">
          ${provinces.map(([name, slug]) => `<a href="/pc-lenta-${slug}.html">${name}</a>`).join('')}
        </nav>
      </div>`;
    footer.before(coverage);
  }

  const phone = '5493883298736';
  const header = document.getElementById('header');
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');
  const status = document.getElementById('serviceStatus');
  const problemNavLink = navLinks?.querySelector('a[href="#problemas"]');
  const plansNavLink = navLinks?.querySelector('a[href="#planes"]');

  if (problemNavLink) problemNavLink.textContent = 'Servicios';
  if (plansNavLink) {
    plansNavLink.href = '/planes';
    plansNavLink.textContent = 'Mercurio · Venus · Planeta X';
  }

  const plansGrid = document.querySelector('#planes .plans');
  if (plansGrid && !document.querySelector('.plans-detail-link')) {
    const detailLink = document.createElement('div');
    detailLink.className = 'center step-actions plans-detail-link';
    detailLink.innerHTML = '<a class="btn btn-secondary" href="/planes">Ver Mercurio, Venus y Planeta X en detalle</a>';
    plansGrid.after(detailLink);
  }

  const updateHeader = () => header?.classList.toggle('scrolled', window.scrollY > 12);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  const closeMenu = () => {
    navLinks?.classList.remove('open');
    menuToggle?.classList.remove('open');
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.setAttribute('aria-label', 'Abrir menú');
    document.body.classList.remove('menu-open');
  };

  menuToggle?.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    menuToggle.classList.toggle('open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    document.body.classList.toggle('menu-open', open);
  });

  navLinks?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navLinks?.classList.contains('open')) {
      closeMenu();
      menuToggle?.focus();
    }
  });

  if (status) {
    const argentinaParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Jujuy',
      hour: '2-digit',
      hour12: false,
      hourCycle: 'h23'
    }).formatToParts(new Date());

    const currentHour = Number(argentinaParts.find(part => part.type === 'hour')?.value ?? 12);
    const isOpen = currentHour >= 7 && currentHour < 24;
    status.textContent = isOpen
      ? 'Estamos atendiendo · horario extendido hasta las 00:00'
      : 'Ahora estamos fuera de horario · escribinos y te respondemos al abrir';
    status.parentElement.style.color = isOpen ? 'var(--green)' : 'var(--orange-dark)';
  }

  const params = new URLSearchParams(window.location.search);
  const campaign = ['utm_source', 'utm_medium', 'utm_campaign']
    .map(key => params.get(key))
    .filter(Boolean)
    .join(' / ');

  const waUrl = (message, source) => {
    const origin = campaign ? `${source} · ${campaign}` : source;
    return `https://wa.me/${phone}?text=${encodeURIComponent(`${message}\n\nVengo desde cosmica.ar (${origin}).`)}`;
  };

  const track = (event, source) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, source });
  };

  document.querySelectorAll('.wa-link').forEach(link => {
    const source = link.dataset.source || 'website';
    link.href = waUrl(link.dataset.message || 'Hola, necesito ayuda.', source);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.addEventListener('click', () => track('whatsapp_click', source));
  });

  document.querySelectorAll('.wa-trigger').forEach(button => {
    button.addEventListener('click', () => {
      const source = button.dataset.source || 'problem';
      track('whatsapp_click', source);
      window.open(waUrl(button.dataset.message || 'Hola, necesito ayuda.', source), '_blank', 'noopener,noreferrer');
    });
  });

  document.querySelectorAll('.assistance-access').forEach((link, index) => {
    link.addEventListener('click', () => track('assistance_click', link.dataset.source || `assistance-${index + 1}`));
  });

  document.querySelectorAll('.faq-question').forEach((button, index) => {
    const answer = button.nextElementSibling;
    const answerId = `faq-answer-${index + 1}`;
    answer.id = answerId;
    button.setAttribute('aria-controls', answerId);

    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') === 'true';

      document.querySelectorAll('.faq-question[aria-expanded="true"]').forEach(other => {
        if (other !== button) {
          other.setAttribute('aria-expanded', 'false');
          other.nextElementSibling.style.maxHeight = null;
        }
      });

      button.setAttribute('aria-expanded', String(!open));
      answer.style.maxHeight = open ? null : '520px';
    });
  });

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealElements = [...document.querySelectorAll('.reveal')];

  if (!reducedMotion && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          entry.target.classList.remove('reveal-pending');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .12 });

    revealElements.forEach(element => {
      if (element.getBoundingClientRect().top > window.innerHeight * .88) {
        element.classList.add('reveal-pending');
        observer.observe(element);
      } else {
        element.classList.add('visible');
      }
    });
  } else {
    revealElements.forEach(element => element.classList.add('visible'));
  }

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();