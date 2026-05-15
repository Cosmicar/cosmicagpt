import { WORK_STATUS } from '../../../js/domain.js';

/**
 * DETECCIÓN DE CLIENTE FRECUENTE / VIP
 */
export function getClientBadge(ticketCount) {
  if (ticketCount >= 6) return { label: '💎 Cliente VIP', class: 'badge-gold' };
  if (ticketCount >= 3) return { label: '⭐ Cliente frecuente', class: 'badge-cyan' };
  return null;
}

/**
 * RIESGO DE REINGRESO
 * Si tuvo 2+ reingresos en los últimos 90 días.
 */
export function getReentryRisk(tickets) {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  const reentries = tickets.filter(t => 
    t.estado === WORK_STATUS.reingresada && 
    new Date(t.updatedAt || t.createdAt) >= ninetyDaysAgo
  );
  
  if (reentries.length >= 2) {
    return { label: '⚠️ Reincidente', class: 'badge-danger' };
  }
  return null;
}

/**
 * AUTO-SUGERENCIA DE PRESUPUESTO
 */
const BUDGET_KEYWORDS = [
  'cambio módulo', 'cambio pantalla', 'formateo', 'pin de carga', 
  'flex', 'batería', 'limpieza', 'reinstalación', 'bisagra'
];

export function suggestBudget(term, history) {
  if (!term || term.length < 4) return null;
  
  const t = term.toLowerCase();
  const keyword = BUDGET_KEYWORDS.find(k => t.includes(k));
  if (!keyword) return null;
  
  const matches = history.filter(h => 
    h.problema?.toLowerCase().includes(keyword) || 
    h.servicioRealizado?.toLowerCase().includes(keyword)
  ).filter(h => h.precio > 0);
  
  if (matches.length === 0) return null;
  
  const sum = matches.reduce((acc, m) => acc + Number(m.precio), 0);
  const avg = Math.round(sum / matches.length);
  
  return {
    keyword,
    average: avg,
    count: matches.length
  };
}

/**
 * ESTIMACIÓN DE TIEMPO
 */
export function estimateRepairTime(ticket) {
  const plan = ticket.planServicio?.toLowerCase() || 'estandar';
  
  // Base time by plan
  let hours = 24; // Standard: 1 day
  if (plan === 'oro') hours = 8;
  if (plan === 'platinum') hours = 3;
  
  // Adjust by problem complexity (simple matching)
  const prob = ticket.problema?.toLowerCase() || '';
  if (prob.includes('pantalla') || prob.includes('módulo')) hours += 2;
  if (prob.includes('placa') || prob.includes('corto') || prob.includes('agua')) hours += 48;
  if (prob.includes('formateo') || prob.includes('soft')) hours = Math.min(hours, 4);

  if (hours < 24) return `${hours} hs`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'día' : 'días'}`;
}

/**
 * CLIENT SNAPSHOT DATA
 */
export function getClientSnapshot(clienteId, allTickets) {
  const history = allTickets.filter(t => t.clienteId === clienteId);
  if (history.length === 0) return null;
  
  const spent = history.reduce((acc, t) => acc + Number(t.precio || 0), 0);
  const reentries = history.filter(t => t.estado === WORK_STATUS.reingresada).length;
  
  const payments = history.reduce((acc, t) => {
    const p = t.metodoPago || 'efectivo';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});
  
  const topPayment = Object.entries(payments).sort((a,b) => b[1] - a[1])[0]?.[0] || 'efectivo';
  
  const lastEntry = history.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))[0]?.createdAt;

  return {
    totalTickets: history.length,
    totalSpent: spent,
    reentries,
    topPayment,
    lastEntry
  };
}

// ─── Lifecycle / Aging Helpers ────────────────────────────────────────────────

/**
 * Returns the number of days the ticket has been in its CURRENT status.
 * Uses updatedAt as the reference point (best proxy for "last state change").
 *
 * @param {Object} ticket
 * @returns {number}
 */
export function getDaysInStatus(ticket) {
  const ref = ticket.updatedAt || ticket.fechaIngreso || ticket.createdAt;
  if (!ref) return 0;
  const d = ref.toDate ? ref.toDate() : new Date(ref);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Returns a human-readable lifecycle stage label.
 *
 * @param {Object} ticket
 * @returns {string}
 */
export function getLifecycleStage(ticket) {
  const estado = ticket?.estado || '';
  if (estado === WORK_STATUS.entregado) return 'Entregado';
  if (estado === WORK_STATUS.listo)     return 'Listo para retirar';
  if (estado === WORK_STATUS.esperandoRepuesto) return 'Esperando repuesto';
  if (estado === WORK_STATUS.enReparacion)      return 'En reparación';
  if (ticket?.aprobadoCliente)          return 'Aprobado — sin comenzar';
  if (ticket?.presupuesto > 0)          return 'Esperando aprobación';
  return 'Ingresado — sin presupuesto';
}

/**
 * Returns true when a non-delivered ticket hasn't been touched in 30+ days.
 *
 * @param {Object} ticket
 * @returns {boolean}
 */
export function isAbandoned(ticket) {
  if (ticket?.estado === WORK_STATUS.entregado) return false;
  const ref = ticket.updatedAt || ticket.fechaIngreso || ticket.createdAt;
  if (!ref) return false;
  const d = ref.toDate ? ref.toDate() : new Date(ref);
  return (Date.now() - d.getTime()) > 30 * 24 * 60 * 60 * 1000;
}

/**
 * Returns an HTML badge string showing how long the ticket has been open.
 * Returns '' for delivered tickets or tickets open < 3 days.
 *
 * @param {Object} ticket
 * @returns {string} HTML badge or empty string
 */
export function getAgingBadge(ticket) {
  if (ticket?.estado === WORK_STATUS.entregado) return '';
  if (!ticket?.fechaIngreso) return '';
  const days = Math.floor((Date.now() - new Date(ticket.fechaIngreso).getTime()) / (1000 * 60 * 60 * 24));
  if (days >= 30) return `<span class="badge badge-danger"  style="font-size:10px;white-space:nowrap;">🔴 ${days}d</span>`;
  if (days >= 15) return `<span class="badge badge-orange"  style="font-size:10px;white-space:nowrap;">🟠 ${days}d</span>`;
  if (days >= 7)  return `<span class="badge" style="font-size:10px;white-space:nowrap;background:rgba(234,179,8,0.2);color:#fde047;border:1px solid rgba(234,179,8,0.4);">🟡 ${days}d</span>`;
  if (days >= 3)  return `<span class="badge" style="font-size:10px;white-space:nowrap;background:rgba(255,255,255,0.06);color:var(--text-muted);">⏳ ${days}d</span>`;
  return '';
}

/**
 * DETECCIÓN DE TICKET CRÍTICO
 */
export function getCriticalAlert(ticket, allTickets) {
  const now = new Date();
  const createdAt = new Date(ticket.createdAt || ticket.fechaIngreso);
  const updatedAt = new Date(ticket.updatedAt || ticket.createdAt);
  const daysOpen = (now - createdAt) / (1000 * 60 * 60 * 24);
  const daysStagnant = (now - updatedAt) / (1000 * 60 * 60 * 24);
  
  // 1. 3+ reingresos históricos para este cliente
  const history = allTickets.filter(t => t.clienteId === ticket.clienteId);
  const totalReentries = history.filter(t => t.estado === WORK_STATUS.reingresada).length;
  if (totalReentries >= 3) {
    return { label: '🚨 Crítico: Reincidente Serial', class: 'badge-danger', reason: '3+ reingresos' };
  }
  
  // 2. Ticket abierto > 30 días (no entregado)
  if (ticket.estado !== WORK_STATUS.entregado && daysOpen > 30) {
    return { label: '🚨 Crítico: Abandonado', class: 'badge-danger', reason: '+30 días abierto' };
  }
  
  // 3. Presupuesto aprobado pero sin movimiento > 7 días
  if (ticket.aprobadoCliente && ticket.estado === WORK_STATUS.ingresado && daysStagnant > 7) {
    return { label: '🚨 Crítico: Sin Reparar', class: 'badge-danger', reason: 'Aprobado sin avance > 7 días' };
  }
  
  // 4. Cliente VIP + Reingreso (reclamo recurrente)
  const isVIP = history.length >= 6;
  if (isVIP && ticket.estado === WORK_STATUS.reingresada) {
    return { label: '🚨 Crítico: VIP Reclamo', class: 'badge-danger', reason: 'Cliente VIP con reingreso' };
  }
  
  return null;
}
