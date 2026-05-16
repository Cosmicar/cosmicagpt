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
  const showCTA   = hasBudgetApproved(ticket) && canEdit;

  // Aging visual — uses centralized helper from intelligence.js
  const agingBadge = getAgingBadge(ticket);

  return `
    <div class="card glass-card${selected ? ' ticket-selected' : ''}" id="ticket-card-${ticket.id}" data-ticket-id="${ticket.id}"
      style="display:flex;flex-direction:column;cursor:pointer;min-width:0;max-width:100%;box-sizing:border-box;overflow:hidden;">

      <!-- ── Header row: checkbox │ title │ badge column ───────────────── -->
      <div class="flex-between tc-card-header" style="align-items:flex-start;margin-bottom:var(--space-sm);gap:6px;flex-wrap:nowrap;">

        <input type="checkbox" class="ticket-checkbox" data-id="${ticket.id}" ${selected ? 'checked' : ''}
          style="flex-shrink:0;margin-top:3px;">

        <!-- Title + order number — must shrink, never overflow -->
        <div style="flex:1;min-width:0;padding:0 8px;overflow:hidden;box-sizing:border-box;">
          <h3 class="card-title text-truncate" title="${ticket.nombre || ''} ${ticket.apellido || ''}"
            style="font-size:var(--font-md); font-weight:800; margin:0; letter-spacing: -0.01em; color: var(--text-primary);">
            ${ticket.nombre || 'Sin Nombre'} ${ticket.apellido || ''}
          </h3>
          <div style="font-size: 10px; color: var(--accent-cyan); margin-top: 2px; font-weight: 800;
                      text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.8;">
            ORDEN #${ticket.numeroOrden || 'N/A'}
          </div>
        </div>

        <!-- Badge column — capped width; never pushes title out of the card -->
        <div class="tc-badge-col"
          style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;
                 flex-shrink:0;min-width:64px;max-width:clamp(64px,38%,148px);
                 overflow:hidden;box-sizing:border-box;">
          <div class="badge ${badgeClass}" id="badge-${ticket.id}"
            style="font-size:10px;max-width:100%;overflow:hidden;text-overflow:ellipsis;">${estado}</div>
          ${ticket.reentryRisk  ? `<div class="badge ${ticket.reentryRisk.class}"  style="font-size:10px;max-width:100%;overflow:hidden;text-overflow:ellipsis;">${ticket.reentryRisk.label}</div>` : ''}
          ${ticket.clientBadge  ? `<div class="badge ${ticket.clientBadge.class}"  style="font-size:10px;max-width:100%;overflow:hidden;text-overflow:ellipsis;">${ticket.clientBadge.label}</div>` : ''}
          ${metodoBadge         ? `<div class="badge ${metodoBadge.class}"          style="font-size:10px;max-width:100%;overflow:hidden;text-overflow:ellipsis;">${metodoBadge.label}</div>` : ''}
          ${overdue   ? '<div class="badge badge-orange rule-badge" style="font-size:10px;max-width:100%;overflow:hidden;text-overflow:ellipsis;">⚠ DEMORADO</div>' : ''}
          ${agingBadge}
          ${highValue ? '<div class="badge badge-gold rule-badge"   style="font-size:10px;max-width:100%;overflow:hidden;text-overflow:ellipsis;">💎 ALTO VALOR</div>' : ''}
          ${ticket.tecnicoAsignadoId ? `
            <div class="badge badge-blue" style="font-size:10px;max-width:100%;overflow:hidden;text-overflow:ellipsis;
                 background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.4);color:#93c5fd;">
              👨‍🔧 ${ticket.tecnicoAsignadoNombre || 'Asignado'}
            </div>` : ''}
          ${ticket.isOverloaded ? '<div class="badge badge-danger" style="font-size:10px;max-width:100%;overflow:hidden;text-overflow:ellipsis;animation:pulse 2s infinite;">🔥 CARGADO</div>' : ''}
        </div>
      </div>

      <!-- ── Meta + problem ─────────────────────────────────────────────── -->
      <div style="flex:1;min-width:0;overflow:hidden;box-sizing:border-box; padding: 0 4px;">
        <p class="vm-meta"
          style="color:var(--text-muted);font-size:var(--font-sm);margin-bottom:10px;
                 overflow-wrap:anywhere;word-break:break-word;min-width:0;max-width:100%;box-sizing:border-box; line-height: 1.5;">
          <span style="color:var(--text-muted); opacity: 0.6; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">Equipo:</span> <span style="color: var(--text-primary); font-weight: 500;">${ticket.equipo || '—'} ${ticket.marca || ''}</span><br>
          <span style="color:var(--text-muted); opacity: 0.6; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">Fecha:</span> <span style="color: var(--text-primary); font-weight: 500;">${fecha}</span><br>
          <span style="color:var(--text-muted); opacity: 0.6; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">Prioridad:</span> <span style="color: var(--text-primary); font-weight: 700; text-transform:capitalize;">${prioridad}</span>
        </p>

        <div class="vm-problema"
          style="border-top: 1px solid var(--border); padding-top: 6px;
                 font-size: var(--font-sm); color: var(--text-muted); min-height: 3em;
                 overflow-wrap: anywhere; word-break: break-word; min-width: 0; max-width: 100%; box-sizing: border-box; line-height: 1.6;">
          <span style="color:var(--text-muted); opacity: 0.6; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 2px;">Problema:</span>
          <span class="vm-problema-text" style="color: var(--text-primary); font-weight: 400;">${ticket.problema || 'No especificado'}</span>
        </div>
      </div>

      ${showCTA ? `
      <div class="quick-repair-wrap" style="margin-top:var(--space-sm);">
        <button class="btn btn-sm btn-primary quick-repair-btn" data-id="${ticket.id}"
          style="width:100%;font-size:var(--font-xs);min-height:44px;">
          🔧 Pasar a Reparación
        </button>
      </div>` : ''}

      <!-- ── Action bar — always visible ─────── -->
      <div style="margin-top:var(--space-sm);border-top:1px solid var(--border);padding-top:var(--space-xs);
                  display:flex;align-items:center;gap:4px;position:relative;z-index:10;
                  flex-wrap:wrap;min-width:0;box-sizing:border-box;">
        <div style="display:flex;gap:4px;flex:1;flex-wrap:wrap;min-width:0;box-sizing:border-box;align-items:center;">

          ${!ticket.tecnicoAsignadoId && canEdit && estado !== WORK_STATUS.entregado ? `
            <button class="btn btn-sm btn-primary quick-tomar-btn" data-id="${ticket.id}"
              title="Tomar Ticket"
              style="padding:6px 8px;flex:1;min-width:56px;font-size:10px;font-weight:700;
                     background:var(--accent-blue);color:#fff;min-height:36px;">
              🙋 TOMAR
            </button>` : ''}

          ${canEdit && estado === WORK_STATUS.listo ? `
            <button class="btn btn-sm btn-success quick-entregar-btn" data-id="${ticket.id}"
              title="Cobrar y Finalizar"
              style="padding:6px 8px;flex:1;min-width:60px;font-size:10px;font-weight:700;min-height:36px;">
              💵 COBRAR
            </button>` : ''}

          ${canEdit && (estado === WORK_STATUS.ingresado || estado === WORK_STATUS.enReparacion) ? `
            <button class="btn btn-sm btn-primary quick-listo-btn" data-id="${ticket.id}"
              title="Marcar como Listo"
              style="padding:6px 8px;flex:1;min-width:56px;font-size:10px;font-weight:700;min-height:36px;">
              ✅ LISTO
            </button>` : ''}

          ${estado === WORK_STATUS.entregado ? `
            <button class="btn btn-sm btn-secondary reingreso-btn" data-id="${ticket.id}"
              title="Generar Reingreso"
              style="padding:6px 8px;flex:1;min-width:72px;font-size:10px;min-height:36px;
                     background:rgba(0,229,255,0.1);color:var(--accent-cyan);">
              ♻️ REINGRESO
            </button>` : ''}

          <!-- Print — always visible, no permission gate -->
          <button class="btn btn-sm btn-secondary ticket-print-btn" data-id="${ticket.id}"
            style="padding:6px 10px;flex-shrink:0;min-height:36px;" title="Imprimir orden">🖨</button>

          <!-- Edit — permission-gated -->
          ${canEdit ? `
            <a href="#ticket-edit?id=${ticket.id}" class="btn btn-sm btn-secondary"
              style="padding:6px 10px;flex-shrink:0;min-height:36px;" title="Editar">📝</a>` : ''}

          <!-- WhatsApp — always visible when phone exists, no permission gate -->
          ${ticket.telefono ? `
            <button class="btn btn-sm ticket-whatsapp-btn" data-id="${ticket.id}"
              style="padding:6px 8px;flex-shrink:0;min-height:36px;
                     background:rgba(37,211,102,0.15);color:#25D366;border:1px solid rgba(37,211,102,0.3);"
              title="WhatsApp rápido">📲</button>` : ''}

        </div>
      </div>
    </div>
  `;
}
