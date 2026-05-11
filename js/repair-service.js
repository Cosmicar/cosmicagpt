import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  doc,
  writeBatch,
  addDoc,
  serverTimestamp,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { COLLECTIONS, WORK_STATUS } from "./domain.js";

// Helper para logs
function logAudit(msg) {
  console.log(`[REPAIR] ${msg}`);
}

import { getSession } from "./auth-service.js";
const isTesterSession = () => getSession()?.profile?.rol === 'tester';
const getTrabajosCol = () => isTesterSession() ? "trabajos_demo" : COLLECTIONS.trabajos;
const getClientesCol = () => isTesterSession() ? "clientes_demo" : COLLECTIONS.clientes;
const getPublicasCol = () => isTesterSession() ? "ordenesPublicas_demo" : COLLECTIONS.ordenesPublicas;
const getProductosCol = () => isTesterSession() ? "productos_demo" : COLLECTIONS.productos;
const getMovimientosCol = () => isTesterSession() ? "movimientos_stock_demo" : COLLECTIONS.movimientos_stock;
const getSystemLogsCol = () => isTesterSession() ? "system_logs_demo" : "system_logs";

export async function auditarYRepararBD() {
  logAudit("Iniciando EJECUCIÓN DE RECUPERACIÓN de base de datos...");

  const [clientesSnap, trabajosSnap, productosSnap, movsSnap] = await Promise.all([
    getDocs(collection(db, getClientesCol())),
    getDocs(collection(db, getTrabajosCol())),
    getDocs(collection(db, getProductosCol())),
    getDocs(collection(db, getMovimientosCol()))
  ]);

  const clientes = clientesSnap.docs.map(snap => ({ id: snap.id, ref: snap.ref, ...snap.data() }));
  const trabajos = trabajosSnap.docs.map(snap => ({ id: snap.id, ref: snap.ref, ...snap.data() }));
  const productos = productosSnap.docs.map(snap => ({ id: snap.id, ref: snap.ref, ...snap.data() }));
  const movimientos = movsSnap.docs.map(snap => ({ id: snap.id, ref: snap.ref, ...snap.data() }));

  const batch = writeBatch(db);
  let changes = 0;
  const rollbackData = {
    timestamp: new Date().toISOString(),
    event: "recovery_rollback_data",
    mergedClientes: [],
    remappedTrabajos: [],
    renumberedTrabajos: [],
    deletedHuérfanos: [],
    stockReconciled: []
  };

  // ── FASE 1: CLIENTES Y REFERENCIAS ────────────────────────────────────────

  // 1.1 Merge de Clientes duplicados (DNI y Nombre+Tel)
  const dnis = {};
  const names = {};
  const clientesAEliminar = new Set();
  const remapClientes = {}; // old_id -> new_id

  // Identificar el Master y los duplicados
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
      // Priorizar el master que tenga más datos o más órdenes, simplificado a: nos quedamos con el primero.
      logAudit(`Cliente duplicado: ${c.nombre} (ID: ${c.id}). Se fusionará hacia ${mainClient.id}`);
      clientesAEliminar.add(c.id);
      remapClientes[c.id] = mainClient.id;
      
      rollbackData.mergedClientes.push({
        deletedId: c.id,
        deletedData: { ...c, ref: undefined },
        masterId: mainClient.id
      });
    }
  }

  // 1.2 Detectar referencias rotas (clienteId que no existe)
  const clientesActivos = new Set(clientes.map(c => c.id));
  let clienteGenericoId = null;

  for (const t of trabajos) {
    // Si la orden apunta a un cliente que será eliminado, lo remapeamos
    if (remapClientes[t.clienteId]) {
      const oldId = t.clienteId;
      const newId = remapClientes[oldId];
      batch.update(t.ref, { clienteId: newId });
      changes++;
      rollbackData.remappedTrabajos.push({
        trabajoId: t.id,
        numeroOrden: t.numeroOrden,
        oldClienteId: oldId,
        newClienteId: newId
      });
      t.clienteId = newId; // Update in memory for later checks
    }
    // Si la orden apunta a un cliente que directamente no existe en Firestore
    else if (!clientesActivos.has(t.clienteId)) {
      if (!clienteGenericoId) {
        // Crear cliente genérico en batch
        const newRef = doc(collection(db, getClientesCol()));
        clienteGenericoId = newRef.id;
        batch.set(newRef, {
          nombre: "Cliente Eliminado",
          apellido: "(Recuperado)",
          telefono: "0000000000",
          origenContacto: "taller"
        });
        changes++;
      }
      batch.update(t.ref, { clienteId: clienteGenericoId });
      changes++;
      rollbackData.remappedTrabajos.push({
        trabajoId: t.id,
        numeroOrden: t.numeroOrden,
        oldClienteId: t.clienteId,
        newClienteId: clienteGenericoId,
        reason: "referencia_rota"
      });
      t.clienteId = clienteGenericoId;
    }
  }

  // Ejecutar eliminación de duplicados
  for (const cId of clientesAEliminar) {
    const cRef = doc(db, getClientesCol(), cId);
    batch.delete(cRef);
    changes++;
  }

  // 1.3 Limpiar Clientes Huérfanos
  const idsConOrden = new Set(trabajos.map(t => t.clienteId));
  for (const c of clientes) {
    if (!clientesAEliminar.has(c.id) && !idsConOrden.has(c.id)) {
      batch.delete(c.ref);
      changes++;
      rollbackData.deletedHuérfanos.push({
        id: c.id,
        data: { ...c, ref: undefined }
      });
    }
  }

  // ── FASE 2: ÓRDENES DUPLICADAS Y CONTADORES ───────────────────────────────
  
  const ordenesVistas = {};
  let maxRem = 0;
  let maxTal = 0;

  // Encontrar el max real
  for (const t of trabajos) {
    if (t.numeroOrden) {
      const num = parseInt(t.numeroOrden.split("-")[1] || "0", 10);
      if (t.tipo === "remoto" && num > maxRem) maxRem = num;
      if (t.tipo === "taller" && num > maxTal) maxTal = num;
    }
  }

  // Renumerar colisiones
  trabajos.sort((a, b) => new Date(a.fechaIngreso || 0) - new Date(b.fechaIngreso || 0));

  for (const t of trabajos) {
    if (!t.numeroOrden) continue;

    if (ordenesVistas[t.numeroOrden]) {
      const original = ordenesVistas[t.numeroOrden];
      
      if (t.clienteId === original.clienteId && t.equipo === original.equipo && t.precio === original.precio) {
        // Clon exacto (double submit sin modificar params) -> Borrar clon
        batch.delete(t.ref);
        const pubRef = doc(db, getPublicasCol(), t.id);
        // pubRef is not verified if exists before batch.delete, but in v12 it is safe or we can do conditional.
        // Actually, safer to just try delete. Firestore batch allows deleting non-existent docs.
        batch.delete(pubRef);
        changes++;
        rollbackData.renumberedTrabajos.push({
          trabajoId: t.id,
          action: "deleted_clone",
          cloneOf: original.id
        });
      } else {
        // Colisión real (ej. REM-0030) -> Renumerar
        const isRemoto = t.numeroOrden.startsWith("REM");
        const num = isRemoto ? ++maxRem : ++maxTal;
        const prefix = isRemoto ? "REM" : "TAL";
        const newOrder = `${prefix}-${String(num).padStart(4, "0")}`;
        
        batch.update(t.ref, { numeroOrden: newOrder });
        
        // Es más seguro usar set merge por si la orden publica se borró
        const pubRef = doc(db, getPublicasCol(), t.id);
        batch.set(pubRef, { numeroOrden: newOrder }, { merge: true });
        changes++;
        
        rollbackData.renumberedTrabajos.push({
          trabajoId: t.id,
          oldOrder: t.numeroOrden,
          newOrder: newOrder
        });
      }
    } else {
      ordenesVistas[t.numeroOrden] = t;
    }
  }

  // Update Counters
  const counterRef = doc(db, COLLECTIONS.config, "ordenes");
  batch.set(counterRef, {
    remoto: maxRem,
    taller: maxTal
  }, { merge: true });
  changes++;

  // ── FASE 3: INVENTARIO (Reservas Huérfanas y Stock Matemático) ────────────

  // 3.1 Limpiar reservas en órdenes inactivas
  for (const t of trabajos) {
    if (t.estado === WORK_STATUS.entregado || t.estado === "Cancelado") {
      let invModificado = false;
      const items = t.itemsInventario || [];
      for (const i of items) {
        if (i.estado === "reservado") {
          i.estado = "devuelto"; // Liberamos la reserva huérfana
          invModificado = true;
          
          // También devolvemos el stock físicamente por la reserva que nunca se restó
          // OJO: las reservas nunca descontaron stock en este sistema viejo, así que no restauramos.
          // Solo limpiamos el estado fantasma.
        }
      }
      if (invModificado) {
        batch.update(t.ref, { itemsInventario: items });
        changes++;
      }
    }
  }

  // 3.2 Recalcular Stock Real
  const stockCalculado = {};
  for (const m of movimientos) {
    if (!stockCalculado[m.productoId]) stockCalculado[m.productoId] = 0;
    const cant = Number(m.cantidad || 0);
    if (["ingreso", "devolucion", "ajuste_positivo"].includes(m.tipo)) {
      stockCalculado[m.productoId] += cant;
    } else if (["salida", "venta", "reparacion", "ajuste_negativo"].includes(m.tipo)) {
      stockCalculado[m.productoId] -= cant;
    } else if (m.tipo === "ajuste") {
      stockCalculado[m.productoId] += cant; 
    }
  }

  for (const p of productos) {
    const esperado = stockCalculado[p.id] || 0;
    const actual = p.stock || 0;
    if (actual !== esperado) {
      batch.update(p.ref, { stock: esperado });
      changes++;
      rollbackData.stockReconciled.push({
        productoId: p.id,
        oldStock: actual,
        newStock: esperado
      });
    }
  }

  // ── COMMIT ────────────────────────────────────────────────────────────────

  if (changes > 0) {
    // Guardar rollback data en system_logs
    const logRef = doc(collection(db, getSystemLogsCol()));
    batch.set(logRef, {
      tipo: "recovery_execution",
      level: "critical",
      payload: rollbackData,
      usuario: "system_repair",
      fecha: new Date().toISOString(),
      createdAt: serverTimestamp()
    });

    logAudit(`Aplicando ${changes} modificaciones en la base de datos...`);
    await batch.commit();
    logAudit("✅ Reparación y recuperación finalizada exitosamente.");
  } else {
    logAudit("✅ Sistema intacto. No se requirieron modificaciones.");
  }
}
