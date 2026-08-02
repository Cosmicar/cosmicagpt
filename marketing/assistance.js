(() => {
  const brandScript = '/marketing/brand-v2.js';
  if (!document.querySelector(`script[src="${brandScript}"]`)) {
    const script = document.createElement('script');
    script.src = brandScript;
    script.defer = true;
    document.head.appendChild(script);
  }

  const completed = new Set();
  const progressBar = document.getElementById('progressBar');
  const progressLabel = document.getElementById('progressLabel');
  const toast = document.getElementById('toast');

  const showToast = message => {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
  };

  const completeStep = step => {
    completed.add(step);
    const card = document.querySelector(`[data-step="${step}"]`);
    card.classList.add('completed');
    card.querySelector('.number-value').textContent = '✓';
    const count = completed.size;
    progressBar.style.width = `${count / 3 * 100}%`;
    progressLabel.textContent = `${count} de 3 pasos`;
    localStorage.setItem('cosmica_assistance_progress', JSON.stringify([...completed]));
  };

  try {
    const saved = JSON.parse(localStorage.getItem('cosmica_assistance_progress') || '[]');
    saved.forEach(completeStep);
  } catch (_) {}

  document.getElementById('downloadAnydesk').addEventListener('click', () => {
    completeStep(1);
    showToast('Descarga iniciada. Cuando termine, abrí el archivo.');
  });
  document.getElementById('openedButton').addEventListener('click', () => {
    completeStep(2);
    showToast('Perfecto. Ahora buscá el ID que muestra AnyDesk.');
    document.querySelector('[data-step="3"]').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.getElementById('sendId').addEventListener('click', () => completeStep(3));

  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if (isMobile) document.getElementById('mobileAlert').style.display = 'block';
  const pageUrl = 'https://cosmica.ar/asistencia.html';
  document.getElementById('copyLink').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      showToast('Enlace copiado. Abrilo en la computadora.');
    } catch (_) {
      window.prompt('Copiá este enlace:', pageUrl);
    }
  });
  document.getElementById('sendLink').href = `https://wa.me/?text=${encodeURIComponent(`Abrí este enlace en la computadora: ${pageUrl}`)}`;
  document.getElementById('sendLink').target = '_blank';
  document.getElementById('sendLink').rel = 'noopener noreferrer';
  document.getElementById('year').textContent = new Date().getFullYear();
})();
