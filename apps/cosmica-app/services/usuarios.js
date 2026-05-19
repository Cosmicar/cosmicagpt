import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "../../../js/firebase.js";
import { COLLECTIONS } from "../../../js/domain.js";
import { cacheWrap } from '../core/cache.js';

const CACHE_KEY = 'usuarios:list';

/**
 * Obtiene el listado de usuarios (staff) habilitados.
 * 
 * @returns {Promise<Array>} Lista de usuarios
 */
export async function getUsuarios() {
  return cacheWrap(CACHE_KEY, async () => {
    try {
      const q = query(
        collection(db, COLLECTIONS.usuarios),
        where('activo', '!=', false)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        displayName: d.data().nombre || d.data().email || 'Usuario sin nombre'
      })).sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (err) {
      // Graceful degradation: si las rules bloquean al rol (ej. operador
      // antes del rules-deploy), devolvemos lista vacía. La UI del formulario
      // mostrará "Sin asignar" en el selector de técnico — el usuario aún
      // puede crear el ticket.
      console.warn('[usuarios] getUsuarios() denied by rules — returning empty list:', err.message);
      return [];
    }
  });
}

/**
 * Filtra usuarios por rol de técnico o capacidad operativa.
 */
export async function getTecnicos() {
  const all = await getUsuarios();
  // Incluimos admin y técnicos para asignación
  return all.filter(u => ['admin', 'tecnico', 'operador'].includes(u.rol));
}
