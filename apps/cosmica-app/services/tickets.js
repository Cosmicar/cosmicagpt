import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy, limit, startAfter, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "../../../js/firebase.js";
import { COLLECTIONS, WORK_STATUS } from "../../../js/domain.js";
import { getNextOrderNumber, publishPublicOrder, getTrabajo } from "../../../js/work-repository.js";
import { addTicketHistoryEvent, TICKET_EVENT_TYPES } from "./ticket-history.js";
import { cacheWrap, cacheInvalidate } from '../core/cache.js';
import { getCurrentSession } from "../core/session.js";
import { isAdmin } from "../../../js/domain.js";

const CACHE_KEY = 'tickets:list';

// ── Cursor state para paginación Firestore ──────────────────────────────────
// Almacenado a nivel módulo para que getTicketsNextPage() pueda usar el cursor
// del último getDocs() sin necesitar los DocumentSnapshot en el caller.
const FETCH_LIMIT = 500; // tickets por lectura Firestore
let _lastTicketDoc  = null;  // cursor para startAfter()
let _hasMoreTickets = false; // true si la última lectura llegó al límite

/**
 * Obtiene el listado de tickets (trabajos) desde Firestore.
 * Limitado a FETCH_LIMIT documentos por lectura.
 * Retorna datos puros como array — backward-compatible con todos los callers.
 *
 * @returns {Promise<Array>} Lista de tickets (máx. FETCH_LIMIT)
 */
export function getTickets() {
  return cacheWrap(CACHE_KEY, async () => {
    const q = query(
      collection(db, COLLECTIONS.trabajos),
      orderBy('fechaIngreso', 'desc'),
      limit(FETCH_LIMIT)
    );
    const snap = await getDocs(q);
    _lastTicketDoc  = snap.docs[snap.docs.length - 1] ?? null;
    _hasMoreTickets = snap.docs.length === FETCH_LIMIT;
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}

/**
 * Indica si getTickets() alcanzó el límite — hay tickets más antiguos en Firestore.
 * Solo es confiable después de que getTickets() resolvió sin cache hit.
 */
export function hasMoreTickets() {
  return _hasMoreTickets;
}

/**
 * Carga la siguiente página de tickets usando el cursor del último getTickets().
 * Retorna [] si no hay más datos.
 *
 * @returns {Promise<Array>}
 */
export async function getTicketsNextPage() {
  if (!_lastTicketDoc || !_hasMoreTickets) return [];
  const q = query(
    collection(db, COLLECTIONS.trabajos),
    orderBy('fechaIngreso', 'desc'),
    startAfter(_lastTicketDoc),
    limit(FETCH_LIMIT)
  );
  const snap = await getDocs(q);
  _lastTicketDoc  = snap.docs[snap.docs.length - 1] ?? null;
  _hasMoreTickets = snap.docs.length === FETCH_LIMIT;
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Invalidates the ticket list cache.
 * También resetea el cursor Firestore para que el próximo fetch empiece desde el inicio.
 */
export function invalidateTicketsCache() {
  cacheInvalidate(CACHE_KEY);
  _lastTicketDoc  = null;
  _hasMoreTickets = false;
}

/**
 * Crea un nuevo ticket de trabajo.
 * 
 * @param {Object} data - Datos del ticket
 * @returns {Promise<Object>} Resultado
 */
export async function createTicket(data) {
  try {
    // 1. Validaciones básicas
    if (!data.clienteId || !data.equipo || !data.problema) {
      throw new Error("Cliente, Equipo y Problema son campos obligatorios.");
    }

    // 2. Generar número de orden (reutilizando lógica legacy para consistencia)
    const tipo = data.tipo || 'taller';
    const numeroOrden = await getNextOrderNumber(tipo);

    // 3. Preparar documento
    const nuevoTrabajo = {
      numeroOrden,
      clienteId: data.clienteId,
      tipo,
      equipo: data.equipo.trim(),
      marca: data.marca ? data.marca.trim() : "",
      modelo: data.modelo ? data.modelo.trim() : "",
      problema: data.problema.trim(),
      diagnostico: "",
      diagnosticoTecnico: "",
      servicioRealizado: "",
      garantiaDias: Number(data.garantiaDias) || 90,
      precio: Number(data.precio || 0),
      presupuesto: 0,
      aprobadoCliente: false,
      planServicio: data.planServicio || "estandar",
      estado: WORK_STATUS.ingresado,
      fechaIngreso: new Date().toISOString(),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      tecnicoAsignadoId: data.tecnicoAsignadoId || null,
      tecnicoAsignadoNombre: data.tecnicoAsignadoNombre || null,
      source: 'cosmica-saas-v1'
    };

    // 4. Guardar en Firestore
    const docRef = await addDoc(collection(db, COLLECTIONS.trabajos), nuevoTrabajo);

    // 5. Publicar para seguimiento público (legacy sync)
    await publishPublicOrder(docRef.id, nuevoTrabajo);

    // 6. Registrar evento en historial
    await addTicketHistoryEvent(docRef.id, {
      type:    TICKET_EVENT_TYPES.created,
      message: 'Ticket creado',
      metadata: {
        numeroOrden,
        estado: WORK_STATUS.ingresado,
        equipo: nuevoTrabajo.equipo,
        planServicio: nuevoTrabajo.planServicio,
      },
    });

    invalidateTicketsCache();

    return {
      success: true,
      id: docRef.id,
      numeroOrden,
      message: "Orden de trabajo creada correctamente."
    };

  } catch (error) {
    console.error("Error al crear ticket en el servicio:", error);
    return {
      success: false,
      error: error.message || "No se pudo crear la orden de trabajo."
    };
  }
}

/**
 * Actualiza el estado de un ticket.
 * 
 * @param {string} id 
 * @param {string} newStatus 
 * @returns {Promise<Object>} Resultado
 */
export async function updateTicketStatus(id, newStatus) {
  try {
    const trabajo = await getTrabajo(id);
    if (!trabajo) throw new Error("Orden no encontrada.");

    if (newStatus === WORK_STATUS.entregado) {
      const { getCajaSession } = await import('./finanzas.js');
      const cajaSession = await getCajaSession();
      if (!cajaSession) {
        throw new Error("Debe existir una caja abierta para registrar el cobro.");
      }
    }

    const updateData = {
      estado: newStatus,
      updatedAt: serverTimestamp()
    };

    const now = new Date().toISOString();
    // Lifecycle timestamps — only set once (first transition wins; undo can revert via previous state)
    if (newStatus === WORK_STATUS.enReparacion && !trabajo.fechaReparacion)
      updateData.fechaReparacion = now;
    if (newStatus === WORK_STATUS.listo && !trabajo.fechaListo) {
      updateData.fechaListo    = now;
      updateData.fechaReparado = now; // keep legacy field in sync
    }
    if (newStatus === WORK_STATUS.entregado && !trabajo.fechaEntregado)
      updateData.fechaEntregado = now;

    const docRef = doc(db, COLLECTIONS.trabajos, id);
    await updateDoc(docRef, updateData);

    // Sincronizar con seguimiento público
    await publishPublicOrder(id, { ...trabajo, ...updateData });

    // Registrar evento en historial
    await addTicketHistoryEvent(id, {
      type:    TICKET_EVENT_TYPES.statusChanged,
      message: `Estado cambiado: ${trabajo.estado} → ${newStatus}`,
      metadata: {
        from: trabajo.estado,
        to:   newStatus,
      },
    });

    // Auto-registrar ingreso en caja cuando un ticket es entregado con precio
    if (newStatus === WORK_STATUS.entregado && Number(trabajo.precio || 0) > 0) {
      try {
        const { autoRegistrarIngresoTicket, getCajaSession } = await import('./finanzas.js');
        const session = await getCajaSession();
        const autoResult = await autoRegistrarIngresoTicket({ ...trabajo, id, estado: newStatus }, session?.id);
        if (!autoResult || !autoResult.success) {
          throw new Error(autoResult?.error || 'Error desconocido al registrar ingreso');
        }
      } catch (e) {
        console.warn('[tickets] auto-income registration failed:', e);
        // We do not fail the status change, but we MUST alert the operator
        if (typeof window !== 'undefined' && window.__cosmicaShowToast) {
          window.__cosmicaShowToast('⚠️ El ticket se entregó pero NO pudo registrarse el pago en caja. Revisá manualmente.', 'warning', 10000);
        }
      }
    }

    invalidateTicketsCache();
    return { success: true };
  } catch (error) {
    console.error("Error al actualizar estado del ticket:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtiene un ticket por su ID.
 * 
 * @param {string} id 
 * @returns {Promise<Object>}
 */
export async function getTicket(id) {
  return await getTrabajo(id);
}

/**
 * Actualiza los datos de un ticket.
 * 
 * @param {string} id 
 * @param {Object} data 
 * @returns {Promise<Object>}
 */
export async function updateTicket(id, data) {
  try {
    const trabajoActual = await getTrabajo(id);
    if (!trabajoActual) throw new Error("Orden no encontrada.");

    const updateData = {
      clienteId: data.clienteId,
      tipo: data.tipo,
      equipo: data.equipo.trim(),
      marca: data.marca ? data.marca.trim() : "",
      modelo: data.modelo ? data.modelo.trim() : "",
      problema: data.problema.trim(),
      servicioRealizado: (data.servicioRealizado || '').trim(),
      garantiaDias: Number(data.garantiaDias) || 90,
      precio: Number(data.precio || 0),
      metodoPago: data.metodoPago || 'efectivo',
      planServicio: data.planServicio || "estandar",
      tecnicoAsignadoId: data.tecnicoAsignadoId || null,
      tecnicoAsignadoNombre: data.tecnicoAsignadoNombre || null,
      updatedAt: serverTimestamp()
    };

    const oldPrice = Number(trabajoActual.precio || 0);
    const newPrice = updateData.precio;
    const oldMetodo = trabajoActual.metodoPago || 'efectivo';
    const newMetodo = updateData.metodoPago;

    if (trabajoActual.estado === WORK_STATUS.entregado && (oldPrice !== newPrice || oldMetodo !== newMetodo)) {
      const session = getCurrentSession();
      if (!isAdmin(session?.profile)) {
        throw new Error("El ticket ya impactó en caja. Requiere ajuste financiero.");
      }

      const { createCajaEntry, getCajaSession } = await import('./finanzas.js');
      const cajaSession = await getCajaSession();
      // Si no hay caja abierta, se registra con pendingReconciliation = true (conciliación pendiente)
      const sesionId             = cajaSession?.id ?? null;
      const pendingReconciliation = sesionId === null;

      const orderRef = trabajoActual.numeroOrden || id;
      const delta    = newPrice - oldPrice;
      const operador = session?.user?.email || 'admin';

      // ── Audit trail ──────────────────────────────────────────────────────
      await addTicketHistoryEvent(id, {
        type: TICKET_EVENT_TYPES.financialAdjustment,
        message: `Ajuste financiero post-entrega (Admin)${pendingReconciliation ? ' — sin caja abierta' : ''}`,
        metadata: {
          oldPrice,
          newPrice,
          oldMetodoPago: oldMetodo,
          newMetodoPago: newMetodo,
          adjustedBy: operador,
          pendingReconciliation,
        }
      });

      // ── Separate event when payment method changed ────────────────────────
      if (oldMetodo !== newMetodo) {
        await addTicketHistoryEvent(id, {
          type: TICKET_EVENT_TYPES.paymentMethodChanged,
          message: `Método de pago cambiado: ${oldMetodo} → ${newMetodo} (Admin)`,
          metadata: { oldMetodoPago: oldMetodo, newMetodoPago: newMetodo, adjustedBy: operador }
        });
      }

      // ── Caja append-only entries ─────────────────────────────────────────
      const baseEntry = { origen: 'admin_adjustment', ticketRef: id, pendingReconciliation };

      if (oldMetodo === newMetodo) {
        // Same method: single net-delta entry
        if (delta !== 0) {
          await createCajaEntry({
            ...baseEntry,
            tipo: 'ajuste',
            descripcion: `${delta > 0 ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO'} · Ticket #${orderRef} (Admin Override)`,
            monto: delta,
            metodoPago: newMetodo,
          }, sesionId);
        }
      } else {
        // Method changed: reversal of old + compensatory entry for new
        if (oldPrice > 0) {
          await createCajaEntry({
            ...baseEntry,
            tipo: 'ajuste',
            descripcion: `REVERSAL · Ticket #${orderRef} (Admin Cambio M.Pago)`,
            monto: -oldPrice,
            metodoPago: oldMetodo,
          }, sesionId);
        }
        if (newPrice > 0) {
          await createCajaEntry({
            ...baseEntry,
            tipo: 'ajuste',
            descripcion: `COMPENSACIÓN · Ticket #${orderRef} (Admin Cambio M.Pago)`,
            monto: newPrice,
            metodoPago: newMetodo,
          }, sesionId);
        }
      }
    }

    const docRef = doc(db, COLLECTIONS.trabajos, id);
    await updateDoc(docRef, updateData);

    // Sincronizar con seguimiento público
    await publishPublicOrder(id, { ...trabajoActual, ...updateData });

    // Registrar evento en historial
    await addTicketHistoryEvent(id, {
      type:    TICKET_EVENT_TYPES.edited,
      message: 'Ticket editado',
      metadata: {
        equipo:      updateData.equipo,
        problema:    updateData.problema,
        planServicio: updateData.planServicio,
        precio:      updateData.precio,
      },
    });

    invalidateTicketsCache();
    return { success: true };
  } catch (error) {
    console.error("Error al actualizar ticket:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Reglas derivadas — sin lectura a Firestore, sin efectos secundarios.
 */

export function isOverdue(ticket) {
  if (ticket.estado !== WORK_STATUS.enReparacion && ticket.estado !== WORK_STATUS.ingresado) return false;
  if (!ticket.fechaIngreso) return false;
  return Date.now() - new Date(ticket.fechaIngreso).getTime() > 7 * 24 * 60 * 60 * 1000;
}

export function isHighValue(ticket) {
  return Number(ticket.presupuesto || 0) >= 100_000;
}

export function hasBudgetApproved(ticket) {
  return ticket.aprobadoCliente === true && ticket.estado === WORK_STATUS.ingresado;
}

/**
 * Actualiza el estado de múltiples tickets en paralelo.
 * No usa batch Firestore — cada ticket genera su propio historial.
 *
 * @param {string[]} ids
 * @param {string}   status
 * @returns {Promise<{ success: boolean, updated: number, error?: string }>}
 */
export async function updateMultipleTicketStatus(ids, status) {
  if (!ids.length) return { success: true, updated: 0 };

  // DELIVERY GUARD: If bulk includes 'entregado', must have open caja
  if (status === WORK_STATUS.entregado) {
    const { getCajaSession } = await import('./finanzas.js');
    const cajaSession = await getCajaSession();
    if (!cajaSession) {
      return { 
        success: false, 
        updated: 0, 
        error: "No hay una caja abierta para registrar entregas." 
      };
    }
  }

  const results = await Promise.all(ids.map(id => updateTicketStatus(id, status)));
  const failed  = results.filter(r => !r.success);

  if (!failed.length) return { success: true, updated: ids.length };

  return {
    success: failed.length < ids.length,
    updated: ids.length - failed.length,
    error:   `${failed.length} de ${ids.length} ticket(s) fallaron al actualizar.`,
  };
}

/**
 * Actualiza el diagnóstico técnico y presupuesto al cliente.
 * Operación independiente del flujo principal de edición.
 *
 * @param {string} id
 * @param {{ diagnosticoTecnico: string, presupuesto: number }} data
 * @returns {Promise<Object>}
 */
export async function updateTicketBudget(id, data) {
  try {
    const trabajoActual = await getTrabajo(id);
    if (!trabajoActual) throw new Error("Orden no encontrada.");

    const updateData = {
      diagnosticoTecnico: (data.diagnosticoTecnico || '').trim(),
      presupuesto:        Number(data.presupuesto || 0),
      updatedAt:          serverTimestamp(),
    };
    // Stamp fechaPresupuesto only the first time a non-zero presupuesto is set
    if (updateData.presupuesto > 0 && !trabajoActual.fechaPresupuesto) {
      updateData.fechaPresupuesto = new Date().toISOString();
    }

    await updateDoc(doc(db, COLLECTIONS.trabajos, id), updateData);

    // Sincronizar campos de presupuesto al seguimiento público
    await publishPublicOrder(id, { ...trabajoActual, ...updateData });

    await addTicketHistoryEvent(id, {
      type:    TICKET_EVENT_TYPES.edited,
      message: `Diagnóstico y presupuesto actualizados ($${updateData.presupuesto})`,
      metadata: {
        diagnosticoTecnico: updateData.diagnosticoTecnico,
        presupuesto:        updateData.presupuesto,
      },
    });

    invalidateTicketsCache();
    return { success: true };
  } catch (error) {
    console.error("Error al actualizar diagnóstico/presupuesto:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Guarda el array de repuestos consumidos en el ticket.
 * No ajusta stock — eso lo hace el llamador (ticket-form).
 *
 * @param {string}   id              ID del ticket
 * @param {Array}    repuestos       [{ inventarioId, nombre, sku, cantidad, costoUnitario, subtotal }]
 * @param {number}   totalRepuestos  Suma de subtotales
 * @returns {Promise<Object>}
 */
export async function updateTicketRepuestos(id, repuestos, totalRepuestos) {
  try {
    await updateDoc(doc(db, COLLECTIONS.trabajos, id), {
      repuestos,
      totalRepuestos: Number(totalRepuestos || 0),
      updatedAt: serverTimestamp(),
    });
    await addTicketHistoryEvent(id, {
      type:    TICKET_EVENT_TYPES.edited,
      message: `Repuestos actualizados (${repuestos.length} ítem${repuestos.length !== 1 ? 's' : ''}, total $${Number(totalRepuestos || 0).toLocaleString('es-AR')})`,
      metadata: { totalRepuestos, cantidad: repuestos.length },
    });
    invalidateTicketsCache();
    return { success: true };
  } catch (error) {
    console.error("Error al guardar repuestos del ticket:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Crea un nuevo ticket a partir de uno entregado (Garantía / Reingreso).
 * Clona los datos básicos pero genera un nuevo número de orden y fecha.
 *
 * @param {Object} originalTicket
 * @returns {Promise<Object>}
 */
export async function reingresoTicket(originalTicket) {
  try {
    const data = {
      clienteId:    originalTicket.clienteId,
      nombre:       originalTicket.nombre,
      apellido:     originalTicket.apellido,
      equipo:       originalTicket.equipo,
      marca:        originalTicket.marca || '',
      modelo:       originalTicket.modelo || '',
      planServicio: originalTicket.planServicio || 'estandar',
      tipo:         originalTicket.tipo || 'taller',
      problema:     `[REINGRESO] — ${originalTicket.problema || ''}`,
      precio:       0, // El reingreso suele ser garantía o presupuesto nuevo
    };

    const result = await createTicket(data);
    if (!result.success) throw new Error(result.error);

    // Registrar vínculo en el historial del nuevo
    await addTicketHistoryEvent(result.id, {
      type:    TICKET_EVENT_TYPES.edited,
      message: `Reingreso de orden #${originalTicket.numeroOrden}`,
      metadata: { originalOrderId: originalTicket.id, originalOrderNumber: originalTicket.numeroOrden },
    });

    return result;
  } catch (error) {
    console.error("Error en reingresoTicket:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Marca un ticket como aprobado por el cliente.
 *
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function approveTicketBudget(id) {
  try {
    await updateDoc(doc(db, COLLECTIONS.trabajos, id), {
      aprobadoCliente: true,
      updatedAt: serverTimestamp(),
    });
    await ensureBudgetApprovedEvent(id);
    invalidateTicketsCache();
    return { success: true };
  } catch (error) {
    console.error("Error al aprobar presupuesto:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Asigna un técnico a un ticket.
 *
 * @param {string} id
 * @param {{ id: string, nombre: string }} tecnico
 * @returns {Promise<Object>}
 */
export async function assignTechnician(id, tecnico) {
  try {
    const session = getCurrentSession();
    const updateData = {
      tecnicoAsignadoId: tecnico.id,
      tecnicoAsignadoNombre: tecnico.nombre,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, COLLECTIONS.trabajos, id), updateData);

    const message = session?.user?.uid === tecnico.id 
      ? `${tecnico.nombre} tomó el ticket`
      : `${session?.profile?.nombre || 'Operador'} asignó ticket a ${tecnico.nombre}`;

    await addTicketHistoryEvent(id, {
      type: TICKET_EVENT_TYPES.technicianAssigned,
      message,
      metadata: { 
        assignedToId: tecnico.id, 
        assignedToNombre: tecnico.nombre,
        assignedBy: session?.user?.email 
      },
    });

    invalidateTicketsCache();
    return { success: true };
  } catch (error) {
    console.error("Error al asignar técnico:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Desasigna el técnico de un ticket.
 *
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function unassignTechnician(id) {
  try {
    const updateData = {
      tecnicoAsignadoId: null,
      tecnicoAsignadoNombre: null,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, COLLECTIONS.trabajos, id), updateData);

    await addTicketHistoryEvent(id, {
      type: TICKET_EVENT_TYPES.technicianUnassigned,
      message: 'Ticket desasignado',
      metadata: { unassignedBy: getCurrentSession()?.user?.email },
    });

    invalidateTicketsCache();
    return { success: true };
  } catch (error) {
    console.error("Error al desasignar técnico:", error);
    return { success: false, error: error.message };
  }
}

