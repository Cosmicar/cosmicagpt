import { collection, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
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

/**
 * Crea un nuevo cliente en Firestore.
 * 
 * @param {Object} data - Datos del cliente
 * @returns {Promise<Object>} Resultado de la operación
 */
export async function createCliente(data) {
  try {
    // 1. Validación básica de datos mínimos requeridos
    if (!data.nombre || !data.dni || !data.telefono) {
      throw new Error("Nombre, DNI y Teléfono son campos obligatorios.");
    }

    // 2. Preparar objeto para guardar (Sanitización y metadatos)
    const newCliente = {
      nombre: data.nombre.trim(),
      dni: data.dni.trim(),
      telefono: data.telefono.trim(),
      provincia: data.provincia || 'no_definida',
      observaciones: data.observaciones ? data.observaciones.trim() : '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      source: 'cosmica-saas-v1' // Flag para identificar registros del nuevo sistema
    };

    // 3. Guardar en Firestore
    const docRef = await addDoc(collection(db, COLLECTIONS.clientes), newCliente);
    
    return {
      success: true,
      id: docRef.id,
      message: "Cliente registrado correctamente."
    };

  } catch (error) {
    console.error("Error al crear cliente en el servicio:", error);
    return {
      success: false,
      error: error.message || "No se pudo registrar el cliente. Intente nuevamente."
    };
  }
}
