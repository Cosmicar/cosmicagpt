import { openDrawer } from './drawer.js';
import { openTicketPrint } from './ticket-print.js';
import { updateTicketStatus, reingresoTicket, approveTicketBudget } from '../services/tickets.js';
import { getTicketHistory } from '../services/ticket-history.js';
import { WORK_STATUS } from '../../../js/domain.js';
import { canAccess } from '../core/session.js';
import { showToast } from './toast.js';

import { formatRelativeTs, TICKET_EVENT_ICONS } from '../core/utils.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  WORK_STATUS.ingresado,
  WORK_STATUS.enReparacion,
  WORK_STATUS.listo,
  WORK_STATUS.entregado,
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function badgeClass(estado) {
  if (estado === WORK_STATUS.enReparacion) return 'badge-orange';
  if (estado === WORK_STATUS.listo)        return 'badge-green';
  if (estado === WORK_STATUS.entregado)    return 'badge-gray';
  return 'badge-cyan';
}

// ─── Timeline (drawer-scoped ids, no conflict with ticket-form timeline) ─────

function renderTimelineSkeleton() {
  return Array(3).fill(`
    <div style="display:grid;grid-template-columns:28px 1fr;gap:var(--space-sm);padding:var(--space-sm) 0;">
      <div class="skeleton" style="width:24px;height:24px;border-radius:50%;"></div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div class="skeleton" style="width:80%;height:13px;"></div>
        <div class="skeleton" style="width:40%;height:10px;"></div>
      </div>
    </div>`).join('');
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
    container.innerHTML = events.map(ev => `
      <div style="display:grid;grid-template-columns:28px 1fr;gap:var(--space-sm);padding:var(--space-sm) 0;border-bottom:1px solid var(--border);">
        <span style="font-size:1rem;line-height:1.5;padding-top:2px;">${TICKET_EVENT_ICONS[ev.type] || '⚪'}</span>
        <div>
          <div style="font-size:var(--font-sm);color:var(--text-primary);font-weight:500;line-height:1.4;">${ev.message}</div>
          <div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:3px;">
            👤 ${ev.user || 'sistema'}&nbsp;•&nbsp;🕒 ${formatRelativeTs(ev.createdAt)}
          </div>
        </div>
      </div>`).join('');
  } catch (err) {
    container.innerHTML = `<div style="color:var(--danger);font-size:var(--font-sm);text-align:center;">⚠️ ${err.message || 'Error al cargar historial'}</div>`;
  }
}

// ─── HTML builders ───────────────────────────────────────────────────────────

function renderHeader(ticket) {
  const estado = ticket.estado || WORK_STATUS.ingresado;
  return `
    <div style="display:flex;align-items:center;gap:var(--space-sm);">
      <span style="font-family:'Rajdhani',monospace;font-size:var(--font-lg);font-weight:700;color:var(--accent-cyan);">
        #${ticket.numeroOrden || '—'}
      </span>
      <span class="badge ${badgeClass(estado)}">${estado}</span>
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
        background:rgba(255,255,255,0.05);
        border:1px solid var(--border);
        border-radius:var(--radius-md);
        color:var(--text-primary);
        font-size:var(--font-sm);
        padding:8px 10px;
        outline:none;
        cursor:pointer;
      ">
        ${STATUS_OPTIONS.map(opt =>
          `<option value="${opt}" ${estado === opt ? 'selected' : ''}>${opt}</option>`
        ).join('')}
      </select>
    </div>` : '';

  return `
    <!-- Meta grid -->
    <div class="qv-meta-grid">
      <div class="qv-meta-item">
        <div class="qv-meta-label">Cliente</div>
        <div class="qv-meta-value">${cliente}</div>
      </div>
      <div class="qv-meta-item">
        <div class="qv-meta-label">Fecha ingreso</div>
        <div class="qv-meta-value">${fecha}</div>
      </div>
      <div class="qv-meta-item">
        <div class="qv-meta-label">Equipo</div>
        <div class="qv-meta-value">${equipo}</div>
      </div>
      <div class="qv-meta-item">
        <div class="qv-meta-label">Plan</div>
        <div class="qv-meta-value" style="text-transform:capitalize;">${plan}</div>
      </div>
      <div class="qv-meta-item">
        <div class="qv-meta-label">Garantía</div>
        <div class="qv-meta-value">${ticket.garantiaDias ?? 90} días</div>
      </div>
    </div>

    <!-- Problema -->
    <div class="qv-separator"></div>
    <div>
      <div class="qv-section-label">Problema reportado</div>
      <p style="font-size:var(--font-sm);color:var(--text-primary);line-height:1.6;margin:0;">
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
    ${actionsBlock}

    <!-- Timeline (lazy loaded) -->
    <div class="qv-separator"></div>
    <div>
      <div class="qv-section-label">Historial</div>
      <div id="qv-timeline-events">${renderTimelineSkeleton()}</div>
    </div>

    <!-- Actions -->
    <div style="margin-top:var(--space-xl);display:flex;flex-direction:column;gap:var(--space-sm);">
      ${estado === WORK_STATUS.entregado ? `
        <button class="btn btn-secondary qv-reingreso-btn" data-id="${ticket.id}" style="width:100%; background:rgba(0,229,255,0.05); color:var(--accent-cyan); border-color:rgba(0,229,255,0.2);">
          ♻️ Generar Reingreso (Garantía)
        </button>
      ` : ''}
      <div style="display:flex;gap:var(--space-xs);">
        <button class="btn btn-secondary qv-print-btn" data-mode="a4" data-id="${ticket.id}" style="flex:1;">🖨 A4</button>
        <button class="btn btn-secondary qv-print-btn" data-mode="thermal" data-id="${ticket.id}" style="flex:1;">🧾 Ticket</button>
      </div>
      <a href="#ticket-edit?id=${ticket.id}" class="btn btn-primary" style="width:100%;text-align:center;display:block;">
        📝 Editar completo
      </a>
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
export function openTicketQuickView(ticket, { onStatusChange } = {}) {
  openDrawer(
    renderHeader(ticket),
    renderBody(ticket),
    (bodyEl) => {
      // Lazy-load timeline
      mountQvTimeline(ticket.id);

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
            _bodyEl.innerHTML = renderBody(ticket);
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

      // Status selector handler
      const select = bodyEl.querySelector('#qv-status-select');
      if (!select) return;

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
  );
}
