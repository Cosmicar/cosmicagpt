import { getTickets, isOverdue } from './tickets.js';
import { getClientes } from './clientes.js';
import { WORK_STATUS, COLLECTIONS } from '../../../js/domain.js';
import { getClientBadge, getReentryRisk } from '../core/intelligence.js';
import { collectionGroup, query, orderBy, limit, getDocs, collection } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "../../../js/firebase.js";

// ── Internal helpers ──────────────────────────────────────────────────────────

function computeMetrics(tickets) {
  const todayStr = new Date().toISOString().split('T')[0];
  return tickets.reduce((acc, t) => {
    if (t.estado === WORK_STATUS.ingresado)    acc.pending++;
    if (t.estado === WORK_STATUS.enReparacion) acc.inRepair++;
    if (t.estado === WORK_STATUS.listo)        acc.ready++;
    if (isOverdue(t))                          acc.overdue++;
    if (t.estado === WORK_STATUS.entregado && t.fechaEntregado?.split('T')[0] === todayStr) {
      acc.deliveredToday++;
    }
    return acc;
  }, { pending: 0, inRepair: 0, ready: 0, deliveredToday: 0, overdue: 0 });
}

function computeAttentionRequired(tickets) {
  const now = new Date();
  
  return tickets.filter(t => {
    const updatedAt = new Date(t.updatedAt || t.createdAt);
    const daysSinceUpdate = (now - updatedAt) / (1000 * 60 * 60 * 24);
    
    // - en reparación > 7 días
    if (t.estado === WORK_STATUS.enReparacion && daysSinceUpdate > 7) return true;
    
    // - esperando repuesto > 15 días
    if (t.estado === WORK_STATUS.esperandoRepuesto && daysSinceUpdate > 15) return true;
    
    // - listos > 5 días sin entregar
    if (t.estado === WORK_STATUS.listo && daysSinceUpdate > 5) return true;
    
    return false;
  }).sort((a,b) => {
    const dateA = new Date(a.updatedAt || a.createdAt);
    const dateB = new Date(b.updatedAt || b.createdAt);
    return dateA - dateB; // Oldest first
  }).slice(0, 5);
}

function computeRecentClients(clientes, limit = 5) {
  return [...clientes]
    .sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return dateB - dateA;
    })
    .slice(0, limit);
}

async function getGlobalActivity(limitCount = 15) {
  try {
    // 1. Fetch recent ticket history via collectionGroup
    const historyQuery = query(collectionGroup(db, 'history'), orderBy('createdAt', 'desc'), limit(limitCount));
    const historySnap = await getDocs(historyQuery);
    const historyEvents = historySnap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      source: 'ticket'
    }));

    // 2. Fetch recent finance/caja movements
    const cajaQuery = query(collection(db, COLLECTIONS.caja), orderBy('createdAt', 'desc'), limit(limitCount));
    const cajaSnap = await getDocs(cajaQuery);
    const cajaEvents = cajaSnap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      type: 'financial_movement',
      message: `${d.data().tipo?.toUpperCase()}: ${d.data().descripcion}`,
      source: 'finance'
    }));

    // 3. Merge and sort
    const combined = [...historyEvents, ...cajaEvents].sort((a,b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return dateB - dateA;
    }).slice(0, limitCount);

    return combined;
  } catch (err) {
    console.error('[dashboard-service] Activity feed failed:', err);
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches all dashboard data in two parallel Firestore reads (tickets + clientes).
 * Previously required 3× getTickets() calls; now uses each dataset exactly once.
 */
export async function getDashboardData() {
  const [tickets, clientes] = await Promise.all([getTickets(), getClientes()]);

  const enrichTicket = (t) => {
    const clientTickets = tickets.filter(allT => allT.clienteId === t.clienteId);
    return {
      ...t,
      clientBadge: getClientBadge(clientTickets.length),
      reentryRisk: getReentryRisk(clientTickets)
    };
  };

  return {
    metrics:           computeMetrics(tickets),
    recentTickets:     tickets.slice(0, 5).map(enrichTicket),
    recentClients:     computeRecentClients(clientes, 5),
    attentionRequired: computeAttentionRequired(tickets).map(enrichTicket),
    activityFeed:      await getGlobalActivity(15)
  };
}

// Kept for external consumers that may call these individually.
export async function getDashboardMetrics() {
  const tickets = await getTickets();
  return computeMetrics(tickets);
}

export async function getRecentTickets(limit = 5) {
  const tickets = await getTickets();
  return tickets.slice(0, limit);
}

export async function getRecentClientes(limit = 5) {
  const clientes = await getClientes();
  return computeRecentClients(clientes, limit);
}
