import { collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "../../../js/firebase.js";
import { COLLECTIONS, ROLES } from "../../../js/domain.js";
import { cacheWrap, cacheInvalidate } from '../core/cache.js';
import { getCurrentSession } from '../core/session.js';

const CLIENTES_LIMIT = 500; // máximo por lectura Firestore

/**
 * Returns role-aware query constraints for the clientes collection.
 * Operadores can only see clients from "taller" (origenContacto == 'taller').
 * Mirrors the same pattern used in legacy /js/work-repository.js → listClientesCRM().
 */
function _buildClientesQueryConstraints() {
  const session = getCurrentSession();
  const role = session?.profile?.rol;
  if (role === ROLES.operador) {
    return [where('origenContacto', '==', 'taller')];
  }
  return [];
}

/**
 * Obtiene el listado de clientes desde Firestore.
 * Limitado a CLIENTES_LIMIT, ordenado por createdAt desc (más recientes primero).
 * Para operadores filtra por origenContacto == 'taller' (sin índice compuesto:
 * el ordenamiento se hace en cliente para evitar requerir índice Firestore).
 *
 * @returns {Promise<Array>} Lista de clientes
 */
export function getClientes() {
  const session = getCurrentSession();
  const role = session?.profile?.rol;
  const isOperador = role === ROLES.operador;
  const cacheKey = isOperador ? 'clientes:list:taller' : 'clientes:list';

  return cacheWrap(cacheKey, async () => {
    let q;
    if (isOperador) {
      // Sólo el filtro where — sin orderBy para no requerir índice compuesto.
      // El orden se aplica en cliente a continuación.
      q = query(
        collection(db, COLLECTIONS.clientes),
        where('origenContacto', '==', 'taller'),
        limit(CLIENTES_LIMIT)
      );
    } else {
      q = query(
        collection(db, COLLECTIONS.clientes),
        orderBy('createdAt', 'desc'),
        limit(CLIENTES_LIMIT)
      );
    }

    const snap = await getDocs(q);
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Ordenamiento en cliente para el caso operador (evita índice compuesto)
    if (isOperador) {
      docs.sort((a, b) => {
        const ta = a.createdAt?.seconds ?? 0;
        const tb = b.createdAt?.seconds ?? 0;
        return tb - ta;
      });
    }

    return docs;
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
    // 1. Validación básica — paridad con legacy: solo nombre y teléfono son
    //    obligatorios. DNI quedó opcional para permitir cargas rápidas.
    if (!data.nombre || !data.telefono) {
      throw new Error("Nombre y Teléfono son campos obligatorios.");
    }

    // 2. Preparar objeto para guardar (Sanitización y metadatos)
    const newCliente = {
      nombre: data.nombre.trim(),
      apellido: (data.apellido || '').trim(),
      dni: (data.dni || '').trim(),
      telefono: data.telefono.trim(),
      provincia: data.provincia || 'no_definida',
      observaciones: data.observaciones ? data.observaciones.trim() : '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      source: 'cosmica-saas-v1' // Flag para identificar registros del nuevo sistema
    };

    // 3. Guardar en Firestore
    const docRef = await addDoc(collection(db, COLLECTIONS.clientes), newCliente);
    
    cacheInvalidate('clientes:list');
    cacheInvalidate('clientes:list:taller');
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
    cacheInvalidate('clientes:list');
    cacheInvalidate('clientes:list:taller');
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
    cacheInvalidate('clientes:list');
    cacheInvalidate('clientes:list:taller');
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
