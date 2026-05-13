import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "../../../js/firebase.js";
import { COLLECTIONS } from "../../../js/domain.js";

/**
 * Obtiene el listado de clientes desde Firestore.
 * Retorna datos puros.
 * 
 * @returns {Promise<Array>} Lista de clientes
 */
export async function getClientes() {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTIONS.clientes));
    const clientes = [];
    
    querySnapshot.forEach((doc) => {
      clientes.push({ id: doc.id, ...doc.data() });
    });
    
    return clientes;
  } catch (error) {
    console.error("Error al obtener clientes en el servicio:", error);
    throw error; // Re-lanzar para que la vista lo maneje
  }
}
