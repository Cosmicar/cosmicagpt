import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "./firebase.js";
import { COLLECTIONS, ORDER_PREFIX, SERVICE_TYPES, normalizeServiceType } from "./domain.js";

export async function findClienteByDni(dni) {
  const q = query(collection(db, COLLECTIONS.clientes), where("dni", "==", dni));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function getCliente(id) {
  const snap = await getDoc(doc(db, COLLECTIONS.clientes, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function upsertClienteByDni(cliente) {
  const existing = await findClienteByDni(cliente.dni);
  if (existing) {
    await updateDoc(doc(db, COLLECTIONS.clientes, existing.id), {
      nombre: cliente.nombre,
      apellido: cliente.apellido || "",
      telefono: cliente.telefono,
      provincia: cliente.provincia
    });
    return existing.id;
  }

  const ref = await addDoc(collection(db, COLLECTIONS.clientes), {
    nombre: cliente.nombre,
    apellido: cliente.apellido || "",
    dni: cliente.dni,
    telefono: cliente.telefono,
    provincia: cliente.provincia
  });
  return ref.id;
}

export async function updateCliente(id, cliente) {
  await updateDoc(doc(db, COLLECTIONS.clientes, id), {
    nombre: cliente.nombre,
    apellido: cliente.apellido || "",
    telefono: cliente.telefono,
    provincia: cliente.provincia
  });
}

export async function listClientesMap() {
  const snap = await getDocs(collection(db, COLLECTIONS.clientes));
  const clientes = {};
  snap.forEach((docSnap) => {
    clientes[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
  });
  return clientes;
}

export async function listTrabajos() {
  const snap = await getDocs(collection(db, COLLECTIONS.trabajos));
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function findTrabajosByClienteId(clienteId) {
  const q = query(collection(db, COLLECTIONS.trabajos), where("clienteId", "==", clienteId));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function findTrabajosByNumeroOrden(numeroOrden) {
  const q = query(collection(db, COLLECTIONS.trabajos), where("numeroOrden", "==", numeroOrden));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function getTrabajo(id) {
  const snap = await getDoc(doc(db, COLLECTIONS.trabajos, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getTrabajoWithCliente(id) {
  const trabajo = await getTrabajo(id);
  if (!trabajo) return null;
  const cliente = await getCliente(trabajo.clienteId);
  return { trabajo, cliente };
}

export async function updateTrabajo(id, data) {
  await updateDoc(doc(db, COLLECTIONS.trabajos, id), data);
}

export async function addTrabajo(data) {
  const ref = await addDoc(collection(db, COLLECTIONS.trabajos), data);
  return ref.id;
}

export async function deleteTrabajo(id) {
  await deleteDoc(doc(db, COLLECTIONS.trabajos, id));
}

export async function getNextOrderNumber(tipo) {
  const normalizedType = normalizeServiceType(tipo);
  const counterKey = normalizedType === SERVICE_TYPES.remoto ? "remoto" : "taller";
  const prefix = ORDER_PREFIX[normalizedType];
  const baseline = await getMaxOrderSequence(normalizedType);
  const counterRef = doc(db, COLLECTIONS.config, "ordenes");

  const next = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const current = Number(snap.exists() ? snap.data()?.[counterKey] || 0 : 0);
    const nextValue = Math.max(current, baseline) + 1;
    transaction.set(counterRef, { [counterKey]: nextValue }, { merge: true });
    return nextValue;
  });

  return `${prefix}-${String(next).padStart(4, "0")}`;
}

async function getMaxOrderSequence(tipo) {
  const prefix = `${ORDER_PREFIX[tipo]}-`;
  const trabajos = await listTrabajos();
  return trabajos.reduce((max, trabajo) => {
    if (trabajo.tipo !== tipo || !String(trabajo.numeroOrden || "").startsWith(prefix)) return max;
    const value = Number(String(trabajo.numeroOrden).replace(prefix, ""));
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
}

export async function setOrderCounterBaseline({ taller, remoto }) {
  await setDoc(doc(db, COLLECTIONS.config, "ordenes"), {
    taller: Number(taller || 0),
    remoto: Number(remoto || 0)
  }, { merge: true });
}
