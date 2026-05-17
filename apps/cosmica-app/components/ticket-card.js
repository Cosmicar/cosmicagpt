import { WORK_STATUS } from '../../../js/domain.js';
import { canAccess } from '../core/session.js';
import { isOverdue, isHighValue, hasBudgetApproved } from '../services/tickets.js';
import { getAgingBadge } from '../core/intelligence.js';

/**
 * Componente para renderizar una card de ticket
 * 
 * @param {Object} ticket 
 * @returns {string} HTML
 */
export function render(ticket, selected = false) {
  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    return renderMobile(ticket, selected);
  }

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
  const prioridad = ticket.planServicio || 'estándar';
  
  const canEdit = canAccess('edit-ticket');
  const overdue   = isOverdue(ticket);
  const highValue = isHighValue(ticket);
  const showCTA   = hasBudgetApproved(ticket) && canEdit;

  const agingBadge = getAgingBadge(ticket);

  // Opacity for "Entregado" to de-emphasize
  const isEntregado = estado === WORK_STATUS.entregado;
  const rowOpacity = isEntregado ? '0.6' : '1';
  const bgHighlight = selected ? 'rgba(255,255,255,0.04)' : 'rgba(8, 15, 28, 0.4)';
  const borderColor = selected ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.04)';

  // Primary Action Logic
  let primaryActionHtml = '';
  let dropdownActions = '';

  if (canEdit) {
    if (!ticket.tecnicoAsignadoId && estado !== WORK_STATUS.entregado) {
      primaryActionHtml = `<button class="btn btn-sm btn-primary quick-tomar-btn" data-id="${ticket.id}" style="background:var(--accent-blue); padding: 6px 12px; font-weight: 700; height: 32px;">🙋 Tomar Orden</button>`;
    } else if (estado === WORK_STATUS.listo) {
      primaryActionHtml = `<button class="btn btn-sm btn-success quick-entregar-btn" data-id="${ticket.id}" style="padding: 6px 12px; font-weight: 700; height: 32px;">💵 Cobrar</button>`;
    } else if (estado === WORK_STATUS.ingresado || estado === WORK_STATUS.enReparacion) {
      // If needs budget approval and in repair -> "Listo" ? Wait, if showCTA is true it means budget approved.
      // Usually the user wants "Listo" for En Reparacion.
      if (estado === WORK_STATUS.enReparacion) {
        primaryActionHtml = `<button class="btn btn-sm btn-primary quick-listo-btn" data-id="${ticket.id}" style="padding: 6px 12px; font-weight: 700; height: 32px;">✅ Listo</button>`;
      } else if (showCTA) {
        primaryActionHtml = `<button class="btn btn-sm btn-primary quick-repair-btn" data-id="${ticket.id}" style="padding: 6px 12px; font-weight: 700; height: 32px;">🔧 Reparar</button>`;
      } else {
        primaryActionHtml = `<button class="btn btn-sm btn-secondary quick-listo-btn" data-id="${ticket.id}" style="padding: 6px 12px; font-weight: 700; height: 32px; border-color: var(--accent-cyan); color: var(--accent-cyan);">✅ Listo</button>`;
      }
    } else if (estado === WORK_STATUS.entregado) {
      primaryActionHtml = `<button class="btn btn-sm btn-secondary reingreso-btn" data-id="${ticket.id}" style="padding: 6px 12px; font-weight: 700; height: 32px;">♻️ Reingreso</button>`;
    }
  }

  // Secondary actions in dropdown
  dropdownActions += `<button class="btn btn-sm ticket-print-btn" data-id="${ticket.id}">🖨 Imprimir Orden</button>`;
  if (canEdit) {
    dropdownActions += `<a href="#ticket-edit?id=${ticket.id}" class="btn btn-sm" style="text-decoration:none;">📝 Editar Ticket</a>`;
  }
  if (ticket.telefono) {
    dropdownActions += `<button class="btn btn-sm ticket-whatsapp-btn" data-id="${ticket.id}" style="color:#25D366;">📲 Contactar WhatsApp</button>`;
  }

  // Column sizes:
  // Col 1: ID, Client, Equipo (flex: 2)
  // Col 2: Status, Aging (flex: 1)
  // Col 3: Technician, Meta (flex: 1)
  // Col 4: Actions (fixed)

  return `
    <div class="card glass-card${selected ? ' ticket-selected' : ''}" id="ticket-card-${ticket.id}" data-ticket-id="${ticket.id}"
      style="display: flex; align-items: center; padding: 12px 16px; margin-bottom: 8px; border-radius: var(--radius-md); background: ${bgHighlight}; border: 1px solid ${borderColor}; opacity: ${rowOpacity}; cursor: pointer; transition: all 0.2s ease; overflow: visible;">
      
      <!-- Checkbox -->
      <div style="margin-right: 16px; display: flex; align-items: center;">
        <input type="checkbox" class="ticket-checkbox" data-id="${ticket.id}" ${selected ? 'checked' : ''} style="width: 16px; height: 16px; margin: 0; cursor: pointer;">
      </div>

      <!-- Column 1: Client & Equipment -->
      <div style="flex: 2; min-width: 0; padding-right: 16px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-size: 11px; color: var(--accent-cyan); font-weight: 800; letter-spacing: 0.05em;">#${ticket.numeroOrden || '—'}</span>
          <span class="text-truncate" style="font-size: 14px; font-weight: 700; color: var(--text-primary);">
            ${ticket.nombre || 'Sin Nombre'} ${ticket.apellido || ''}
          </span>
          ${highValue ? '<span title="Alto Valor">💎</span>' : ''}
          ${overdue ? '<span title="Demorado">⚠️</span>' : ''}
        </div>
        <div class="text-truncate" style="font-size: 12px; color: var(--text-muted); font-weight: 500;">
          ${ticket.equipo || '—'} ${ticket.marca || ''} <span style="opacity:0.5; margin: 0 4px;">·</span> ${prioridad}
        </div>
      </div>

      <!-- Column 2: Status & Aging -->
      <div style="flex: 1; min-width: 0; padding-right: 16px; display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
        <div class="badge ${badgeClass}" id="badge-${ticket.id}" style="font-size: 10px; text-transform: uppercase;">${estado}</div>
        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
          ${agingBadge}
          ${ticket.isOverloaded ? '<div class="badge badge-danger" style="font-size:10px; animation:pulse 2s infinite;">🔥 CARGADO</div>' : ''}
        </div>
      </div>

      <!-- Column 3: Technician & Payment -->
      <div style="flex: 1; min-width: 0; padding-right: 16px; display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
        <div style="font-size: 12px; color: var(--text-primary); font-weight: 600; display: flex; align-items: center; gap: 4px;">
          <span style="opacity:0.7;">👨‍🔧</span> ${ticket.tecnicoAsignadoNombre ? ticket.tecnicoAsignadoNombre.split(' ')[0] : '<span style="color:var(--text-muted);">Sin asignar</span>'}
        </div>
        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
          ${metodoBadge ? `<div class="badge ${metodoBadge.class}" style="font-size:10px;">${metodoBadge.label}</div>` : ''}
        </div>
      </div>

      <!-- Column 4: Actions -->
      <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;" onclick="event.stopPropagation()">
        ${primaryActionHtml}
        
        <div class="ticket-dropdown-wrapper">
          <button class="btn btn-sm btn-secondary" style="padding: 6px 10px; height: 32px; font-weight: 800; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">⋯</button>
          <div class="ticket-dropdown-content">
            ${dropdownActions}
          </div>
        </div>
      </div>

    </div>
  `;
}

function renderMobile(ticket, selected = false) {
  let badgeClass = 'badge-cyan';
  const estado = ticket.estado || WORK_STATUS.ingresado;
  
  if (estado === WORK_STATUS.enReparacion) badgeClass = 'badge-orange';
  if (estado === WORK_STATUS.listo) badgeClass = 'badge-green';
  if (estado === WORK_STATUS.entregado) badgeClass = 'badge-gray';

  const fecha = ticket.fechaIngreso ? new Date(ticket.fechaIngreso).toLocaleDateString('es-AR', {day: '2-digit', month: '2-digit'}) : '—';
  const cliente = [ticket.nombre, ticket.apellido].filter(Boolean).join(' ') || 'Sin Nombre';
  const equipo = [ticket.marca, ticket.equipo].filter(Boolean).join(' ') || '—';
  const canEdit = canAccess('edit-ticket');
  const showCTA = hasBudgetApproved(ticket) && canEdit;

  // Acciones en móvil: Sólo 1 acción primaria y botón de opciones (...)
  let primaryActionHtml = '';
  let dropdownActions = '';

  if (canEdit) {
    if (!ticket.tecnicoAsignadoId && estado !== WORK_STATUS.entregado) {
      primaryActionHtml = `<button class="btn btn-sm btn-primary quick-tomar-btn" data-id="${ticket.id}" style="flex:1; min-height:36px; font-size:12px; font-weight:700; background:var(--accent-blue);">🙋 Tomar Orden</button>`;
    } else if (estado === WORK_STATUS.listo) {
      primaryActionHtml = `<button class="btn btn-sm btn-success quick-entregar-btn" data-id="${ticket.id}" style="flex:1; min-height:36px; font-size:12px; font-weight:700;">💵 Cobrar</button>`;
    } else if (estado === WORK_STATUS.ingresado || estado === WORK_STATUS.enReparacion) {
      if (estado === WORK_STATUS.enReparacion) {
        primaryActionHtml = `<button class="btn btn-sm btn-primary quick-listo-btn" data-id="${ticket.id}" style="flex:1; min-height:36px; font-size:12px; font-weight:700;">✅ Listo</button>`;
      } else if (showCTA) {
        primaryActionHtml = `<button class="btn btn-sm btn-primary quick-repair-btn" data-id="${ticket.id}" style="flex:1; min-height:36px; font-size:12px; font-weight:700;">🔧 Reparar</button>`;
      } else {
        primaryActionHtml = `<button class="btn btn-sm btn-secondary quick-listo-btn" data-id="${ticket.id}" style="flex:1; min-height:36px; font-size:12px; font-weight:700; border-color:var(--accent-cyan); color:var(--accent-cyan);">✅ Listo</button>`;
      }
    } else if (estado === WORK_STATUS.entregado) {
      primaryActionHtml = `<button class="btn btn-sm btn-secondary reingreso-btn" data-id="${ticket.id}" style="flex:1; min-height:36px; font-size:12px; font-weight:700;">♻️ Reingreso</button>`;
    }
  }

  // Secondary actions in dropdown
  dropdownActions += `<button class="btn btn-sm ticket-print-btn" data-id="${ticket.id}" style="font-size: 13px; padding: 10px;">🖨 Imprimir</button>`;
  if (canEdit) {
    dropdownActions += `<a href="#ticket-edit?id=${ticket.id}" class="btn btn-sm" style="text-decoration:none; font-size: 13px; padding: 10px;">📝 Editar</a>`;
  }
  if (ticket.telefono) {
    dropdownActions += `<button class="btn btn-sm ticket-whatsapp-btn" data-id="${ticket.id}" style="color:#25D366; font-size: 13px; padding: 10px;">📲 WhatsApp</button>`;
  }

  return `
    <div class="card glass-card mobile-ticket-card ${selected ? 'ticket-selected' : ''}" id="ticket-card-${ticket.id}" data-ticket-id="${ticket.id}"
      style="display:flex; flex-direction:column; padding: 14px !important; gap: 10px; border-radius: var(--radius-md); background: rgba(8, 15, 28, 0.6); border: 1px solid rgba(255,255,255,0.06); cursor:pointer; position:relative; overflow:visible; transition: background 0.15s ease;">
      
      <!-- Header -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
          <input type="checkbox" class="ticket-checkbox" data-id="${ticket.id}" ${selected ? 'checked' : ''} style="flex-shrink:0; width:18px; height:18px; margin:0;">
          <div style="min-width:0; flex:1;">
            <div style="font-size: 10px; color: var(--accent-cyan); font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">
              #${ticket.numeroOrden || '—'}
            </div>
            <div style="font-size: 14px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${cliente}
            </div>
          </div>
        </div>
        <div style="flex-shrink:0; display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
          <span class="badge ${badgeClass}" id="badge-${ticket.id}" style="font-size:9.5px; padding: 3px 8px; font-weight:700; text-transform:uppercase;">
            ${estado}
          </span>
          ${ticket.tecnicoAsignadoId ? `
            <span style="font-size:10px; color:var(--text-muted); opacity:0.8; font-weight:600;">
              👨‍🔧 ${ticket.tecnicoAsignadoNombre.split(' ')[0]}
            </span>` : ''}
        </div>
      </div>

      <!-- Info Row -->
      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.03); padding-top:8px; font-size:12px;">
        <div style="color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0;">
          <span style="opacity:0.7;">💻</span> <span style="font-weight:500;">${equipo}</span>
        </div>
        <div style="color: var(--text-muted); flex-shrink: 0; padding-left: 8px;">
          <span style="opacity:0.7;">📅</span> <span>${fecha}</span>
        </div>
      </div>

      <!-- Actions -->
      <div style="display:flex; gap:8px; align-items:center; margin-top:4px;" onclick="event.stopPropagation()">
        ${primaryActionHtml}
        
        <div class="ticket-dropdown-wrapper">
          <button class="btn btn-sm btn-secondary" style="padding: 0 12px; height: 36px; font-weight: 800; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">⋯</button>
          <div class="ticket-dropdown-content" style="right: 0; min-width: 150px; bottom: 100%; top: auto; margin-bottom: 4px;">
            ${dropdownActions}
          </div>
        </div>
      </div>

    </div>
  `;
}

