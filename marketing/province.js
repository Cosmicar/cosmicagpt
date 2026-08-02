(() => {
  const brandScript = '/marketing/brand-v2.js';
  if (!document.querySelector(`script[src="${brandScript}"]`)) {
    const script = document.createElement('script');
    script.src = brandScript;
    document.head.appendChild(script);
  }

  const phone = '5493883298736';
  const header = document.getElementById('header');
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');
  const status = document.getElementById('serviceStatus');
  const province = document.body.dataset.province || 'Argentina';

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
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone:'America/Argentina/Jujuy', hour:'2-digit', hour12:false, hourCycle:'h23' }).format(new Date()));
    const open = hour >= 7 && hour < 24;
    status.textContent = open ? 'Estamos atendiendo · horario extendido hasta las 00:00' : 'Fuera de horario · escribinos y respondemos al abrir';
    status.parentElement.style.color = open ? 'var(--green)' : 'var(--orange-dark)';
  }

  const params = new URLSearchParams(location.search);
  const campaign = ['utm_source','utm_medium','utm_campaign'].map(key => params.get(key)).filter(Boolean).join(' / ');
  const waUrl = (message, source) => {
    const origin = campaign ? `${source} · ${campaign}` : source;
    return `https://wa.me/${phone}?text=${encodeURIComponent(`${message}\n\nVengo desde la página de ${province} en cosmica.ar (${origin}).`)}`;
  };

  document.querySelectorAll('.wa-link').forEach(link => {
    const source = link.dataset.source || 'province-page';
    link.href = waUrl(link.dataset.message || `Hola, necesito ayuda en ${province}.`, source);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });

  document.querySelectorAll('.faq-question').forEach((button,index) => {
    const answer = button.nextElementSibling;
    const id = `faq-answer-${index+1}`;
    answer.id = id;
    button.setAttribute('aria-controls', id);
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') === 'true';
      document.querySelectorAll('.faq-question[aria-expanded="true"]').forEach(other => {
        if (other !== button) {
          other.setAttribute('aria-expanded','false');
          other.nextElementSibling.style.maxHeight = null;
        }
      });
      button.setAttribute('aria-expanded', String(!open));
      answer.style.maxHeight = open ? null : `${answer.scrollHeight + 30}px`;
    });
  });

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveal = [...document.querySelectorAll('.reveal')];
  if (!reduced && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        entry.target.classList.remove('reveal-pending');
        observer.unobserve(entry.target);
      }
    }), { threshold:.1 });
    reveal.forEach(element => {
      if (element.getBoundingClientRect().top > innerHeight * .9) {
        element.classList.add('reveal-pending');
        observer.observe(element);
      } else element.classList.add('visible');
    });
  } else reveal.forEach(element => element.classList.add('visible'));

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
