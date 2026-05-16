/**
 * Componente para renderizar estados visuales de la aplicación
 */

/**
 * Renderiza un estado de carga genérico con skeleton
 * @returns {string} HTML
 */
export function renderLoadingState() {
  return `
    <div class="card glass-card" style="padding: var(--space-xl);">
      <div class="skeleton" style="width: 80px; height: 20px; border-radius: 12px; margin-bottom: var(--space-md);"></div>
      <div class="skeleton" style="width: 60%; height: 28px; margin-bottom: var(--space-sm);"></div>
      <div class="skeleton" style="width: 100%; height: 16px; margin-bottom: var(--space-xs);"></div>
      <div class="skeleton" style="width: 90%; height: 16px;"></div>
    </div>
  `;
}

/**
 * Renderiza skeletons para una lista de cards (Tickets o Clientes)
 * @param {number} count 
 * @returns {string} HTML
 */
export function renderCardSkeletonList(count = 3) {
  let skeletons = '';
  for (let i = 0; i < count; i++) {
    skeletons += `
      <div class="card glass-card" style="margin-bottom: var(--space-md);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-md);">
          <div style="flex: 1;">
            <div class="skeleton" style="width: 50%; height: 20px; margin-bottom: 8px;"></div>
            <div class="skeleton" style="width: 30%; height: 12px;"></div>
          </div>
          <div class="skeleton" style="width: 70px; height: 22px; border-radius: 12px;"></div>
        </div>
        <div class="skeleton" style="width: 100%; height: 14px; margin-bottom: 8px;"></div>
        <div class="skeleton" style="width: 80%; height: 14px; margin-bottom: var(--space-md);"></div>
        <div style="display: flex; gap: 8px;">
          <div class="skeleton" style="flex: 1; height: 32px; border-radius: var(--radius-sm);"></div>
          <div class="skeleton" style="width: 40px; height: 32px; border-radius: var(--radius-sm);"></div>
        </div>
      </div>
    `;
  }
  return skeletons;
}

/**
 * Renderiza skeletons para los KPIs del Dashboard
 * @returns {string} HTML
 */
export function renderKPISkeletons(count = 4) {
  return `
    <div class="render-kpi-container">
      ${Array(count).fill(`
        <div class="card glass-card kpi-card" style="border-left-color: rgba(255,255,255,0.05); pointer-events: none;">
          <div class="skeleton" style="width: 50%; height: 10px;"></div>
          <div class="skeleton" style="width: 40%; height: 32px; margin: var(--space-sm) 0;"></div>
          <div class="skeleton" style="width: 20px; height: 2px; opacity: 0.5;"></div>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Renderiza skeleton para formularios
 * @returns {string} HTML
 */
export function renderFormSkeleton() {
  return `
    <div class="card glass-card" style="padding: var(--space-xl);">
      <div class="skeleton" style="width: 150px; height: 24px; margin-bottom: var(--space-xl);"></div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-lg);">
        ${Array(4).fill(`
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div class="skeleton" style="width: 40%; height: 12px;"></div>
            <div class="skeleton" style="width: 100%; height: 40px; border-radius: 8px;"></div>
          </div>
        `).join('')}
      </div>
      <div style="margin-top: var(--space-xl); display: flex; gap: var(--space-md);">
        <div class="skeleton" style="width: 120px; height: 40px; border-radius: 8px;"></div>
        <div class="skeleton" style="width: 100px; height: 40px; border-radius: 8px;"></div>
      </div>
    </div>
  `;
}

/**
 * Renderiza un estado de error premium
 * @param {string} message 
 * @returns {string} HTML
 */
export function renderErrorState(message) {
  return `
    <div class="card glass-card" style="text-align: center; padding: var(--space-xl); border: 1px solid rgba(255, 94, 0, 0.2);">
      <div style="font-size: 48px; margin-bottom: var(--space-md);">📡</div>
      <div class="badge badge-orange">Error de Conexión</div>
      <h2 class="card-title" style="margin-top: var(--space-md); font-weight: 700;">Parece que hubo un problema</h2>
      <p style="color: var(--text-muted); margin-top: var(--space-sm); max-width: 400px; margin-left: auto; margin-right: auto;">
        ${message || 'No pudimos sincronizar los datos con el servidor en este momento.'}
      </p>
      <div style="margin-top: var(--space-lg);">
        <button class="btn btn-primary" onclick="window.location.reload()">🔄 Reintentar Ahora</button>
      </div>
    </div>
  `;
}

/**
 * Renderiza un estado vacío premium
 * @param {string} message 
 * @param {string} icon 
 * @returns {string} HTML
 */
export function renderEmptyState(message = 'No se encontraron registros.', icon = '🔭', ctaHtml = '') {
  return `
    <div class="card glass-card animate-fade-in" style="
      text-align: center; 
      padding: var(--space-2xl) var(--space-xl); 
      border: 1px dashed var(--border); 
      background: rgba(255,255,255,0.01);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-md);
    ">
      <div style="font-size: 64px; opacity: 0.15; filter: grayscale(1); line-height: 1;">${icon}</div>
      <div style="max-width: 400px;">
        <h2 style="font-size: var(--font-lg); font-weight: 800; color: var(--text-primary); letter-spacing: -0.02em; margin-bottom: 8px;">
          Búsqueda sin éxito
        </h2>
        <p style="color: var(--text-muted); line-height: 1.6; font-size: var(--font-sm); margin: 0;">
          ${message}
        </p>
      </div>
      ${ctaHtml ? `<div style="margin-top: var(--space-sm);">${ctaHtml}</div>` : ''}
      <div style="margin-top: var(--space-lg); opacity: 0.3; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; color: var(--accent-cyan);">
        Cósmica App
      </div>
    </div>
  `;
}
