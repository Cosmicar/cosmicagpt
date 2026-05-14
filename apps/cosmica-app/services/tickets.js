import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "../../../js/firebase.js";
import { COLLECTIONS, WORK_STATUS } from "../../../js/domain.js";
import { getNextOrderNumber, publishPublicOrder, getTrabajo } from "../../../js/work-repository.js";
import { addTicketHistoryEvent, TICKET_EVENT_TYPES } from "./ticket-history.js";
import { cacheWrap, cacheInvalidate } from '../core/cache.js';
import { registerTicketIngreso, getActiveCajaSession, createAdjustmentEntry } from './caja-sesiones.js';
import { getCurrentSession } from '../core/session.js';

const VALID_METODOS = ['efectivo','transferencia','mercadopago','debito','credito'];

const CACHE_KEY = 'tickets:list';

/**
 * Obtiene el listado de tickets (trabajos) desde Firestore.
 * Retorna datos puros.
 * 
 * @returns {Promise<Array>} Lista de tickets
 */
export function getTickets() {
  return cacheWrap(CACHE_KEY, async () => {
    const q = query(collection(db, COLLECTIONS.trabajos), orderBy("fechaIngreso", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}

/** Invalidates the ticket list cache. Call after any write that changes the list. */
export function invalidateTicketsCache() {
  cacheInvalidate(CACHE_KEY);
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
      metodoPago: VALID_METODOS.includes(data.metodoPago) ? data.metodoPago : 'efectivo',
      presupuesto: 0,
      aprobadoCliente: false,
      planServicio: data.planServicio || "estandar",
      estado: WORK_STATUS.ingresado,
      fechaIngreso: new Date().toISOString(),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
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

    // Bloquear entrega si no hay caja abierta y el ticket tiene precio
    if (newStatus === WORK_STATUS.entregado && Number(trabajo.precio || 0) > 0) {
      const activeSession = await getActiveCajaSession();
      if (!activeSession) {
        throw new Error('Debe existir una caja abierta para registrar el cobro.');
      }
    }

    const updateData = {
      estado: newStatus,
      updatedAt: serverTimestamp()
    };

    const now = new Date().toISOString();
    if (newStatus === WORK_STATUS.listo) updateData.fechaReparado = now;
    if (newStatus === WORK_STATUS.entregado) updateData.fechaEntregado = now;

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

    // Auto-registrar ingreso en caja cuando el ticket se entrega con precio
    if (newStatus === WORK_STATUS.entregado && Number(trabajo.precio || 0) > 0) {
      registerTicketIngreso({ ...trabajo, id }).catch(err =>
        console.warn('Auto-registro caja fallido (no crítico):', err)
      );
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

    const session     = getCurrentSession();
    const isAdmin     = session?.profile?.rol === 'admin';
    const isEntregado = trabajoActual.estado === WORK_STATUS.entregado;

    const newPrecio     = Number(data.precio || 0);
    const newMetodoPago = VALID_METODOS.includes(data.metodoPago) ? data.metodoPago : (trabajoActual.metodoPago || 'efectivo');
    const oldPrecio     = Number(trabajoActual.precio || 0);
    const oldMetodoPago = trabajoActual.metodoPago || 'efectivo';

    const precioChanged     = newPrecio !== oldPrecio;
    const metodoPagoChanged = newMetodoPago !== oldMetodoPago;

    // Freeze financiero para no-admin
    if (isEntregado && !isAdmin && (precioChanged || metodoPagoChanged)) {
      throw new Error('El precio y método de pago no se pueden modificar en un ticket ya entregado.');
    }

    const updateData = {
      clienteId:         data.clienteId,
      tipo:              data.tipo,
      equipo:            data.equipo.trim(),
      marca:             data.marca ? data.marca.trim() : "",
      modelo:            data.modelo ? data.modelo.trim() : "",
      problema:          data.problema.trim(),
      servicioRealizado: (data.servicioRealizado || '').trim(),
      garantiaDias:      Number(data.garantiaDias) || 90,
      precio:            newPrecio,
      metodoPago:        newMetodoPago,
      planServicio:      data.planServicio || "estandar",
      updatedAt:         serverTimestamp()
    };

    const docRef = doc(db, COLLECTIONS.trabajos, id);
    await updateDoc(docRef, updateData);

    await publishPublicOrder(id, { ...trabajoActual, ...updateData });

    // Admin override: registro financiero especial + movimiento compensatorio
    if (isEntregado && isAdmin && (precioChanged || metodoPagoChanged)) {
      const delta = newPrecio - oldPrecio;

      await addTicketHistoryEvent(id, {
        type:    TICKET_EVENT_TYPES.financialAdjustment,
        message: `Ajuste financiero por admin: precio ${precioChanged ? `${oldPrecio} → ${newPrecio}` : 'sin cambio'}, método ${metodoPagoChanged ? `${oldMetodoPago} → ${newMetodoPago}` : 'sin cambio'}`,
        metadata: {
          oldPrice:      oldPrecio,
          newPrice:      newPrecio,
          oldMetodoPago,
          newMetodoPago,
          adjustedBy:    session?.user?.uid || '',
        },
      });

      if (delta !== 0) {
        const activeSession = await getActiveCajaSession();
        createAdjustmentEntry({
          delta,
          ticketId:    id,
          descripcion: `Ajuste admin ticket #${trabajoActual.numeroOrden || id} (precio ${oldPrecio} → ${newPrecio})`,
          sessionId:   activeSession?.id || null,
        }).catch(err => console.warn('Ajuste caja fallido:', err));
      }
    } else {
      await addTicketHistoryEvent(id, {
        type:    TICKET_EVENT_TYPES.edited,
        message: 'Ticket editado',
        metadata: {
          equipo:       updateData.equipo,
          problema:     updateData.problema,
          planServicio: updateData.planServicio,
          precio:       updateData.precio,
        },
      });
    }

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
  if (ticket.estado !== WORK_STATUS.enReparacion) return false;
  if (!ticket.fechaIngreso) return false;
  return Date.now() - new Date(ticket.fechaIngreso).getTime() > 7 * 24 * 60 * 60 * 1000;
}

export function isHighValue(ticket) {
  return Number(ticket.presupuesto || 0) >= 100_000;
}

export function needsApprovalCTA(ticket) {
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
