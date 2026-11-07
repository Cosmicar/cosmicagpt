(() => {
  const totalSteps = 3;
  const storageKey = 'cosmica_assistance_remotto_progress_v1';
  const pageUrl = 'https://cosmica.ar/asistencia.html';
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

  // Confirmaciones de guía, nunca detección ni control de una sesión remota.
  const confirmations = [['codeConfirmed', 1], ['openedButton', 2], ['readyConfirmed', 3]];
  confirmations.forEach(([id, step]) => {
    const button = document.getElementById(id);
    if (button) button.addEventListener('click', () => {
      completeStep(step);
      button.setAttribute('aria-pressed', 'true');
      showToast('Paso confirmado. La guía no comprueba el estado de la conexión.');
    });
    if (button) button.setAttribute('aria-pressed', String(completed.has(step)));
  });

  const download = document.getElementById('downloadRemotto');
  if (download) download.addEventListener('click', () => {
    showToast('En el sitio oficial, elegí Remotto Connect para el cliente.');
  });

  const reset = document.getElementById('resetGuide');
  if (reset) reset.addEventListener('click', () => {
    completed.clear();
    confirmations.forEach(([id]) => document.getElementById(id)?.setAttribute('aria-pressed', 'false'));
    renderProgress();
    persistProgress();
    showToast('Guía reiniciada. Empezá nuevamente desde el paso 1.');
  });

  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
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
