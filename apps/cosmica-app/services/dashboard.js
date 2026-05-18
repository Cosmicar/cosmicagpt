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

/**
 * Operational intelligence — historical/aggregate metrics migrated from
 * the legacy admin Estadísticas tab. Single O(n) pass over the existing
 * tickets+clientes datasets — zero additional Firestore reads.
 *
 * Returns: high-value KPIs (totals, revenue, ticket avg, retention),
 * performance (avg resolution time), distribution (workshop vs remote),
 * and top-N rankings (provinces, technicians, problems).
 */
function computeOperationalIntelligence(tickets, clientes) {
  const clientesById = new Map();
  for (const c of clientes) clientesById.set(c.id, c);

  let facturacionGlobal     = 0;
  let countEntregados       = 0;
  let sumResolutionMs       = 0;
  let validResolutionCount  = 0;
  let servicioTaller        = 0;
  let servicioRemoto        = 0;

  const provinciasMap     = Object.create(null);
  const tecnicosMap       = Object.create(null);
  const problemasMap      = Object.create(null);
  const ticketsPerClient  = Object.create(null);

  // Trivial stop-words for problem frequency (skip noise)
  const STOPWORDS = new Set(['ninguno', 'nada', 'no enciende', 'no anda', 'no funciona', '-', '--', 'sin info']);

  for (const t of tickets) {
    if (t.clienteId) {
      ticketsPerClient[t.clienteId] = (ticketsPerClient[t.clienteId] || 0) + 1;
    }

    // Provincia (denormalised lookup via cliente)
    const cliente = clientesById.get(t.clienteId);
    const prov = (cliente?.provincia || 'Sin especificar').trim() || 'Sin especificar';
    provinciasMap[prov] = (provinciasMap[prov] || 0) + 1;

    // Tipo de servicio
    if (t.tipo === 'remoto') servicioRemoto++; else servicioTaller++;

    // Top problemas (filtered for signal)
    const prob = String(t.problema || '').toLowerCase().trim();
    if (prob.length > 3 && !STOPWORDS.has(prob)) {
      problemasMap[prob] = (problemasMap[prob] || 0) + 1;
    }

    // Entregado-only metrics
    if (t.estado === WORK_STATUS.entregado) {
      countEntregados++;
      facturacionGlobal += Number(t.precio || t.presupuesto || 0);

      if (t.fechaIngreso && t.fechaEntregado) {
        const ms = new Date(t.fechaEntregado).getTime() - new Date(t.fechaIngreso).getTime();
        if (ms > 0) {
          sumResolutionMs += ms;
          validResolutionCount++;
        }
      }

      // Técnicos (only credit for completed deliveries — fair attribution)
      const tecNombre = String(t.tecnicoAsignadoNombre || '').trim();
      if (tecNombre) tecnicosMap[tecNombre] = (tecnicosMap[tecNombre] || 0) + 1;
    }
  }

  const totalServicios          = tickets.length;
  const ticketPromedio          = countEntregados > 0 ? facturacionGlobal / countEntregados : 0;
  const tiempoPromedioResolDias = validResolutionCount > 0
    ? (sumResolutionMs / validResolutionCount) / 86_400_000
    : 0;

  // Retention rate (% of active clients with > 1 ticket)
  let clientesActivos    = 0;
  let clientesRepetidos  = 0;
  for (const cid in ticketsPerClient) {
    clientesActivos++;
    if (ticketsPerClient[cid] > 1) clientesRepetidos++;
  }
  const tasaRetencion = clientesActivos > 0 ? (clientesRepetidos / clientesActivos) * 100 : 0;

  const buildRanking = (map, n) => Object.entries(map)
    .map(([nombre, count]) => ({ nombre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);

  // Province distribution — top 5 + "Otros" grouping (donut-chart ready)
  const PROV_TOP_N = 5;
  const allProvincias = Object.entries(provinciasMap)
    .map(([nombre, count]) => ({ nombre, count }))
    .sort((a, b) => b.count - a.count);
  const topProvs   = allProvincias.slice(0, PROV_TOP_N);
  const otherProvs = allProvincias.slice(PROV_TOP_N);
  const othersCount = otherProvs.reduce((sum, p) => sum + p.count, 0);

  const provinciasChart = [
    ...topProvs.map(p => ({
      nombre: p.nombre,
      count: p.count,
      pct: totalServicios > 0 ? (p.count / totalServicios) * 100 : 0,
      isOthers: false,
    })),
    ...(othersCount > 0 ? [{
      nombre: `Otros (${otherProvs.length})`,
      count: othersCount,
      pct: totalServicios > 0 ? (othersCount / totalServicios) * 100 : 0,
      isOthers: true,
    }] : []),
  ];

  return {
    totalServicios,
    countEntregados,
    facturacionGlobal,
    ticketPromedio,
    tasaRetencion,
    tiempoPromedioResolDias,
    servicioTallerCount: servicioTaller,
    servicioRemotoCount: servicioRemoto,
    clientesActivos,
    provinciasChart,
    distinctProvincias: allProvincias.length,
    topTecnicos:  buildRanking(tecnicosMap, 3),
    topProblemas: buildRanking(problemasMap, 3).map(r => ({
      ...r,
      nombre: r.nombre.charAt(0).toUpperCase() + r.nombre.slice(1),
    })),
  };
}

// Límite máximo de eventos en el Activity Feed del dashboard
const ACTIVITY_LIMIT = 20;

async function getGlobalActivity(limitCount = ACTIVITY_LIMIT) {
  // Clampeamos para no leer más de ACTIVITY_LIMIT * 2 docs en total
  const safeLimit = Math.min(limitCount, ACTIVITY_LIMIT);

  try {
    // 1. Fetch recent ticket history via collectionGroup
    const historyQuery = query(
      collectionGroup(db, 'history'),
      orderBy('createdAt', 'desc'),
      limit(safeLimit)
    );
    const historySnap = await getDocs(historyQuery);
    const historyEvents = historySnap.docs.map(d => ({
      id: d.id, ...d.data(), source: 'ticket'
    }));

    // 2. Fetch recent finance/caja movements — same limit
    const cajaQuery = query(
      collection(db, COLLECTIONS.caja),
      orderBy('createdAt', 'desc'),
      limit(safeLimit)
    );
    const cajaSnap = await getDocs(cajaQuery);
    const cajaEvents = cajaSnap.docs.map(d => ({
      id: d.id, ...d.data(),
      type: 'financial_movement',
      message: `${d.data().tipo?.toUpperCase()}: ${d.data().descripcion}`,
      source: 'finance'
    }));

    // 3. Merge, sort, slice final
    return [...historyEvents, ...cajaEvents]
      .sort((a, b) => {
        const dA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dB - dA;
      })
      .slice(0, safeLimit);
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
  // Lazy-import facturas service: si las rules bloquean al rol, devuelve map vacío
  const { getFacturasMapByTicket } = await import('./facturacion.js');
  const [tickets, clientes, facturasMap] = await Promise.all([
    getTickets(),
    getClientes(),
    getFacturasMapByTicket(),
  ]);

  // Pre-agrupa tickets por clienteId — O(n) en vez de O(n²) por ticket enriquecido
  const clientTicketMap = new Map();
  tickets.forEach(t => {
    if (!clientTicketMap.has(t.clienteId)) clientTicketMap.set(t.clienteId, []);
    clientTicketMap.get(t.clienteId).push(t);
  });

  const enrichTicket = (t) => {
    const clientTickets = clientTicketMap.get(t.clienteId) || [];
    const facturasDel  = facturasMap.get(t.id) || [];
    return {
      ...t,
      clientBadge:   getClientBadge(clientTickets.length),
      reentryRisk:   getReentryRisk(clientTickets),
      facturada:     facturasDel.length > 0,
      facturasCount: facturasDel.length,
    };
  };

  return {
    metrics:           computeMetrics(tickets),
    intelligence:      computeOperationalIntelligence(tickets, clientes),
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
