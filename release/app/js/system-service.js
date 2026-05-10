import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "./firebase.js";
import { getSession } from "./auth-service.js";

const DEFAULT_SYSTEM_CONFIG = Object.freeze({
  inventarioActivo: true,
  ventasActivas: true,
  modoDebug: false
});

let _systemConfigCache = null;

export async function getSystemConfig({ force = false } = {}) {
  if (_systemConfigCache && !force) return _systemConfigCache;

  try {
    const ref = doc(db, "config", "system");
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, DEFAULT_SYSTEM_CONFIG, { merge: true });
      _systemConfigCache = { ...DEFAULT_SYSTEM_CONFIG };
      return _systemConfigCache;
    }

    _systemConfigCache = {
      ...DEFAULT_SYSTEM_CONFIG,
      ...snap.data()
    };
    return _systemConfigCache;
  } catch (error) {
    console.warn("[system] No se pudo leer config/system:", error);
    _systemConfigCache = { ...DEFAULT_SYSTEM_CONFIG };
    return _systemConfigCache;
  }
}

export function getCachedSystemConfig() {
  return _systemConfigCache || DEFAULT_SYSTEM_CONFIG;
}

export async function logSystem(tipo, payload = {}, level = "info") {
  try {
    const session = getSession();
    const colName = session?.profile?.rol === "tester" ? "system_logs_demo" : "system_logs";
    await addDoc(collection(db, colName), {
      tipo,
      level,
      payload,
      usuario: session?.user?.email || "sistema",
      rol: session?.profile?.rol || "",
      fecha: new Date().toISOString(),
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.warn("[system-log]", tipo, payload, error);
  }
}

