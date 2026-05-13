/**
 * Vista de Tickets / Trabajos
 */
export function render() {
  return `
    <div class="card glass-card">
      <div class="badge badge-cyan">🛠️ Módulo</div>
      <h2 class="card-title" style="margin-top: var(--space-md);">Tickets / Trabajos</h2>
      <p class="card-content" style="color: var(--text-muted); margin-top: var(--space-sm);">
        Gestión de órdenes de servicio y soporte. Aquí verás los estados de las reparaciones.
      </p>
      <div style="margin-top: var(--space-lg);">
        <button class="btn btn-primary">Nuevo Ticket</button>
      </div>
    </div>
    
    <div class="card glass-card" style="margin-top: var(--space-xl);">
      <h3 class="card-title" style="font-size: var(--font-md);">Tickets Recientes</h3>
      <p style="color: var(--text-muted); font-size: var(--font-sm); margin-top: var(--space-sm);">
        [Aquí se renderizará el listado de tickets en el futuro]
      </p>
    </div>
  `;
}
