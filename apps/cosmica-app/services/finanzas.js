import {
  collection, getDocs, addDoc, updateDoc, getDoc, doc,
  query, orderBy, where, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "../../../js/firebase.js";
import { COLLECTIONS, WORK_STATUS } from "../../../js/domain.js";
import { getCurrentSession } from "../core/session.js";
import { getTickets } from "./tickets.js";
import { cacheInvalidate } from '../core/cache.js';

const CACHE_CAJA      = 'finanzas:caja';
const CACHE_HISTORIAL = 'finanzas:historial';

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
 * Returns the currently open caja session, or null if none.
 * Never cached — must always reflect the real DB state.
 */
export async function getCajaSession() {
  try {
    const q = query(
      collection(db, COLLECTIONS.cajaSesiones),
      where('status', '==', 'open'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  } catch (err) {
    console.error('[caja] getCajaSession:', err);
    return null;
  }
}

/**
 * Opens a new caja session.
 * Throws if one is already open.
 */
export async function abrirCaja(saldoInicial) {
  const existing = await getCajaSession();
  if (existing) throw new Error('Ya existe una caja abierta. Cerrala antes de abrir una nueva.');

  const ref = await addDoc(collection(db, COLLECTIONS.cajaSesiones), {
    openedAt:            serverTimestamp(),
    openedBy:            sessionUid(),
    openedByName:        sessionName(),
    saldoInicial:        Number(saldoInicial) || 0,
    status:              'open',
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

  return { success: true, id: ref.id };
}

/**
 * Closes the open caja session with a declared cash amount.
 * Computes the system-expected balance and the difference.
 */
export async function cerrarCaja(sesionId, saldoDeclarado) {
  if (!sesionId) throw new Error('ID de sesión requerido.');
  const declared = Number(saldoDeclarado);
  if (isNaN(declared)) throw new Error('Monto declarado inválido.');

  const sesionRef  = doc(db, COLLECTIONS.cajaSesiones, sesionId);
  const sesionSnap = await getDoc(sesionRef);
  if (!sesionSnap.exists()) throw new Error('Sesión de caja no encontrada.');
  if (sesionSnap.data().status === 'closed') throw new Error('Esta caja ya está cerrada.');

  const saldoInicial = Number(sesionSnap.data().saldoInicial || 0);

  // Fetch all movements for this session
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

  const saldoFinalSistema = saldoInicial + totalIngresos - totalEgresos;
  const diferencia        = declared - saldoFinalSistema;

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

  await updateDoc(sesionRef, {
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

  cacheInvalidate(CACHE_HISTORIAL, CACHE_CAJA);
  return { success: true, saldoFinalSistema, diferencia, totalIngresos, totalEgresos };
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
 */
export async function autoRegistrarIngresoTicket(ticket, sesionId = null) {
  try {
    if (!ticket?.id || !Number(ticket.precio || 0)) return;

    // Dedup check — use ticketRef field
    const dedupSnap = await getDocs(
      query(collection(db, COLLECTIONS.caja), where('ticketRef', '==', ticket.id))
    );
    if (!dedupSnap.empty) return; // already registered

    const cliente = [ticket.nombre, ticket.apellido].filter(Boolean).join(' ').trim();
    const descripcion = [
      `Ticket #${ticket.numeroOrden || '—'}`,
      ticket.equipo || 'Equipo',
      cliente ? `· ${cliente}` : '',
    ].filter(Boolean).join(' ');

    await addDoc(collection(db, COLLECTIONS.caja), {
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
  } catch (err) {
    console.warn('[finanzas] autoRegistrarIngresoTicket (silently failed):', err);
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
  const delivered = tickets.filter(t => t.estado === WORK_STATUS.entregado);
  const ready     = tickets.filter(t => t.estado === WORK_STATUS.listo);
  const withPrice = delivered.filter(t => Number(t.precio || 0) > 0);
  const approved  = tickets.filter(t => t.aprobadoCliente === true);

  // ── KPIs ─────────────────────────────────────────────────────────────────
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
    // ── New fields ────────────────────────────────────────────────────────
    cajaSession,
    cajaSessionEntries,
    cajaSessionData,
    cajaHistorial,
    ajustes,
  };
}
