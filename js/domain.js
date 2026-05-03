export const COLLECTIONS = Object.freeze({
  usuarios: "usuarios",
  clientes: "clientes",
  trabajos: "trabajos",
  config: "config"
});

export const ROLES = Object.freeze({
  admin: "admin",
  operador: "operador"
});

export const SERVICE_TYPES = Object.freeze({
  taller: "taller",
  remoto: "remoto"
});

export const ORDER_PREFIX = Object.freeze({
  [SERVICE_TYPES.taller]: "TAL",
  [SERVICE_TYPES.remoto]: "REM"
});

export const WORK_STATUS = Object.freeze({
  ingresado: "Ingresado",
  enReparacion: "En reparación",
  listo: "Listo",
  entregado: "Entregado",
  reingresada: "Reingresada"
});

export const ACTIVE_STATUSES = Object.freeze([
  WORK_STATUS.ingresado,
  WORK_STATUS.enReparacion,
  WORK_STATUS.listo
]);

export const ALL_STATUSES = Object.freeze([
  ...ACTIVE_STATUSES,
  WORK_STATUS.entregado,
  WORK_STATUS.reingresada
]);

export function isAdmin(profile) {
  return profile?.rol === ROLES.admin && profile?.activo !== false;
}

export function isStaff(profile) {
  return [ROLES.admin, ROLES.operador].includes(profile?.rol) && profile?.activo !== false;
}

export function canDeleteWork(profile) {
  return isAdmin(profile);
}

export function canChangeStatus(currentStatus, nextStatus) {
  if (!ALL_STATUSES.includes(nextStatus)) return false;
  if ([WORK_STATUS.entregado, WORK_STATUS.reingresada].includes(currentStatus)) return false;
  return nextStatus !== WORK_STATUS.reingresada;
}

export function canReenterWork(status) {
  return status === WORK_STATUS.entregado;
}

export function normalizeServiceType(tipo) {
  return tipo === SERVICE_TYPES.remoto ? SERVICE_TYPES.remoto : SERVICE_TYPES.taller;
}

export function normalizeRole(rol) {
  return rol === ROLES.admin ? ROLES.admin : ROLES.operador;
}
