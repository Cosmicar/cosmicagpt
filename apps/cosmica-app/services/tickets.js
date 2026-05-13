import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "../../../js/firebase.js";
import { COLLECTIONS } from "../../../js/domain.js";

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
