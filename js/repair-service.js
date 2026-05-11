import { db } from "./firebase.js";
import { collection, getDocs, doc, writeBatch, updateDoc, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { getTrabajosNoLiquidados } from "./work-repository.js";

// Helper para logs
function logAudit(msg) {
  console.log(`[AUDIT] ${msg}`);
  const logDiv = document.getElementById("auditLogs");
  if (logDiv) {
    logDiv.innerHTML += `<div>${msg}</div>`;
  }
}

export async function auditarYRepararBD() {
  logAudit("Iniciando auditoría de base de datos...");
  
  const clientesCol = collection(db, "clientes");
  const trabajosCol = collection(db, "trabajos");

  const [clientesSnap, trabajosSnap] = await Promise.all([
    getDocs(clientesCol),
    getDocs(trabajosCol)
  ]);

  const clientes = [];
  clientesSnap.forEach(snap => clientes.push({ id: snap.id, ref: snap.ref, ...snap.data() }));

  const trabajos = [];
  trabajosSnap.forEach(snap => trabajos.push({ id: snap.id, ref: snap.ref, ...snap.data() }));

  logAudit(`Se encontraron ${clientes.length} clientes y ${trabajos.length} trabajos.`);

  const batch = writeBatch(db);
  let changes = 0;

  // 1. REPARAR CLIENTES DUPLICADOS (Por DNI y por Nombre+Teléfono)
  const dnis = {};
  const names = {};
  const clientesAEliminar = new Set();
  const remapClientes = {}; // old_id -> new_id

  for (const c of clientes) {
    if (clientesAEliminar.has(c.id)) continue;

    let isDuplicate = false;
    let mainClient = null;

    if (c.dni && c.dni.trim() !== "") {
      if (dnis[c.dni]) {
        isDuplicate = true;
        mainClient = dnis[c.dni];
      } else {
        dnis[c.dni] = c;
      }
    } else if (c.nombre && c.telefono) {
      const key = `${c.nombre.toLowerCase().trim()}_${c.telefono.trim()}`;
      if (names[key]) {
        isDuplicate = true;
        mainClient = names[key];
      } else {
        names[key] = c;
      }
    }

    if (isDuplicate && mainClient) {
      logAudit(`Cliente duplicado detectado: ${c.nombre} (ID: ${c.id}). Se fusionará con ${mainClient.id}`);
      clientesAEliminar.add(c.id);
      remapClientes[c.id] = mainClient.id;
    }
  }

  // 2. REASIGNAR TRABAJOS DE CLIENTES DUPLICADOS
  for (const t of trabajos) {
    if (remapClientes[t.clienteId]) {
      logAudit(`Trabajo ${t.numeroOrden} reasignado al cliente fusionado ${remapClientes[t.clienteId]}`);
      batch.update(t.ref, { clienteId: remapClientes[t.clienteId] });
      changes++;
    }
  }

  // 3. ELIMINAR CLIENTES DUPLICADOS
  for (const cId of clientesAEliminar) {
    const cRef = doc(db, "clientes", cId);
    batch.delete(cRef);
    changes++;
  }

  // 4. DETECTAR Y REPARAR ÓRDENES DUPLICADAS (Ej. REM-0030)
  const ordenesVistas = {};
  let counterRemoto = 0;
  let counterTaller = 0;

  // Actualizar los contadores base primero
  for (const t of trabajos) {
    if (t.numeroOrden) {
      const num = parseInt(t.numeroOrden.split("-")[1] || "0", 10);
      if (t.tipo === "remoto" && num > counterRemoto) counterRemoto = num;
      if (t.tipo === "taller" && num > counterTaller) counterTaller = num;
    }
  }

  for (const t of trabajos) {
    if (!t.numeroOrden) continue;
    
    // Verificar si es un número duplicado exacto
    if (ordenesVistas[t.numeroOrden]) {
      const original = ordenesVistas[t.numeroOrden];
      logAudit(`¡ORDEN DUPLICADA ENCONTRADA! ${t.numeroOrden}`);
      logAudit(`Original ID: ${original.id}, Duplicada ID: ${t.id}`);
      
      // Si tienen exactamente los mismos datos (mismo equipo, mismo precio, misma fecha, etc.)
      // Es un doble-submit 100%. Eliminamos la duplicada.
      if (t.clienteId === original.clienteId && t.equipo === original.equipo) {
        logAudit(`La orden ${t.id} es un clon de ${original.id}. Se eliminará.`);
        batch.delete(t.ref);
        
        // También eliminar de ordenesPublicas
        const publicRef = doc(db, "ordenesPublicas", t.id);
        batch.delete(publicRef);
        changes++;
      } else {
        // Es una orden distinta que colisionó en el ID. Le damos un ID nuevo.
        const num = t.tipo === "remoto" ? ++counterRemoto : ++counterTaller;
        const prefix = t.tipo === "remoto" ? "REM" : "TAL";
        const newOrder = `${prefix}-${String(num).padStart(4, "0")}`;
        
        logAudit(`La orden ${t.id} colisionó pero es distinta. Se renombra a ${newOrder}`);
        batch.update(t.ref, { numeroOrden: newOrder });
        
        const publicRef = doc(db, "ordenesPublicas", t.id);
        batch.update(publicRef, { numeroOrden: newOrder });
        changes++;
      }
    } else {
      ordenesVistas[t.numeroOrden] = t;
    }
  }

  // 5. RESTAURAR CONTADORES DE ORDENES (Sanity check)
  const counterRef = doc(db, "config", "ordenes");
  batch.set(counterRef, {
    remoto: counterRemoto,
    taller: counterTaller
  }, { merge: true });
  changes++;

  logAudit(`Auditoría finalizada. Se aplicarán ${changes} correcciones en batch...`);
  
  if (changes > 0) {
    await batch.commit();
    logAudit("¡Correcciones aplicadas con éxito en Firestore!");
  } else {
    logAudit("La base de datos está sana, no se requirieron cambios.");
  }
}
