/**
 * Componente para renderizar estados visuales de la aplicación
 */

/**
 * Renderiza un estado de carga
 * @returns {string} HTML
 */
export function renderLoadingState() {
  return `
    <div class="card glass-card" style="text-align: center; padding: var(--space-xl);">
      <div class="badge badge-cyan">Cargando</div>
      <h2 class="card-title" style="margin-top: var(--space-md);">Cargando aplicación...</h2>
      <p style="color: var(--text-muted); margin-top: var(--space-sm);">Por favor espera mientras verificamos tus credenciales.</p>
    </div>
  `;
}

/**
 * Renderiza un estado de error
 * @param {string} message 
 * @returns {string} HTML
 */
export function renderErrorState(message) {
  return `
    <div class="card glass-card" style="text-align: center; padding: var(--space-xl); border-color: var(--accent-orange);">
      <div class="badge badge-orange">Error</div>
      <h2 class="card-title" style="margin-top: var(--space-md);">Algo salió mal</h2>
      <p style="color: var(--text-muted); margin-top: var(--space-sm);">${message}</p>
      <div style="margin-top: var(--space-lg);">
        <button class="btn btn-primary" onclick="window.location.reload()">Reintentar</button>
      </div>
    </div>
  `;
}

/**
 * Renderiza un estado vacío (no hay datos)
 * @param {string} message 
 * @returns {string} HTML
 */
export function renderEmptyState(message) {
  return `
    <div class="card glass-card" style="text-align: center; padding: var(--space-xl);">
      <div class="badge badge-cyan">Vacío</div>
      <h2 class="card-title" style="margin-top: var(--space-md);">No hay datos</h2>
      <p style="color: var(--text-muted); margin-top: var(--space-sm);">${message}</p>
    </div>
  `;
}
