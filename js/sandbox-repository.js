/**
 * sandbox-repository.js
 * Repositorio de SOLO lectura/escritura en colecciones demo (_demo).
 * Se activa automáticamente cuando el rol de la sesión es "tester".
 * NO modifica las colecciones de producción.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "./firebase.js";
import { WORK_STATUS, ORDER_PREFIX, SERVICE_TYPES } from "./domain.js";

// ── Colecciones demo (aisladas de producción) ──────────────────
const DEMO = Object.freeze({
  trabajos:       "trabajos_demo",
  clientes:       "clientes_demo",
  ordenesPublicas: "ordenesPublicas_demo"
});

// ── Helpers internos ────────────────────────────────────────────
function nowIso() { return new Date().toISOString(); }
function pad(n) { return String(n).padStart(4, "0"); }
function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── Re-exports de las funciones del repositorio principal ───────
// (proxeadas a las colecciones demo)

export async function listTrabajos() {
  const snap = await getDocs(collection(db, DEMO.trabajos));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getTrabajo(id) {
  const snap = await getDoc(doc(db, DEMO.trabajos, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getTrabajoWithCliente(id) {
  const trabajo = await getTrabajo(id);
  if (!trabajo) return null;
  const cliente = await getCliente(trabajo.clienteId);
  return { trabajo, cliente };
}

export async function addTrabajo(data) {
  const ref = await addDoc(collection(db, DEMO.trabajos), data);
  return ref.id;
}

export async function updateTrabajo(id, data) {
  await updateDoc(doc(db, DEMO.trabajos, id), data);
}

export async function deleteTrabajo(id) {
  await deleteDoc(doc(db, DEMO.trabajos, id));
}

export async function findTrabajosByClienteId(clienteId) {
  const q = query(collection(db, DEMO.trabajos), where("clienteId", "==", clienteId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function findTrabajosByNumeroOrden(numeroOrden) {
  const q = query(collection(db, DEMO.trabajos), where("numeroOrden", "==", numeroOrden));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getCliente(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, DEMO.clientes, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function findClienteByDni(dni) {
  const q = query(collection(db, DEMO.clientes), where("dni", "==", dni));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function upsertClienteByDni(cliente) {
  const existing = await findClienteByDni(cliente.dni);
  if (existing) {
    await updateDoc(doc(db, DEMO.clientes, existing.id), {
      nombre: cliente.nombre,
      apellido: cliente.apellido || "",
      telefono: cliente.telefono,
      provincia: cliente.provincia
    });
    return existing.id;
  }
  const ref = await addDoc(collection(db, DEMO.clientes), {
    nombre: cliente.nombre,
    apellido: cliente.apellido || "",
    dni: cliente.dni,
    telefono: cliente.telefono,
    provincia: cliente.provincia
  });
  return ref.id;
}

export async function updateCliente(id, data) {
  await updateDoc(doc(db, DEMO.clientes, id), {
    nombre: data.nombre,
    apellido: data.apellido || "",
    telefono: data.telefono,
    provincia: data.provincia
  });
}

export async function listClientesMap() {
  const snap = await getDocs(collection(db, DEMO.clientes));
  const map = {};
  snap.forEach(d => { map[d.id] = { id: d.id, ...d.data() }; });
  return map;
}

export async function publishPublicOrder(id, trabajo) {
  await setDoc(doc(db, DEMO.ordenesPublicas, id), {
    numeroOrden:     trabajo.numeroOrden || "",
    estado:          trabajo.estado || "",
    tipo:            trabajo.tipo || "",
    equipo:          trabajo.equipo || "",
    marca:           trabajo.marca || "",
    modelo:          trabajo.modelo || "",
    diagnostico:     trabajo.diagnostico || "",
    servicioRealizado: trabajo.servicioRealizado || "",
    fechaIngreso:    trabajo.fechaIngreso || "",
    fechaReparado:   trabajo.fechaReparado || "",
    fechaEntregado:  trabajo.fechaEntregado || "",
    garantiaDias:    Number(trabajo.garantiaDias || 90),
    actualizadoEn:   nowIso()
  }, { merge: true });
}

export async function deletePublicOrder(id) {
  await deleteDoc(doc(db, DEMO.ordenesPublicas, id));
}

// getNextOrderNumber simplificado para sandbox (sin transacción de contador global)
export async function getNextOrderNumber(tipo) {
  const prefix = ORDER_PREFIX[tipo] || "TAL";
  const snap = await getDocs(collection(db, DEMO.trabajos));
  const max = snap.docs.reduce((m, d) => {
    const num = Number(String(d.data().numeroOrden || "").replace(`${prefix}-`, ""));
    return Number.isFinite(num) ? Math.max(m, num) : m;
  }, 0);
  return `${prefix}-${pad(max + 1)}`;
}

// ── Función de inyección de datos de prueba ─────────────────────
const NOMBRES = ["Fito Páez", "Gustavo Demo", "Tester Pérez", "Prueba García", "Sandbox López", "Charly Virtual"];
const EQUIPOS = ["Notebook", "PC de escritorio", "Impresora", "Tablet", "All-in-One"];
const MARCAS  = ["HP", "Lenovo", "Epson", "Asus", "Samsung"];
const PROBLEMAS = [
  "No enciende al presionar el botón de encendido.",
  "Pantalla rota con manchas de colores.",
  "Se congela a los 5 minutos de uso.",
  "No detecta la red WiFi.",
  "Hace ruido extraño al girar el ventilador."
];
const ESTADOS = [WORK_STATUS.ingresado, WORK_STATUS.enReparacion, WORK_STATUS.listo];

export async function inyectarDatosDePrueba() {
  const ordenes = [
    { tipo: SERVICE_TYPES.taller, nombre: randomItem(NOMBRES), dni: "11111111", precio: 8500 },
    { tipo: SERVICE_TYPES.taller, nombre: randomItem(NOMBRES), dni: "22222222", precio: 12000 },
    { tipo: SERVICE_TYPES.remoto, nombre: randomItem(NOMBRES), dni: "33333333", precio: 5000 },
    { tipo: SERVICE_TYPES.taller, nombre: randomItem(NOMBRES), dni: "44444444", precio: 17500 }
  ];

  for (const [i, o] of ordenes.entries()) {
    // Crear o reutilizar cliente demo
    const [apellido] = o.nombre.split(" ").slice(1);
    const nombre    = o.nombre.split(" ")[0];
    const clienteRef = await addDoc(collection(db, DEMO.clientes), {
      nombre,
      apellido: apellido || "Demo",
      dni: o.dni,
      telefono: `388300000${i}`,
      provincia: "Jujuy"
    });

    const prefix = ORDER_PREFIX[o.tipo];
    const numeroOrden = `${prefix}-${pad(900 + i + 1)}`;
    const estado = randomItem(ESTADOS);

    const nuevoTrabajo = {
      numeroOrden,
      clienteId: clienteRef.id,
      tipo: o.tipo,
      equipo: randomItem(EQUIPOS),
      marca: randomItem(MARCAS),
      modelo: `Modelo-Demo-${i + 1}`,
      problema: randomItem(PROBLEMAS),
      diagnostico: "",
      servicioRealizado: "",
      precio: o.precio,
      estado,
      fechaIngreso: nowIso(),
      fechaReparado: null,
      fechaEntregado: null,
      garantiaDias: 90
    };

    const trabajoRef = await addDoc(collection(db, DEMO.trabajos), nuevoTrabajo);
    await publishPublicOrder(trabajoRef.id, nuevoTrabajo);
  }
}
