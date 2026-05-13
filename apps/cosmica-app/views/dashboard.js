/**
 * Vista de Dashboard
 */
export function render() {
  return `
    <div class="card glass-card">
      <div class="badge badge-cyan">📊 Módulo</div>
      <h2 class="card-title" style="margin-top: var(--space-md);">Dashboard</h2>
      <p class="card-content" style="color: var(--text-muted); margin-top: var(--space-sm);">
        Vista del panel principal del SaaS. Aquí se mostrarán los resúmenes y métricas clave.
      </p>
      <div style="margin-top: var(--space-lg);">
        <button class="btn btn-primary">Ver Métricas</button>
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-lg); margin-top: var(--space-xl);">
      <div class="card glass-card">
        <div style="font-size: var(--font-xl); color: var(--accent-cyan); font-weight: 800;">12</div>
        <div style="color: var(--text-muted); font-size: var(--font-sm); margin-top: 5px;">Trabajos Activos</div>
      </div>
      <div class="card glass-card">
        <div style="font-size: var(--font-xl); color: var(--accent-orange); font-weight: 800;">5</div>
        <div style="color: var(--text-muted); font-size: var(--font-sm); margin-top: 5px;">Pendientes</div>
      </div>
    </div>
  `;
}
