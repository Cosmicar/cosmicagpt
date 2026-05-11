import { canChangeStatus, canDeleteWork, canReenterWork, normalizeServiceType, WORK_STATUS, isAdmin } from "./domain.js";
import { nowIso } from "./utils.js";
import { confirmarItemsOrden, devolverItemsOrden } from "./inventario-repository.js";
import { getSystemConfig, logSystem } from "./system-service.js";

const _locks = new Set();


import {
  addTrabajo,
  deletePublicOrder,
  deleteTrabajo,
  getNextOrderNumber,
  getTrabajo,
  publishPublicOrder,
  updateCliente,
  updateTrabajo,
  findClienteMatch,
  createNewCliente,
  resetContabilidadBatch,
  listTrabajos
} from "./work-repository.js";

export function validateWorkForm(values, profile) {
  const required = [
    ["nombre", "Nombre"],
    ["telefono", "Teléfono"],
    ["provincia", "Provincia"],
    ["equipo", "Equipo"],
    ["problema", "Problema"]
  ];
  // DNI ya no es obligatorio: permite registrar clientes sin documento

  for (const [field, label] of required) {
    if (!String(values[field] ?? "").trim()) {
      throw new Error(`Completá el campo obligatorio: ${label}.`);
    }
  }

  if (!Number.isFinite(values.precio) || values.precio < 0) {
    throw new Error("Ingresá un precio válido.");
  }
}

export async function updateWork(values, editState, profile = null) {
  validateWorkForm(values, profile);

  if (!window.confirm("⚠️ ¿Estás seguro de que deseas guardar los cambios en esta orden?")) {
    throw new Error("Operación cancelada por el usuario.");
  }

  const trabajoActual = await getTrabajo(editState.trabajoId);
  
  // Si está bloqueado (Entregado) y NO es modo admin, bloquear
  const bloqueado = trabajoActual.estado === WORK_STATUS.entregado || trabajoActual.estado === WORK_STATUS.reingresada;
  if (bloqueado && !editState.modoAdminEdicion) {
    throw new Error("Esta orden está bloqueada. Solo un administrador puede editarla en Modo Avanzado.");
  }

  const itemsLimpios = (values.itemsInventario || []).filter(i => i.estado !== "devuelto");
  const update = {
    tipo: normalizeServiceType(values.tipo || trabajoActual.tipo),
    equipo: values.equipo,
    marca: values.marca || "",
    modelo: values.modelo || "",
    problema: values.problema,
    diagnostico: values.diagnostico || "",
    servicioRealizado: values.servicioRealizado || "",
    precio: values.precio,
    itemsInventario: itemsLimpios
  };

  const cliente = {
    nombre: values.nombre,
    apellido: values.apellido,
    dni: values.dni,
    telefono: values.telefono,
    provincia: values.provincia
  };

  if (editState.modoAdminEdicion) {
    // Hardening: Snapshot before edit
    await logSystem("[SAFE_ADMIN_EDIT]", {
      trabajoId: editState.trabajoId,
      snapshotBefore: trabajoActual,
      snapshotAfter: update,
      clienteId: editState.clienteId,
      usuario: profile?.email || "N/A",
      fecha: new Date().toISOString()
    });
  }

  await updateTrabajo(editState.trabajoId, update);
  
  // REGLA CRÍTICA: NO buscar coincidencias, NO crear nuevo cliente.
  // Solo actualizamos los datos del cliente ya vinculado.
  await updateCliente(editState.clienteId, cliente);
  
  await publishPublicOrder(editState.trabajoId, {
    ...trabajoActual,
    ...update,
    diagnostico: values.diagnostico || "",
    servicioRealizado: values.servicioRealizado || ""
  });
  
  return { mode: "updated", numeroOrden: trabajoActual.numeroOrden };
}

export async function createWork(values, profile = null, forceCreateNewClient = false) {
  validateWorkForm(values, profile);

  const cliente = {
    nombre: values.nombre,
    apellido: values.apellido,
    dni: values.dni,
    telefono: values.telefono,
    provincia: values.provincia,
    origenContacto: normalizeServiceType(values.tipo) // 'taller' | 'remoto'
  };

  let clienteId = values.clienteId; // Si ya viene seleccionado de la UI

  if (!clienteId && !forceCreateNewClient) {
    const { findClienteMatch } = await import("./work-repository.js");
    const matches = await findClienteMatch(cliente);
    
    if (matches && matches.length > 0) {
      // Registrar log de coincidencias encontradas
      try {
        const { logSystem } = await import("./system-service.js");
        await logSystem("[CLIENT_MATCH_FOUND]", {
          operador: profile?.email || "N/A",
          matchesEncontrados: matches.length,
          mejorScore: matches[0].score
        });
      } catch (e) {}

      // Retornar estado para que la UI decida
      return {
        requiresClientSelection: true,
        matches
      };
    }
  }

  // Si no hay clienteId seleccionado y no hubo coincidencias (o se forzó la creación)
  if (!clienteId) {
    const { createNewCliente } = await import("./work-repository.js");
    clienteId = await createNewCliente(cliente);
    
    // Registrar log de cliente nuevo forzado o creado sin coincidencias
    try {
      const { logSystem } = await import("./system-service.js");
      await logSystem(forceCreateNewClient ? "[CLIENT_NEW_FORCED]" : "[CLIENT_CREATED_AUTO]", {
        clienteId,
        operador: profile?.email || "N/A"
      });
    } catch (e) {}
  } else {
    // Si se usó un cliente existente
    try {
      const { logSystem } = await import("./system-service.js");
      await logSystem("[CLIENT_SELECTED]", {
        clienteId,
        operador: profile?.email || "N/A"
      });
    } catch (e) {}
  }
  
  const tipo = normalizeServiceType(values.tipo);
  const numeroOrden = await getNextOrderNumber(tipo, profile);

  const itemsLimpios = (values.itemsInventario || []).filter(i => i.estado !== "devuelto");

  const nuevoTrabajo = {
    numeroOrden,
    clienteId,
    tipo,
    equipo: values.equipo,
    marca: values.marca || "",
    modelo: values.modelo || "",
    problema: values.problema,
    diagnostico: values.diagnostico || "",
    servicioRealizado: values.servicioRealizado || "",
    precio: values.precio,
    planServicio: values.planServicio || "",
    itemsInventario: itemsLimpios,
    estado: WORK_STATUS.ingresado,
    fechaIngreso: nowIso(),
    garantiaDias: 90,
    creadoPor: profile?.email || ""
  };

  const trabajoId = await addTrabajo(nuevoTrabajo);
  await publishPublicOrder(trabajoId, nuevoTrabajo);

  return { success: true, mode: "created", numeroOrden };
}

export async function changeWorkStatus(id, nextStatus) {
  if (!window.confirm(`⚠️ Estás a punto de cambiar el estado a: "${nextStatus}". ¿Deseas continuar?`)) {
    throw new Error("Cambio de estado cancelado.");
  }

  const trabajo = await getTrabajo(id);
  if (!trabajo) throw new Error("La orden no existe.");
  if (!canChangeStatus(trabajo.estado, nextStatus)) {
    throw new Error("No se puede cambiar el estado de esta orden.");
  }

  const update = { 
    estado: nextStatus,
    tipo: trabajo.tipo // Incluir explícitamente el tipo original
  };
  let inventoryLogType = null;
  if (nextStatus === WORK_STATUS.listo) update.fechaReparado = nowIso();
  if (nextStatus === WORK_STATUS.entregado) {
    update.fechaEntregado = nowIso();
    const systemConfig = await getSystemConfig();
    if (systemConfig.inventarioActivo) {
      await confirmarItemsOrden(id);
      inventoryLogType = "orden_entregada_inventario_confirmado";
    } else {
      inventoryLogType = "orden_entregada_inventario_desactivado";
    }
  }

  await updateTrabajo(id, update);
  if (inventoryLogType) await logSystem(inventoryLogType, { trabajoId: id });

  await publishPublicOrder(id, { ...trabajo, ...update });
}

export async function reenterWork(id, newPrice, profile = null) {
  if (_locks.has(`reenter_${id}`)) throw new Error("Procesando reingreso, espera un momento...");
  _locks.add(`reenter_${id}`);
  try {
    const trabajo = await getTrabajo(id);
    if (!trabajo) throw new Error("La orden no existe.");
    if (!canReenterWork(trabajo.estado)) {
      throw new Error("Solo se puede reingresar una orden entregada.");
    }

    const precio = Number(newPrice);
  if (!Number.isFinite(precio) || precio < 0) {
    throw new Error("Precio inválido.");
  }

  const tipo = normalizeServiceType(trabajo.tipo);
  // Pasamos el perfil para que la consulta interna respete RBAC
  const numeroOrden = await getNextOrderNumber(tipo, profile);

  const originalUpdate = {
    estado: WORK_STATUS.reingresada,
    fechaReingreso: nowIso(),
    tipo
  };
  await updateTrabajo(id, originalUpdate);
  await publishPublicOrder(id, { ...trabajo, ...originalUpdate });

  const nuevoTrabajo = {
    numeroOrden,
    clienteId: trabajo.clienteId,
    tipo,
    equipo: trabajo.equipo || "",
    marca: trabajo.marca || "",
    modelo: trabajo.modelo || "",
    problema: trabajo.problema || "",
    precio,
    estado: WORK_STATUS.ingresado,
    fechaIngreso: nowIso(),
    garantiaDias: 90,
    reingreso: true,
    ordenOriginal: trabajo.numeroOrden || ""
  };

    const nuevoTrabajoId = await addTrabajo(nuevoTrabajo);
    await publishPublicOrder(nuevoTrabajoId, nuevoTrabajo);

    return numeroOrden;
  } finally {
    _locks.delete(`reenter_${id}`);
  }
}

export async function removeWork(id, profile) {
  if (_locks.has(`remove_${id}`)) throw new Error("Procesando eliminación, espera...");
  _locks.add(`remove_${id}`);
  try {
    const trabajo = await getTrabajo(id);
    if (!trabajo) throw new Error("La orden no existe.");

    // UX-01: Si es un reingreso, restaurar el estado de la orden original
    if (trabajo.reingreso && trabajo.ordenOriginal) {
      const { findTrabajosByNumeroOrden } = await import("./work-repository.js");
      const parentOrders = await findTrabajosByNumeroOrden(trabajo.ordenOriginal);
      if (parentOrders && parentOrders.length > 0) {
        const parent = parentOrders[0];
        const updateParent = {
          estado: WORK_STATUS.entregado,
          fechaReingreso: null
        };
        await updateTrabajo(parent.id, updateParent);
        await publishPublicOrder(parent.id, { ...parent, ...updateParent });
      }
    }

  if (profile?.rol === "operador" && trabajo.estado === "Entregado") {
    throw new Error("Los operadores no pueden borrar órdenes entregadas.");
  }

  if (!canDeleteWork(profile) && profile?.rol !== "operador") {
    throw new Error("Solo un administrador o un operador pueden borrar órdenes.");
  }
  
  const systemConfig = await getSystemConfig();
  if (systemConfig.inventarioActivo) {
    // Si es admin borrando un reingreso o un entregado, forzamos la devolución de items confirmados
    const forzar = profile?.rol === "admin" && (trabajo.reingreso || trabajo.estado === "Entregado");
    await devolverItemsOrden(id, null, forzar);
  } else {
    await logSystem("orden_eliminada_inventario_desactivado", { trabajoId: id });
  }

  if (profile?.rol === "admin") {
    // Hardening: Snapshot before delete
    await logSystem("[ADMIN_DELETE]", {
      trabajoId: id,
      snapshotBefore: trabajo,
      usuario: profile?.email || "N/A",
      fecha: new Date().toISOString()
    });
  }

  await deleteTrabajo(id);
  await deletePublicOrder(id).catch(() => {});
  } finally {
    _locks.delete(`remove_${id}`);
  }
}

export async function deleteAllWorks(profile) {
  if (!isAdmin(profile)) {
    throw new Error("Solo un administrador puede borrar todas las órdenes.");
  }
  
  // Usamos listTrabajos con perfil de admin para traer todo
  const trabajos = await listTrabajos(profile);
  
  // Para optimizar se podrían borrar en batch, o uno por uno
  for (const trabajo of trabajos) {
    if (trabajo.id) {
      await deleteTrabajo(trabajo.id);
      await deletePublicOrder(trabajo.id).catch(() => {});
    }
  }
}

export async function resetAccountancy(profile) {
  if (!isAdmin(profile)) {
    throw new Error("Solo un administrador puede resetear la contabilidad.");
  }
  await resetContabilidadBatch();
}

export async function desacoplarClienteOrden(trabajoId, numeroOrden, profile = null) {
  if (!isAdmin(profile) && profile?.rol !== 'tester') {
    throw new Error("Solo los administradores pueden desacoplar clientes.");
  }

  const { getTrabajo, getCliente, getClientesCol, getTrabajosCol, getNextClienteCodigo } = await import("./work-repository.js");
  const { db } = await import("./firebase.js");
  const { doc, runTransaction, serverTimestamp, collection } = await import("https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js");
  const { logSystem } = await import("./system-service.js");

  const trabajo = await getTrabajo(trabajoId);
  if (!trabajo) throw new Error("No se encontró la orden.");

  const clienteOriginalId = trabajo.clienteId;
  const clienteOriginal = await getCliente(clienteOriginalId);
  if (!clienteOriginal) throw new Error("No se encontró el cliente original.");

  // Generar nuevo código de cliente
  const clienteCodigoNuevo = await getNextClienteCodigo();

  const nuevoCliente = {
    clienteCodigo: clienteCodigoNuevo,
    nombre: clienteOriginal.nombre || "",
    apellido: clienteOriginal.apellido || "",
    telefono: clienteOriginal.telefono || "",
    dni: clienteOriginal.dni || "",
    alias: clienteOriginal.alias || "",
    createdAt: serverTimestamp()
  };

  const next = await runTransaction(db, async (transaction) => {
    const clientesColRef = collection(db, getClientesCol());
    const nuevoClienteRef = doc(clientesColRef); // Genera ID aleatorio
    
    // Crear nuevo cliente
    transaction.set(nuevoClienteRef, nuevoCliente);

    // Actualizar la orden
    const trabajoRef = doc(db, getTrabajosCol(), trabajoId);
    transaction.update(trabajoRef, { clienteId: nuevoClienteRef.id });

    return nuevoClienteRef.id;
  });

  // Registrar log
  await logSystem("[CLIENT_DECOUPLED]", {
    orden: numeroOrden,
    clienteOriginalId,
    clienteNuevoId: next,
    clienteCodigoNuevo,
    operador: profile?.email || "N/A"
  });

  return { success: true, nuevoClienteId: next, clienteCodigoNuevo };
}
