import { getTicketHistory } from '../services/ticket-history.js';
import { formatRelativeTs, TICKET_EVENT_ICONS } from '../core/utils.js';

// ─── HTML builders ───────────────────────────────────────────────────────────

function renderTimelineLoading() {
  return `
    <div style="display: flex; flex-direction: column; gap: var(--space-md); padding: var(--space-sm) 0;">
      ${Array(3).fill(`
        <div style="display: grid; grid-template-columns: 28px 1fr; gap: var(--space-sm);">
          <div class="skeleton" style="width: 24px; height: 24px; border-radius: 50%;"></div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div class="skeleton" style="width: 80%; height: 14px;"></div>
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

  return `
    <div style="
      display: grid;
      grid-template-columns: 28px 1fr;
      gap: var(--space-md);
      padding: var(--space-lg) 0;
      border-bottom: 1px solid var(--border);
    ">
      <span style="font-size: 1.1rem; line-height: 1.5; padding-top: 2px; filter: grayscale(0.2);">${icon}</span>
      <div>
        <div style="font-size: var(--font-sm); color: var(--text-primary); line-height: 1.5; font-weight: 500;">
          ${event.message}
        </div>
        <div style="font-size: var(--font-xs); color: var(--text-muted); margin-top: 6px; display: flex; gap: 12px; align-items: center;">
          <span style="opacity: 0.8; display: flex; align-items: center; gap: 4px;">👤 ${user}</span>
          <span style="opacity: 0.3;">•</span>
          <span style="opacity: 0.8; display: flex; align-items: center; gap: 4px;">🕒 ${time}</span>
        </div>
      </div>
    </div>`;
}

function renderTimelineEvents(events) {
  if (!events.length) return renderTimelineEmpty();
  return events.map(renderEvent).join('');
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Renders the timeline container shell (empty, filled on load).
 * Call mountTicketTimeline() in afterRender to populate it.
 */
export function renderTicketTimeline() {
  return `
    <div class="card glass-card" style="margin-top: var(--space-xl); max-width: 900px;">
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--space-md);
      ">
        <h3 style="
          font-size: var(--font-sm);
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0;
        ">Historial de la orden</h3>
        <span class="badge badge-cyan" style="font-size: var(--font-xs);">Timeline</span>
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
