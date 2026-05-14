import { WORK_STATUS } from '../../../js/domain.js';
import { canAccess } from '../core/session.js';
import { isOverdue, isHighValue, needsApprovalCTA } from '../services/tickets.js';

/**
 * Componente para renderizar una card de ticket
 * 
 * @param {Object} ticket 
 * @returns {string} HTML
 */
export function render(ticket, selected = false) {
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

  const canEdit = canAccess('edit-ticket');
  const overdue   = isOverdue(ticket);
  const highValue = isHighValue(ticket);
  const showCTA   = needsApprovalCTA(ticket) && canEdit;

  return `
    <div class="card glass-card${selected ? ' ticket-selected' : ''}" id="ticket-card-${ticket.id}" data-ticket-id="${ticket.id}" style="display: flex; flex-direction: column; cursor: pointer;">
      <div class="flex-between" style="align-items: flex-start; margin-bottom: var(--space-sm);">
        <input type="checkbox" class="ticket-checkbox" data-id="${ticket.id}" ${selected ? 'checked' : ''}>
        <div style="flex: 1; min-width: 0;">
          <h3 class="card-title text-truncate" title="${ticket.nombre || ''} ${ticket.apellido || ''}" style="font-size: var(--font-md); margin: 0;">
            ${ticket.nombre || 'Sin Nombre'} ${ticket.apellido || ''}
          </h3>
          <div style="font-size: var(--font-xs); color: var(--text-muted); margin-top: 2px;">#${ticket.numeroOrden || 'N/A'}</div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
          <div class="badge ${badgeClass}" id="badge-${ticket.id}">${estado}</div>
          ${overdue   ? '<div class="badge badge-orange rule-badge">⚠ DEMORADO</div>'  : ''}
          ${highValue ? '<div class="badge badge-gold rule-badge">💎 ALTO VALOR</div>' : ''}
        </div>
      </div>
      
      <div style="flex: 1;">
        <p class="vm-meta" style="color: var(--text-muted); font-size: var(--font-sm); margin-bottom: var(--space-md);">
          <strong style="color: var(--text-primary);">Equipo:</strong> ${ticket.equipo || 'N/A'} ${ticket.marca || ''}<br>
          <strong style="color: var(--text-primary);">Fecha:</strong> ${fecha}<br>
          <strong style="color: var(--text-primary);">Prioridad:</strong> <span style="text-transform: capitalize;">${prioridad}</span>
        </p>

        <div class="vm-problema" style="border-top: 1px solid var(--border); padding-top: var(--space-sm); font-size: var(--font-sm); color: var(--text-muted); min-height: 3em;">
          <strong style="color: var(--text-primary);">Problema:</strong>
          <span class="vm-problema-text">${ticket.problema || 'No especificado'}</span>
        </div>
      </div>

      ${showCTA ? `
      <div class="quick-repair-wrap" style="margin-top: var(--space-sm);">
        <button class="btn btn-sm btn-primary quick-repair-btn" data-id="${ticket.id}" style="width: 100%; font-size: var(--font-xs);">
          🔧 Pasar a Reparación
        </button>
      </div>
      ` : ''}

      ${canEdit ? `
      <div style="margin-top: var(--space-md); border-top: 1px solid var(--border); padding-top: var(--space-sm); display: flex; align-items: center; gap: var(--space-sm); position: relative; z-index: 10; overflow: visible;">
        <select class="status-selector" data-id="${ticket.id}" style="flex: 1; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); font-size: var(--font-xs); padding: 6px; outline: none;">
          ${statusOptions.map(opt => `<option value="${opt}" ${estado === opt ? 'selected' : ''}>${opt}</option>`).join('')}
        </select>
        <a href="#ticket-edit?id=${ticket.id}" class="btn btn-sm btn-secondary" style="padding: 6px 10px;">
          <i>📝</i>
        </a>
      </div>
      ` : ''}
    </div>
  `;
}
