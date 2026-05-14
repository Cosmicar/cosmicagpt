import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { auth } from "../../../js/firebase.js";
import { getUserProfile } from "../services/auth.js";

// Estado de la sesión en memoria
let currentSession = {
  user: null,
  profile: null
};

/**
 * Inicializa la sesión verificando el estado de autenticación en Firebase.
 * temporary bridge from legacy auth
 * 
 * @returns {Promise<Object>} La sesión actual
 */
export function initializeSession() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const profile = await getUserProfile(user.uid);
          currentSession = { user, profile };
          console.log("session initialized");
          resolve(currentSession);
        } catch (error) {
          // El perfil de Firestore falló, pero el usuario SÍ está autenticado.
          // Resolver con profile: null permite que la app cargue en estado degradado
          // en vez de mostrar la pantalla de error de autenticación.
          console.error("Error al cargar perfil de usuario:", error);
          currentSession = { user, profile: null };
          resolve(currentSession);
        }
      } else {
        currentSession = { user: null, profile: null };
        console.log("no active session");
        resolve(currentSession);
      }
    });
  });
}

/**
 * Obtiene la sesión actual en memoria.
 * @returns {Object} { user, profile }
 */
export function getCurrentSession() {
  return currentSession;
}

/**
 * Limpia la sesión en memoria.
 */
export function clearSession() {
  currentSession = { user: null, profile: null };
}

/**
 * Cierra la sesión de Firebase y limpia el estado en memoria.
 * Recarga la página para volver al flujo de login.
 */
export async function logout() {
  await signOut(auth);
  clearSession();
  window.location.reload();
}

/**
 * Verifica si el usuario actual tiene un rol específico
 * @param {string|Array} role - Rol o lista de roles permitidos
 * @returns {boolean}
 */
export function hasRole(role) {
  const profile = currentSession.profile;
  if (!profile) return false;
  
  if (Array.isArray(role)) {
    return role.includes(profile.rol);
  }
  return profile.rol === role;
}

/**
 * Verifica si el usuario puede acceder a un recurso o acción
 * @param {string} action - 'admin' | 'edit-ticket' | 'create-client' | etc.
 * @returns {boolean}
 */
export function canAccess(action) {
  const profile = currentSession.profile;
  if (!profile) return false;
  
  const role = profile.rol;
  
  // Admin tiene acceso total
  if (role === 'admin') return true;
  
  switch (action) {
    case 'config':
      return false; // Solo admin
    case 'edit-ticket':
      return role === 'tecnico';
    case 'create-ticket':
    case 'create-client':
      return role === 'recepcion';
    case 'view-tickets':
    case 'view-clients':
      return true; // Todos los roles staff
    default:
      return false;
  }
}
