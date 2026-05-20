/**
 * push.js — Servicio de Push Notifications para el SaaS Cósmica
 *
 * Responsabilidades:
 *  - Inicializar Firebase Messaging
 *  - Pedir permiso y obtener token FCM del dispositivo
 *  - Guardar / eliminar el token en Firestore (notification_tokens)
 *  - Exponer activarPush(), desactivarPush(), pushActivo()
 */

import { getApp }        from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getMessaging, getToken, deleteToken, onMessage }
  from "https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging.js";
import { doc, setDoc, deleteDoc }
  from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db }              from "../../../js/firebase.js";
import { getCurrentSession } from "../core/session.js";

export const VAPID_KEY = "BEKakDYEjQMa4oxctdaQfeEKxNTzGmR4cQW6JK8q4c92RLZsPvnyfECTSyTGR_0FG3asvoGHRR3AwYM5kANe-Hc";

const TOKENS_COL = "notification_tokens";
const LS_KEY     = "cosmica_saas_push_token";

// ── Singleton de Messaging ────────────────────────────────────────
let _messaging = null;
function getMsg() {
  if (!_messaging) _messaging = getMessaging(getApp());
  return _messaging;
}

// ── Registrar SW de FCM ───────────────────────────────────────────
async function registerSW() {
  if (!("serviceWorker" in navigator)) throw new Error("Service Workers no soportados.");
  // El SW debe estar junto al index.html del SaaS
  const swUrl = new URL("firebase-messaging-sw.js", window.location.href).href;
  return navigator.serviceWorker.register(swUrl, { scope: "./" });
}

// ── Activar Push ──────────────────────────────────────────────────
export async function activarPush() {
  if (!("Notification" in window)) throw new Error("Tu navegador no soporta notificaciones.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permiso denegado. Habilitá las notificaciones desde el navegador.");

  const swReg = await registerSW();
  const token = await getToken(getMsg(), { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
  if (!token) throw new Error("No se pudo obtener el token FCM.");

  const session = getCurrentSession();
  await setDoc(doc(db, TOKENS_COL, token), {
    token,
    uid:          session?.user?.uid   || "anonymous",
    rol:          session?.profile?.rol || "unknown",
    email:        session?.user?.email  || "",
    dispositivo:  navigator.userAgent,
    actualizadoEn: new Date().toISOString()
  });

  localStorage.setItem(LS_KEY, token);

  // Mostrar notificaciones en foreground (app abierta)
  onMessage(getMsg(), (payload) => {
    const title = payload.notification?.title || "🔔 Cósmica";
    const body  = payload.notification?.body  || "Nueva notificación";
    // Usamos Notification API nativa para foreground
    if (Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/assets/icon-192.png"
      });
    }
  });

  return { ok: true, token };
}

// ── Desactivar Push ───────────────────────────────────────────────
export async function desactivarPush() {
  const token = localStorage.getItem(LS_KEY);
  if (token) {
    try { await deleteDoc(doc(db, TOKENS_COL, token)); } catch (_) {}
    try { await deleteToken(getMsg()); } catch (_) {}
    localStorage.removeItem(LS_KEY);
  }
  return { ok: true };
}

// ── Estado actual ─────────────────────────────────────────────────
export function pushActivo() {
  return !!localStorage.getItem(LS_KEY);
}
