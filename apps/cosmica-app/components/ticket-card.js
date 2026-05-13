/**
 * Componente para renderizar una card de ticket
 * 
 * @param {Object} ticket 
 * @returns {string} HTML
 */
export function render(ticket) {
  let badgeClass = 'badge-cyan';
  const estado = ticket.estado || 'Ingresado';
  
  if (estado === 'En reparación') badgeClass = 'badge-orange';
  // En el futuro se pueden agregar más mapeos de colores
  
  const fecha = ticket.fechaIngreso ? new Date(ticket.fechaIngreso).toLocaleDateString() : 'N/A';
  const prioridad = ticket.planServicio || 'Estándar';

  return `
    <div class="card glass-card">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h3 class="card-title" style="font-size: var(--font-md);">${ticket.nombre || 'Sin Nombre'} ${ticket.apellido || ''}</h3>
          <div style="font-size: var(--font-xs); color: var(--text-muted); margin-top: 2px;">Orden: ${ticket.numeroOrden || 'N/A'}</div>
        </div>
        <div class="badge ${badgeClass}">${estado}</div>
      </div>
      
      <p style="color: var(--text-muted); font-size: var(--font-sm); margin-top: var(--space-md);">
        <strong>Equipo:</strong> ${ticket.equipo || 'N/A'} ${ticket.marca || ''}<br>
        <strong>Fecha:</strong> ${fecha}<br>
        <strong>Prioridad/Plan:</strong> <span style="text-transform: capitalize;">${prioridad}</span>
      </p>
      
      <div style="margin-top: var(--space-md); border-top: 1px solid var(--border); padding-top: var(--space-sm); font-size: var(--font-sm); color: var(--text-muted);">
        <strong>Problema:</strong> ${ticket.problema || 'No especificado'}
      </div>
    </div>
  `;
}
