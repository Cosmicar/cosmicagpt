import { getTicketHistory } from '../services/ticket-history.js';
import { formatRelativeTs, TICKET_EVENT_ICONS } from '../core/utils.js';

// ─── HTML builders ───────────────────────────────────────────────────────────

function renderTimelineLoading() {
  return `
    <div class="timeline-container">
      ${Array(3).fill(`
        <div class="timeline-item">
          <div class="skeleton timeline-icon-wrapper" style="border-radius: 50%;"></div>
          <div class="timeline-content">
            <div class="skeleton" style="width: 80%; height: 14px; margin-bottom: 8px;"></div>
            <div class="skeleton" style="width: 40%; height: 10px;"></div>
          </div>
        </div>
      `).join('')}
    </div>`;
}

function renderTimelineEmpty() {
  return `
    <div style="color:var(--text-muted); font-size:var(--font-sm); padding:var(--space-md) 0; text-align: center; opacity: 0.6;">
      No hay eventos registrados en esta orden aún.
    </div>`;
}

function renderTimelineError(msg) {
  return `
    <div style="color:var(--danger); font-size:var(--font-sm); padding:var(--space-md) 0; text-align: center; background: rgba(255,0,0,0.05); border-radius: var(--radius-sm);">
      ⚠️ Error: ${msg}
    </div>`;
}

function renderEvent(event) {
  const icon = TICKET_EVENT_ICONS[event.type] || '⚪';
  const time = formatRelativeTs(event.createdAt);
  const user = event.user || 'sistema';
  const meta = event.metadata || {};

  let detailHtml = '';
  
  if (event.type === 'status_changed' && meta.from && meta.to) {
    detailHtml = `
      <div class="timeline-detail detail-status">
        <div style="font-weight: 600; margin-bottom: 2px;">🟡 Cambio de Estado</div>
        <div style="font-family: monospace; opacity: 0.9;">${meta.from} → ${meta.to}</div>
      </div>
    `;
  } else if (event.type === 'ticket_edited' && meta.presupuesto !== undefined) {
    detailHtml = `
      <div class="timeline-detail detail-edit">
        <div style="font-weight: 600; margin-bottom: 2px;">💰 Presupuesto</div>
        <div style="font-family: monospace; opacity: 0.9;">$${meta.presupuesto.toLocaleString('es-AR')}</div>
      </div>
    `;
  } else if (event.type === 'ticket_edited' && meta.totalRepuestos !== undefined) {
    detailHtml = `
      <div class="timeline-detail detail-finance">
        <div style="font-weight: 600; margin-bottom: 2px;">🔧 Repuestos</div>
        <div style="font-family: monospace; opacity: 0.9;">Total: $${meta.totalRepuestos.toLocaleString('es-AR')} (${meta.cantidad} ítems)</div>
      </div>
    `;
  }

  return `
    <div class="timeline-item">
      <div class="timeline-icon-wrapper">${icon}</div>
      <div class="timeline-content">
        <div class="timeline-message">${event.message}</div>
        ${detailHtml}
        <div class="timeline-meta">
          <span>👤 ${user}</span>
          <span>🕒 ${time}</span>
        </div>
      </div>
    </div>`;
}

function renderTimelineEvents(events) {
  if (!events.length) return renderTimelineEmpty();
  return `<div class="timeline-container">${events.map(renderEvent).join('')}</div>`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Renders the timeline container shell (empty, filled on load).
 * Call mountTicketTimeline() in afterRender to populate it.
 */
export function renderTicketTimeline() {
  return `
    <div class="card glass-card" style="margin-top: var(--space-lg); max-width: 900px;">
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--space-md);
      ">
        <h3 style="
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin: 0;
        ">Historial de la orden</h3>
        <span class="badge" style="font-size: 9px; opacity: 0.8;">Timeline</span>
      </div>
      <div id="ticket-timeline-events">
        ${renderTimelineLoading()}
      </div>
    </div>`;
}

/**
 * Fetches history and injects events into #ticket-timeline-events.
 * Call this after the view is mounted in the DOM.
 *
 * @param {string} ticketId
 */
export async function mountTicketTimeline(ticketId) {
  const container = document.getElementById('ticket-timeline-events');
  if (!container) return;

  try {
    const events = await getTicketHistory(ticketId);
    container.innerHTML = renderTimelineEvents(events);
  } catch (err) {
    container.innerHTML = renderTimelineError(err.message || 'Error desconocido');
  }
}
