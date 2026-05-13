/**
 * Sistema ligero de notificaciones Toast para Cosmica SaaS
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
    top: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none;
  `;
  document.body.appendChild(toastContainer);

  // Inyectar estilos necesarios
  const style = document.createElement('style');
  style.textContent = `
    .toast-notification {
      min-width: 280px;
      max-width: 400px;
      padding: 12px 20px;
      border-radius: var(--radius-md);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid var(--border);
      color: var(--text-primary);
      font-size: var(--font-sm);
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: var(--shadow-lg);
      transform: translateX(120%);
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
      pointer-events: auto;
      opacity: 0;
    }
    
    .toast-notification.show {
      transform: translateX(0);
      opacity: 1;
    }
    
    .toast-success {
      background: rgba(16, 185, 129, 0.15);
      border-color: var(--success);
    }
    
    .toast-error {
      background: rgba(255, 0, 127, 0.15);
      border-color: var(--danger);
    }
    
    .toast-info {
      background: rgba(0, 229, 255, 0.15);
      border-color: var(--accent-cyan);
    }

    .toast-icon {
      font-size: 1.2em;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Muestra un mensaje toast
 * 
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo: 'success', 'error', 'info'
 * @param {number} duration - Duración en ms (default 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
  createContainer();

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${message}</span>
  `;

  toastContainer.appendChild(toast);

  // Trigger animación de entrada
  setTimeout(() => toast.classList.add('show'), 10);

  // Auto-eliminación
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode === toastContainer) {
        toastContainer.removeChild(toast);
      }
    }, 400); // Esperar a que termine la transición de salida
  }, duration);
}
