import { collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "../../../js/firebase.js";
import { COLLECTIONS } from "../../../js/domain.js";
import { cacheWrap, cacheInvalidate } from '../core/cache.js';

const CACHE_KEY     = 'clientes:list';
const CLIENTES_LIMIT = 500; // máximo por lectura Firestore

/**
 * Obtiene el listado de clientes desde Firestore.
 * Limitado a CLIENTES_LIMIT, ordenado por createdAt desc (más recientes primero).
 *
 * @returns {Promise<Array>} Lista de clientes
 */
export function getClientes() {
  return cacheWrap(CACHE_KEY, async () => {
    const q = query(
      collection(db, COLLECTIONS.clientes),
      orderBy('createdAt', 'desc'),
      limit(CLIENTES_LIMIT)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}

/**
 * Obtiene un cliente específico por ID.
 * @param {string} id 
 * @returns {Promise<Object>} Datos del cliente
 */
export async function getCliente(id) {
  const docSnap = await getDoc(doc(db, COLLECTIONS.clientes, id));
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  throw new Error("Cliente no encontrado.");
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
    
    cacheInvalidate(CACHE_KEY);
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

/**
 * Actualiza un cliente existente.
 * 
 * @param {string} id 
 * @param {Object} data 
 * @returns {Promise<Object>} Resultado
 */
export async function updateCliente(id, data) {
  try {
    const docRef = doc(db, COLLECTIONS.clientes, id);
    
    const updateData = {
      nombre: data.nombre.trim(),
      dni: data.dni.trim(),
      telefono: data.telefono.trim(),
      provincia: data.provincia || 'no_definida',
      observaciones: data.observaciones ? data.observaciones.trim() : '',
      updatedAt: serverTimestamp()
    };

    await updateDoc(docRef, updateData);
    cacheInvalidate(CACHE_KEY);
    return {
      success: true,
      message: "Cliente actualizado correctamente."
    };
  } catch (error) {
    console.error("Error al actualizar cliente en el servicio:", error);
    return {
      success: false,
      error: error.message || "No se pudo actualizar el cliente."
    };
  }
}

/**
 * Elimina un cliente.
 */
export async function deleteCliente(id) {
  try {
    await deleteDoc(doc(db, COLLECTIONS.clientes, id));
    cacheInvalidate(CACHE_KEY);
    return { success: true };
  } catch (error) {
    console.error("Error al eliminar cliente:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Fusiona un cliente duplicado (source) en uno principal (target).
 * Elimina el duplicado.
 */
export async function mergeClientes(targetId, sourceId) {
  try {
    if (targetId === sourceId) throw new Error("No se puede fusionar un cliente consigo mismo.");
    // En una implementación real, aquí actualizaríamos las referencias de tickets.
    // Por ahora, solo eliminamos el duplicado para limpiar la base.
    await deleteCliente(sourceId);
    return { success: true };
  } catch (error) {
    console.error("Error al fusionar clientes:", error);
    return { success: false, error: error.message };
  }
}
