import { getTickets, isOverdue } from './tickets.js';
import { getClientes } from './clientes.js';
import { WORK_STATUS, COLLECTIONS } from '../../../js/domain.js';
import { getClientBadge, getReentryRisk } from '../core/intelligence.js';
import { normalizeProvincia } from '../core/utils.js';
import { collectionGroup, query, limit, getDocs, collection, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "../../../js/firebase.js";

// ── Internal helpers ──────────────────────────────────────────────────────────

function computeMetrics(tickets) {
  const todayStr = new Date().toISOString().split('T')[0];
  const isAbandonedTicket = (t) => {
    if (t.estado === WORK_STATUS.entregado) return false;
    const ref = t.updatedAt || t.fechaIngreso || t.createdAt;
    if (!ref) return false;
    const d = ref.toDate ? ref.toDate() : new Date(ref);
    return (Date.now() - d.getTime()) > 30 * 24 * 60 * 60 * 1000;
  };

  return tickets.reduce((acc, t) => {
    if (t.estado === WORK_STATUS.ingresado)    acc.pending++;
    if (t.estado === WORK_STATUS.enReparacion) acc.inRepair++;
    if (t.estado === WORK_STATUS.listo)        acc.ready++;
    // Demorados = activos >7 días pero NO abandonados (>30 días). Los abandonados
    // son ruido — aparecen en la sección "Atención Requerida" como tickets fantasma.
    if (isOverdue(t) && !isAbandonedTicket(t))    acc.overdue++;
    // Entregados HOY = entregado HOY Y ingresado HOY (same-day close). Excluye
    // tickets viejos cerrados hoy (ej. REM-0043 ingresado 14/05, entregado hoy).
    if (t.estado === WORK_STATUS.entregado
        && t.fechaEntregado?.split('T')[0] === todayStr
        && t.fechaIngreso?.split('T')[0] === todayStr) {
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
/**
 * Spanish stopwords + noise tokens — palabras comunes que NO sirven como
 * "anchor" para agrupar problemas/equipos. Filtramos para que el algoritmo
 * de keyword extraction encuentre el sustantivo realmente relevante.
 */
const SPANISH_STOPWORDS = new Set([
  // artículos
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  // preposiciones
  'de', 'del', 'al', 'en', 'con', 'por', 'para', 'sin', 'sobre', 'tras', 'entre',
  'desde', 'hacia', 'hasta', 'segun', 'según',
  // conjunciones
  'y', 'o', 'u', 'e', 'pero', 'ni', 'sino', 'aunque', 'porque', 'pues',
  // pronombres
  'que', 'qué', 'cual', 'cuál', 'quien', 'quién', 'donde', 'dónde', 'cuando', 'cuándo',
  'su', 'sus', 'mi', 'mis', 'tu', 'tus', 'me', 'te', 'se', 'le', 'les', 'lo', 'las',
  // verbos de relleno
  'es', 'son', 'esta', 'está', 'estan', 'están', 'ser', 'estar', 'esta', 'este', 'esto',
  'fue', 'fueron', 'sido', 'tiene', 'tienen', 'tenia', 'tenía', 'hay', 'haber',
  'hace', 'hacer', 'esta', 'está',
  // adverbios comunes
  'no', 'si', 'sí', 'tambien', 'también', 'muy', 'mas', 'más', 'menos',
  'solo', 'solo', 'sólo', 'mucho', 'poco', 'todo', 'todos', 'toda', 'todas',
  // ruido específico de tickets
  'problema', 'falla', 'fallas', 'cuestion', 'cuestión', 'servicio', 'cliente',
  'ninguno', 'nada', 'info',
]);

/**
 * Tokeniza un string a palabras significativas (≥4 chars, sin stopwords).
 */
function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove accents for dedup
    .replace(/[^a-zñ0-9\s]/g, ' ')                    // strip punctuation
    .split(/\s+/)
    .filter(w => w.length >= 4 && !SPANISH_STOPWORDS.has(w));
}

/**
 * Frequency-anchor ranking: agrupa items por el token más globalmente frecuente.
 *
 * Ejemplo: ["Almohadillas", "Reset almohadillas", "Almohadillas llenas"]
 * → globalFreq: { almohadillas: 3, reset: 1, llenas: 1 }
 * → cada ticket anclado a "almohadillas" (mayor freq)
 * → ranking: [{ nombre: 'Almohadillas', count: 3 }]
 *
 * Esto resuelve el problema de variaciones del mismo concepto sin necesidad
 * de stemming complejo o NLP.
 */
function buildAnchorRanking(items, n) {
  // Pass 1: tokenizar y contar frecuencia global de cada token
  const globalFreq = new Map();
  const itemTokens = [];
  for (const raw of items) {
    const tokens = tokenize(raw);
    if (tokens.length === 0) continue;
    itemTokens.push(tokens);
    for (const tok of tokens) {
      globalFreq.set(tok, (globalFreq.get(tok) || 0) + 1);
    }
  }

  // Pass 2: para cada item, asignarle su "anchor" (token con mayor freq global)
  const anchorCounts = new Map();
  for (const tokens of itemTokens) {
    let bestAnchor = tokens[0];
    let bestFreq = globalFreq.get(bestAnchor) || 0;
    for (const tok of tokens) {
      const freq = globalFreq.get(tok);
      if (freq > bestFreq) {
        bestAnchor = tok;
        bestFreq = freq;
      }
    }
    anchorCounts.set(bestAnchor, (anchorCounts.get(bestAnchor) || 0) + 1);
  }

  // Pass 3: construir ranking y capitalizar
  return [...anchorCounts.entries()]
    .map(([anchor, count]) => ({
      nombre: anchor.charAt(0).toUpperCase() + anchor.slice(1),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

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
  const ticketsPerClient  = Object.create(null);
  // Raw strings for anchor-based ranking (deduplicado por frecuencia global)
  const problemasRaw      = [];
  const equiposRaw        = [];

  for (const t of tickets) {
    if (t.clienteId) {
      ticketsPerClient[t.clienteId] = (ticketsPerClient[t.clienteId] || 0) + 1;
    }

    // Provincia (denormalised lookup via cliente)
    const cliente = clientesById.get(t.clienteId);
    const rawProv = cliente?.provincia;
    const prov = normalizeProvincia(rawProv);
    if (prov && prov !== 'Sin especificar') {
      provinciasMap[prov] = (provinciasMap[prov] || 0) + 1;
    }

    // Tipo de servicio
    if (t.tipo === 'remoto') servicioRemoto++; else servicioTaller++;

    // Recolección de strings raw para ranking por frecuencia-anchor
    if (t.problema) problemasRaw.push(t.problema);
    // Top equipos: combinamos equipo + marca para mejor signal
    const equipoFull = [t.equipo, t.marca].filter(Boolean).join(' ').trim();
    if (equipoFull) equiposRaw.push(equipoFull);

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

  // Province distribution — top 5 + "Otros" grouping (donut-chart ready)
  const PROV_TOP_N = 5;
  const allProvincias = Object.entries(provinciasMap)
    .map(([nombre, count]) => ({ nombre, count }))
    .sort((a, b) => b.count - a.count);
  const topProvs   = allProvincias.slice(0, PROV_TOP_N);
  const otherProvs = allProvincias.slice(PROV_TOP_N);
  const othersCount = otherProvs.reduce((sum, p) => sum + p.count, 0);

  const totalServiciosConProvincia = allProvincias.reduce((sum, p) => sum + p.count, 0);

  const provinciasChart = [
    ...topProvs.map(p => ({
      nombre: p.nombre,
      count: p.count,
      pct: totalServiciosConProvincia > 0 ? (p.count / totalServiciosConProvincia) * 100 : 0,
      isOthers: false,
    })),
    ...(othersCount > 0 ? [{
      nombre: `Otros (${otherProvs.length})`,
      count: othersCount,
      pct: totalServiciosConProvincia > 0 ? (othersCount / totalServiciosConProvincia) * 100 : 0,
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
    // Anchor-based rankings — agrupa variaciones del mismo concepto por
    // frecuencia global del keyword (ej. "Reset almohadillas",
    // "Almohadillas llenas" y "Almohadillas" → 1 sola entrada).
    topEquipos:   buildAnchorRanking(equiposRaw, 3),
    topProblemas: buildAnchorRanking(problemasRaw, 3),
  };
}

// Límite máximo de eventos en el Activity Feed del dashboard
const ACTIVITY_LIMIT = 20;

async function getGlobalActivity(limitCount = ACTIVITY_LIMIT, visibleTicketIds = null) {
  // Clampeamos para no leer más de ACTIVITY_LIMIT * 2 docs en total
  const safeLimit = Math.min(limitCount, ACTIVITY_LIMIT);

  try {
    // 1. Fetch recent ticket history via collectionGroup — sin orderBy para evitar
    //    requerir un índice compuesto en Firestore. Ordenamos client-side.
    // Si visibleTicketIds está definido (operador), pedimos extra para compensar
    // los eventos que vamos a filtrar fuera (de tickets remotos no visibles).
    const fetchMultiplier = visibleTicketIds ? 6 : 3;
    const historyQuery = query(
      collectionGroup(db, 'history'),
      limit(safeLimit * fetchMultiplier) // fetch más y filtramos/ordenamos en memoria
    );
    const historySnap = await getDocs(historyQuery);
    let historyEvents = historySnap.docs.map(d => ({
      id: d.id,
      _trabajoId: d.ref.parent.parent?.id, // necesario para filtrar por visibilidad
      ...d.data(),
      source: 'ticket',
    }));

    // Filtro defensivo: si el rol no puede ver ciertos trabajos (operador → solo
    // taller), descartamos los eventos de tickets no visibles. Esto evita leak
    // de info de tickets remotos en el Activity Feed.
    if (visibleTicketIds) {
      historyEvents = historyEvents.filter(e => visibleTicketIds.has(e._trabajoId));
    }

    // 2. Fetch recent finance/caja movements
    const cajaQuery = query(
      collection(db, COLLECTIONS.caja),
      orderBy('createdAt', 'desc'),
      limit(safeLimit)
    );
    const cajaSnap = await getDocs(cajaQuery);
    let cajaEvents = cajaSnap.docs.map(d => ({
      id: d.id, ...d.data(),
      type: 'financial_movement',
      message: `${d.data().tipo?.toUpperCase()}: ${d.data().descripcion}`,
      source: 'finance'
    }));

    if (visibleTicketIds) {
      const { filterRemoteCajaEntriesForOperador } = await import('./finanzas.js');
      cajaEvents = await filterRemoteCajaEntriesForOperador(cajaEvents);
      cajaEvents = cajaEvents.filter(e => !e.ticketRef || visibleTicketIds.has(e.ticketRef));
    }

    // 3. Merge, sort client-side, slice final
    return [...historyEvents, ...cajaEvents]
      .sort((a, b) => {
        const dA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dB - dA;
      })
      .slice(0, safeLimit);
  } catch (err) {
    console.warn('[dashboard-service] Activity feed no disponible:', err.message);
    return [];
  }
}

// ── Date-based stats ─────────────────────────────────────────────────────────

/**
 * Computes ingresados / entregados / facturación for a given date or range.
 *
 * @param {Array}  tickets  - Full ticket array (from getDashboardData)
 * @param {string|{from:string,to:string}} dateParam
 *   - Single date string 'YYYY-MM-DD', or
 *   - Range object  { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }
 * @returns {{ ingresadosTaller, ingresadosRemoto, entregadosTaller, entregadosRemoto,
 *             facturacionTaller, facturacionRemoto }}
 */
export function computeStatsForDate(tickets, dateParam) {
  const result = {
    ingresadosTaller:  0, ingresadosRemoto:  0,
    entregadosTaller:  0, entregadosRemoto:  0,
    facturacionTaller: 0, facturacionRemoto: 0,
  };

  const inRange = (rawDateStr) => {
    if (!rawDateStr) return false;
    const d = rawDateStr.split('T')[0];
    if (typeof dateParam === 'string') return d === dateParam;
    return d >= dateParam.from && d <= dateParam.to;
  };

  for (const t of tickets) {
    const taller = t.tipo !== 'remoto';
    if (inRange(t.fechaIngreso)) {
      if (taller) result.ingresadosTaller++; else result.ingresadosRemoto++;
    }
    if (inRange(t.fechaEntregado)) {
      if (taller) result.entregadosTaller++; else result.entregadosRemoto++;
      const precio = Number(t.precio || 0);
      if (taller) result.facturacionTaller += precio; else result.facturacionRemoto += precio;
    }
  }
  return result;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Computa el desglose financiero diferencial — paridad con legacy panel.js l.643-660.
 *
 * Reglas:
 *   - Remoto entregado: 100% del precio → entra directo a Caja Cósmica Neto.
 *   - Taller entregado liquidado: la parte de empresa (100 - comisionTaller %)
 *     suma a Caja Cósmica Neto. La parte del operador ya fue retirada al cobro.
 *   - Taller entregado SIN liquidar: la parte de empresa va a "Pendiente Cósmica"
 *     y la parte del operador a "Deuda Operadores" (el operador todavía tiene el efectivo).
 *
 * @returns {{ bruto:number, neto:number, pendienteCosmica:number, deudaOperadores:number,
 *             pctEmpresaTaller:number, pctEmpresaRemoto:number,
 *             tallerLiquidadosCount:number, tallerPendientesCount:number }}
 */
function computeFinancialBreakdown(tickets, comisiones) {
  const pctOpTaller   = Number(comisiones?.taller ?? 30);
  const pctOpRemoto   = Number(comisiones?.remoto ?? 20);
  const pctEmpresaTaller = 100 - pctOpTaller;   // ej. comisión 30 → empresa 70
  const pctEmpresaRemoto = 100 - pctOpRemoto;   // ej. comisión 20 → empresa 80

  let bruto = 0, neto = 0, pendienteCosmica = 0, deudaOperadores = 0;
  let tallerLiquidadosCount = 0, tallerPendientesCount = 0;

  for (const t of tickets) {
    if (t.estado !== WORK_STATUS.entregado) continue;
    const precio = Number(t.precio || 0);
    if (precio <= 0) continue;
    bruto += precio;

    if (t.tipo === 'remoto') {
      // 100% del remoto entra a la caja Cósmica
      neto += precio;
    } else {
      // taller
      const aporteEmpresa = precio * (pctEmpresaTaller / 100);
      const cuotaOperador = precio * (pctOpTaller       / 100);
      if (t.liquidado === true) {
        neto += aporteEmpresa;
        tallerLiquidadosCount++;
      } else {
        pendienteCosmica += aporteEmpresa;
        deudaOperadores  += cuotaOperador;
        tallerPendientesCount++;
      }
    }
  }

  return {
    bruto:                Math.round(bruto),
    neto:                 Math.round(neto),
    pendienteCosmica:     Math.round(pendienteCosmica),
    deudaOperadores:      Math.round(deudaOperadores),
    pctEmpresaTaller,
    pctEmpresaRemoto,
    pctOperadorTaller:    pctOpTaller,
    tallerLiquidadosCount,
    tallerPendientesCount,
  };
}

/**
 * Fetches all dashboard data in two parallel Firestore reads (tickets + clientes).
 * Previously required 3× getTickets() calls; now uses each dataset exactly once.
 */
export async function getDashboardData() {
  // Lazy-import facturas service: si las rules bloquean al rol, devuelve map vacío
  const { getFacturasMapByTicket } = await import('./facturacion.js');
  const { getCajaEntries } = await import('./finanzas.js');

  // Comisiones config (default legacy: 80/20 taller, 100/0 remoto → operator commissions
  // are 30/20 in SaaS as configurable defaults; fallback if doc missing)
  const comisionesPromise = getDoc(doc(db, 'config', 'comisiones'))
    .then(s => s.exists() ? s.data() : { taller: 30, remoto: 20 })
    .catch(() => ({ taller: 30, remoto: 20 }));

  const [tickets, clientes, facturasMap, cajaEntries, comisiones] = await Promise.all([
    getTickets(),
    getClientes(),
    getFacturasMapByTicket(),
    getCajaEntries().catch(() => []),
    comisionesPromise,
  ]);

  // Pre-agrupa tickets por clienteId — O(n) en vez de O(n²) por ticket enriquecido
  const clientTicketMap = new Map();
  tickets.forEach(t => {
    if (!clientTicketMap.has(t.clienteId)) clientTicketMap.set(t.clienteId, []);
    clientTicketMap.get(t.clienteId).push(t);
  });

  // Index clients by id for O(1) name lookup
  const clienteById = new Map(clientes.map(c => [c.id, c]));

  const enrichTicket = (t) => {
    const clientTickets = clientTicketMap.get(t.clienteId) || [];
    const facturasDel  = facturasMap.get(t.id) || [];
    const cliente      = clienteById.get(t.clienteId);
    return {
      ...t,
      // Fill in nombre/apellido from the clientes collection if the ticket doesn't have them
      nombre:        t.nombre  || cliente?.nombre  || '',
      apellido:      t.apellido || cliente?.apellido || '',
      telefono:      t.telefono || cliente?.telefono || '',
      clientBadge:   getClientBadge(clientTickets.length),
      reentryRisk:   getReentryRisk(clientTickets),
      facturada:     facturasDel.length > 0,
      facturasCount: facturasDel.length,
    };
  };

  // ── Métricas del día (hoy) ────────────────────────────────────────────────
  // Regla: todo se filtra por fechaIngreso == hoy.
  //   Ingresados  → tickets con fechaIngreso = hoy
  //   Entregados  → tickets con fechaIngreso = hoy Y entregados (mismo día)
  //   Facturado   → asientos de caja para tickets ingresados hoy
  //
  // Esto excluye correctamente tickets viejos cerrados hoy (ej. REM-0043
  // ingresado el 14/05 y cerrado el 21/05 no contamina la vista diaria).
  const todayStr = new Date().toISOString().split('T')[0];
  const hoy = {
    ingresadosTaller:  0, ingresadosRemoto:  0,
    entregadosTaller:  0, entregadosRemoto:  0,
    facturacionTaller: 0, facturacionRemoto: 0,
  };

  // Mapa ticketId → {tipo, ingresadoHoy} para cross-reference con caja
  const ticketMetaMap = new Map(tickets.map(t => [t.id, {
    tipo:        t.tipo || 'taller',
    ingresadoHoy: t.fechaIngreso?.split('T')[0] === todayStr,
  }]));

  const esHoyTs = (ts) => {
    if (!ts) return false;
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toISOString().split('T')[0] === todayStr;
  };

  for (const t of tickets) {
    if (t.fechaIngreso?.split('T')[0] !== todayStr) continue; // solo tickets de hoy
    const taller = t.tipo !== 'remoto';
    if (taller) hoy.ingresadosTaller++; else hoy.ingresadosRemoto++;
    if (t.estado === WORK_STATUS.entregado) {
      if (taller) hoy.entregadosTaller++; else hoy.entregadosRemoto++;
    }
  }

  // Facturado hoy = caja ingresos para tickets ingresados hoy (sin importar cuándo se cobró)
  for (const entry of cajaEntries) {
    if (entry.tipo !== 'ingreso') continue;
    const meta = entry.ticketRef ? ticketMetaMap.get(entry.ticketRef) : null;
    // Entrada sin ticketRef (manual) → contar si fue creada hoy
    if (!entry.ticketRef) {
      if (!esHoyTs(entry.createdAt)) continue;
      hoy.facturacionTaller += Number(entry.monto || 0);
      continue;
    }
    // Entrada con ticketRef → contar solo si el ticket fue ingresado hoy
    if (!meta?.ingresadoHoy) continue;
    if (meta.tipo === 'remoto') hoy.facturacionRemoto += Number(entry.monto || 0);
    else                        hoy.facturacionTaller += Number(entry.monto || 0);
  }

  // ── Desglose financiero diferencial (paridad legacy 80/20) ────────────────
  const finanzas = computeFinancialBreakdown(tickets, comisiones);

  // Activity Feed: si el rol activo tiene visibilidad restringida (operador),
  // pasamos los IDs visibles para que getGlobalActivity filtre eventos de
  // tickets no permitidos (ej. remotos para operador).
  const { getCurrentSession } = await import('../core/session.js');
  const isOperador = getCurrentSession()?.profile?.rol === 'operador';
  const visibleTicketIds = isOperador
    ? new Set(tickets.map(t => t.id))
    : null;

  return {
    metrics:           computeMetrics(tickets),
    hoy,
    finanzas,
    intelligence:      computeOperationalIntelligence(tickets, clientes),
    recentTickets:     tickets.slice(0, 5).map(enrichTicket),
    recentClients:     computeRecentClients(clientes, 5),
    attentionRequired: computeAttentionRequired(tickets).map(enrichTicket),
    activityFeed:      await getGlobalActivity(15, visibleTicketIds),
    // Expose full dataset for client-side date-range stats (zero extra Firestore reads)
    allTickets:        tickets,
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
