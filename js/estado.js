import { getPublicOrder } from "./work-repository.js";
import { $, escapeHtml, formatDateTime } from "./utils.js";

const STATUS_CLASS = {
  "Listo": "listo",
  "Entregado": "entregado"
};

function getOrderId() {
  return new URLSearchParams(window.location.search).get("id") || "";
}

function renderError(message) {
  $("content").innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
}

function renderOrder(order) {
  const equipo = [order.equipo, order.marca, order.modelo]
    .filter(Boolean)
    .join(" · ");

  $("content").innerHTML = `
    <div class="label">Orden</div>
    <div class="order">${escapeHtml(order.numeroOrden || "—")}</div>
    <div class="badge ${STATUS_CLASS[order.estado] || ""}">
      ${escapeHtml(order.estado || "Sin estado")}
    </div>

    <div class="info">
      <div class="row"><span>Equipo</span><b>${escapeHtml(equipo || "—")}</b></div>
      <div class="row"><span>Ingreso</span><b>${formatDateTime(order.fechaIngreso)}</b></div>
      <div class="row"><span>Reparado</span><b>${formatDateTime(order.fechaReparado)}</b></div>
      <div class="row"><span>Entregado</span><b>${formatDateTime(order.fechaEntregado)}</b></div>
    </div>

    <p class="message">
      Esta página muestra el estado actual registrado por Cosmica.ar.
      Ante cualquier duda, comunicate por WhatsApp.
    </p>
  `;
}

async function boot() {
  const id = getOrderId();
  if (!id) {
    renderError("No se indicó una orden para consultar.");
    return;
  }

  try {
    const order = await getPublicOrder(id);
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
