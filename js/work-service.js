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

export async function saveWorkForm(values, editState = {}, profile = null) {
  validateWorkForm(values, profile);

  if (!window.confirm("⚠️ ¿Estás seguro de que deseas guardar esta orden? Revisa que los datos y el tipo de servicio sean correctos.")) {
    throw new Error("Operación cancelada por el usuario.");
  }

  const cliente = {
    nombre: values.nombre,
    apellido: values.apellido,
    dni: values.dni,
    telefono: values.telefono,
    provincia: values.provincia,
    origenContacto: normalizeServiceType(values.tipo) // 'taller' | 'remoto'
  };

  if (editState.trabajoId) {
    const trabajoActual = await getTrabajo(editState.trabajoId);
    // Filtrar items devueltos al actualizar
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

    await updateTrabajo(editState.trabajoId, update);
    await updateCliente(editState.clienteId, cliente);
    await publishPublicOrder(editState.trabajoId, {
      ...trabajoActual,
      ...update,
      diagnostico: values.diagnostico || "",
      servicioRealizado: values.servicioRealizado || ""
    });
    return { mode: "updated" };
  }

  const match = await findClienteMatch(cliente);
  let clienteId = null;

  if (match) {
    if (match.type === 'dni') {
      const c = match.client;
      if ((c.nombre !== cliente.nombre || c.telefono !== cliente.telefono) && (cliente.nombre && cliente.telefono)) {
        if (!window.confirm(`⚠️ Existe un cliente con este DNI: ${c.nombre} ${c.apellido} (Tel: ${c.telefono}).\n\n¿Deseas actualizarlo con los nuevos datos (${cliente.nombre}, ${cliente.telefono}) y vincularle esta orden?`)) {
          throw new Error("Operación cancelada por el usuario para proteger los datos del cliente existente.");
        }
      }
      await updateCliente(c.id, cliente);
      clienteId = c.id;
    } else {
      const c = match.client;
      if (window.confirm(`⚠️ Coincidencia dudosa detectada por ${match.type === 'telefono' ? 'teléfono' : 'nombre'}.\nEn la base de datos ya existe: ${c.nombre} ${c.apellido} (DNI: ${c.dni || 'vacío'}, Tel: ${c.telefono}).\n\n[ACEPTAR] = Son la misma persona. Vincular esta orden y actualizar sus datos.\n[CANCELAR] = Crear como un cliente totalmente nuevo e independiente.`)) {
        await updateCliente(c.id, cliente);
        clienteId = c.id;
      } else {
        clienteId = await createNewCliente(cliente);
      }
    }
  } else {
    clienteId = await createNewCliente(cliente);
  }
  const tipo = normalizeServiceType(values.tipo);
  // Pasamos el perfil para que la consulta interna respete RBAC
  const numeroOrden = await getNextOrderNumber(tipo, profile);

  // Filtrar items devueltos antes de guardar (no enviar datos fantasma a Firestore)
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

  return { mode: "created", numeroOrden };
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

  if (profile?.rol === "operador" && trabajo.estado === "Entregado") {
    throw new Error("Los operadores no pueden borrar órdenes entregadas.");
  }

  if (!canDeleteWork(profile) && profile?.rol !== "operador") {
    throw new Error("Solo un administrador o un operador pueden borrar órdenes.");
  }
  
  const systemConfig = await getSystemConfig();
  if (systemConfig.inventarioActivo) {
    await devolverItemsOrden(id);
  } else {
    await logSystem("orden_eliminada_inventario_desactivado", { trabajoId: id });
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
