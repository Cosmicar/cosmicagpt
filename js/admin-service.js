import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc,
  addDoc, serverTimestamp, query, where, orderBy, limit,
  increment, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import {
  createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { db, createSecondaryFirebaseApp } from "./firebase.js";
import { COLLECTIONS, ROLES, isAdmin } from "./domain.js";

// ── COLECCIONES ADMIN ────────────────────────────────────────────
export const ADMIN_COLLECTIONS = Object.freeze({
  puntos_log:  "puntos_log",
  beneficios:  "beneficios",
  penalidades: "penalidades"
});

// ── PERMISOS GRANULARES ──────────────────────────────────────────
export const PERMISOS = Object.freeze({
  ver_caja:           "ver_caja",
  editar_trabajos:    "editar_trabajos",
  eliminar_trabajos:  "eliminar_trabajos",
  ver_inventario:     "ver_inventario",
  editar_inventario:  "editar_inventario",
  ver_facturacion:    "ver_facturacion",
  exportar_datos:     "exportar_datos",
  ver_reportes:       "ver_reportes",
  gestion_clientes:   "gestion_clientes"
});

export const PERMISOS_LABEL = {
  ver_caja:          "Ver caja",
  editar_trabajos:   "Editar trabajos",
  eliminar_trabajos: "Eliminar trabajos",
  ver_inventario:    "Ver inventario",
  editar_inventario: "Editar inventario",
  ver_facturacion:   "Ver facturación",
  exportar_datos:    "Exportar datos",
  ver_reportes:      "Ver reportes",
  gestion_clientes:  "Gestión de clientes"
};

export const PERMISOS_POR_ROL = Object.freeze({
  admin:     Object.values(PERMISOS),
  operador:  ["ver_caja", "editar_trabajos", "ver_inventario", "gestion_clientes"],
  tecnico:   ["editar_trabajos", "ver_inventario", "editar_inventario"],
  recepcion: ["editar_trabajos", "gestion_clientes"],
  tester:    Object.values(PERMISOS)
});

// ── LISTAR USUARIOS ──────────────────────────────────────────────
export async function listAllUsers() {
  const snap = await getDocs(collection(db, COLLECTIONS.usuarios));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── CREAR USUARIO ────────────────────────────────────────────────
export async function createUser({ email, password, nombre, rol, permisos, adminProfile }) {
  if (!isAdmin(adminProfile)) {
    throw new Error("Solo un administrador puede crear usuarios.");
  }

  const rolFinal = Object.values(ROLES).includes(rol) ? rol : ROLES.operador;
  const permisosFinal = Array.isArray(permisos) ? permisos : (PERMISOS_POR_ROL[rolFinal] || []);

  const secondary = createSecondaryFirebaseApp();
  try {
    const credentials = await createUserWithEmailAndPassword(secondary.auth, email, password);
    const uid = credentials.user.uid;

    await setDoc(doc(db, COLLECTIONS.usuarios, uid), {
      email,
      nombre: nombre?.trim() || "",
      rol: rolFinal,
      permisos: permisosFinal,
      activo: true,
      puntos: 0,
      creadoEn: serverTimestamp(),
      creadoPor: adminProfile.email || adminProfile.id
    });

    await signOut(secondary.auth).catch(() => {});
    return { uid, email, rol: rolFinal };
  } finally {
    await secondary.destroy().catch(() => {});
  }
}

// ── ACTUALIZAR USUARIO ───────────────────────────────────────────
export async function updateUser({ uid, data, adminProfile }) {
  if (!isAdmin(adminProfile)) {
    throw new Error("Solo un administrador puede editar usuarios.");
  }

  const allowed = ["rol", "permisos", "activo", "nombre"];
  const update = {};
  for (const key of allowed) {
    if (key in data) update[key] = data[key];
  }
  update.actualizadoEn = serverTimestamp();
  update.actualizadoPor = adminProfile.email || adminProfile.id;

  await updateDoc(doc(db, COLLECTIONS.usuarios, uid), update);
}

// ── SISTEMA DE PUNTOS ────────────────────────────────────────────
export async function agregarPuntos({ uid, puntos, motivo, tipo = "manual", adminProfile }) {
  if (!isAdmin(adminProfile)) {
    throw new Error("Solo un administrador puede gestionar puntos.");
  }
  if (!Number.isFinite(puntos) || puntos === 0) {
    throw new Error("Puntos inválidos.");
  }

  await updateDoc(doc(db, COLLECTIONS.usuarios, uid), { puntos: increment(puntos) });

  await addDoc(collection(db, ADMIN_COLLECTIONS.puntos_log), {
    uid,
    puntos,
    motivo: motivo?.trim() || "Sin motivo",
    tipo,
    creadoEn: serverTimestamp(),
    creadoPor: adminProfile.email || adminProfile.id
  });
}

export async function getPuntosLog(uid) {
  const q = query(
    collection(db, ADMIN_COLLECTIONS.puntos_log),
    where("uid", "==", uid),
    orderBy("creadoEn", "desc"),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── BENEFICIOS ───────────────────────────────────────────────────
export async function listBeneficios() {
  const snap = await getDocs(collection(db, ADMIN_COLLECTIONS.beneficios));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveBeneficio({ id, nombre, descripcion, puntos, activo = true }, adminProfile) {
  if (!isAdmin(adminProfile)) throw new Error("Sin permisos.");
  const data = {
    nombre: nombre?.trim(),
    descripcion: descripcion?.trim() || "",
    puntos: Math.abs(Number(puntos)),
    activo,
    tipo: "beneficio"
  };
  if (id) {
    await updateDoc(doc(db, ADMIN_COLLECTIONS.beneficios, id), { ...data, actualizadoEn: serverTimestamp() });
  } else {
    await addDoc(collection(db, ADMIN_COLLECTIONS.beneficios), { ...data, creadoEn: serverTimestamp() });
  }
}

export async function deleteBeneficio(id, adminProfile) {
  if (!isAdmin(adminProfile)) throw new Error("Sin permisos.");
  await deleteDoc(doc(db, ADMIN_COLLECTIONS.beneficios, id));
}

// ── PENALIDADES ──────────────────────────────────────────────────
export async function listPenalidades() {
  const snap = await getDocs(collection(db, ADMIN_COLLECTIONS.penalidades));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function savePenalidad({ id, nombre, descripcion, puntos, activo = true }, adminProfile) {
  if (!isAdmin(adminProfile)) throw new Error("Sin permisos.");
  const data = {
    nombre: nombre?.trim(),
    descripcion: descripcion?.trim() || "",
    puntos: -Math.abs(Number(puntos)),
    activo,
    tipo: "penalidad"
  };
  if (id) {
    await updateDoc(doc(db, ADMIN_COLLECTIONS.penalidades, id), { ...data, actualizadoEn: serverTimestamp() });
  } else {
    await addDoc(collection(db, ADMIN_COLLECTIONS.penalidades), { ...data, creadoEn: serverTimestamp() });
  }
}

export async function deletePenalidad(id, adminProfile) {
  if (!isAdmin(adminProfile)) throw new Error("Sin permisos.");
  await deleteDoc(doc(db, ADMIN_COLLECTIONS.penalidades, id));
}

// ── APLICAR PRESET (beneficio o penalidad) A USUARIO ─────────────
export async function aplicarPreset({ uid, itemId, tipo, adminProfile }) {
  const colName = tipo === "beneficio" ? ADMIN_COLLECTIONS.beneficios : ADMIN_COLLECTIONS.penalidades;
  const snap = await getDoc(doc(db, colName, itemId));
  if (!snap.exists()) throw new Error("Preset no encontrado.");
  const item = snap.data();
  await agregarPuntos({
    uid,
    puntos: item.puntos,
    motivo: `${tipo === "beneficio" ? "Beneficio" : "Penalidad"}: ${item.nombre}`,
    tipo,
    adminProfile
  });
}
