import {
  collection, getDocs, addDoc, updateDoc, getDoc, doc,
  query, orderBy, where, limit, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "../../../js/firebase.js";
import { COLLECTIONS, WORK_STATUS, SERVICE_TYPES } from "../../../js/domain.js";
import { getCurrentSession } from "../core/session.js";
import { getTickets } from "./tickets.js";
import { cacheInvalidate } from '../core/cache.js';

const CACHE_CAJA      = 'finanzas:caja';
const CACHE_HISTORIAL = 'finanzas:historial';

// ── Race-condition guard for autoRegistrarIngresoTicket ───────────────────────
// In-memory Set prevents two simultaneous async calls from both passing the
// Firestore dedup check and inserting duplicate income entries.
const _cajaInFlight = new Set();
let _comisionesCache = null;
export function clearComisionesCache() {
  _comisionesCache = null;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function toDate(ts) {
  if (!ts) return new Date(0);
  if (ts.toDate) return ts.toDate();
  return new Date(ts);
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Devuelve el inicio del último sábado (día de rendición semanal).
 * Si hoy es sábado, devuelve el inicio de hoy mismo.
 */
function startOfLastSaturday() {
  const d = new Date();
  // getDay(): 0=Dom, 1=Lun, ... 6=Sáb
  const dayOfWeek = d.getDay(); // 0-6
  const daysSinceSat = dayOfWeek === 6 ? 0 : (dayOfWeek + 1); // cuántos días atrás fue el sábado
  d.setDate(d.getDate() - daysSinceSat);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Devuelve los días que faltan para el próximo sábado.
 * Si hoy es sábado devuelve 0.
 */
function daysUntilNextSaturday() {
  const dayOfWeek = new Date().getDay(); // 0=Dom ... 6=Sáb
  if (dayOfWeek === 6) return 0;
  return 6 - dayOfWeek;
}

// ── Session helpers ───────────────────────────────────────────────────────────

function sessionName() {
  const s = getCurrentSession();
  return s?.profile?.nombre || s?.user?.email || 'Operador';
}

function sessionUid() {
  return getCurrentSession()?.user?.uid || '';
}

// ── Caja Session Management ───────────────────────────────────────────────────

/**
 * Returns the currently open caja session for a given tipo ('taller' | 'remoto').
 * Sessions without tipo field are treated as 'taller' (backward compat).
 * Never cached — must always reflect the real DB state.
 */
export async function getCajaSessionByTipo(tipo = 'taller') {
  try {
    const snap = await getDocs(query(
      collection(db, COLLECTIONS.cajaSesiones),
      where('status', '==', 'open'),
      limit(10)  // small limit — few cajas open at a time
    ));
    if (snap.empty) return null;
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Taller: sessions with tipo=='taller' OR legacy sessions without tipo
    if (tipo === 'taller') {
      return docs.find(d => d.tipo === 'taller' || !d.tipo) || null;
    }
    return docs.find(d => d.tipo === tipo) || null;
  } catch (err) {
    console.error(`[caja] getCajaSessionByTipo(${tipo}):`, err);
    return null;
  }
}

/**
 * Returns the currently open caja session (taller), or null if none.
 * Kept for backward compatibility.
 */
export async function getCajaSession() {
  return getCajaSessionByTipo('taller');
}

/**
 * @param {number} saldoInicial
 * @param {'taller'|'remoto'} tipo - tipo de caja a abrir (default: 'taller')
 */
export async function abrirCaja(saldoInicial, tipo = 'taller') {
  const existing = await getCajaSessionByTipo(tipo);
  if (existing) throw new Error(`Ya existe una caja ${tipo} abierta. Cerrala antes de abrir una nueva.`);

  // Each tipo uses its own config doc to avoid mutex conflicts between cajas
  const configKey = tipo === 'remoto' ? 'caja_remoto_status' : 'caja_status';
  const configRef = doc(db, 'config', configKey);

  const id = await runTransaction(db, async (t) => {
    const configSnap = await t.get(configRef);
    if (configSnap.exists() && configSnap.data().isOpen) {
      throw new Error(`Ya existe una caja ${tipo} abierta. Cerrala antes de abrir una nueva.`);
    }

    const newRef = doc(collection(db, COLLECTIONS.cajaSesiones));
    t.set(newRef, {
      openedAt:            serverTimestamp(),
      openedBy:            sessionUid(),
      openedByName:        sessionName(),
      saldoInicial:        Number(saldoInicial) || 0,
      status:              'open',
      tipo,
      closedAt:            null,
      closedBy:            null,
      closedByName:        null,
      saldoFinalDeclarado: null,
      saldoFinalSistema:   null,
      diferencia:          null,
      totalIngresos:       null,
      totalEgresos:        null,
      movimientosCount:    null,
    });

    t.set(configRef, { isOpen: true, currentSessionId: newRef.id }, { merge: true });
    return newRef.id;
  });

  return { success: true, id };
}

export async function cerrarCaja(sesionId, saldoDeclarado) {
  if (!sesionId) throw new Error('ID de sesión requerido.');
  const declared = Number(saldoDeclarado);
  if (isNaN(declared)) throw new Error('Monto declarado inválido.');

  // Fetch all movements for this session outside the transaction
  const movSnap = await getDocs(
    query(collection(db, COLLECTIONS.caja), where('sesionId', '==', sesionId))
  );
  const entries = movSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const totalIngresos = entries
    .filter(e => e.tipo === 'ingreso' || (e.tipo === 'ajuste' && Number(e.monto || 0) > 0))
    .reduce((s, e) => s + Math.abs(Number(e.monto || 0)), 0);
  const totalEgresos = entries
    .filter(e => e.tipo === 'egreso' || (e.tipo === 'ajuste' && Number(e.monto || 0) < 0))
    .reduce((s, e) => s + Math.abs(Number(e.monto || 0)), 0);

  const calcTotalByMethod = (method) => entries
    .filter(e => e.metodoPago === method)
    .reduce((s, e) => {
      const m = Number(e.monto || 0);
      return s + (e.tipo === 'egreso' || (e.tipo === 'ajuste' && m < 0) ? -Math.abs(m) : Math.abs(m));
    }, 0);

  const totalEfectivo      = calcTotalByMethod('efectivo');
  const totalTransferencia = calcTotalByMethod('transferencia');
  const totalMP            = calcTotalByMethod('mercadopago');
  const totalDebito        = calcTotalByMethod('debito');
  const totalCredito       = calcTotalByMethod('credito');

  const sesionRef = doc(db, COLLECTIONS.cajaSesiones, sesionId);

  const res = await runTransaction(db, async (t) => {
    const sesionSnap = await t.get(sesionRef);
    if (!sesionSnap.exists()) throw new Error('Sesión de caja no encontrada.');
    if (sesionSnap.data().status === 'closed') throw new Error('Esta caja ya está cerrada.');

    // Determine config doc based on session tipo (backward compat: no tipo → taller)
    const sesionTipo = sesionSnap.data().tipo || 'taller';
    const configKey  = sesionTipo === 'remoto' ? 'caja_remoto_status' : 'caja_status';
    const configRef  = doc(db, 'config', configKey);

    const saldoInicial = Number(sesionSnap.data().saldoInicial || 0);
    const saldoFinalSistema = saldoInicial + totalIngresos - totalEgresos;
    const diferencia        = declared - saldoFinalSistema;

    t.update(sesionRef, {
      status:              'closed',
      closedAt:            serverTimestamp(),
      closedBy:            sessionUid(),
      closedByName:        sessionName(),
      saldoFinalDeclarado: declared,
      saldoFinalSistema,
      diferencia,
      totalIngresos,
      totalEgresos,
      totalEfectivo,
      totalTransferencia,
      totalMP,
      totalDebito,
      totalCredito,
      movimientosCount:    entries.length,
    });

    t.set(configRef, { isOpen: false, currentSessionId: null }, { merge: true });

    return { saldoFinalSistema, diferencia, totalIngresos, totalEgresos };
  });

  cacheInvalidate(CACHE_HISTORIAL, CACHE_CAJA);
  return { success: true, ...res };
}

/**
 * Returns the last N closed caja sessions (historial de cierres).
 */
export async function getCajaHistorial(n = 10) {
  try {
    const q = query(
      collection(db, COLLECTIONS.cajaSesiones),
      where('status', '==', 'closed'),
      orderBy('closedAt', 'desc'),
      limit(n)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('[caja] getCajaHistorial:', err);
    return [];
  }
}

// ── Caja Movements ────────────────────────────────────────────────────────────

/**
 * Fetches caja entries, optionally scoped to a session.
 */
export async function getCajaEntries(sesionId = null) {
  try {
    let q;
    if (sesionId) {
      q = query(
        collection(db, COLLECTIONS.caja),
        where('sesionId', '==', sesionId),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(collection(db, COLLECTIONS.caja), orderBy('createdAt', 'desc'));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('[caja] getCajaEntries:', err);
    return [];
  }
}

/**
 * Creates a manual caja movement.
 * Requires an open caja session (sesionId must be provided).
 */
export async function createCajaEntry(data, sesionId = null) {
  try {
    if (!data.descripcion?.trim()) throw new Error('La descripción es obligatoria.');
    const monto = Number(data.monto);
    if (isNaN(monto) || monto === 0) throw new Error('El monto es inválido.');
    // Admin adjustments on delivered tickets are allowed without an open session
    // (they carry pendingReconciliation: true for later reconciliation).
    if (!sesionId && !data.pendingReconciliation) {
      throw new Error('No hay caja abierta. Abrí la caja antes de registrar movimientos.');
    }

    const tipo = ['ingreso', 'egreso', 'ajuste'].includes(data.tipo) ? data.tipo : 'ingreso';

    const ref = await addDoc(collection(db, COLLECTIONS.caja), {
      tipo,
      descripcion: data.descripcion.trim(),
      monto,
      metodoPago:  ['efectivo', 'transferencia', 'mercadopago', 'debito', 'credito'].includes(data.metodoPago)
        ? data.metodoPago : 'efectivo',
      origen:               data.origen || 'manual',
      ticketRef:            data.ticketRef || null,
      pendingReconciliation: data.pendingReconciliation ?? false,
      sesionId,
      createdAt: serverTimestamp(),
      createdBy: sessionUid(),
    });

    cacheInvalidate(CACHE_CAJA);
    return { success: true, id: ref.id };
  } catch (err) {
    console.error('[caja] createCajaEntry:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Auto-registers income from a delivered ticket.
 * Idempotent: skips silently if already registered for this ticket.
 * Non-fatal: errors are swallowed so ticket flow is never blocked.
 *
 * Race-condition protection:
 *   - In-memory _cajaInFlight Set prevents two simultaneous calls for the same
 *     ticket from both passing the Firestore dedup check.
 *   - Firestore dedup query is scoped to tipo=='ingreso' so it doesn't match
 *     admin adjustment entries with the same ticketRef.
 */
export async function autoRegistrarIngresoTicket(ticket, sesionId = null) {
  if (!ticket?.id || !Number(ticket.precio || 0)) {
    return { success: true, skipped: true, reason: 'no-price-or-id' };
  }

  // In-memory guard: intercept concurrent duplicate calls in the same JS process
  const eventKey = `${ticket.id}_ingreso`;
  if (_cajaInFlight.has(eventKey)) {
    console.warn('[finanzas] autoRegistrarIngresoTicket: concurrent call intercepted for', ticket.id);
    return { success: true, alreadyExists: true, reason: 'concurrent-call' };
  }
  _cajaInFlight.add(eventKey);

  try {
    // Firestore dedup — scoped to tipo=='ingreso' so admin adjustments don't mask this check
    const dedupSnap = await getDocs(
      query(
        collection(db, COLLECTIONS.caja),
        where('ticketRef', '==', ticket.id),
        where('tipo', '==', 'ingreso'),
      )
    );
    if (!dedupSnap.empty) return { success: true, alreadyExists: true };

    const cliente = [ticket.nombre, ticket.apellido].filter(Boolean).join(' ').trim();
    const descripcion = [
      `Ticket #${ticket.numeroOrden || '—'}`,
      ticket.equipo || 'Equipo',
      cliente ? `· ${cliente}` : '',
    ].filter(Boolean).join(' ');

    const ref = await addDoc(collection(db, COLLECTIONS.caja), {
      tipo:        'ingreso',
      descripcion,
      monto:       Number(ticket.precio),
      metodoPago:  ticket.metodoPago || 'efectivo',
      origen:      'ticket',
      ticketRef:   ticket.id,
      sesionId:    sesionId || null,
      createdAt:   serverTimestamp(),
      createdBy:   sessionUid() || 'sistema',
    });

    cacheInvalidate(CACHE_CAJA);
    return { success: true, id: ref.id };
  } catch (err) {
    console.error('[finanzas] autoRegistrarIngresoTicket failed:', err);
    // ⬆ ahora propagamos error como resultado — el caller decide si abortar la entrega
    return { success: false, error: err.message || 'Error desconocido al registrar caja' };
  } finally {
    _cajaInFlight.delete(eventKey);
  }
}

// ── Main aggregation ──────────────────────────────────────────────────────────

export async function getFinanzasData() {
  const [tickets, cajaEntries, cajaSession, cajaHistorial] = await Promise.all([
    getTickets(),
    getCajaEntries(),
    getCajaSession(),
    getCajaHistorial(10),
  ]);

  // ── Ticket segments ───────────────────────────────────────────────────────
  const delivered    = tickets.filter(t => t.estado === WORK_STATUS.entregado);
  const ready        = tickets.filter(t => t.estado === WORK_STATUS.listo);
  const withPrice    = delivered.filter(t => Number(t.precio || 0) > 0);
  const approved     = tickets.filter(t => t.aprobadoCliente === true);

  // Separar por tipo de servicio
  const withPriceTaller = withPrice.filter(t => (t.tipo || '') !== SERVICE_TYPES.remoto);
  const withPriceRemoto = withPrice.filter(t => t.tipo === SERVICE_TYPES.remoto);

  // ── KPIs globales ─────────────────────────────────────────────────────────
  const facturacionConcretada  = withPrice.reduce((s, t) => s + Number(t.precio || 0), 0);
  const facturacionPotencial   = approved.reduce((s, t) => s + Number(t.presupuesto || 0), 0);
  const costoRepuestos         = tickets.reduce((s, t) => s + Number(t.totalRepuestos || 0), 0);
  const gananciaEstimada       = facturacionConcretada - costoRepuestos;
  const ticketsPendientesCobro = ready.length;
  const ticketPromedio         = withPrice.length
    ? Math.round(facturacionConcretada / withPrice.length) : 0;
  const margenPct              = facturacionConcretada > 0
    ? Math.round((gananciaEstimada / facturacionConcretada) * 100) : null;

  // ── Top tickets ───────────────────────────────────────────────────────────
  const ticketsMasRentables = [...withPrice]
    .sort((a, b) => Number(b.precio || 0) - Number(a.precio || 0))
    .slice(0, 5);

  const ultimosCobrados = [...withPrice]
    .sort((a, b) => toDate(b.fechaEntregado || b.updatedAt) - toDate(a.fechaEntregado || a.updatedAt))
    .slice(0, 5);

  // ── Rendición semanal — TALLER (tickets pendientes de liquidar) ───────────
  // Solo taller: el remoto va directo a la empresa, no pasa por el cierre semanal
  const diasHastaRendicion       = daysUntilNextSaturday();
  const tallerPendientes         = withPriceTaller.filter(t => t.liquidado !== true);
  const remotoPendientes         = withPriceRemoto; // Todos los remoto (se contabilizan aparte)
  const facturacionDesdeRendicion        = tallerPendientes.reduce((s, t) => s + Number(t.precio || 0), 0);
  const facturacionRemotoDesdeRendicion  = remotoPendientes.reduce((s, t) => s + Number(t.precio || 0), 0);
  // Para el banner usamos solo taller (que requiere rendición)
  const withPriceSinceRendicion  = tallerPendientes;

  // ── Plan distribution ─────────────────────────────────────────────────────
  const distribucionPlanes = {};
  for (const t of tickets) {
    const plan = t.planServicio || 'estandar';
    distribucionPlanes[plan] = (distribucionPlanes[plan] || 0) + 1;
  }

  // ── Caja aggregates (all-time entries, for weekly/daily KPIs) ─────────────
  const todayStart = startOfDay();
  const weekStart  = startOfWeek();
  const cajaHoy    = cajaEntries.filter(e => toDate(e.createdAt) >= todayStart);
  const cajaSemana = cajaEntries.filter(e => toDate(e.createdAt) >= weekStart);

  const calcCaja = (entries) => {
    const ingresos = entries.filter(e => e.tipo === 'ingreso' || (e.tipo === 'ajuste' && Number(e.monto || 0) > 0)).reduce((s, e) => s + Math.abs(Number(e.monto || 0)), 0);
    const egresos  = entries.filter(e => e.tipo === 'egreso' || (e.tipo === 'ajuste' && Number(e.monto || 0) < 0)).reduce((s, e) => s + Math.abs(Number(e.monto || 0)), 0);
    return {
      ingresos,
      egresos,
      get balance() { return this.ingresos - this.egresos; },
    };
  };

  const cajaDia = calcCaja(cajaHoy);
  const cajaSem = calcCaja(cajaSemana);

  // Session-scoped entries (for the live caja panel)
  const cajaSessionEntries = cajaSession
    ? cajaEntries.filter(e => e.sesionId === cajaSession.id)
    : [];
  const cajaSessionData = calcCaja(cajaSessionEntries);

  // ── Tickets delivered today ───────────────────────────────────────────────
  const todayStr = new Date().toISOString().split('T')[0];
  const entregadosHoy = delivered.filter(t => (t.fechaEntregado || '').startsWith(todayStr));

  // ── Ajustes contables (admin adjustments on delivered tickets) ────────────
  const ajusteMovimientos = cajaEntries.filter(e => e.origen === 'admin_adjustment');
  const ajustePositivos   = ajusteMovimientos.filter(e => Number(e.monto || 0) > 0);
  const ajusteNegativos   = ajusteMovimientos.filter(e => Number(e.monto || 0) < 0);
  const ajusteNeto        = ajusteMovimientos.reduce((s, e) => s + Number(e.monto || 0), 0);
  const ajusteTicketRefs  = [...new Set(ajusteMovimientos.map(e => e.ticketRef).filter(Boolean))];
  const ajustePendientes  = ajusteMovimientos.filter(e => e.pendingReconciliation === true);
  const ajustes = {
    movimientos:      ajusteMovimientos,
    positivos:        ajustePositivos,
    negativos:        ajusteNegativos,
    neto:             ajusteNeto,
    ticketsAfectados: ajusteTicketRefs.length,
    pendientes:       ajustePendientes,
  };

  let comisiones = _comisionesCache;
  if (!comisiones) {
    try {
      const cfgSnap = await getDoc(doc(db, 'config', 'comisiones'));
      if (cfgSnap.exists()) {
        comisiones = cfgSnap.data();
      } else {
        comisiones = { taller: 30, remoto: 20 };
      }
      _comisionesCache = comisiones;
    } catch (e) {
      console.warn('[finanzas] Fallback a config default:', e);
      comisiones = { taller: 30, remoto: 20 };
    }
  }

  return {
    kpis: {
      facturacionConcretada,
      facturacionPotencial,
      costoRepuestos,
      gananciaEstimada,
      ticketsPendientesCobro,
      ticketPromedio,
      margenPct,
      totalTickets:    tickets.length,
      totalEntregados: delivered.length,
      totalConPrecio:  withPrice.length,
      // Rendición semanal — TALLER
      facturacionDesdeRendicion,
      ticketsDesdeRendicion:       tallerPendientes.length,
      diasHastaRendicion,
      // Remoto (siempre abierto, va directo empresa)
      facturacionRemotoDesdeRendicion,
      ticketsRemoto:               withPriceRemoto.length,
      ticketsTaller:               withPriceTaller.length,
    },
    ticketsMasRentables,
    ultimosCobrados,
    distribucionPlanes,
    cajaEntries,
    cajaHoy,
    cajaSemana,
    cajaDia,
    cajaSem,
    entregadosHoy,
    cajaSession,
    cajaSessionEntries,
    cajaSessionData,
    cajaHistorial,
    ajustes,
    comisiones,
  };
}
