/**
 * notificaciones.js — Sistema de notificaciones in-app vía Firestore
 *
 * Reemplaza la integración con Netlify Functions (agotado el free tier).
 * Escribe documentos en `notificaciones/{uid}/inbox` cuando se asignan puntos.
 * La app escucha en tiempo real y muestra toasts al usuario.
 *
 * Colección: notificaciones/{uid}/inbox/{autoId}
 * Campos:  { titulo, cuerpo, tipo, leido, creadoEn }
 */

import {
  collection, addDoc, query, where, onSnapshot,
  updateDoc, doc, serverTimestamp, orderBy, limit
} from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { db } from '../../../js/firebase.js';

const COL = (uid) => collection(db, 'notificaciones', uid, 'inbox');

/**
 * Escribe una notificación en el inbox de un usuario.
 * @param {string} uid
 * @param {string} titulo
 * @param {string} cuerpo
 * @param {'puntos'|'penalidad'|'info'} tipo
 */
export async function enviarNotificacion(uid, titulo, cuerpo, tipo = 'info') {
  if (!uid) return;
  try {
    await addDoc(COL(uid), {
      titulo,
      cuerpo,
      tipo,
      leido: false,
      creadoEn: serverTimestamp()
    });
  } catch (err) {
    console.warn('[notificaciones] enviarNotificacion failed:', err.message);
  }
}

/**
 * Suscribe al inbox del usuario logueado. Llama onNueva(doc) para cada
 * notificación nueva no leída.
 * Retorna la función de unsuscribe.
 * @param {string} uid
 * @param {function} onNueva
 */
export function suscribirseAlInbox(uid, onNueva) {
  if (!uid) return () => {};

  const q = query(
    COL(uid),
    where('leido', '==', false),
    limit(20)
  );


  const unsub = onSnapshot(q, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === 'added') {
        onNueva(change.doc);
      }
    });
  }, (err) => {
    console.warn('[notificaciones] suscribirseAlInbox error:', err.message);
  });

  return unsub;
}


/**
 * Marca una notificación como leída.
 * @param {string} uid
 * @param {string} docId
 */
export async function marcarLeida(uid, docId) {
  try {
    await updateDoc(doc(db, 'notificaciones', uid, 'inbox', docId), { leido: true });
  } catch (err) {
    console.warn('[notificaciones] marcarLeida failed:', err.message);
  }
}
