import {
  collection, getDocs, addDoc, updateDoc, doc,
  query, orderBy, where, limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "../../../js/firebase.js";
import { COLLECTIONS } from "../../../js/domain.js";
import { getCurrentSession } from "../core/session.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDate(ts) {
  if (!ts) return new Date(0);
  if (ts.toDate) return ts.toDate();
  return new Date(ts);
}

function operadorName() {
  const s = getCurrentSession();
  if (!s?.profile) return s?.user?.email || 'Sistema';
  const { nombre, apellido, rol } = s.profile;
  return [nombre, apellido].filter(Boolean).join(' ') || rol || s.user?.email || 'Sistema';
}

// ── Sesiones ──────────────────────────────────────────────────────────────────

/**
 * Devuelve la sesión de caja abierta, o null si no hay ninguna.
 */
export async function getActiveCajaSession() {
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
    console.error('Error al obtener sesión de caja activa:', err);
    return null;
  }
}

/**
 * Abre una nueva sesión de caja.
 * Lanza error si ya existe una sesión abierta.
 */
export async function openCajaSession({ saldoInicial = 0 }) {
  const active = await getActiveCajaSession();
  if (active) throw new Error('Ya existe una caja abierta. Cerrala antes de abrir una nueva.');

  const session = getCurrentSession();
  const doc_ = {
    openedAt:             serverTimestamp(),
    openedBy:             session?.user?.uid || '',
    openedByName:         operadorName(),
    saldoInicial:         Number(saldoInicial) || 0,
    status:               'open',
    closedAt:             null,
    closedBy:             null,
    closedByName:         null,
    saldoFinalDeclarado:  null,
    saldoFinalSistema:    null,
    ingresosSistema:      null,
    egresosSistema:       null,
    diferencia:           null,
  };

  const ref = await addDoc(collection(db, COLLECTIONS.cajaSesiones), doc_);
  return { success: true, id: ref.id };
}

/**
 * Cierra la sesión activa.
 * Calcula saldo sistema desde movimientos de caja de la sesión.
 * @param {string} sessionId - ID de la sesión a cerrar
 * @param {number} saldoDeclarado - Monto contado físicamente por el operador
 */
export async function closeCajaSession(sessionId, saldoDeclarado) {
  const active = await getActiveCajaSession();
  if (!active || active.id !== sessionId) {
    throw new Error('No hay una caja abierta con ese ID.');
  }

  const { ingresos, egresos } = await getSessionTotals(sessionId);
  const saldoFinalSistema   = active.saldoInicial + ingresos - egresos;
  const saldoFinalDeclarado = Number(saldoDeclarado) || 0;
  const diferencia          = saldoFinalDeclarado - saldoFinalSistema;

  const session = getCurrentSession();
  const now     = new Date();

  await updateDoc(doc(db, COLLECTIONS.cajaSesiones, sessionId), {
    status:              'closed',
    closedAt:            serverTimestamp(),
    closedBy:            session?.user?.uid || '',
    closedByName:        operadorName(),
    saldoFinalDeclarado,
    saldoFinalSistema,
    ingresosSistema:     ingresos,
    egresosSistema:      egresos,
    diferencia,
  });

  return { success: true, ingresos, egresos, saldoFinalSistema, saldoFinalDeclarado, diferencia };
}

/**
 * Calcula ingresos y egresos de los movimientos de caja vinculados a una sesión.
 */
export async function getSessionTotals(sessionId) {
  try {
    const q = query(
      collection(db, COLLECTIONS.caja),
      where('sessionId', '==', sessionId)
    );
    const snap = await getDocs(q);
    const entries = snap.docs.map(d => d.data());
    const ingresos = entries
      .filter(e => e.tipo === 'ingreso')
      .reduce((s, e) => s + Number(e.monto || 0), 0);
    const egresos = entries
      .filter(e => e.tipo === 'egreso')
      .reduce((s, e) => s + Number(e.monto || 0), 0);
    return { ingresos, egresos };
  } catch (err) {
    console.error('Error calculando totales de sesión:', err);
    return { ingresos: 0, egresos: 0 };
  }
}

/**
 * Devuelve el historial de sesiones cerradas, ordenadas por fecha de cierre desc.
 */
export async function getCajaSessionHistory(maxResults = 20) {
  try {
    const q = query(
      collection(db, COLLECTIONS.cajaSesiones),
      where('status', '==', 'closed'),
      orderBy('closedAt', 'desc'),
      limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Error al obtener historial de caja:', err);
    return [];
  }
}

/**
 * Registra automáticamente un ingreso en caja cuando un ticket es entregado.
 * Idempotente: no duplica si ya existe un movimiento con ese ticketId.
 */
export async function registerTicketIngreso(ticket) {
  try {
    if (!ticket?.id || !ticket?.precio || Number(ticket.precio) <= 0) return;

    // Verificar duplicado
    const q = query(
      collection(db, COLLECTIONS.caja),
      where('ticketId', '==', ticket.id),
      limit(1)
    );
    const existing = await getDocs(q);
    if (!existing.empty) return; // ya registrado

    const activeSession = await getActiveCajaSession();
    const session       = getCurrentSession();

    const entry = {
      tipo:        'ingreso',
      descripcion: `Cobro ticket #${ticket.numeroOrden || ticket.id}`,
      monto:       Number(ticket.precio),
      metodoPago:  'efectivo',
      origen:      'ticket',
      ticketId:    ticket.id,
      numeroOrden: ticket.numeroOrden || '',
      sessionId:   activeSession?.id || null,
      createdAt:   serverTimestamp(),
      createdBy:   session?.user?.uid || '',
    };

    await addDoc(collection(db, COLLECTIONS.caja), entry);
  } catch (err) {
    console.error('Error al registrar ingreso automático de ticket:', err);
  }
}
