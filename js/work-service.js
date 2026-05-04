import { canChangeStatus, canDeleteWork, canReenterWork, normalizeServiceType, WORK_STATUS, isAdmin } from "./domain.js";
import { nowIso } from "./utils.js";
import {
  addTrabajo,
  deletePublicOrder,
  deleteTrabajo,
  getNextOrderNumber,
  getTrabajo,
  publishPublicOrder,
  updateCliente,
  updateTrabajo,
  upsertClienteByDni,
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

  if (!isAdmin(profile)) {
    required.push(["dni", "DNI"]);
  }

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
    provincia: values.provincia
  };

  if (editState.trabajoId) {
    const trabajoActual = await getTrabajo(editState.trabajoId);
    const update = {
      tipo: normalizeServiceType(values.tipo || trabajoActual.tipo),
      equipo: values.equipo,
      marca: values.marca || "",
      modelo: values.modelo || "",
      problema: values.problema,
      diagnostico: values.diagnostico || "",
      servicioRealizado: values.servicioRealizado || "",
      precio: values.precio
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

  const clienteId = await upsertClienteByDni(cliente);
  const tipo = normalizeServiceType(values.tipo);
  // Pasamos el perfil para que la consulta interna respete RBAC
  const numeroOrden = await getNextOrderNumber(tipo, profile);

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
    estado: WORK_STATUS.ingresado,
    fechaIngreso: nowIso(),
    garantiaDias: 90
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
  if (nextStatus === WORK_STATUS.listo) update.fechaReparado = nowIso();
  if (nextStatus === WORK_STATUS.entregado) update.fechaEntregado = nowIso();

  await updateTrabajo(id, update);
  await publishPublicOrder(id, { ...trabajo, ...update });
}

export async function reenterWork(id, newPrice, profile = null) {
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
}

export async function removeWork(id, profile) {
  const trabajo = await getTrabajo(id);
  if (!trabajo) throw new Error("La orden no existe.");

  if (profile?.rol === "operador" && trabajo.estado === "Entregado") {
    throw new Error("Los operadores no pueden borrar órdenes entregadas.");
  }

  if (!canDeleteWork(profile) && profile?.rol !== "operador") {
    throw new Error("Solo un administrador o un operador pueden borrar órdenes.");
  }
  
  await deleteTrabajo(id);
  await deletePublicOrder(id).catch(() => {});
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
