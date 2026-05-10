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
