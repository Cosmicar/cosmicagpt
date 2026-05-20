import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc,
  addDoc, serverTimestamp, query, where, orderBy, limit,
  increment, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import {
  createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { db, createSecondaryFirebaseApp } from "../../../js/firebase.js";
import { COLLECTIONS } from "../../../js/domain.js";

// ── Colecciones admin ────────────────────────────────────────────
export const ADMIN_COLS = Object.freeze({
  puntos_log:  "puntos_log",
  beneficios:  "beneficios",
  penalidades: "penalidades"
});

// ── Definición de permisos granulares ────────────────────────────
export const PERMISOS = Object.freeze({
  ver_caja:          "ver_caja",
  editar_trabajos:   "editar_trabajos",
  eliminar_trabajos: "eliminar_trabajos",
  ver_inventario:    "ver_inventario",
  editar_inventario: "editar_inventario",
  ver_facturacion:   "ver_facturacion",
  exportar_datos:    "exportar_datos",
  ver_reportes:      "ver_reportes",
  gestion_clientes:  "gestion_clientes"
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

export const ROLES_INFO = [
  { value: "admin",     label: "Administrador",  color: "var(--accent-orange, #FF5E00)" },
  { value: "operador",  label: "Operador",        color: "var(--accent-cyan)"  },
  { value: "tecnico",   label: "Técnico",         color: "var(--accent-green, #10B981)" },
  { value: "recepcion", label: "Recepción",       color: "var(--accent-purple)" },
  { value: "tester",    label: "Tester",          color: "#F59E0B" }
];

// ── Usuarios ─────────────────────────────────────────────────────

export async function listAllUsers() {
  const snap = await getDocs(collection(db, COLLECTIONS.usuarios));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createUser({ email, password, nombre, rol, permisos }) {
  const rolFinal = ROLES_INFO.some(r => r.value === rol) ? rol : "operador";
  const permisosFinal = Array.isArray(permisos) ? permisos : (PERMISOS_POR_ROL[rolFinal] || []);

  const secondary = createSecondaryFirebaseApp();
  try {
    const { user } = await createUserWithEmailAndPassword(secondary.auth, email, password);
    await setDoc(doc(db, COLLECTIONS.usuarios, user.uid), {
      email,
      nombre: nombre?.trim() || "",
      rol: rolFinal,
      permisos: permisosFinal,
      activo: true,
      puntos: 0,
      creadoEn: serverTimestamp()
    });
    await signOut(secondary.auth).catch(() => {});
    return { uid: user.uid, email, rol: rolFinal };
  } finally {
    await secondary.destroy().catch(() => {});
  }
}

export async function updateUser(uid, data) {
  const allowed = ["rol", "permisos", "activo", "nombre"];
  const update = {};
  for (const key of allowed) {
    if (key in data) update[key] = data[key];
  }
  update.actualizadoEn = serverTimestamp();
  await updateDoc(doc(db, COLLECTIONS.usuarios, uid), update);
}

// ── Puntos ───────────────────────────────────────────────────────

export async function agregarPuntos(uid, puntos, motivo, tipo = "manual") {
  if (!Number.isFinite(puntos) || puntos === 0) throw new Error("Puntos inválidos.");
  await updateDoc(doc(db, COLLECTIONS.usuarios, uid), { puntos: increment(puntos) });
  await addDoc(collection(db, ADMIN_COLS.puntos_log), {
    uid, puntos,
    motivo: motivo?.trim() || "Sin motivo",
    tipo,
    creadoEn: serverTimestamp()
  });
}

export async function getPuntosLog(uid) {
  const q = query(
    collection(db, ADMIN_COLS.puntos_log),
    where("uid", "==", uid),
    orderBy("creadoEn", "desc"),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Beneficios ────────────────────────────────────────────────────

export async function listBeneficios() {
  const snap = await getDocs(collection(db, ADMIN_COLS.beneficios));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveBeneficio({ id, nombre, descripcion, puntos, activo = true }) {
  const data = {
    nombre: nombre?.trim(),
    descripcion: descripcion?.trim() || "",
    puntos: Math.abs(Number(puntos)),
    activo,
    tipo: "beneficio"
  };
  if (id) {
    await updateDoc(doc(db, ADMIN_COLS.beneficios, id), { ...data, actualizadoEn: serverTimestamp() });
  } else {
    await addDoc(collection(db, ADMIN_COLS.beneficios), { ...data, creadoEn: serverTimestamp() });
  }
}

export async function deleteBeneficio(id) {
  await deleteDoc(doc(db, ADMIN_COLS.beneficios, id));
}

// ── Penalidades ───────────────────────────────────────────────────

export async function listPenalidades() {
  const snap = await getDocs(collection(db, ADMIN_COLS.penalidades));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function savePenalidad({ id, nombre, descripcion, puntos, activo = true }) {
  const data = {
    nombre: nombre?.trim(),
    descripcion: descripcion?.trim() || "",
    puntos: -Math.abs(Number(puntos)),
    activo,
    tipo: "penalidad"
  };
  if (id) {
    await updateDoc(doc(db, ADMIN_COLS.penalidades, id), { ...data, actualizadoEn: serverTimestamp() });
  } else {
    await addDoc(collection(db, ADMIN_COLS.penalidades), { ...data, creadoEn: serverTimestamp() });
  }
}

export async function deletePenalidad(id) {
  await deleteDoc(doc(db, ADMIN_COLS.penalidades, id));
}

// ── Aplicar preset a usuario ──────────────────────────────────────

export async function aplicarPreset(uid, itemId, tipo) {
  const colName = tipo === "beneficio" ? ADMIN_COLS.beneficios : ADMIN_COLS.penalidades;
  const snap = await getDoc(doc(db, colName, itemId));
  if (!snap.exists()) throw new Error("Preset no encontrado.");
  const item = snap.data();
  await agregarPuntos(
    uid,
    item.puntos,
    `${tipo === "beneficio" ? "Beneficio" : "Penalidad"}: ${item.nombre}`,
    tipo
  );
}
