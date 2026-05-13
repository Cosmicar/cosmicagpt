/**
 * Componente para renderizar el encabezado de una sección
 * 
 * @param {string} title 
 * @param {string} description 
 * @param {string} badgeText (Opcional)
 * @returns {string} HTML
 */
export function render(title, description, badgeText = '') {
  return `
    <div class="card glass-card">
      ${badgeText ? `<div class="badge badge-cyan">${badgeText}</div>` : ''}
      <h2 class="card-title" style="margin-top: var(--space-md);">${title}</h2>
      <p style="color: var(--text-muted); margin-top: var(--space-sm);">${description}</p>
    </div>
  `;
}
