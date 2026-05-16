/**
 * Sistema ligero de notificaciones Toast para Cósmica App
 */

// Contenedor global para los toasts
let toastContainer = null;

/**
 * Crea el contenedor de toasts si no existe
 */
function createContainer() {
  if (toastContainer) return;

  toastContainer = document.createElement('div');
  toastContainer.id = 'toast-container';
  toastContainer.style.cssText = `
    position: fixed;
    top: env(safe-area-inset-top, 20px);
    right: 20px;
    z-index: 10000;
    display: flex;
    flex-direction: column-reverse;
    gap: 10px;
    pointer-events: none;
    max-width: calc(100vw - 40px);
  `;
  document.body.appendChild(toastContainer);

  // Inyectar estilos necesarios
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 600px) {
      #toast-container {
        right: 10px;
        left: 10px;
        top: auto;
        bottom: 20px;
        flex-direction: column;
      }
    }
    
    .toast-notification {
      min-width: 280px;
      padding: 14px 20px;
      border-radius: var(--radius-lg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      color: var(--text-primary);
      font-size: var(--font-sm);
      display: flex;
      align-items: center;
      gap: 14px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.4);
      transform: translateY(20px) scale(0.95);
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: auto;
      opacity: 0;
    }
    
    .toast-notification.show {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
    
    .toast-success { background: rgba(16, 185, 129, 0.95); border-color: #10b981; color: #fff; }
    .toast-error   { background: rgba(239, 68, 68, 0.95);  border-color: #ef4444; color: #fff; }
    .toast-info    { background: rgba(0, 229, 255, 0.95); border-color: #00e5ff; color: #000; }
    .toast-warning { background: rgba(245, 158, 11, 0.95); border-color: #f59e0b; color: #000; }

    .toast-icon { font-size: 1.3em; flex-shrink: 0; }
    .toast-message { flex: 1; font-weight: 600; }
    .toast-action-btn {
      flex-shrink: 0;
      background: rgba(255,255,255,0.25);
      border: 1px solid rgba(255,255,255,0.4);
      border-radius: 6px;
      color: inherit;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 10px;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s;
    }
    .toast-action-btn:hover { background: rgba(255,255,255,0.4); }
  `;
  document.head.appendChild(style);
}

/**
 * Muestra un mensaje toast
 */
export function showToast(message, type = 'info', duration = 3500) {
  createContainer();

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  
  const iconMap = {
    success: '✅',
    error:   '🚨',
    info:    '✨',
    warning: '⚠️'
  };
  
  toast.innerHTML = `
    <span class="toast-icon">${iconMap[type] || 'ℹ️'}</span>
    <span class="toast-message">${message}</span>
  `;

  toastContainer.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode === toastContainer) toastContainer.removeChild(toast);
    }, 400);
  }, duration);
}
// Expose for usage outside component scope
if (typeof window !== 'undefined') window.__cosmicaShowToast = showToast;

/**
 * Muestra un toast con un botón de acción inline (usado por el mecanismo de undo).
 * El botón llama a onAction() y cierra el toast inmediatamente.
 *
 * @param {string}   message      Texto del toast
 * @param {string}   actionLabel  Etiqueta del botón (ej. 'Deshacer')
 * @param {Function} onAction     Callback invocado al hacer clic en el botón
 * @param {number}   duration     Duración en ms antes de auto-cerrar (default: 5000)
 */
export function showActionToast(message, actionLabel, onAction, duration = 5000) {
  createContainer();

  const toast = document.createElement('div');
  toast.className = 'toast-notification toast-info';

  toast.innerHTML = `
    <span class="toast-icon">↩️</span>
    <span class="toast-message">${message}</span>
    <button class="toast-action-btn">${actionLabel}</button>
  `;

  const dismiss = () => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode === toastContainer) toastContainer.removeChild(toast);
    }, 400);
  };

  toast.querySelector('.toast-action-btn').addEventListener('click', () => {
    dismiss();
    try { onAction(); } catch (e) { console.error('[toast] showActionToast onAction error:', e); }
  });

  toastContainer.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);

  const timerId = setTimeout(dismiss, duration);

  // Allow external cancellation via the returned dismiss function
  return () => { clearTimeout(timerId); dismiss(); };
}
