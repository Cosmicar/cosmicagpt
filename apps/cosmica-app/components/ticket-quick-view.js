import { openDrawer } from './drawer.js';
import { openTicketPrint } from './ticket-print.js';
import { updateTicketStatus } from '../services/tickets.js';
import { getTicketHistory } from '../services/ticket-history.js';
import { WORK_STATUS } from '../../../js/domain.js';
import { canAccess } from '../core/session.js';
import { showToast } from './toast.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  WORK_STATUS.ingresado,
  WORK_STATUS.enReparacion,
  WORK_STATUS.listo,
  WORK_STATUS.entregado,
];

const EVENT_ICON = {
  ticket_created: '🟢',
  status_changed: '🟡',
  ticket_edited:  '🔵',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function badgeClass(estado) {
  if (estado === WORK_STATUS.enReparacion) return 'badge-orange';
  if (estado === WORK_STATUS.listo)        return 'badge-green';
  if (estado === WORK_STATUS.entregado)    return 'badge-gray';
  return 'badge-cyan';
}

function formatTs(ts) {
  if (!ts) return '—';
  const d    = ts.toDate ? ts.toDate() : new Date(ts);
  const now  = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)    return 'hace un momento';
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
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
        <span style="font-size:1rem;line-height:1.5;padding-top:2px;">${EVENT_ICON[ev.type] || '⚪'}</span>
        <div>
          <div style="font-size:var(--font-sm);color:var(--text-primary);font-weight:500;line-height:1.4;">${ev.message}</div>
          <div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:3px;">
            👤 ${ev.user || 'sistema'}&nbsp;•&nbsp;🕒 ${formatTs(ev.createdAt)}
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
               : `<span class="badge badge-orange" style="font-size:var(--font-xs);">Pendiente aprobación</span>`}
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
    </div>

    <!-- Problema -->
    <div class="qv-separator"></div>
    <div>
      <div class="qv-section-label">Problema reportado</div>
      <p style="font-size:var(--font-sm);color:var(--text-primary);line-height:1.6;margin:0;">
        ${ticket.problema || 'No especificado'}
      </p>
    </div>

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
      <button class="btn btn-secondary qv-print-btn" data-id="${ticket.id}" style="width:100%;">
        🖨 Imprimir Orden
      </button>
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

      // Print button
      const printBtn = bodyEl.querySelector('.qv-print-btn');
      if (printBtn) {
        printBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openTicketPrint(ticket);
        });
      }

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
