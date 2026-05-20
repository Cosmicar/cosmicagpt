import { openDrawer } from './drawer.js';
import { openTicketPrint } from './ticket-print.js';
import { updateTicketStatus, reingresoTicket, approveTicketBudget, updateTicket, assignTechnician } from '../services/tickets.js';
import { getTicketHistory, addTicketHistoryEvent, TICKET_EVENT_TYPES } from '../services/ticket-history.js';
import { getTecnicos } from '../services/usuarios.js';
import { WORK_STATUS } from '../../../js/domain.js';
import { canAccess, getCurrentSession } from '../core/session.js';
import { showToast } from './toast.js';

import { formatRelativeTs, TICKET_EVENT_ICONS } from '../core/utils.js';
import { getClientBadge, getReentryRisk, estimateRepairTime, getClientSnapshot, getCriticalAlert, getDaysInStatus, getLifecycleStage, getAgingBadge } from '../core/intelligence.js';
import { openWhatsApp, buildReadyMessage, buildBudgetMessage, buildApprovalMessage, buildWaitingPartsMessage, buildReminderMessage, buildLastWarningMessage } from '../core/message-templates.js';
import { getTickets } from '../services/tickets.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  WORK_STATUS.ingresado,
  WORK_STATUS.enReparacion,
  WORK_STATUS.esperandoRepuesto,
  WORK_STATUS.listo,
  WORK_STATUS.entregado,
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function badgeClass(estado) {
  if (estado === WORK_STATUS.enReparacion) return 'badge-orange';
  if (estado === WORK_STATUS.esperandoRepuesto) return 'badge-orange'; // Same color as enReparacion
  if (estado === WORK_STATUS.listo)        return 'badge-green';
  if (estado === WORK_STATUS.entregado)    return 'badge-gray';
  return 'badge-cyan';
}

// ─── Timeline (drawer-scoped ids, no conflict with ticket-form timeline) ─────

function renderTimelineSkeleton() {
  return `
    <div class="timeline-container">
      ${Array(3).fill(`
        <div class="timeline-item">
          <div class="skeleton timeline-icon-wrapper"></div>
          <div class="timeline-content">
            <div class="skeleton" style="width:80%;height:12px;margin-bottom:6px;"></div>
            <div class="skeleton" style="width:40%;height:10px;"></div>
          </div>
        </div>`).join('')}
    </div>`;
}

async function mountQvTimeline(ticketId) {
  const container = document.getElementById('qv-timeline-events');
  if (!container) return;
  try {
    const events = await getTicketHistory(ticketId);
    if (!events.length) {
      container.innerHTML = `<div style="color:var(--text-muted);font-size:var(--font-sm);text-align:center;padding:var(--space-md) 0;opacity:0.6;">Sin eventos registrados aún.</div>`;
      return;
    }
    container.innerHTML = `
      <div class="timeline-container">
        ${events.map(ev => `
          <div class="timeline-item">
            <div class="timeline-icon-wrapper">${TICKET_EVENT_ICONS[ev.type] || '⚪'}</div>
            <div class="timeline-content">
              <div class="timeline-message">${ev.message}</div>
              <div class="timeline-meta">
                <span>👤 ${ev.user || 'sistema'}</span>
                <span>🕒 ${formatRelativeTs(ev.createdAt)}</span>
              </div>
            </div>
          </div>`).join('')}
      </div>`;
  } catch (err) {
    container.innerHTML = `<div style="color:var(--danger);font-size:var(--font-sm);text-align:center;">⚠️ ${err.message || 'Error al cargar historial'}</div>`;
  }
}

// ─── HTML builders ───────────────────────────────────────────────────────────

function renderHeader(ticket) {
  const estado = ticket.estado || WORK_STATUS.ingresado;
  return `
    <div style="display:flex;align-items:center;gap:6px;">
      <span style="font-family:'Rajdhani',monospace;font-size:var(--font-lg);font-weight:700;color:var(--accent-cyan);">
        #${ticket.numeroOrden || '—'}
      </span>
      <span class="badge ${badgeClass(estado)}">${estado}</span>
      ${ticket.reentryRisk ? `<span class="badge ${ticket.reentryRisk.class}">${ticket.reentryRisk.label}</span>` : ''}
      ${ticket.criticalAlert ? `<span class="badge ${ticket.criticalAlert.class}" title="${ticket.criticalAlert.reason}">${ticket.criticalAlert.label}</span>` : ''}
      <button class="btn btn-sm btn-secondary qv-copy-btn" data-text="${ticket.numeroOrden}" title="Copiar orden" style="width:24px;height:24px;padding:0;font-size:10px;opacity:0.5;border:none;background:transparent;">📋</button>
    </div>`;
}

function renderBody(ticket) {
  const estado  = ticket.estado || WORK_STATUS.ingresado;
  const fecha   = ticket.fechaIngreso
    ? new Date(ticket.fechaIngreso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';
  const equipo  = [ticket.equipo, ticket.marca, ticket.modelo].filter(Boolean).join(' ') || '—';
  const cliente = [ticket.nombre, ticket.apellido].filter(Boolean).join(' ') || 'Sin nombre';
  const plan    = ticket.planServicio
    ? ticket.planServicio.charAt(0).toUpperCase() + ticket.planServicio.slice(1)
    : '—';
  const canEdit = canAccess('edit-ticket');

  // Technician section
  const session = getCurrentSession();
  const userRole = session?.profile?.rol;
  const isOnlyAdmin = userRole === 'admin';
  const isNotOperator = userRole !== 'operador';
  const assignedName = ticket.tecnicoAsignadoNombre || 'Sin asignar';
  
  const techBlock = `
    <div class="qv-separator"></div>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
      <div class="qv-section-label" style="margin:0;">🛠️ Técnico Asignado</div>
      ${!ticket.tecnicoAsignadoId && isNotOperator ? `
        <button class="btn btn-sm btn-primary qv-take-btn" data-id="${ticket.id}" style="font-size:9px; padding:3px 8px; min-height:24px;">Tomar ticket</button>
      ` : ''}
    </div>
    <div style="display:flex; align-items:center; gap:var(--space-sm);">
       <div id="qv-tech-display" style="font-size:var(--font-sm); color:var(--text-primary); font-weight:600;">
         ${ticket.tecnicoAsignadoId ? `👨‍🔧 ${assignedName}` : '<span style="color:var(--text-muted); font-weight:400;">Sin técnico</span>'}
       </div>
       ${isOnlyAdmin ? `<button class="btn btn-sm btn-secondary qv-edit-tech-btn" style="padding:2px 6px; font-size:9px; min-height:22px;">Cambiar</button>` : ''}
    </div>
    <div id="qv-tech-selector-wrap" style="display:none; margin-top:var(--space-sm);">
       <select id="qv-tech-select" style="width:100%; background:#0d1117; border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text-primary); font-size:var(--font-sm); padding:6px; appearance:none; -webkit-appearance:none;">
         <option value="" style="background:#0d1117;color:#e2e8f0;">Cargando técnicos...</option>
       </select>
    </div>
  `;

  // Budget section — only shown when there is data
  const hasBudget = ticket.presupuesto || ticket.diagnosticoTecnico;
  const budgetBlock = hasBudget ? `
    <div class="qv-separator"></div>
    <div>
      <div class="qv-section-label">Diagnóstico y Presupuesto</div>
      ${ticket.diagnosticoTecnico
        ? `<p style="font-size:var(--font-sm);color:var(--text-primary);line-height:1.6;margin:0 0 var(--space-sm);">${ticket.diagnosticoTecnico}</p>`
        : ''}
      ${ticket.presupuesto
        ? `<div style="display:flex;align-items:center;gap:var(--space-sm);">
             <span style="font-size:var(--font-lg);font-weight:700;color:var(--accent-cyan);">
               $${Number(ticket.presupuesto).toLocaleString('es-AR')}
             </span>
             ${ticket.aprobadoCliente
               ? `<span class="badge badge-green" style="font-size:var(--font-xs);">✓ Aprobado</span>`
               : `<div style="display:flex;flex-direction:column;gap:var(--space-xs);">
                    <span class="badge badge-orange" style="font-size:var(--font-xs);">Pendiente aprobación</span>
                    ${canEdit ? `<button class="btn btn-sm btn-primary qv-approve-btn" data-id="${ticket.id}" style="font-size:10px;padding:4px 8px;">✅ Aprobar ahora</button>` : ''}
                  </div>`}
           </div>`
        : ''}
    </div>` : '';

  // Status selector — only for roles with edit access
  const actionsBlock = canEdit ? `
    <div class="qv-separator"></div>
    <div>
      <div class="qv-section-label">Cambiar estado</div>
      <select id="qv-status-select" data-id="${ticket.id}" style="
        width:100%;
        background:#0d1117;
        border:1px solid var(--border);
        border-radius:var(--radius-md);
        color:var(--text-primary);
        font-size:var(--font-sm);
        padding:8px 10px;
        outline:none;
        cursor:pointer;
        appearance:none;
        -webkit-appearance:none;
      ">
        ${STATUS_OPTIONS.map(opt =>
          `<option value="${opt}" ${estado === opt ? 'selected' : ''} style="background:#0d1117;color:#e2e8f0;">${opt}</option>`
        ).join('')}
      </select>
    </div>` : '';

  return `
    <!-- Meta grid -->
    <div class="qv-meta-grid" style="gap: 12px var(--space-md);">
      <div class="qv-meta-item">
        <div class="qv-meta-label">Cliente</div>
        <div class="qv-meta-value" style="display:flex;align-items:center;gap:6px; flex-wrap: wrap; line-height: 1.2;">
          ${cliente}
          ${ticket.telefono ? `<button class="btn btn-sm btn-secondary qv-copy-btn" data-text="${ticket.telefono}" title="Copiar teléfono" style="padding:0 4px; height: 18px; font-size:10px; opacity:0.6;">📋</button>` : ''}
          ${ticket.clientBadge ? `<span class="badge ${ticket.clientBadge.class}" style="font-size:9px; padding: 1px 6px;">${ticket.clientBadge.label}</span>` : ''}
        </div>
      </div>
      <div class="qv-meta-item">
        <div class="qv-meta-label">Fecha ingreso</div>
        <div class="qv-meta-value">${fecha}</div>
      </div>
      <div class="qv-meta-item">
        <div class="qv-meta-label">Equipo</div>
        <div class="qv-meta-value" style="line-height: 1.2;">${equipo}</div>
      </div>
      <div class="qv-meta-item">
        <div class="qv-meta-label">Plan</div>
        <div class="qv-meta-value" style="text-transform:capitalize;">${plan}</div>
      </div>
      <div class="qv-meta-item">
        <div class="qv-meta-label">Garantía</div>
        <div class="qv-meta-value">${ticket.garantiaDias ?? 90} días</div>
      </div>
      <div class="qv-meta-item">
        <div class="qv-meta-label">Método Pago</div>
        <div class="qv-meta-value" style="text-transform:capitalize;">${ticket.metodoPago || 'Efectivo'}</div>
      </div>
      <div class="qv-meta-item">
        <div class="qv-meta-label">⏱ Estimado</div>
        <div class="qv-meta-value" style="color: var(--accent-cyan); font-weight: 700;">${estimateRepairTime(ticket)}</div>
      </div>
    </div>

    <!-- Problema -->
    <div class="qv-separator"></div>
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
        <div class="qv-section-label" style="margin:0;">Problema reportado</div>
        <button class="btn btn-sm btn-secondary qv-copy-btn" data-text="${ticket.problema || ''}" title="Copiar problema" style="width:24px;height:24px;padding:0;font-size:10px;opacity:0.4;border:none;background:transparent;">📋</button>
      </div>
      <p style="font-size:var(--font-sm);color:var(--text-primary);line-height:1.5;margin:0;">
        ${ticket.problema || 'No especificado'}
      </p>
    </div>

    ${ticket.servicioRealizado ? `
    <div class="qv-separator"></div>
    <div>
      <div class="qv-section-label">Servicio Realizado</div>
      <p style="font-size:var(--font-sm);color:var(--text-primary);line-height:1.6;margin:0;">
        ${ticket.servicioRealizado}
      </p>
    </div>` : ''}

    ${budgetBlock}
    ${techBlock}
    ${actionsBlock}

    <!-- Contact Quick Block -->
    ${ticket.telefono ? `
    <div class="qv-separator"></div>
    <div class="qv-section-label">📞 Contacto rápido</div>
    <div style="background:rgba(37,211,102,0.03);border:1px solid rgba(37,211,102,0.15);border-radius:var(--radius-md);padding:10px;">
      <!-- Phone + quick actions row -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:var(--font-md);font-weight:700;color:var(--text-primary);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace;">${ticket.telefono}</span>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-sm btn-secondary qv-copy-btn" data-text="${ticket.telefono}"
            style="width:32px;height:32px;padding:0;font-size:12px;" title="Copiar teléfono">📋</button>
          <a href="tel:${ticket.telefono}" class="btn btn-sm"
            style="height:32px;padding:0 12px;font-size:11px;background:rgba(59,130,246,0.15);color:#93c5fd;border:1px solid rgba(59,130,246,0.3);display:inline-flex;align-items:center;gap:6px;" title="Llamar">📱 Llamar</a>
        </div>
      </div>
      <!-- WhatsApp action grid -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
        <button class="btn btn-sm qv-wa-btn" data-action="listo"
          style="height:34px;font-size:9px;font-weight:700;background:rgba(37,211,102,0.1);color:#25D366;border:1px solid rgba(37,211,102,0.2);">Avisar listo</button>
        <button class="btn btn-sm qv-wa-btn" data-action="presupuesto"
          style="height:34px;font-size:9px;font-weight:700;background:rgba(37,211,102,0.1);color:#25D366;border:1px solid rgba(37,211,102,0.2);">Presupuesto</button>
        <button class="btn btn-sm qv-wa-btn" data-action="aprobacion"
          style="height:34px;font-size:9px;font-weight:700;background:rgba(37,211,102,0.1);color:#25D366;border:1px solid rgba(37,211,102,0.2);">Aprobación</button>
        <button class="btn btn-sm qv-wa-btn" data-action="repuesto"
          style="height:34px;font-size:9px;font-weight:700;background:rgba(37,211,102,0.1);color:#25D366;border:1px solid rgba(37,211,102,0.2);">Repuesto</button>
        <button class="btn btn-sm qv-wa-btn" data-action="recordatorio"
          style="height:34px;font-size:9px;font-weight:700;background:rgba(37,211,102,0.1);color:#25D366;border:1px solid rgba(37,211,102,0.2);">Recordar</button>
        <button class="btn btn-sm qv-wa-btn" data-action="ultimoaviso"
          style="height:34px;font-size:9px;font-weight:700;background:rgba(239,68,68,0.1);color:#f87171;border:1px solid rgba(239,68,68,0.2);">Último aviso</button>
      </div>
    </div>` : ''}

    <!-- Lifecycle info -->
    <div id="qv-lifecycle-info" style="margin-top:var(--space-sm);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <span style="font-size:var(--font-xs);color:var(--text-muted);">Etapa: <strong style="color:var(--text-primary);">${getLifecycleStage(ticket)}</strong></span>
      <span style="font-size:var(--font-xs);color:var(--text-muted);">en este estado hace <strong style="color:var(--accent-cyan);">${getDaysInStatus(ticket)}d</strong></span>
      ${getAgingBadge(ticket)}
    </div>

    <!-- Client Snapshot -->
    <div id="qv-client-snapshot" style="margin-top: var(--space-lg);"></div>

    <!-- Timeline (lazy loaded) -->
    <div class="qv-separator"></div>
    <div>
      <div class="qv-section-label" style="margin-bottom:var(--space-md);">Historial de la Orden</div>
      <div id="qv-timeline-events">${renderTimelineSkeleton()}</div>
    </div>

    <!-- Actions -->
    <div class="drawer-footer" style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
      ${canEdit && estado === WORK_STATUS.listo ? `
        <button class="btn btn-success qv-entregar-btn" data-id="${ticket.id}" style="grid-column: 1 / -1; font-weight:700; height:36px; font-size:12px;">
          💵 COBRAR Y FINALIZAR
        </button>
      ` : ''}
      ${canEdit && (estado === WORK_STATUS.ingresado || estado === WORK_STATUS.enReparacion) ? `
        <button class="btn btn-primary qv-listo-btn" data-id="${ticket.id}" style="grid-column: 1 / -1; font-weight:700; height:36px; font-size:12px;">
          ✅ MARCAR COMO LISTO
        </button>
      ` : ''}
      ${canEdit && (estado === WORK_STATUS.ingresado || estado === WORK_STATUS.esperandoRepuesto) ? `
        <button class="btn btn-secondary qv-reparacion-btn" data-id="${ticket.id}" style="grid-column: 1 / -1; height:36px; background:rgba(251,146,60,0.1); color:#fb923c; border-color:rgba(251,146,60,0.35); font-weight:600; font-size:12px;">
          🔧 REPARACIÓN
        </button>
      ` : ''}
      ${estado === WORK_STATUS.entregado ? `
        <button class="btn btn-secondary qv-reingreso-btn" data-id="${ticket.id}" style="grid-column: 1 / -1; background:rgba(0,229,255,0.05); color:var(--accent-cyan); border-color:rgba(0,229,255,0.2); height:36px; font-size:12px;">
          ♻️ REINGRESO (GARANTÍA)
        </button>
      ` : ''}
      <button class="btn btn-secondary qv-print-btn" data-mode="a4" data-id="${ticket.id}" style="height:34px; font-size:11px;">🖨 A4</button>
      <button class="btn btn-secondary qv-print-btn" data-mode="thermal" data-id="${ticket.id}" style="height:34px; font-size:11px;">🧾 Ticket</button>
      ${canAccess('facturar') ? `
        <button class="btn btn-secondary qv-facturar-btn" data-id="${ticket.id}"
                style="grid-column: 1 / -1; height:36px; font-size:12px; font-weight:700;
                       background:rgba(16,185,129,0.08); color:var(--accent-green);
                       border-color:rgba(16,185,129,0.28);">
          🧾 EMITIR FACTURA AFIP
        </button>
      ` : ''}
      <a href="#ticket-edit?id=${ticket.id}" class="btn btn-primary" style="grid-column: 1 / -1; height:34px; line-height:34px; padding:0; font-size:11px; text-align:center;">
        📝 EDITAR COMPLETO
      </a>
      <div id="qv-undo-container" style="grid-column: 1 / -1;"></div>
    </div>
  `;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Opens the quick-view drawer for a ticket.
 *
 * @param {Object}   ticket          Full ticket data object (from allTickets cache).
 * @param {Object}   [options]
 * @param {Function} [options.onStatusChange]  Called with (id, newStatus) after a
 *                                             successful status update so the parent
 *                                             view can sync its badge and local cache.
 */
export async function openTicketQuickView(ticket, { onStatusChange } = {}) {
  // Enrich ticket with intelligence before rendering
  const allTickets = await getTickets();
  const clientTickets = allTickets.filter(t => t.clienteId === ticket.clienteId);
  ticket.clientBadge = getClientBadge(clientTickets.length);
  ticket.reentryRisk = getReentryRisk(clientTickets);
  ticket.criticalAlert = getCriticalAlert(ticket, allTickets);

  openDrawer(
    renderHeader(ticket),
    renderBody(ticket),
    async (bodyEl) => {
      // Lazy-load timeline
      mountQvTimeline(ticket.id);

      // Check for Undo possibility — wrapped so a permission error doesn't crash the callback
      try {
        const history = await getTicketHistory(ticket.id);
        const lastEvent = history[0];
        const undoContainer = bodyEl.querySelector('#qv-undo-container');

        if (lastEvent && canUndo(lastEvent) && undoContainer) {
          undoContainer.innerHTML = `
            <button class="btn btn-sm btn-secondary qv-undo-btn" style="width:100%; border-style: dashed; font-size: 11px; color: var(--text-muted);">
              ↩ Deshacer último cambio (${lastEvent.message})
            </button>
          `;
          undoContainer.querySelector('.qv-undo-btn').addEventListener('click', () => handleUndo(ticket, lastEvent, onStatusChange));
        }
      } catch (histErr) {
        // Undo feature is non-critical — permission errors are silenced here;
        // mountQvTimeline (below) will display the error in the timeline section.
        console.warn('[quick-view] undo history fetch failed (non-fatal):', histErr.code || histErr.message);
      }

      const refreshQuickView = () => openTicketQuickView(ticket, { onStatusChange });

      // Take ticket button
      const takeBtn = bodyEl.querySelector('.qv-take-btn');
      if (takeBtn) {
        takeBtn.addEventListener('click', async () => {
          takeBtn.disabled = true;
          const session = getCurrentSession();
          const res = await assignTechnician(ticket.id, { 
            id: session.user.uid, 
            nombre: session.profile.nombre || session.user.email 
          });
          if (res.success) {
            showToast('Ticket asignado a ti', 'success');
            ticket.tecnicoAsignadoId = session.user.uid;
            ticket.tecnicoAsignadoNombre = session.profile.nombre || session.user.email;
            if (onStatusChange) onStatusChange(ticket.id, ticket.estado);
            refreshQuickView();
          } else {
            showToast(res.error || 'Error', 'error');
            takeBtn.disabled = false;
          }
        });
      }

      // Tech selector toggle
      const editTechBtn = bodyEl.querySelector('.qv-edit-tech-btn');
      const techWrap = bodyEl.querySelector('#qv-tech-selector-wrap');
      const techSelect = bodyEl.querySelector('#qv-tech-select');
      if (editTechBtn && techWrap && techSelect) {
        editTechBtn.addEventListener('click', async () => {
          techWrap.style.display = techWrap.style.display === 'none' ? 'block' : 'none';
          if (techWrap.style.display === 'block') {
            const techs = await getTecnicos();
            const optStyle = 'style="background:#0d1117;color:#e2e8f0;"';
            techSelect.innerHTML = `<option value="" ${optStyle}>Sin asignar</option>` + techs.map(t => `<option value="${t.id}" ${t.id === ticket.tecnicoAsignadoId ? 'selected' : ''} ${optStyle}>${t.displayName}</option>`).join('');
          }
        });

        techSelect.addEventListener('change', async () => {
          const tid = techSelect.value;
          const tname = techSelect.options[techSelect.selectedIndex].text;
          techSelect.disabled = true;
          
          let res;
          if (!tid) {
            const { unassignTechnician } = await import('../services/tickets.js');
            res = await unassignTechnician(ticket.id);
          } else {
            res = await assignTechnician(ticket.id, { id: tid, nombre: tname });
          }

          if (res.success) {
            showToast('Técnico actualizado', 'success');
            ticket.tecnicoAsignadoId = tid || null;
            ticket.tecnicoAsignadoNombre = tid ? tname : null;
            if (onStatusChange) onStatusChange(ticket.id, ticket.estado);
            refreshQuickView();
          } else {
            showToast(res.error || 'Error', 'error');
            techSelect.disabled = false;
          }
        });
      }

      // Render snapshot
      const snapshot = getClientSnapshot(ticket.clienteId, allTickets);
      const snapshotContainer = bodyEl.querySelector('#qv-client-snapshot');
      if (snapshot && snapshotContainer) {
        snapshotContainer.innerHTML = `
          <div class="qv-separator"></div>
          <div class="qv-section-label">👤 Historial rápido</div>
          <div class="qv-meta-grid" style="grid-template-columns: 1fr 1fr; gap: 8px; background: rgba(255,255,255,0.03); padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--border);">
            <div class="qv-meta-item">
              <div class="qv-meta-label">Total tickets</div>
              <div class="qv-meta-value">${snapshot.totalTickets}</div>
            </div>
            <div class="qv-meta-item">
              <div class="qv-meta-label">Total gastado</div>
              <div class="qv-meta-value">$${snapshot.totalSpent.toLocaleString('es-AR')}</div>
            </div>
            <div class="qv-meta-item">
              <div class="qv-meta-label">Reingresos</div>
              <div class="qv-meta-value" style="color: ${snapshot.reentries > 0 ? 'var(--danger)' : 'inherit'}">${snapshot.reentries}</div>
            </div>
            <div class="qv-meta-item">
              <div class="qv-meta-label">Pago más usado</div>
              <div class="qv-meta-value" style="text-transform: capitalize;">${snapshot.topPayment}</div>
            </div>
          </div>
        `;
      }

      // Approval button
      const approveBtn = bodyEl.querySelector('.qv-approve-btn');
      if (approveBtn) {
        approveBtn.addEventListener('click', async () => {
          approveBtn.disabled = true;
          approveBtn.textContent = '⏳ Procesando...';
          const res = await approveTicketBudget(ticket.id);
          if (res.success) {
            showToast('Presupuesto aprobado', 'success');
            ticket.aprobadoCliente = true;
            // Re-render body to show "Aprobado" badge
            bodyEl.innerHTML = renderBody(ticket);
            // Re-mount events for the new body
            mountQvTimeline(ticket.id);
            // Since we re-rendered the whole body, we need to re-wire all buttons. 
            // Better to just call openTicketQuickView again or refresh.
            // For now, let's just refresh the whole drawer.
            openTicketQuickView(ticket, { onStatusChange });
          } else {
            showToast(res.error || 'Error al aprobar', 'error');
            approveBtn.disabled = false;
            approveBtn.textContent = '✅ Aprobar ahora';
          }
        });
      }

      // Entregar button
      const entregarBtn = bodyEl.querySelector('.qv-entregar-btn');
      if (entregarBtn) {
        entregarBtn.addEventListener('click', async () => {
          entregarBtn.disabled = true;
          entregarBtn.textContent = '⏳ Procesando...';
          const result = await updateTicketStatus(ticket.id, WORK_STATUS.entregado);
          if (result.success) {
            showToast('Orden entregada', 'success');
            ticket.estado = WORK_STATUS.entregado;
            if (onStatusChange) onStatusChange(ticket.id, WORK_STATUS.entregado);
            openTicketQuickView(ticket, { onStatusChange });
          } else {
            showToast(result.error || 'Error al entregar', 'error');
            entregarBtn.disabled = false;
            entregarBtn.textContent = '💵 COBRAR Y FINALIZAR';
          }
        });
      }

      // Listo button
      const listoBtn = bodyEl.querySelector('.qv-listo-btn');
      if (listoBtn) {
        listoBtn.addEventListener('click', async () => {
          listoBtn.disabled = true;
          listoBtn.textContent = '⏳ Procesando...';
          const result = await updateTicketStatus(ticket.id, WORK_STATUS.listo);
          if (result.success) {
            showToast('Orden lista', 'success');
            ticket.estado = WORK_STATUS.listo;
            if (onStatusChange) onStatusChange(ticket.id, WORK_STATUS.listo);
            openTicketQuickView(ticket, { onStatusChange });
          } else {
            showToast(result.error || 'Error al actualizar', 'error');
            listoBtn.disabled = false;
            listoBtn.textContent = '✅ MARCAR COMO LISTO';
          }
        });
      }

      // Reingreso button
      const reingresoBtn = bodyEl.querySelector('.qv-reingreso-btn');
      if (reingresoBtn) {
        reingresoBtn.addEventListener('click', async () => {
          if (!confirm('¿Generar un reingreso para este equipo? Se creará una nueva orden.')) return;
          reingresoBtn.disabled = true;
          reingresoBtn.textContent = '⏳ Generando...';
          const res = await reingresoTicket(ticket);
          if (res.success) {
            showToast('Reingreso generado con éxito', 'success');
            window.location.hash = `#ticket-edit?id=${res.id}`;
          } else {
            showToast(res.error || 'Error al generar reingreso', 'error');
            reingresoBtn.disabled = false;
            reingresoBtn.textContent = '♻️ Generar Reingreso (Garantía)';
          }
        });
      }

      // Print buttons (A4 + Thermal)
      bodyEl.querySelectorAll('.qv-print-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          openTicketPrint(ticket, btn.dataset.mode || 'a4');
        });
      });

      // Facturar AFIP — lazy-load del modal (no se carga si nadie hace click).
      // Cerramos el drawer antes de abrir el modal: el operador trabaja sobre
      // la factura sin distracciones visuales del ticket detrás.
      const facturarBtn = bodyEl.querySelector('.qv-facturar-btn');
      if (facturarBtn) {
        facturarBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          facturarBtn.disabled = true;
          facturarBtn.innerHTML = '⏳ Abriendo emisor...';
          try {
            const { openFacturaModal } = await import('./factura-modal.js');
            const { closeDrawer } = await import('./drawer.js');
            // Cerramos el drawer del ticket — el modal toma el foco
            closeDrawer();
            openFacturaModal({
              ticket,
              onSuccess: (factura) => {
                showToast(`Factura ${factura.numero} emitida correctamente`, 'success');
              },
              // onClose no necesario: el drawer ya fue desmontado
            });
          } catch (err) {
            console.error('[qv-facturar] failed to load modal:', err);
            showToast('Error al abrir emisor: ' + err.message, 'error');
            facturarBtn.innerHTML = '🧾 EMITIR FACTURA AFIP';
            facturarBtn.disabled = false;
          }
        });
      }

      // ── Status selector handler — guard scoped to THIS block only ──────────
      // WARNING: do NOT add an early return here; handlers below must always run.
      const select = bodyEl.querySelector('#qv-status-select');
      if (select) {
        select.addEventListener('change', async (e) => {
          const newStatus = e.target.value;
          select.disabled = true;

          const result = await updateTicketStatus(ticket.id, newStatus);

          if (result.success) {
            showToast('Estado actualizado', 'success');

            // Mutate local reference so re-opens of the same ticket are consistent
            ticket.estado = newStatus;

            // Update drawer header badge
            const titleEl = document.getElementById('drawer-title');
            if (titleEl) titleEl.innerHTML = renderHeader(ticket);

            // Notify parent view to sync the list badge + cache
            if (onStatusChange) onStatusChange(ticket.id, newStatus);
          } else {
            showToast(result.error || 'Error al cambiar estado', 'error');
            e.target.value = ticket.estado; // revert selector
          }

          select.disabled = false;
        });
      }

      // ── Reparación quick action button ─────────────────────────────────────
      const reparacionBtn = bodyEl.querySelector('.qv-reparacion-btn');
      if (reparacionBtn) {
        reparacionBtn.addEventListener('click', async () => {
          reparacionBtn.disabled = true;
          reparacionBtn.textContent = '⏳ Enviando...';
          const result = await updateTicketStatus(ticket.id, WORK_STATUS.enReparacion);
          if (result.success) {
            showToast('🛠 Ticket enviado a reparación', 'success');
            ticket.estado = WORK_STATUS.enReparacion;
            if (onStatusChange) onStatusChange(ticket.id, WORK_STATUS.enReparacion);
            openTicketQuickView(ticket, { onStatusChange });
          } else {
            showToast(result.error || 'Error al actualizar estado', 'error');
            reparacionBtn.disabled = false;
            reparacionBtn.textContent = '🔧 Enviar a Reparación';
          }
        });
      }

      // ── WhatsApp quick action buttons — always wired regardless of canEdit ─
      bodyEl.querySelectorAll('.qv-wa-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          const msgMap = {
            listo:        () => buildReadyMessage(ticket),
            presupuesto:  () => buildBudgetMessage(ticket),
            aprobacion:   () => buildApprovalMessage(ticket),
            repuesto:     () => buildWaitingPartsMessage(ticket),
            recordatorio: () => buildReminderMessage(ticket),
            ultimoaviso:  () => buildLastWarningMessage(ticket),
          };
          const build = msgMap[action];
          if (build) openWhatsApp(ticket.telefono, build());
        });
      });

      // ── Copy buttons — always wired; clipboard with execCommand fallback ───
      const _copyToClipboard = async (text) => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // Fallback for non-HTTPS or older browsers
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          try { document.execCommand('copy'); } catch { /* silent */ }
          document.body.removeChild(ta);
        }
        showToast('✅ Copiado al portapapeles', 'success');
      };

      bodyEl.querySelectorAll('.qv-copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const text = btn.dataset.text;
          if (text) _copyToClipboard(text);
        });
      });
    }
  );
}

/**
 * UNDO LOGIC
 */
function canUndo(event) {
  if (!event || !event.createdAt) return false;
  const now = Date.now();
  const eventTime = (event.createdAt.seconds || 0) * 1000 || new Date(event.createdAt).getTime();
  const diffMinutes = (now - eventTime) / (1000 * 60);
  
  if (diffMinutes > 2) return false; // Max 2 minutes
  
  const reversibleTypes = [TICKET_EVENT_TYPES.statusChanged, TICKET_EVENT_TYPES.edited];
  if (!reversibleTypes.includes(event.type)) return false;
  
  const meta = event.metadata || {};
  return meta.from !== undefined || meta.presupuesto !== undefined;
}

async function handleUndo(ticket, event, onStatusChange) {
  if (!confirm('¿Deshacer el último cambio?')) return;
  
  try {
    const meta = event.metadata || {};
    let success = false;
    
    if (event.type === TICKET_EVENT_TYPES.statusChanged && meta.from) {
      const res = await updateTicketStatus(ticket.id, meta.from);
      success = res.success;
      if (success) {
        ticket.estado = meta.from;
        if (onStatusChange) onStatusChange(ticket.id, meta.from);
      }
    } else if (event.type === TICKET_EVENT_TYPES.edited && meta.presupuesto !== undefined) {
      // Revert budget logic would need previous budget in metadata. 
      // For now, let's just log it or alert.
      showToast('Undo para presupuesto no disponible sin valor previo en metadata', 'error');
      return;
    }

    if (success) {
      showToast('Cambio deshecho', 'success');
      await addTicketHistoryEvent(ticket.id, {
        type: TICKET_EVENT_TYPES.edited,
        message: `Undo: ${event.message}`,
        metadata: { undoing: event.id }
      });
      openTicketQuickView(ticket, { onStatusChange });
    }
  } catch (err) {
    showToast('Error al deshacer: ' + err.message, 'error');
  }
}

