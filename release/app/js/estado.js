import { findPublicOrderByNumeroOrden, getPublicOrder } from "./work-repository.js";
import { $, escapeHtml, formatDateTime } from "./utils.js";

const STATUS_CLASS = {
  "Listo": "listo",
  "Entregado": "entregado"
};

function getOrderId() {
  return new URLSearchParams(window.location.search).get("id") || "";
}

function getOrderNumber() {
  return new URLSearchParams(window.location.search).get("orden") || "";
}

function renderError(message) {
  $("content").innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
}

function renderOrder(order) {
  const equipoParts = [order.equipo, order.marca, order.modelo].filter(Boolean);
  const equipoStr = equipoParts.join(" \u00b7 ");

  $("content").innerHTML = `
    <div class="label">ORDEN</div>
    <div class="order">${escapeHtml(order.numeroOrden || order.id || "\u2014")}</div>
    <div class="badge ${STATUS_CLASS[order.estado] || ""}">
      ${escapeHtml(order.estado || "Ingresado")}
    </div>

    <div class="info">
      <div class="row">
        <span>Equipo</span>
        <b>${escapeHtml(equipoStr || "\u2014")}</b>
      </div>
      <div class="row">
        <span>Ingreso</span>
        <b>${formatDateTime(order.fechaIngreso)}</b>
      </div>

      ${order.diagnostico ? `
      <div class="row">
        <span>Diagn\u00f3stico t\u00e9cnico:</span>
        <b>${escapeHtml(order.diagnostico)}</b>
      </div>` : ""}

      ${order.servicioRealizado ? `
      <div class="row">
        <span>Servicio realizado:</span>
        <b>${escapeHtml(order.servicioRealizado)}</b>
      </div>` : ""}

      ${order.fechaReparado ? `
      <div class="row">
        <span>Reparado</span>
        <b>${formatDateTime(order.fechaReparado)}</b>
      </div>` : ""}

      ${order.fechaEntregado ? `
      <div class="row">
        <span>Entregado</span>
        <b>${formatDateTime(order.fechaEntregado)}</b>
      </div>` : ""}
    </div>

    <p class="message">
      Esta p\u00e1gina muestra el estado actual registrado por Cosmica.ar.
      Ante cualquier duda, comun\u00edcate por WhatsApp.
    </p>
  `;
}

async function boot() {
  const id = getOrderId();
  const orden = getOrderNumber();
  if (!id && !orden) {
    renderError("No se indicó una orden para consultar.");
    return;
  }

  try {
    const order = id
      ? await getPublicOrder(id)
      : await findPublicOrderByNumeroOrden(orden);
    if (!order) {
      renderError("Todavía no hay información pública para esta orden.");
      return;
    }
    renderOrder(order);
  } catch (error) {
    console.error(error);
    renderError("No se pudo consultar el estado de la orden.");
  }
}

boot();
