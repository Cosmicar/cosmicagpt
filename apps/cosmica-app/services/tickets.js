import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "../../../js/firebase.js";
import { COLLECTIONS, WORK_STATUS } from "../../../js/domain.js";
import { getNextOrderNumber, publishPublicOrder, getTrabajo } from "../../../js/work-repository.js";
import { addTicketHistoryEvent, TICKET_EVENT_TYPES } from "./ticket-history.js";

/**
 * Obtiene el listado de tickets (trabajos) desde Firestore.
 * Retorna datos puros.
 * 
 * @returns {Promise<Array>} Lista de tickets
 */
export async function getTickets() {
  try {
    // Consultamos la colección de trabajos, ordenando por fecha de ingreso descendente
    const q = query(collection(db, COLLECTIONS.trabajos), orderBy("fechaIngreso", "desc"));
    const querySnapshot = await getDocs(q);
    const tickets = [];
    
    querySnapshot.forEach((doc) => {
      tickets.push({ id: doc.id, ...doc.data() });
    });
    
    return tickets;
  } catch (error) {
    console.error("Error al obtener tickets en el servicio:", error);
    throw error;
  }
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
      servicioRealizado: "",
      precio: Number(data.precio || 0),
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
      precio: Number(data.precio || 0),
      planServicio: data.planServicio || "estandar",
      updatedAt: serverTimestamp()
    };

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

    return { success: true };
  } catch (error) {
    console.error("Error al actualizar ticket:", error);
    return { success: false, error: error.message };
  }
}
