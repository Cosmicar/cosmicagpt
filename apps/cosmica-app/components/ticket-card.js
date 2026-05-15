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

  const getMetodoPagoBadge = (metodo) => {
    const m = String(metodo || '').toLowerCase();
    if (m === 'efectivo') return { class: 'badge-green', label: '💵 EFVO' };
    if (m === 'transferencia') return { class: 'badge-blue', label: '🏦 TRANS' };
    if (m === 'mercadopago') return { class: 'badge-cyan', label: '📱 MP' };
    if (m === 'debito') return { class: 'badge-violet', label: '💳 DEB' };
    if (m === 'credito') return { class: 'badge-orange', label: '💳 CRED' };
    return null;
  };

  const metodoBadge = getMetodoPagoBadge(ticket.metodoPago);
  
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

  // Aging visual
  let agingBadge = '';
  if (ticket.fechaIngreso && estado !== WORK_STATUS.entregado && estado !== WORK_STATUS.listo) {
    const days = Math.floor((Date.now() - new Date(ticket.fechaIngreso).getTime()) / (1000 * 60 * 60 * 24));
    if (days >= 30) {
      agingBadge = '<div class="badge badge-danger" style="white-space: nowrap; font-size: 10px;">🔴 +30 DÍAS</div>';
    } else if (days >= 15) {
      agingBadge = '<div class="badge badge-orange" style="white-space: nowrap; font-size: 10px;">🟠 +15 DÍAS</div>';
    } else if (days >= 7) {
      agingBadge = '<div class="badge" style="white-space: nowrap; font-size: 10px; background: rgba(234, 179, 8, 0.2); color: #fde047; border: 1px solid rgba(234, 179, 8, 0.4);">🟡 +7 DÍAS</div>';
    }
  }

  return `
    <div class="card glass-card${selected ? ' ticket-selected' : ''}" id="ticket-card-${ticket.id}" data-ticket-id="${ticket.id}" style="display: flex; flex-direction: column; cursor: pointer;">
      <div class="flex-between" style="align-items: flex-start; margin-bottom: var(--space-sm);">
        <input type="checkbox" class="ticket-checkbox" data-id="${ticket.id}" ${selected ? 'checked' : ''}>
        <div style="flex: 1; min-width: 0; padding: 0 8px;">
          <h3 class="card-title text-truncate" title="${ticket.nombre || ''} ${ticket.apellido || ''}" style="font-size: var(--font-md); margin: 0;">
            ${ticket.nombre || 'Sin Nombre'} ${ticket.apellido || ''}
          </h3>
          <div style="font-size: var(--font-xs); color: var(--text-muted); margin-top: 2px;">#${ticket.numeroOrden || 'N/A'}</div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; min-width: 80px;">
          <div class="badge ${badgeClass}" id="badge-${ticket.id}" style="font-size: 10px;">${estado}</div>
          ${ticket.reentryRisk ? `<div class="badge ${ticket.reentryRisk.class}" style="white-space: nowrap; font-size: 10px;">${ticket.reentryRisk.label}</div>` : ''}
          ${ticket.clientBadge ? `<div class="badge ${ticket.clientBadge.class}" style="white-space: nowrap; font-size: 10px;">${ticket.clientBadge.label}</div>` : ''}
          ${metodoBadge ? `<div class="badge ${metodoBadge.class}" style="white-space: nowrap; font-size: 10px;">${metodoBadge.label}</div>` : ''}
          ${overdue   ? '<div class="badge badge-orange rule-badge" style="white-space: nowrap; font-size: 10px;">⚠ DEMORADO</div>'  : ''}
          ${agingBadge}
          ${highValue ? '<div class="badge badge-gold rule-badge" style="white-space: nowrap; font-size: 10px;">💎 ALTO VALOR</div>' : ''}
          ${ticket.tecnicoAsignadoId ? `<div class="badge badge-blue" style="white-space: nowrap; font-size: 10px; background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.4); color: #93c5fd;">👨‍🔧 ${ticket.tecnicoAsignadoNombre || 'Asignado'}</div>` : ''}
          ${ticket.isOverloaded ? '<div class="badge badge-danger" style="white-space: nowrap; font-size: 10px; animation: pulse 2s infinite;">🔥 SOBRECARGADO</div>' : ''}
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
      
      <div style="margin-top: var(--space-md); border-top: 1px solid var(--border); padding-top: var(--space-sm); display: flex; align-items: center; gap: var(--space-sm); position: relative; z-index: 10; overflow: visible;">
        <div style="display: flex; gap: 4px; flex: 1;">
          ${!ticket.tecnicoAsignadoId && canEdit && estado !== WORK_STATUS.entregado ? `
            <button class="btn btn-sm btn-primary quick-tomar-btn" data-id="${ticket.id}" title="Tomar Ticket" style="padding: 6px 8px; flex: 1; font-size: 10px; font-weight: 700; background: var(--accent-blue); color: #fff;">
              🙋 TOMAR
            </button>
          ` : ''}
          ${canEdit && estado === WORK_STATUS.listo ? `
            <button class="btn btn-sm btn-success quick-entregar-btn" data-id="${ticket.id}" title="Cobrar y Finalizar" style="padding: 6px 8px; flex: 1; font-size: 10px; font-weight: 700;">
              💵 COBRAR
            </button>
          ` : ''}
          ${canEdit && (estado === WORK_STATUS.ingresado || estado === WORK_STATUS.enReparacion) ? `
            <button class="btn btn-sm btn-primary quick-listo-btn" data-id="${ticket.id}" title="Marcar como Listo" style="padding: 6px 8px; flex: 1; font-size: 10px; font-weight: 700;">
              ✅ LISTO
            </button>
          ` : ''}
          ${estado === WORK_STATUS.entregado ? `
            <button class="btn btn-sm btn-secondary reingreso-btn" data-id="${ticket.id}" title="Generar Reingreso" style="padding: 6px 8px; flex: 1; font-size: 10px; background: rgba(0, 229, 255, 0.1); color: var(--accent-cyan);">
              ♻️ REINGRESO
            </button>
          ` : ''}
          <button class="btn btn-sm btn-secondary ticket-print-btn" data-id="${ticket.id}" style="padding: 6px 10px;" title="Imprimir orden">🖨</button>
          ${canEdit ? `<a href="#ticket-edit?id=${ticket.id}" class="btn btn-sm btn-secondary" style="padding: 6px 10px;" title="Editar">📝</a>` : ''}
        </div>
      </div>
    </div>
  `;
}
