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
export function renderKPISkeletons() {
  return `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md); margin-bottom: var(--space-xl);">
      ${Array(4).fill(`
        <div class="card glass-card" style="height: 120px; display: flex; flex-direction: column; justify-content: center; gap: 12px; border-left: 4px solid rgba(255,255,255,0.05);">
          <div style="display: flex; justify-content: space-between;">
            <div class="skeleton" style="width: 60px; height: 10px;"></div>
            <div class="skeleton" style="width: 20px; height: 20px; border-radius: 50%;"></div>
          </div>
          <div class="skeleton" style="width: 40px; height: 36px;"></div>
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
export function renderEmptyState(message = 'No se encontraron registros.', icon = '🔭') {
  return `
    <div class="card glass-card animate-fade-in" style="text-align: center; padding: var(--space-2xl) var(--space-xl); border: 1px dashed var(--border); background: rgba(255,255,255,0.01);">
      <div style="font-size: 64px; margin-bottom: var(--space-md); filter: grayscale(1); opacity: 0.3;">${icon}</div>
      <h2 style="font-size: var(--font-lg); font-weight: 800; color: var(--text-primary); letter-spacing: -0.02em;">Búsqueda sin éxito</h2>
      <p style="color: var(--text-muted); margin-top: var(--space-sm); max-width: 320px; margin-left: auto; margin-right: auto; line-height: 1.6; font-size: var(--font-sm);">
        ${message}
      </p>
      <div style="margin-top: var(--space-xl); opacity: 0.5; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--accent-cyan);">
        Cósmica App
      </div>
    </div>
  `;
}
