import { getTickets } from './tickets.js';
import { getClientes } from './clientes.js';
import { WORK_STATUS } from '../../../js/domain.js';

/**
 * Servicio de Dashboard
 * Encapsula la lógica de agregación y métricas para desacoplarla de la vista.
 */

/**
 * Obtiene las métricas principales del dashboard (KPIs)
 * @returns {Promise<Object>}
 */
export async function getDashboardMetrics() {
  const tickets = await getTickets();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  return tickets.reduce((acc, t) => {
    if (t.estado === WORK_STATUS.ingresado) acc.pending++;
    if (t.estado === WORK_STATUS.enReparacion) acc.inRepair++;
    if (t.estado === WORK_STATUS.listo) acc.ready++;
    
    // Chequear si fue entregado hoy
    if (t.estado === WORK_STATUS.entregado && t.fechaEntregado) {
      const deliveredDate = t.fechaEntregado.split('T')[0];
      if (deliveredDate === todayStr) {
        acc.deliveredToday++;
      }
    }
    
    return acc;
  }, { pending: 0, inRepair: 0, ready: 0, deliveredToday: 0 });
}

/**
 * Obtiene los tickets más recientes para la actividad del dashboard
 * @param {number} limit 
 * @returns {Promise<Array>}
 */
export async function getRecentTickets(limit = 5) {
  const tickets = await getTickets();
  // getTickets ya viene ordenado por fechaIngreso desc de Firestore
  return tickets.slice(0, limit);
}

/**
 * Obtiene los clientes más recientes registrados
 * @param {number} limit 
 * @returns {Promise<Array>}
 */
export async function getRecentClientes(limit = 5) {
  const clientes = await getClientes();
  return [...clientes]
    .sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return dateB - dateA;
    })
    .slice(0, limit);
}

/**
 * Obtiene todos los datos necesarios para el dashboard en una sola llamada optimizada
 * @returns {Promise<Object>}
 */
export async function getDashboardData() {
  const [metrics, recentTickets, recentClients] = await Promise.all([
    getDashboardMetrics(),
    getRecentTickets(5),
    getRecentClientes(5)
  ]);

  return { metrics, recentTickets, recentClients };
}
