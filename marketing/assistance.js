(() => {
  const totalSteps = 3;
  const storageKey = 'cosmica_assistance_progress';
  const pageUrl = 'https://cosmica.ar/asistencia.html';
  const supportWhatsApp = '5493883298736';
  const completed = new Set();
  const progressBar = document.getElementById('progressBar');
  const progressTrack = document.getElementById('progressTrack');
  const progressLabel = document.getElementById('progressLabel');
  const toast = document.getElementById('toast');

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 3400);
  }
  function renderProgress() {
    document.querySelectorAll('[data-step]').forEach(card => {
      const step = Number(card.dataset.step);
      const done = completed.has(step);
      card.classList.toggle('completed', done);
      const value = card.querySelector('.number-value');
      if (value) value.textContent = done ? '✓' : String(step);
      const confirmation = card.querySelector('.step-complete');
      if (confirmation) {
        confirmation.setAttribute('aria-pressed', String(done));
        confirmation.textContent = done ? 'Descarga confirmada ✓' : 'Ya lo descargué ✓';
      }
    });
    if (progressBar) progressBar.style.width = String(completed.size / totalSteps * 100) + '%';
    if (progressLabel) progressLabel.textContent = String(completed.size) + ' de ' + String(totalSteps) + ' pasos';
    if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(completed.size));
  }
  function persistProgress() {
    try { localStorage.setItem(storageKey, JSON.stringify([...completed])); }
    catch (_) { /* La guía funciona incluso si el almacenamiento está bloqueado. */ }
  }
  function completeStep(step) {
    if (![1, 2, 3].includes(step) || completed.has(step)) return;
    completed.add(step);
    renderProgress();
    persistProgress();
  }

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) saved.forEach(value => {
      if (Number.isInteger(value) && value >= 1 && value <= totalSteps) completed.add(value);
    });
  } catch (_) { /* Ignorar estados corruptos. */ }
  renderProgress();

  const download = document.getElementById('downloadAnydesk');
  if (download) download.addEventListener('click', () => {
    showToast('Se abrió el sitio oficial de AnyDesk. Confirmá el paso cuando termine la descarga.');
  });
  const downloaded = document.getElementById('downloadConfirmed');
  if (downloaded) downloaded.addEventListener('click', () => {
    completeStep(1);
    showToast('Perfecto. Ahora abrí el archivo descargado.');
  });
  const opened = document.getElementById('openedButton');
  if (opened) opened.addEventListener('click', () => {
    completeStep(2);
    showToast('Ahora buscá el número de identificación en AnyDesk.');
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelector('[data-step="3"]')?.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth', block: 'nearest'
    });
  });

  const idInput = document.getElementById('supportId');
  const idFeedback = document.getElementById('idFeedback');
  const sendId = document.getElementById('sendId');
  if (idInput) idInput.addEventListener('input', () => {
    idInput.removeAttribute('aria-invalid');
    if (idFeedback) idFeedback.textContent = '';
  });
  if (sendId) sendId.addEventListener('click', event => {
    const raw = idInput?.value.trim() || '';
    const digits = raw.replace(/[\s.-]/g, '');
    // El ID es opcional: también puede ingresarse manualmente en WhatsApp.
    if (raw && (!/^[\d\s.-]+$/.test(raw) || digits.length < 6 || digits.length > 12)) {
      event.preventDefault();
      if (idInput) {
        idInput.setAttribute('aria-invalid', 'true');
        idInput.focus();
      }
      if (idFeedback) idFeedback.textContent = 'Revisá el ID: usá entre 6 y 12 dígitos, sin letras.';
      return;
    }
    const message = digits
      ? 'Hola, ya abrí AnyDesk para recibir asistencia de Cósmica. Mi ID es: ' + digits + '.'
      : 'Hola, ya abrí AnyDesk y necesito ayuda para continuar. Mi ID es: ';
    sendId.href = 'https://wa.me/' + supportWhatsApp + '?text=' + encodeURIComponent(message);
    completeStep(3);
    showToast('Se abrió WhatsApp. Revisá y enviá el mensaje para contactar al técnico.');
  });

  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const mobileAlert = document.getElementById('mobileAlert');
  if (mobile && mobileAlert) mobileAlert.hidden = false;
  const copyLink = document.getElementById('copyLink');
  if (copyLink) copyLink.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      showToast('Enlace copiado. Abrilo en la computadora que necesita asistencia.');
    } catch (_) { window.prompt('Copiá este enlace para abrirlo desde la computadora:', pageUrl); }
  });
  const sendLink = document.getElementById('sendLink');
  if (sendLink) sendLink.href = 'https://wa.me/?text=' + encodeURIComponent('Abrí esta guía de Cósmica desde la computadora: ' + pageUrl);
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
