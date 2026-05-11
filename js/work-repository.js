import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "./firebase.js";
import { COLLECTIONS, ORDER_PREFIX, SERVICE_TYPES, normalizeServiceType, ROLES } from "./domain.js";
import { getSession } from "./auth-service.js";

// ── Getters de colección dinámicos (evalúados en tiempo de ejecución) ──
// El tester apunta a colecciones _demo para no contaminar producción.
const isTesterSession = () => getSession()?.profile?.rol === 'tester';
const getTrabajosCol  = () => isTesterSession() ? "trabajos_demo"        : COLLECTIONS.trabajos;
const getClientesCol  = () => isTesterSession() ? "clientes_demo"        : COLLECTIONS.clientes;
const getPublicasCol  = () => isTesterSession() ? "ordenesPublicas_demo" : COLLECTIONS.ordenesPublicas;

export async function findClienteByDni(dni) {
  const q = query(collection(db, getClientesCol()), where("dni", "==", dni));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function getCliente(id) {
  const snap = await getDoc(doc(db, getClientesCol(), id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function findClienteMatch(cliente) {
  if (cliente.dni && cliente.dni.trim() !== "") {
    const qDni = query(collection(db, getClientesCol()), where("dni", "==", cliente.dni.trim()));
    const snapDni = await getDocs(qDni);
    if (!snapDni.empty) return { type: 'dni', client: { id: snapDni.docs[0].id, ...snapDni.docs[0].data() } };
  }

  if (cliente.telefono && cliente.telefono.trim() !== "") {
    const qTel = query(collection(db, getClientesCol()), where("telefono", "==", cliente.telefono.trim()));
    const snapTel = await getDocs(qTel);
    if (!snapTel.empty) {
      return { type: 'telefono', client: { id: snapTel.docs[0].id, ...snapTel.docs[0].data() } };
    }
  }

  if (cliente.nombre && cliente.nombre.trim() !== "") {
    const qNom = query(collection(db, getClientesCol()), where("nombre", "==", cliente.nombre.trim()));
    const snapNom = await getDocs(qNom);
    for (const d of snapNom.docs) {
      const data = d.data();
      if ((data.apellido || "").trim().toLowerCase() === (cliente.apellido || "").trim().toLowerCase()) {
        return { type: 'nombre', client: { id: d.id, ...data } };
      }
    }
  }

  return null;
}

export async function createNewCliente(cliente) {
  const ref = await addDoc(collection(db, getClientesCol()), {
    nombre: cliente.nombre,
    apellido: cliente.apellido || "",
    dni: cliente.dni || "",
    telefono: cliente.telefono,
    provincia: cliente.provincia,
    origenContacto: cliente.origenContacto || ""
  });
  return ref.id;
}

export async function updateCliente(id, cliente) {
  await updateDoc(doc(db, getClientesCol(), id), {
    nombre: cliente.nombre,
    apellido: cliente.apellido || "",
    telefono: cliente.telefono,
    provincia: cliente.provincia
  });
}

export async function deleteCliente(id) {
  await deleteDoc(doc(db, getClientesCol(), id));
}

// ── Migración: inyecta origenContacto basado en provincia ───────────
// Regla: Jujuy (o sin provincia) → "taller", cualquier otra → "remoto".
export async function migrarClientesGeolocalizados() {
  const snap = await getDocs(collection(db, getClientesCol()));
  if (snap.empty) return 0;

  const batch = writeBatch(db);
  let contador = 0;

  snap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const provincia = (data.provincia || "").trim().toLowerCase();
    const origen = (!provincia || provincia === "jujuy") ? "taller" : "remoto";

    // Solo actualizar si el campo falta o tiene un valor diferente al calculado
    if (data.origenContacto !== origen) {
      batch.update(docSnap.ref, { origenContacto: origen });
      contador++;
    }
  });

  await batch.commit();
  return contador; // devuelve cuántos docs se actualizaron
}

export async function listClientesMap() {
  const snap = await getDocs(collection(db, getClientesCol()));
  const clientes = {};
  snap.forEach((docSnap) => {
    clientes[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
  });
  return clientes;
}

// ── CRM: lista de clientes con filtro de rol ─────────────────────
export async function listClientesCRM(profile) {
  let q;
  if (profile?.rol === ROLES.operador) {
    q = query(collection(db, getClientesCol()), where("origenContacto", "==", "taller"));
  } else {
    q = collection(db, getClientesCol());
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── CRM: historial de servicios de un cliente ────────────────
export async function listTrabajosByClienteIdCRM(clienteId, profile) {
  let q;
  if (profile?.rol === ROLES.operador) {
    q = query(
      collection(db, getTrabajosCol()),
      where("clienteId", "==", clienteId),
      where("tipo", "==", SERVICE_TYPES.taller)
    );
  } else {
    q = query(collection(db, getTrabajosCol()), where("clienteId", "==", clienteId));
  }
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => new Date(b.fechaIngreso) - new Date(a.fechaIngreso));
}

export async function listTrabajos(profile) {
  let q;
  if (profile?.rol === ROLES.operador) {
    q = query(collection(db, getTrabajosCol()), where("tipo", "==", SERVICE_TYPES.taller));
  } else {
    q = collection(db, getTrabajosCol());
  }
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function findTrabajosByClienteId(clienteId, profile) {
  let q;
  if (profile?.rol === ROLES.operador) {
    q = query(collection(db, getTrabajosCol()), where("clienteId", "==", clienteId), where("tipo", "==", SERVICE_TYPES.taller));
  } else {
    q = query(collection(db, getTrabajosCol()), where("clienteId", "==", clienteId));
  }
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function findTrabajosByNumeroOrden(numeroOrden, profile) {
  let q;
  if (profile?.rol === ROLES.operador) {
    q = query(collection(db, getTrabajosCol()), where("numeroOrden", "==", numeroOrden), where("tipo", "==", SERVICE_TYPES.taller));
  } else {
    q = query(collection(db, getTrabajosCol()), where("numeroOrden", "==", numeroOrden));
  }
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function getTrabajo(id) {
  const snap = await getDoc(doc(db, getTrabajosCol(), id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getTrabajoWithCliente(id) {
  const trabajo = await getTrabajo(id);
  if (!trabajo) return null;
  const cliente = await getCliente(trabajo.clienteId);
  return { trabajo, cliente };
}

export async function getPublicOrder(id) {
  const snap = await getDoc(doc(db, getPublicasCol(), id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function findPublicOrderByNumeroOrden(numeroOrden) {
  const q = query(collection(db, getPublicasCol()), where("numeroOrden", "==", numeroOrden));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function publishPublicOrder(id, trabajo) {
  await setDoc(doc(db, getPublicasCol(), id), {
    numeroOrden: trabajo.numeroOrden || "",
    estado: trabajo.estado || "",
    tipo: trabajo.tipo || "",
    equipo: trabajo.equipo || "",
    marca: trabajo.marca || "",
    modelo: trabajo.modelo || "",
    diagnostico: trabajo.diagnostico || "",
    servicioRealizado: trabajo.servicioRealizado || "",
    fechaIngreso: trabajo.fechaIngreso || "",
    fechaReparado: trabajo.fechaReparado || "",
    fechaEntregado: trabajo.fechaEntregado || "",
    garantiaDias: Number(trabajo.garantiaDias || 90),
    actualizadoEn: new Date().toISOString()
  }, { merge: true });
}

export async function updateTrabajo(id, data) {
  await updateDoc(doc(db, getTrabajosCol(), id), data);
}

export async function addTrabajo(data) {
  const ref = await addDoc(collection(db, getTrabajosCol()), data);
  return ref.id;
}

export async function deleteTrabajo(id) {
  await deleteDoc(doc(db, getTrabajosCol(), id));
}

export async function deletePublicOrder(id) {
  await deleteDoc(doc(db, getPublicasCol(), id));
}

export async function getNextOrderNumber(tipo, profile) {
  const normalizedType = normalizeServiceType(tipo);
  const counterKey = normalizedType === SERVICE_TYPES.remoto ? "remoto" : "taller";
  const prefix = ORDER_PREFIX[normalizedType];
  const counterRef = doc(db, COLLECTIONS.config, "ordenes");

  const next = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const current = Number(snap.exists() ? snap.data()?.[counterKey] || 0 : 0);
    const nextValue = current + 1;
    transaction.set(counterRef, { [counterKey]: nextValue }, { merge: true });
    return nextValue;
  });

  return `${prefix}-${String(next).padStart(4, "0")}`;
}

export async function setOrderCounterBaseline({ taller, remoto }) {
  await setDoc(doc(db, COLLECTIONS.config, "ordenes"), {
    taller: Number(taller || 0),
    remoto: Number(remoto || 0)
  }, { merge: true });
}

export async function resetContabilidadBatch() {
  const batch = writeBatch(db);
  const snap = await getDocs(collection(db, getTrabajosCol()));
  snap.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, { precio: 0 });
  });
  await batch.commit();
}

// ── Cierre de Caja Taller ──────────────────────────────────────
// Retorna los trabajos de taller entregados que aún no fueron liquidados.
export async function getTrabajosNoLiquidados() {
  const q = query(
    collection(db, getTrabajosCol()),
    where("tipo", "==", "taller"),
    where("estado", "==", "Entregado")
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, _ref: d.ref, ...d.data() }))
    .filter((t) => t.liquidado !== true);
}

// Marca como liquidado=true todos los trabajos del array (recibidos de getTrabajosNoLiquidados).
export async function liquidarCajaBatch(trabajos) {
  const batch = writeBatch(db);
  trabajos.forEach((t) => batch.update(t._ref, { liquidado: true }));
  await batch.commit();
}

// ── Planes de servicio (colección config, siempre producción) ───
export async function getPreciosPlanes() {
  const snap = await getDoc(doc(db, COLLECTIONS.config, "planes"));
  return snap.exists() ? snap.data() : {};
}

export async function setPreciosPlanes({ bronce, oro, platinum, reset }) {
  await setDoc(doc(db, COLLECTIONS.config, "planes"), {
    bronce:   Number(bronce   || 0),
    oro:      Number(oro      || 0),
    platinum: Number(platinum || 0),
    reset:    Number(reset    || 0)
  }, { merge: true });
}

// ── Notificaciones en tiempo real ──────────────────────────────
// Devuelve la función `unsubscribe` de Firestore para limpiar el listener.
// `profile` - perfil de sesión del usuario logueado
// `onChange` - callback(snapshot) que se invoca en cada cambio real (no en la carga inicial)
export function suscribirseANuevosTrabajos(profile, onChange) {
  const colName = getTrabajosCol();
  let q;

  if (profile?.rol === ROLES.operador) {
    // Operador: solo trabajos de taller (filtro que ya existe en el dominio)
    q = query(collection(db, colName), where("tipo", "==", "taller"));
  } else {
    // Admin / tester: todos los trabajos
    q = collection(db, colName);
  }

  let inicializado = false;

  const unsubscribe = onSnapshot(q, (snapshot) => {
    if (!inicializado) {
      // Primera ejecución: carga del estado actual — ignorar para evitar spam
      inicializado = true;
      return;
    }
    onChange(snapshot);
  });

  return unsubscribe;
}
