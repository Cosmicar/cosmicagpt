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
