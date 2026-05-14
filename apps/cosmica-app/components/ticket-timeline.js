import { getTicketHistory } from '../services/ticket-history.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EVENT_ICON = {
  ticket_created:  '🟢',
  status_changed:  '🟡',
  ticket_edited:   '🔵',
};

function formatDate(ts) {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const now  = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60)   return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;

  return date.toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ─── HTML builders ───────────────────────────────────────────────────────────

function renderTimelineLoading() {
  return `
    <div style="display:flex; align-items:center; gap:var(--space-sm); color:var(--text-muted); font-size:var(--font-sm); padding:var(--space-md) 0;">
      <span class="badge badge-cyan" style="font-size:var(--font-xs);">Cargando</span>
      <span>Recuperando historial...</span>
    </div>`;
}

function renderTimelineEmpty() {
  return `
    <div style="color:var(--text-muted); font-size:var(--font-sm); padding:var(--space-md) 0;">
      Sin eventos registrados aún.
    </div>`;
}

function renderTimelineError(msg) {
  return `
    <div style="color:var(--accent-orange); font-size:var(--font-sm); padding:var(--space-md) 0;">
      No se pudo cargar el historial: ${msg}
    </div>`;
}

function renderEvent(event) {
  const icon = EVENT_ICON[event.type] || '⚪';
  const time = formatDate(event.createdAt);
  const user = event.user || 'sistema';

  return `
    <div style="
      display: grid;
      grid-template-columns: 28px 1fr;
      gap: var(--space-sm);
      padding: var(--space-sm) 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    ">
      <span style="font-size: 1rem; line-height: 1.5; padding-top: 2px;">${icon}</span>
      <div>
        <div style="font-size: var(--font-sm); color: var(--text-primary); line-height: 1.4;">
          ${event.message}
        </div>
        <div style="font-size: var(--font-xs); color: var(--text-muted); margin-top: 2px;">
          ${user} · ${time}
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
