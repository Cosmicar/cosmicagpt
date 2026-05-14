import {
  collection, getDocs, addDoc,
  query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "../../../js/firebase.js";
import { COLLECTIONS, WORK_STATUS } from "../../../js/domain.js";
import { getCurrentSession } from "../core/session.js";
import { getTickets } from "./tickets.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Main data aggregation ─────────────────────────────────────────────────────

export async function getFinanzasData() {
  const [tickets, cajaEntries] = await Promise.all([
    getTickets(),
    getCajaEntries(),
  ]);

  // ── Ticket segments ────────────────────────────────────────────────────────
  const delivered  = tickets.filter(t => t.estado === WORK_STATUS.entregado);
  const ready      = tickets.filter(t => t.estado === WORK_STATUS.listo);
  const withPrice  = delivered.filter(t => Number(t.precio || 0) > 0);
  const approved   = tickets.filter(t => t.aprobadoCliente === true);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const facturacionConcretada = withPrice.reduce((s, t) => s + Number(t.precio || 0), 0);
  const facturacionPotencial  = approved.reduce((s, t) => s + Number(t.presupuesto || 0), 0);
  const costoRepuestos        = tickets.reduce((s, t) => s + Number(t.totalRepuestos || 0), 0);
  const gananciaEstimada      = facturacionConcretada - costoRepuestos;
  const ticketsPendientesCobro = ready.length;
  const ticketPromedio        = withPrice.length
    ? Math.round(facturacionConcretada / withPrice.length)
    : 0;
  const margenPct             = facturacionConcretada > 0
    ? Math.round((gananciaEstimada / facturacionConcretada) * 100)
    : null;

  // ── Top tickets ────────────────────────────────────────────────────────────
  const ticketsMasRentables = [...withPrice]
    .sort((a, b) => Number(b.precio || 0) - Number(a.precio || 0))
    .slice(0, 5);

  const ultimosCobrados = [...withPrice]
    .sort((a, b) => toDate(b.fechaEntregado || b.updatedAt) - toDate(a.fechaEntregado || a.updatedAt))
    .slice(0, 5);

  // ── Plan distribution ──────────────────────────────────────────────────────
  const distribucionPlanes = {};
  for (const t of tickets) {
    const plan = t.planServicio || 'estandar';
    distribucionPlanes[plan] = (distribucionPlanes[plan] || 0) + 1;
  }

  // ── Caja aggregates ────────────────────────────────────────────────────────
  const todayStart = startOfDay();
  const weekStart  = startOfWeek();

  const cajaHoy    = cajaEntries.filter(e => toDate(e.createdAt) >= todayStart);
  const cajaSemana = cajaEntries.filter(e => toDate(e.createdAt) >= weekStart);

  const calcCaja = (entries) => ({
    ingresos: entries.filter(e => e.tipo === 'ingreso').reduce((s, e) => s + Number(e.monto || 0), 0),
    egresos:  entries.filter(e => e.tipo === 'egreso').reduce((s, e) => s + Number(e.monto || 0), 0),
    get balance() { return this.ingresos - this.egresos; },
  });

  const cajaDia    = calcCaja(cajaHoy);
  const cajaSem    = calcCaja(cajaSemana);

  // ── Tickets delivered today ────────────────────────────────────────────────
  const todayStr = new Date().toISOString().split('T')[0];
  const entregadosHoy = delivered.filter(t => {
    const d = t.fechaEntregado || '';
    return d.startsWith(todayStr);
  });

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
  };
}

// ── Caja CRUD ─────────────────────────────────────────────────────────────────

export async function getCajaEntries() {
  try {
    const q = query(collection(db, COLLECTIONS.caja), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Error al obtener caja:', err);
    return [];
  }
}

export async function createCajaEntry(data) {
  try {
    if (!data.descripcion?.trim()) throw new Error('La descripción es obligatoria.');
    const monto = Number(data.monto);
    if (!monto || monto <= 0) throw new Error('El monto debe ser mayor a cero.');

    const session = getCurrentSession();
    const entry = {
      tipo:        data.tipo === 'egreso' ? 'egreso' : 'ingreso',
      descripcion: data.descripcion.trim(),
      monto,
      metodoPago:  ['efectivo', 'transferencia', 'tarjeta'].includes(data.metodoPago)
        ? data.metodoPago : 'efectivo',
      createdAt: serverTimestamp(),
      createdBy: session?.user?.uid || '',
    };

    const ref = await addDoc(collection(db, COLLECTIONS.caja), entry);
    return { success: true, id: ref.id };
  } catch (err) {
    console.error('Error al registrar en caja:', err);
    return { success: false, error: err.message };
  }
}
