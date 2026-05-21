export const $ = (id) => document.getElementById(id);

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR");
}

export function nowIso() {
  return new Date().toISOString();
}

export function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value) {
  const date = toDate(value);
  return date ? date.toLocaleString("es-AR") : "—";
}

export function formatDate(value) {
  const date = toDate(value);
  return date ? date.toLocaleDateString("es-AR") : "—";
}

export function daysSince(value) {
  const date = toDate(value);
  if (!date) return 0;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

export function daysRemaining(value, days) {
  const date = toDate(value);
  if (!date) return 0;
  return days - Math.floor((Date.now() - date.getTime()) / 86400000);
}

export function isTodayLocal(value) {
  const date = toDate(value);
  if (!date) return false;
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function isCurrentMonthLocal(value) {
  const date = toDate(value);
  if (!date) return false;
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth()
  );
}

export function onlyDigits(value) {
  return String(value ?? "").replace(/[^0-9]/g, "");
}

export function showAlertError(error, fallback = "Ocurrió un error. Intentá de nuevo.") {
  console.error(error);
  alert(error?.message || fallback);
}

export async function runWithButton(button, busyText, task) {
  const originalText = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = busyText;
  }

  try {
    return await task();
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

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

