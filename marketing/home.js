(() => {
  const phone = '5493883298736';
  const header = document.getElementById('header');
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');
  const status = document.getElementById('serviceStatus');
  const problemNavLink = navLinks.querySelector('a[href="#problemas"]');

  if (problemNavLink) problemNavLink.textContent = '¿En qué te ayudamos?';

  const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 12);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  const closeMenu = () => {
    navLinks.classList.remove('open');
    menuToggle.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Abrir menú');
    document.body.classList.remove('menu-open');
  };

  menuToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    menuToggle.classList.toggle('open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    document.body.classList.toggle('menu-open', open);
  });

  navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navLinks.classList.contains('open')) {
      closeMenu();
      menuToggle.focus();
    }
  });

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

  document.getElementById('year').textContent = new Date().getFullYear();
})();