import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { APP_ROUTES } from "./config.js";
import { auth, db, createSecondaryFirebaseApp } from "./firebase.js";
import { COLLECTIONS, ROLES, isAdmin, isStaff, normalizeRole } from "./domain.js";

let session = {
  user: null,
  profile: null
};

export function getSession() {
  return session;
}

export async function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  await signOut(auth);
  window.location.href = APP_ROUTES.login;
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, COLLECTIONS.usuarios, uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function requirePanelSession({ onReady, onUnauthorized, onError }) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      session = { user: null, profile: null };
      onUnauthorized?.();
      return;
    }

    try {
      const profile = await getUserProfile(user.uid);
      session = { user, profile };

      if (!isStaff(profile)) {
        await signOut(auth);
        onError?.(new Error("Tu usuario no tiene permisos activos para ingresar al panel."));
        return;
      }

      onReady?.(session);
    } catch (error) {
      onError?.(error);
    }
  });
}

export function redirectIfLoggedIn() {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    const profile = await getUserProfile(user.uid).catch(() => null);
    if (isStaff(profile)) window.location.href = APP_ROUTES.panel;
  });
}

export async function createOperatorUser({ email, password, role = ROLES.operador, adminProfile }) {
  if (!isAdmin(adminProfile)) {
    throw new Error("Solo un administrador puede crear usuarios.");
  }

  const secondary = createSecondaryFirebaseApp();
  try {
    const credentials = await createUserWithEmailAndPassword(secondary.auth, email, password);
    const uid = credentials.user.uid;

    await setDoc(doc(db, COLLECTIONS.usuarios, uid), {
      email,
      rol: normalizeRole(role),
      activo: true,
      creadoEn: serverTimestamp()
    }, { merge: true });

    await signOut(secondary.auth).catch(() => {});
    return { uid, email };
  } finally {
    await secondary.destroy().catch(() => {});
  }
}
