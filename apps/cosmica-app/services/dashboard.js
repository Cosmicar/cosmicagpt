import { getTickets, isOverdue } from './tickets.js';
import { getClientes } from './clientes.js';
import { WORK_STATUS } from '../../../js/domain.js';

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

function computeRecentClients(clientes, limit = 5) {
  return [...clientes]
    .sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return dateB - dateA;
    })
    .slice(0, limit);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches all dashboard data in two parallel Firestore reads (tickets + clientes).
 * Previously required 3× getTickets() calls; now uses each dataset exactly once.
 */
export async function getDashboardData() {
  const [tickets, clientes] = await Promise.all([getTickets(), getClientes()]);

  return {
    metrics:       computeMetrics(tickets),
    recentTickets: tickets.slice(0, 5),
    recentClients: computeRecentClients(clientes, 5),
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
