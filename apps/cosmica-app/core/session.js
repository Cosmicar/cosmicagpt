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
    const TIMEOUT_MS = 12_000;
    const timer = setTimeout(() => {
      reject(new Error('Tiempo de espera agotado al conectar con Firebase Auth'));
    }, TIMEOUT_MS);

    const done = (sessionValue) => { clearTimeout(timer); resolve(sessionValue); };
    const fail = (err)          => { clearTimeout(timer); reject(err); };

    try {
      onAuthStateChanged(
        auth,
        async (user) => {
          if (user) {
            try {
              const profile = await getUserProfile(user.uid);
              currentSession = { user, profile };
              done(currentSession);
            } catch (error) {
              // Firestore profile failed — resolve degraded rather than error screen
              console.error("Error al cargar perfil de usuario:", error);
              currentSession = { user, profile: null };
              done(currentSession);
            }
          } else {
            currentSession = { user: null, profile: null };
            done(currentSession);
          }
        },
        (authError) => {
          console.error("Firebase Auth error:", authError);
          fail(authError);
        }
      );
    } catch (syncErr) {
      fail(syncErr);
    }
  });
}

/**
 * Obtiene la sesión actual en memoria.
 * Also mirrors to window.__cosmicaCurrentSession__ so chaos-guard.js can read
 * session info without creating a circular import dependency.
 * @returns {Object} { user, profile }
 */
export function getCurrentSession() {
  // Keep the window mirror in sync — zero-cost after the first read
  try { window.__cosmicaCurrentSession__ = currentSession; } catch {}
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
 * Verifica si el usuario puede acceder a un recurso o acción.
 *
 * Degraded-profile safety: when the Firestore profile fetch fails (network error,
 * permission denied on /usuarios), `profile` is null but the user IS authenticated.
 * In that case we grant read-only actions and deny destructive ones — this prevents
 * the entire card/drawer action bar from going blank due to a transient profile load
 * failure.  The user sees print / WA / view buttons; edit / status-change stay hidden.
 *
 * @param {string} action - 'admin' | 'edit-ticket' | 'create-client' | etc.
 * @returns {boolean}
 */
export function canAccess(action) {
  const { user, profile } = currentSession;

  // Not authenticated at all → deny everything
  if (!user) return false;

  // Profile failed to load (Firestore error) → degraded read-only mode
  if (!profile) {
    // Allow safe read-only and contact actions; block all writes
    const readOnlyAllowed = ['view-tickets', 'view-clients', 'inventario-read', 'finanzas-read'];
    return readOnlyAllowed.includes(action);
  }

  const role = profile.rol;

  // Admin and Tester have full access
  if (role === 'admin' || role === 'tester') return true;

  switch (action) {
    case 'config':
      return false; // Admin-only
    case 'edit-ticket':
      // tecnico: technical repairs; operador: workshop orders; recepcion: at creation
      return ['tecnico', 'operador', 'recepcion'].includes(role);
    case 'create-ticket':
      return ['recepcion', 'operador'].includes(role);
    case 'create-client':
      return ['recepcion', 'operador'].includes(role);
    case 'view-tickets':
    case 'view-clients':
    case 'inventario-read':
      return true; // All staff roles
    case 'inventario-write': // consume stock from tickets
      return ['tecnico', 'operador'].includes(role);
    case 'finanzas-read':
      return true; // All staff roles
    case 'finanzas-write': // register cash movements
      return ['recepcion', 'operador'].includes(role);
    default:
      return false;
  }
}
