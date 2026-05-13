/**
 * Componente Breadcrumb para navegación contextual
 * Proporciona una jerarquía visual simple para mejorar la ubicación del usuario.
 * 
 * @param {Array} items - Lista de objetos { label, href, icon }
 * @returns {string} HTML del breadcrumb
 */
export function renderBreadcrumb(items = []) {
  if (items.length === 0) return '';

  const styleHtml = `
    <style>
      .breadcrumb-list a {
        color: var(--text-muted);
        text-decoration: none;
        transition: var(--transition-fast);
      }
      .breadcrumb-list a:hover {
        color: var(--accent-cyan);
        text-shadow: 0 0 8px var(--accent-cyan-glow);
      }
      .breadcrumb-separator {
        margin: 0 var(--space-md);
        color: var(--text-muted);
        opacity: 0.3;
        font-weight: 300;
      }
      @media (max-width: 768px) {
        .breadcrumb-separator {
          margin: 0 var(--space-sm);
        }
      }
    </style>
  `;

  const breadcrumbItems = items.map((item, index) => {
    const isLast = index === items.length - 1;
    const iconHtml = item.icon ? `<span style="margin-right: var(--space-xs); font-size: 1.1em; display: flex; align-items: center;">${item.icon}</span>` : '';
    
    if (isLast) {
      return `
        <li style="display: flex; align-items: center; color: var(--text-primary); font-weight: 600;" class="breadcrumb-item active">
          ${iconHtml}
          <span>${item.label}</span>
        </li>
      `;
    }

    return `
      <li style="display: flex; align-items: center;" class="breadcrumb-item">
        <a href="${item.href}" style="display: flex; align-items: center;">
          ${iconHtml}
          <span>${item.label}</span>
        </a>
        <span class="breadcrumb-separator">/</span>
      </li>
    `;
  }).join('');

  return `
    ${styleHtml}
    <nav aria-label="Breadcrumb" style="margin-bottom: var(--space-lg); padding: var(--space-xs) 0;">
      <ul class="breadcrumb-list" style="list-style: none; padding: 0; margin: 0; display: flex; align-items: center; font-size: var(--font-sm); flex-wrap: wrap; gap: var(--space-xs) 0;">
        <li style="display: flex; align-items: center;">
          <a href="#dashboard" style="display: flex; align-items: center;">
            <span style="margin-right: var(--space-xs); opacity: 0.7;">🏠</span>
          </a>
          <span class="breadcrumb-separator">/</span>
        </li>
        ${breadcrumbItems}
      </ul>
    </nav>
  `;
}
