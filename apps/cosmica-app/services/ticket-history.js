import { collection, addDoc, getDocs, orderBy, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "../../../js/firebase.js";
import { COLLECTIONS } from "../../../js/domain.js";
import { getCurrentSession } from "../core/session.js";

/**
 * Tipos de evento canónicos para el historial de tickets.
 * Usar estas constantes al llamar addTicketHistoryEvent().
 */
export const TICKET_EVENT_TYPES = {
  created:              'ticket_created',
  statusChanged:        'status_changed',
  edited:               'ticket_edited',
  budgetApproved:       'budget_approved',
  financialAdjustment:  'financial_adjustment',
  paymentMethodChanged: 'payment_method_changed',
  technicianAssigned:   'technician_assigned',
  technicianUnassigned: 'technician_unassigned',
};

/**
 * Registra un evento en la subcolección tickets/{ticketId}/history.
 *
 * No lanza excepciones — si falla, loguea y retorna sin romper el flujo principal.
 *
 * @param {string} ticketId  - ID del documento en COLLECTIONS.trabajos
 * @param {{
 *   type:     string,
 *   message:  string,
 *   metadata: Object
 * }} eventData
 */
export async function addTicketHistoryEvent(ticketId, eventData) {
  try {
    const session = getCurrentSession();
    const user = session?.user?.email || 'sistema';

    const event = {
      type:      eventData.type,
      message:   eventData.message,
      createdAt: serverTimestamp(),
      user,
      metadata:  eventData.metadata ?? {},
    };

    const historyCol = collection(db, COLLECTIONS.trabajos, ticketId, 'history');
    await addDoc(historyCol, event);
  } catch (err) {
    // El historial no debe interrumpir la operación principal
    console.error('[ticket-history] No se pudo registrar el evento:', err);
  }
}

/**
 * Registra el evento budget_approved solo si no existe ya.
 * Idempotente — se puede llamar cada vez que aprobadoCliente sea true.
 *
 * @param {string} ticketId
 */
export async function ensureBudgetApprovedEvent(ticketId) {
  try {
    const events = await getTicketHistory(ticketId);
    if (events.some(e => e.type === TICKET_EVENT_TYPES.budgetApproved)) return;
    await addTicketHistoryEvent(ticketId, {
      type:     TICKET_EVENT_TYPES.budgetApproved,
      message:  'Presupuesto aprobado por el cliente',
      metadata: {},
    });
  } catch (err) {
    console.error('[ticket-history] ensureBudgetApprovedEvent failed:', err);
  }
}

/**
 * Recupera el historial de un ticket ordenado por fecha descendente.
 *
 * @param {string} ticketId
 * @returns {Promise<Array<{id, type, message, user, createdAt, metadata}>>}
 */
export async function getTicketHistory(ticketId) {
  const historyCol = collection(db, COLLECTIONS.trabajos, ticketId, 'history');
  const q = query(historyCol, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
