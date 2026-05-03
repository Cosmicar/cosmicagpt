import { canChangeStatus, canDeleteWork, canReenterWork, normalizeServiceType, WORK_STATUS } from "./domain.js";
import { nowIso } from "./utils.js";
import {
  addTrabajo,
  deleteTrabajo,
  getNextOrderNumber,
  getTrabajo,
  updateCliente,
  updateTrabajo,
  upsertClienteByDni
} from "./work-repository.js";

export function validateWorkForm(values) {
  const required = [
    ["nombre", "Nombre"],
    ["dni", "DNI"],
    ["telefono", "Teléfono"],
    ["provincia", "Provincia"],
    ["equipo", "Equipo"],
    ["problema", "Problema"]
  ];

  for (const [field, label] of required) {
    if (!String(values[field] ?? "").trim()) {
      throw new Error(`Completá el campo obligatorio: ${label}.`);
    }
  }

  if (!Number.isFinite(values.precio) || values.precio < 0) {
    throw new Error("Ingresá un precio válido.");
  }
}

export async function saveWorkForm(values, editState = {}) {
  validateWorkForm(values);

  const cliente = {
    nombre: values.nombre,
    apellido: values.apellido,
    dni: values.dni,
    telefono: values.telefono,
    provincia: values.provincia
  };

  if (editState.trabajoId) {
    await updateTrabajo(editState.trabajoId, {
      tipo: normalizeServiceType(values.tipo),
      equipo: values.equipo,
      marca: values.marca || "",
      modelo: values.modelo || "",
      problema: values.problema,
      precio: values.precio
    });
    await updateCliente(editState.clienteId, cliente);
    return { mode: "updated" };
  }

  const clienteId = await upsertClienteByDni(cliente);
  const tipo = normalizeServiceType(values.tipo);
  const numeroOrden = await getNextOrderNumber(tipo);

  await addTrabajo({
    numeroOrden,
    clienteId,
    tipo,
    equipo: values.equipo,
    marca: values.marca || "",
    modelo: values.modelo || "",
    problema: values.problema,
    precio: values.precio,
    estado: WORK_STATUS.ingresado,
    fechaIngreso: nowIso(),
    garantiaDias: 90
  });

  return { mode: "created", numeroOrden };
}

export async function changeWorkStatus(id, nextStatus) {
  const trabajo = await getTrabajo(id);
  if (!trabajo) throw new Error("La orden no existe.");
  if (!canChangeStatus(trabajo.estado, nextStatus)) {
    throw new Error("No se puede cambiar el estado de esta orden.");
  }

  const update = { estado: nextStatus };
  if (nextStatus === WORK_STATUS.listo) update.fechaReparado = nowIso();
  if (nextStatus === WORK_STATUS.entregado) update.fechaEntregado = nowIso();

  await updateTrabajo(id, update);
}

export async function reenterWork(id, newPrice) {
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
  const numeroOrden = await getNextOrderNumber(tipo);

  await updateTrabajo(id, {
    estado: WORK_STATUS.reingresada,
    fechaReingreso: nowIso()
  });

  await addTrabajo({
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
  });

  return numeroOrden;
}

export async function removeWork(id, profile) {
  if (!canDeleteWork(profile)) {
    throw new Error("Solo un administrador puede borrar órdenes.");
  }
  await deleteTrabajo(id);
}
