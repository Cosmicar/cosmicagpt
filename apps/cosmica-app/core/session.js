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
          console.error("Error al inicializar sesión:", error);
          currentSession = { user, profile: null };
          reject(error);
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
