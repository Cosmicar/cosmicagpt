// Shared utility functions used across multiple modules.
// Import from here to avoid duplicating logic in views and components.

/**
 * Formats a Firestore timestamp or date into a human-readable relative string.
 * Examples: "hace un momento", "hace 5 min", "hace 3 h", "12/05/24 09:30"
 *
 * @param {*} ts  Firestore Timestamp, ISO string, or Date
 * @returns {string}
 */
export function formatRelativeTs(ts) {
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

/**
 * Emoji icons for ticket history event types.
 * Used in ticket-timeline.js and ticket-quick-view.js.
 */
export const TICKET_EVENT_ICONS = {
  ticket_created: '🟢',
  status_changed: '🟡',
  ticket_edited:  '🔵',
  budget_approved: '💎',
  financial_adjustment: '💰',
};
