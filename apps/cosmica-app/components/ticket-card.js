import { WORK_STATUS } from '../../../js/domain.js';

/**
 * Componente para renderizar una card de ticket
 * 
 * @param {Object} ticket 
 * @returns {string} HTML
 */
export function render(ticket) {
  let badgeClass = 'badge-cyan';
  const estado = ticket.estado || WORK_STATUS.ingresado;
  
  if (estado === WORK_STATUS.enReparacion) badgeClass = 'badge-orange';
  if (estado === WORK_STATUS.listo) badgeClass = 'badge-green';
  if (estado === WORK_STATUS.entregado) badgeClass = 'badge-gray';
  
  const fecha = ticket.fechaIngreso ? new Date(ticket.fechaIngreso).toLocaleDateString() : 'N/A';
  const prioridad = ticket.planServicio || 'Estándar';

  const statusOptions = [
    WORK_STATUS.ingresado,
    WORK_STATUS.enReparacion,
    WORK_STATUS.listo,
    WORK_STATUS.entregado
  ];

  return `
    <div class="card glass-card" id="ticket-card-${ticket.id}">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h3 class="card-title" style="font-size: var(--font-md);">${ticket.nombre || 'Sin Nombre'} ${ticket.apellido || ''}</h3>
          <div style="font-size: var(--font-xs); color: var(--text-muted); margin-top: 2px;">Orden: ${ticket.numeroOrden || 'N/A'}</div>
        </div>
        <div class="badge ${badgeClass}" id="badge-${ticket.id}">${estado}</div>
      </div>
      
      <p style="color: var(--text-muted); font-size: var(--font-sm); margin-top: var(--space-md);">
        <strong>Equipo:</strong> ${ticket.equipo || 'N/A'} ${ticket.marca || ''}<br>
        <strong>Fecha:</strong> ${fecha}<br>
        <strong>Prioridad/Plan:</strong> <span style="text-transform: capitalize;">${prioridad}</span>
      </p>
      
      <div style="margin-top: var(--space-md); border-top: 1px solid var(--border); padding-top: var(--space-sm); font-size: var(--font-sm); color: var(--text-muted);">
        <strong>Problema:</strong> ${ticket.problema || 'No especificado'}
      </div>

      <div style="margin-top: var(--space-md); display: flex; align-items: center; gap: var(--space-sm);">
        <label style="font-size: 10px; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Estado:</label>
        <select class="status-selector" data-id="${ticket.id}" style="flex: 1; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); font-size: var(--font-xs); padding: 4px; outline: none;">
          ${statusOptions.map(opt => `<option value="${opt}" ${estado === opt ? 'selected' : ''}>${opt}</option>`).join('')}
        </select>
      </div>
    </div>
  `;
}
