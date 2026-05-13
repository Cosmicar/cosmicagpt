/**
 * @file auth.js
 * @description Capa de servicios de autenticación para el nuevo SaaS.
 * 
 * temporary bridge from legacy auth
 * Este archivo extrae la lógica pura de js/auth-service.js para ser utilizada
 * en el entorno modular del SaaS, sin dependencias de DOM ni redirecciones.
 */

import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { auth, db } from "../../../js/firebase.js";
import { COLLECTIONS } from "../../../js/domain.js";

// Estado de la sesión local (en memoria)
let session = {
  user: null,
  profile: null
};

/**
 * Reusable logic
 * Obtiene el estado de la sesión actual.
 * @returns {Object} { user, profile }
 */
export function getSession() {
  return session;
}

/**
 * Reusable logic
 * Autentica un usuario con email y contraseña.
 * Retorna datos puros (credenciales) y no realiza redirecciones.
 * 
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise} Credenciales de Firebase
 */
export async function loginWithEmail(email, password) {
  const credentials = await signInWithEmailAndPassword(auth, email, password);
  session.user = credentials.user;
  return credentials;
}

/**
 * Reusable logic
 * Obtiene el perfil del usuario desde Firestore.
 * Retorna datos puros.
 * 
 * @param {string} uid 
 * @returns {Promise<Object|null>} Perfil del usuario o null
 */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, COLLECTIONS.usuarios, uid));
  const profile = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  
  if (profile) {
    session.profile = profile;
  }
  
  return profile;
}
