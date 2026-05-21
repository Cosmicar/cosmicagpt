/**
 * CÓSMICA — Message Templates Engine
 * Deterministic WhatsApp message builders. No AI — pure template logic.
 *
 * Usage:
 *   import { buildReadyMessage, openWhatsApp } from '../core/message-templates.js';
 *   openWhatsApp(ticket.telefono, buildReadyMessage(ticket));
 */

const BRAND_NAME  = 'Cósmica Online';
const BRAND_WEB   = 'https://cosmica.ar';
const BRAND_PHONE = '+54 9 11 0000-0000'; // TODO: replace with real number from config

// ─── Phone normalization ──────────────────────────────────────────────────────

/**
 * Normalizes an Argentine phone number to WhatsApp format (E.164-ish without +).
 * Handles formats like 011-4444-5555, 1544445555, +54 9 11 4444-5555, etc.
 *
 * @param {string} raw
 * @returns {string|null} Digits-only string starting with 549... or null if invalid
 */
export function normalizePhone(raw) {
  if (!raw) return null;
  // Strip all non-digit chars
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 8) return null;

  // Already starts with country code
  if (digits.startsWith('549')) return digits;
  if (digits.startsWith('54'))  return '549' + digits.slice(2);

  // Local Argentine format: 011... → area 11
  if (digits.startsWith('0')) return '549' + digits.slice(1);

  // 10-digit local number: assume area 11 if 10 digits
  if (digits.length === 10) return '549' + digits;

  // 8-digit local: assume Buenos Aires area 11
  if (digits.length === 8) return '54911' + digits;

  return '549' + digits;
}

/**
 * Opens WhatsApp Web on desktop / WhatsApp app on mobile with a pre-filled message.
 *
 * @param {string} phone    Raw phone number (any format)
 * @param {string} message  Pre-filled message text
 */
export function openWhatsApp(phone, message) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    alert('Teléfono no válido. Verificá el número del cliente antes de enviar.');
    return;
  }
  const encoded = encodeURIComponent(message);
  // wa.me handles both desktop (WhatsApp Web) and mobile (app deep-link)
  window.open(`https://wa.me/${normalized}?text=${encoded}`, '_blank', 'noopener');
}

// ─── Money formatter (no Intl dependency) ────────────────────────────────────

function fmt(amount) {
  const n = Number(amount || 0);
  return '$' + n.toLocaleString('es-AR');
}

function nombre(ticket) {
  return [ticket.nombre, ticket.apellido].filter(Boolean).join(' ') || 'Cliente';
}

function equipo(ticket) {
  return [ticket.equipo, ticket.marca, ticket.modelo].filter(Boolean).join(' ') || 'tu equipo';
}

// ─── Message builders ─────────────────────────────────────────────────────────

/**
 * Devuelve el link público de seguimiento de la orden.
 * @param {Object} ticket
 * @returns {string|null}
 */
function linkSeguimiento(ticket) {
  return ticket?.numeroOrden
    ? `https://cosmica.ar/estado.html?orden=${ticket.numeroOrden}`
    : null;
}

/**
 * "Listo para retirar" — sent when status → listo.
 */
export function buildReadyMessage(ticket) {
  const garantia = Number(ticket.garantiaDias) || 90;
  const precio   = Number(ticket.precio || ticket.presupuesto || 0);
  const link     = linkSeguimiento(ticket);
  const lines = [
    `Hola ${nombre(ticket)} 👋`,
    ``,
    `Tu equipo *${equipo(ticket)}* ya está *LISTO para retirar* ✅`,
    precio > 0 ? `💰 Total: *${fmt(precio)}*` : '',
    `🛡 Garantía: ${garantia} días sobre mano de obra`,
    ``,
    `Podés pasar por el taller en nuestro horario habitual.`,
    link ? `\n📍 Revisá el estado de tu equipo en:\n${link}` : '',
    ``,
    `_${BRAND_NAME}_`,
  ].filter(l => l !== null);
  return lines.join('\n');
}

/**
 * "Aquí está tu presupuesto" — sent when presupuesto is set.
 */
export function buildBudgetMessage(ticket) {
  const presupuesto = Number(ticket.presupuesto || 0);
  const lines = [
    `Hola ${nombre(ticket)} 👋`,
    ``,
    `Terminamos de revisar tu *${equipo(ticket)}* y tenemos el presupuesto listo 🔧`,
    ``,
    `💰 Presupuesto estimado: *${fmt(presupuesto)}*`,
    ticket.diagnosticoTecnico ? `📋 Diagnóstico: _${ticket.diagnosticoTecnico}_` : '',
    ``,
    `Respondé este mensaje para *aprobar* o consultar. Sin tu confirmación no comenzamos la reparación.`,
    ``,
    `_${BRAND_NAME}_`,
    `${BRAND_WEB}`,
  ].filter(l => l !== null);
  return lines.join('\n');
}

/**
 * "Solicitar aprobación" — when awaiting client approval.
 */
export function buildApprovalMessage(ticket) {
  const presupuesto = Number(ticket.presupuesto || 0);
  const lines = [
    `Hola ${nombre(ticket)} 👋`,
    ``,
    `Te recordamos que estamos esperando tu *aprobación* para continuar con la reparación de tu *${equipo(ticket)}* 🛠`,
    presupuesto > 0 ? `💰 Monto presupuestado: *${fmt(presupuesto)}*` : '',
    ``,
    `Respondé *SÍ* para aprobar o avisanos si querés cancelar.`,
    ``,
    `_${BRAND_NAME}_`,
    `${BRAND_WEB}`,
  ].filter(l => l !== null);
  return lines.join('\n');
}

/**
 * "Esperando repuesto" — when status → esperandoRepuesto.
 */
export function buildWaitingPartsMessage(ticket) {
  const lines = [
    `Hola ${nombre(ticket)} 👋`,
    ``,
    `Tu *${equipo(ticket)}* está en reparación pero estamos esperando la llegada de un *repuesto* 📦`,
    ``,
    `Te avisamos en cuanto llegue para continuar. Disculpá la demora.`,
    ``,
    `_${BRAND_NAME}_`,
    `${BRAND_WEB}`,
  ].filter(Boolean);
  return lines.join('\n');
}

/**
 * "Recordatorio de retiro" — general follow-up / reminder.
 */
export function buildReminderMessage(ticket) {
  const precio = Number(ticket.precio || ticket.presupuesto || 0);
  const lines = [
    `Hola ${nombre(ticket)} 👋`,
    ``,
    `Te recordamos que tu *${equipo(ticket)}* sigue esperándote en nuestro taller ⏳`,
    precio > 0 ? `💰 Total a abonar: *${fmt(precio)}*` : '',
    ``,
    `Podés pasar a retirarlo en nuestro horario habitual.`,
    ``,
    `_${BRAND_NAME}_`,
    `${BRAND_WEB}`,
  ].filter(l => l !== null);
  return lines.join('\n');
}

/**
 * "Último aviso" — urgent final warning before device is considered abandoned.
 */
export function buildLastWarningMessage(ticket) {
  const precio = Number(ticket.precio || ticket.presupuesto || 0);
  const link   = linkSeguimiento(ticket);
  const lines = [
    `Hola ${nombre(ticket)} 👋`,
    ``,
    `⚠️ *ÚLTIMO AVISO* — Tu *${equipo(ticket)}* lleva más de 30 días en nuestro taller.`,
    precio > 0 ? `💰 Total pendiente: *${fmt(precio)}*` : '',
    ``,
    `Si no retirás el equipo en los próximos días, nos vemos en la necesidad de tomar medidas.`,
    `Por favor comunicate a la brevedad.`,
    link ? `\n📍 Estado de tu equipo:\n${link}` : '',
    ``,
    `_${BRAND_NAME}_ · ${BRAND_PHONE}`,
  ].filter(l => l !== null);
  return lines.join('\n');
}

// ─── Convenience map: estado → default message builder ───────────────────────

/**
 * Returns the most appropriate message builder for a ticket's current state.
 * Used to pick the default WhatsApp action.
 *
 * @param {Object} ticket
 * @returns {{ label: string, build: Function }|null}
 */
export function getDefaultWhatsAppAction(ticket) {
  const estado = ticket?.estado || '';
  if (estado === 'Listo')               return { label: '📲 Avisar listo',         build: buildReadyMessage };
  if (estado === 'Esperando repuesto')  return { label: '📦 Esperando repuesto',   build: buildWaitingPartsMessage };
  if (ticket?.presupuesto > 0 && !ticket?.aprobadoCliente)
                                        return { label: '🛠 Solicitar aprobación', build: buildApprovalMessage };
  if (ticket?.presupuesto > 0)          return { label: '💰 Enviar presupuesto',   build: buildBudgetMessage };
  return null;
}
