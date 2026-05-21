/**
 * Logger estructurado — Cósmica App
 *
 * Reemplaza console.warn/error sueltos con eventos tipados que se persisten
 * en la colección `system_logs` de Firestore. Admin puede revisar el feed
 * en la vista Drift Detection y responder rápido a "caja no cuadra" o
 * "ticket entregado sin pago" sin tener que pedirle al operador que abra
 * el devtools.
 *
 * Diseño:
 *   - Fire-and-forget: nunca bloquea la UI ni propaga errores.
 *   - Batched: agrupa hasta 10 eventos en 2s para reducir writes.
 *   - Local fallback: si Firestore falla, también imprime a console para no
 *     perder el evento durante outages.
 *   - Respeta reglas: `system_logs` solo permite create a staff (ver firestore.rules).
 */

import {
  collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "../../../js/firebase.js";

const BUFFER_FLUSH_MS = 2000;
const BUFFER_MAX_SIZE = 10;
const _buffer = [];
let _flushTimer = null;

/**
 * Niveles válidos. info/warn quedan solo en buffer salvo overflow; error
 * fuerza flush inmediato porque indica algo que admin debe ver pronto.
 */
const LEVELS = Object.freeze({
  info:  'info',
  warn:  'warn',
  error: 'error',
});

function scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(flush, BUFFER_FLUSH_MS);
}

async function flush() {
  clearTimeout(_flushTimer);
  _flushTimer = null;
  if (_buffer.length === 0) return;

  const batch = _buffer.splice(0, _buffer.length);

  // Best-effort: si Firestore falla, conservamos en console como red de seguridad
  for (const entry of batch) {
    try {
      await addDoc(collection(db, 'system_logs'), {
        ...entry,
        ts: serverTimestamp(),
      });
    } catch (err) {
      console.warn('[logger] flush failed for', entry.event, err.message);
    }
  }
}

/**
 * Registra un evento estructurado.
 *
 * @param {string} event   Nombre del evento (ej: 'finanzas.auto_income_failed')
 * @param {object} [data]  Payload arbitrario (uid, ticketId, monto, error.message)
 * @param {'info'|'warn'|'error'} [level]  Default 'info'
 */
export function logEvent(event, data = {}, level = LEVELS.info) {
  if (!event || typeof event !== 'string') return;

  // Datos de sesión inyectados desde session.js (sin import circular)
  const session = (typeof window !== 'undefined' && window.__cosmicaCurrentSession__) || {};
  const entry = {
    event,
    level,
    data:    sanitize(data),
    uid:     session?.user?.uid || null,
    email:   session?.user?.email || null,
    rol:     session?.profile?.rol || null,
    url:     (typeof location !== 'undefined') ? location.hash : '',
    ua:      (typeof navigator !== 'undefined') ? navigator.userAgent.slice(0, 200) : '',
  };

  _buffer.push(entry);

  // También a console — durante desarrollo es crítico ver los eventos
  const consoleFn = level === 'error' ? console.error : (level === 'warn' ? console.warn : console.log);
  consoleFn(`[evt:${event}]`, data);

  if (level === LEVELS.error || _buffer.length >= BUFFER_MAX_SIZE) {
    flush();
  } else {
    scheduleFlush();
  }
}

/**
 * Sanea el payload: convierte Error en {message, stack}, limita strings largos,
 * descarta funciones, evita ciclos.
 */
function sanitize(obj) {
  if (obj === null || obj === undefined) return null;
  try {
    const safe = JSON.parse(JSON.stringify(obj, (_key, value) => {
      if (value instanceof Error) {
        return { __error: true, message: value.message, stack: (value.stack || '').slice(0, 500) };
      }
      if (typeof value === 'function') return '[fn]';
      if (typeof value === 'string' && value.length > 500) return value.slice(0, 500) + '…';
      return value;
    }));
    return safe;
  } catch {
    return { __unsanitizable: true };
  }
}

// Flush al cerrar pestaña — best-effort, ignorable si falla
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => { try { flush(); } catch {} });
}

export const LOG_LEVELS = LEVELS;
