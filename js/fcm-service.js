/**
 * fcm-service.js
 * Módulo de Push Notifications via Firebase Cloud Messaging (FCM).
 *
 * Responsabilidades:
 *  - Registrar el SW de FCM (firebase-messaging-sw.js)
 *  - Solicitar permisos y obtener el token FCM del dispositivo
 *  - Guardar / eliminar el token en Firestore (colección: notification_tokens)
 *  - Exportar helpers para el panel
 *
 * REGLA: Este módulo NO toca ARCA, PDF ni emitir-factura.js.
 */

import { getApp }       from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getMessaging, getToken, deleteToken }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";
import {
  collection, doc, setDoc, deleteDoc, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "./firebase.js";

// ── VAPID Key (Web Push Certificate) ─────────────────────────────────────
// Generala en Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
// Pegá la clave pública (VAPID) aquí:
export const VAPID_KEY = "BEKakDYEjQMa4oxctdaQfeEKxNTzGmR4cQW6JK8q4c92RLZsPvnyfECTSyTGR_0FG3asvoGHRR3AwYM5kANe-Hc";

// Colección Firestore donde se guardan los tokens FCM
const TOKENS_COLLECTION = "notification_tokens";

// Key de localStorage para recordar si el usuario activó la campanita
const LS_KEY_BELL = "cosmica_push_enabled";

// ── Singleton de messaging ────────────────────────────────────────────────
let _messaging = null;
function getMsg() {
  if (!_messaging) {
    try {
      _messaging = getMessaging(getApp());
    } catch (e) {
      console.error("[FCM] No se pudo inicializar Firebase Messaging:", e);
      throw e;
    }
  }
  return _messaging;
}

// ── Registrar el SW de FCM ────────────────────────────────────────────────
export async function registrarSWFcm() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" }
    );
    console.log("[FCM] SW de mensajería registrado:", reg.scope);
    return reg;
  } catch (err) {
    console.error("[FCM] Error al registrar el SW de mensajería:", err);
    return null;
  }
}

// ── Obtener token FCM del dispositivo ─────────────────────────────────────
export async function obtenerTokenFcm() {
  const swReg = await registrarSWFcm();
  const messaging = getMsg();

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: swReg ?? undefined
  });

  if (!token) throw new Error("No se pudo obtener el token FCM. Verificá los permisos.");
  console.log("[FCM] Token obtenido:", token);
  return token;
}

// ── Guardar token en Firestore ────────────────────────────────────────────
// El documento usa el token como ID para evitar duplicados.
export async function guardarTokenEnFirestore(token, userSession) {
  const uid   = userSession?.user?.uid   || "anonymous";
  const rol   = userSession?.profile?.rol || "unknown";
  const email = userSession?.user?.email  || "";

  await setDoc(doc(db, TOKENS_COLLECTION, token), {
    token,
    uid,
    rol,
    email,
    dispositivo:  navigator.userAgent,
    creadoEn:     new Date().toISOString(),
    actualizadoEn: new Date().toISOString()
  });

  console.log("[FCM] Token guardado en Firestore para:", email);
}

// ── Eliminar token de Firestore y revocar en FCM ──────────────────────────
export async function eliminarTokenDeFirestore(token) {
  if (!token) return;
  try {
    await deleteDoc(doc(db, TOKENS_COLLECTION, token));
    const messaging = getMsg();
    await deleteToken(messaging);
    console.log("[FCM] Token eliminado de Firestore y FCM.");
  } catch (err) {
    console.warn("[FCM] Error al eliminar token:", err);
  }
}

// ── Activar Push Notifications ────────────────────────────────────────────
// Retorna { ok: true, token } o lanza error.
export async function activarPush(userSession) {
  if (!("Notification" in window)) {
    throw new Error("Tu navegador no soporta notificaciones.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permiso denegado. Habilitá las notificaciones desde la configuración del navegador.");
  }

  const token = await obtenerTokenFcm();
  await guardarTokenEnFirestore(token, userSession);

  localStorage.setItem(LS_KEY_BELL, token); // persistir para poder revocar luego
  return { ok: true, token };
}

// ── Desactivar Push Notifications ─────────────────────────────────────────
export async function desactivarPush() {
  const token = localStorage.getItem(LS_KEY_BELL);
  await eliminarTokenDeFirestore(token);
  localStorage.removeItem(LS_KEY_BELL);
  return { ok: true };
}

// ── Estado actual de la campanita ─────────────────────────────────────────
export function pushEstaActivo() {
  return !!localStorage.getItem(LS_KEY_BELL);
}
