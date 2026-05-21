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
  ticket_created:          '🟢',
  status_changed:          '🟡',
  ticket_edited:           '🔵',
  budget_approved:         '💎',
  financial_adjustment:    '💰',
  payment_method_changed:  '⚖️',
  inventory_adjust_failed: '⚠️',
  undo_success:            '↩️',
  undo_rejected:           '🚫',
  technician_assigned:     '👨‍🔧',
  technician_unassigned:   '👤',
  customer_notified:       '📲',
  reminder_sent:           '🔔',
  delivery_warning:        '⚠️',
  abandoned_flagged:       '🔴',
};

/**
 * Normaliza nombres de provincias para evitar duplicados por escritura,
 * capitalización, guiones bajos o faltas de ortografía/acentos.
 * Mapea valores vacíos o indeterminados a 'Sin especificar'.
 *
 * @param {string} prov
 * @returns {string}
 */
export function normalizeProvincia(prov) {
  if (!prov) return 'Sin especificar';
  const clean = prov.trim().toLowerCase().replace(/_/g, ' ');
  if (!clean || clean === 'no definida' || clean === 'no_definida' || clean === 'desconocida' || clean === 'sin especificar') {
    return 'Sin especificar';
  }
  const mapping = {
    'buenos aires': 'Buenos Aires',
    'caba': 'CABA',
    'catamarca': 'Catamarca',
    'chaco': 'Chaco',
    'chubut': 'Chubut',
    'cordoba': 'Córdoba',
    'corrientes': 'Corrientes',
    'entre rios': 'Entre Ríos',
    'formosa': 'Formosa',
    'jujuy': 'Jujuy',
    'la pampa': 'La Pampa',
    'la rioja': 'La Rioja',
    'mendoza': 'Mendoza',
    'misiones': 'Misiones',
    'neuquen': 'Neuquén',
    'rio negro': 'Río Negro',
    'salta': 'Salta',
    'san juan': 'San Juan',
    'san luis': 'San Luis',
    'santa cruz': 'Santa Cruz',
    'santa fe': 'Santa Fe',
    'santiago del estero': 'Santiago del Estero',
    'tierra del fuego': 'Tierra del Fuego',
    'tucuman': 'Tucumán'
  };
  
  if (mapping[clean]) return mapping[clean];

  // Comparar removiendo acentos
  const cleanAccent = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const pClean = cleanAccent(clean);
  for (const [key, value] of Object.entries(mapping)) {
    if (cleanAccent(key) === pClean) {
      return value;
    }
  }

  // Fallback: Capitalizar palabras
  return clean.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

