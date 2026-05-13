/**
 * Vista de Clientes
 */
export function render() {
  return `
    <div class="card glass-card">
      <div class="badge badge-cyan">👥 Módulo</div>
      <h2 class="card-title" style="margin-top: var(--space-md);">Clientes</h2>
      <p class="card-content" style="color: var(--text-muted); margin-top: var(--space-sm);">
        Gestión y listado de clientes. Aquí podrás buscar, añadir y editar información de clientes.
      </p>
      <div style="margin-top: var(--space-lg);">
        <button class="btn btn-primary">Añadir Cliente</button>
      </div>
    </div>
    
    <div class="card glass-card" style="margin-top: var(--space-xl);">
      <h3 class="card-title" style="font-size: var(--font-md);">Lista de Clientes</h3>
      <p style="color: var(--text-muted); font-size: var(--font-sm); margin-top: var(--space-sm);">
        [Aquí se renderizará la tabla de clientes en el futuro]
      </p>
    </div>
  `;
}
