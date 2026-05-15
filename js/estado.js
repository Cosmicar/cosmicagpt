import {
  findPublicOrderByNumeroOrden,
  getPublicOrder,
} from "./work-repository.js";
import { db } from "./firebase.js";
import { COLLECTIONS } from "./domain.js";
import { escapeHtml, formatDateTime } from "./utils.js";
import {
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_ORDER = ["Ingresado", "En reparación", "Listo", "Entregado"];

const STATUS_BADGE = {
  "Ingresado":    { cls: "badge-ingresado",  label: "Ingresado" },
  "En reparación":{ cls: "badge-reparacion", label: "En reparación" },
  "Listo":        { cls: "badge-listo",      label: "Listo para retirar" },
  "Entregado":    { cls: "badge-entregado",  label: "Entregado" },
  "Reingresada":  { cls: "badge-reingresada",label: "Reingresada" },
};

const STATUS_MESSAGE = {
  "Ingresado":    "<strong>Tu equipo fue recibido.</strong> Está en cola de diagnóstico. Te avisaremos cuando empiece la reparación.",
  "En reparación":"<strong>Tu equipo está en reparación.</strong> Nuestro equipo técnico está trabajando en él. Te notificamos cuando esté listo.",
  "Listo":        "<strong>¡Tu equipo está listo!</strong> Podés pasar a retirarlo en el local o coordinamos la entrega. Comunicate con nosotros.",
  "Entregado":    "<strong>Equipo entregado.</strong> Gracias por confiar en Cosmica.ar. Recordá que tenés garantía por el servicio realizado.",
  "Reingresada":  "<strong>Tu equipo fue reingresado.</strong> Estamos revisando el inconveniente. Nos comunicaremos a la brevedad.",
};

// ─── Stepper ──────────────────────────────────────────────────────────────────

const STEPPER_STEPS = [
  { key: "Ingresado",     label: "Recibido" },
  { key: "En reparación", label: "En taller" },
  { key: "Listo",         label: "Listo" },
  { key: "Entregado",     label: "Entregado" },
];

function activeStepIndex(estado) {
  const normalized = estado === "Reingresada" ? "En reparación" : estado;
  const idx = STATUS_ORDER.indexOf(normalized);
  return idx === -1 ? 0 : idx;
}

function renderStepper(estado) {
  const active = activeStepIndex(estado);
  return `
    <div class="stepper">
      ${STEPPER_STEPS.map((step, i) => {
        const isDone   = i < active;
        const isActive = i === active;
        const cls = isDone ? "done" : isActive ? "active" : "";
        const check = isDone ? "✓" : "";
        return `
          <div class="step ${cls}">
            <div class="step-track">
              <div class="step-line-left ${isDone || isActive ? "filled" : ""}"></div>
              <div class="step-dot">${check}</div>
              <div class="step-line-right ${isDone ? "filled" : ""}"></div>
            </div>
            <div class="step-label">${step.label}</div>
          </div>`;
      }).join("")}
    </div>`;
}

// ─── Budget section ───────────────────────────────────────────────────────────

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR");
}

function renderBudgetSection(order) {
  const presupuesto    = Number(order.presupuesto || 0);
  const aprobado       = order.aprobadoCliente === true;
  const diagnostico    = (order.diagnosticoTecnico || "").trim();
  const estadoFinal    = order.estado === "Entregado";

  // No mostrar si no hay presupuesto ni diagnóstico
  if (!presupuesto && !diagnostico) return "";

  const diagHtml = diagnostico ? `
    <div class="budget-diag">
      <div class="budget-diag-label">Diagnóstico técnico</div>
      <div class="budget-diag-text">${escapeHtml(diagnostico)}</div>
    </div>` : "";

  const presupuestoHtml = presupuesto ? `
    <div class="budget-amount-row">
      <span class="budget-amount-label">Presupuesto cotizado</span>
      <span class="budget-amount">$${formatMoney(presupuesto)}</span>
    </div>` : "";

  let actionHtml = "";
  if (aprobado) {
    actionHtml = `
      <div class="budget-approved-badge">
        <span class="budget-approved-icon">✓</span>
        Reparación aprobada por el cliente
      </div>`;
  } else if (presupuesto > 0 && !estadoFinal) {
    actionHtml = `
      <button id="approve-btn" class="btn-approve">
        <span id="approve-btn-text">Aprobar reparación</span>
      </button>
      <p class="budget-approve-note">Al aprobar, autorizás al taller a proceder con la reparación por el monto cotizado.</p>`;
  }

  return `
    <div class="budget-card">
      <div class="budget-card-header">
        <span class="budget-card-title">Presupuesto</span>
        ${aprobado
          ? `<span class="budget-pill budget-pill-approved">Aprobado</span>`
          : presupuesto > 0
            ? `<span class="budget-pill budget-pill-pending">Pendiente</span>`
            : ""}
      </div>
      ${diagHtml}
      ${presupuestoHtml}
      ${actionHtml}
    </div>`;
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function buildTimeline(order) {
  const events = [];
  const estado = order.estado || "Ingresado";

  if (order.fechaIngreso) {
    events.push({
      cls:   "tl-created",
      icon:  "📥",
      label: "Orden ingresada",
      meta:  formatDateTime(order.fechaIngreso),
    });
  }

  const pastIngest = ["En reparación", "Listo", "Entregado", "Reingresada"].includes(estado);
  if (pastIngest && !order.fechaReparado) {
    events.push({
      cls:   "tl-progress",
      icon:  "🔧",
      label: "En reparación",
      meta:  "Trabajo en curso",
    });
  }

  if (order.aprobadoCliente && order.fechaAprobacion) {
    events.push({
      cls:   "tl-approved",
      icon:  "✅",
      label: "Reparación aprobada por el cliente",
      meta:  formatDateTime(order.fechaAprobacion),
    });
  }

  if (order.fechaReparado) {
    events.push({
      cls:   "tl-progress",
      icon:  "🔧",
      label: "Reparación completada",
      meta:  formatDateTime(order.fechaReparado),
    });
  }

  if (estado === "Reingresada") {
    events.push({
      cls:   "tl-reingest",
      icon:  "🔄",
      label: "Reingresado para revisión",
      meta:  "En seguimiento",
    });
  }

  if (["Listo", "Entregado"].includes(estado) && !order.fechaEntregado) {
    events.push({
      cls:   "tl-done",
      icon:  "⭐",
      label: "Listo para retirar",
      meta:  "Disponible en el local",
    });
  }

  if (order.fechaEntregado) {
    events.push({
      cls:   "tl-delivered",
      icon:  "🎉",
      label: "Entregado al cliente",
      meta:  formatDateTime(order.fechaEntregado),
    });
  }

  return events;
}

// ─── Intelligence helpers ─────────────────────────────────────────────────────
function estimateRepairTime(order) {
  const plan = (order.planServicio || "").toLowerCase();
  let hours = 24; 
  if (plan === "oro") hours = 8;
  if (plan === "platinum") hours = 3;
  
  const prob = (order.problema || order.diagnosticoTecnico || "").toLowerCase();
  if (prob.includes("pantalla") || prob.includes("módulo")) hours += 2;
  if (prob.includes("placa") || prob.includes("corto") || prob.includes("agua")) hours += 48;
  if (prob.includes("formateo") || prob.includes("soft")) hours = Math.min(hours, 4);

  if (hours < 24) return `${hours} hs`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "día" : "días"}`;
}

function renderTimeline(order) {
  const events = buildTimeline(order);
  if (!events.length) return "";
  return `
    <div class="timeline-title">Historial</div>
    <div class="timeline">
      ${events.map(ev => `
        <div class="tl-item ${ev.cls}">
          <div class="tl-side">
            <div class="tl-icon">${ev.icon}</div>
            <div class="tl-line"></div>
          </div>
          <div class="tl-body">
            <div class="tl-label">${ev.label}</div>
            <div class="tl-meta">${ev.meta}</div>
          </div>
        </div>`).join("")}
    </div>`;
}

// ─── Info rows ────────────────────────────────────────────────────────────────

function infoRow(key, val) {
  if (!val || val === "—") return "";
  return `
    <div class="info-row">
      <span class="key">${key}</span>
      <span class="val">${escapeHtml(String(val))}</span>
    </div>`;
}

function renderInfoGrid(order) {
  const equipoParts = [order.equipo, order.marca, order.modelo].filter(Boolean);
  const equipo = equipoParts.join(" · ") || "—";

  const rows = [
    infoRow("Equipo",             equipo),
    infoRow("Problema",           order.problema || order.diagnostico || ""),
    infoRow("Plan de servicio",   order.planServicio ? capitalize(order.planServicio) : ""),
    infoRow("⏱ Est. Reparación",  order.estado === 'Entregado' ? 'Finalizado' : estimateRepairTime(order)),
    infoRow("Servicio realizado", order.servicioRealizado || ""),
    infoRow("Garantía",           order.garantiaDias ? `${order.garantiaDias} días` : ""),
  ].filter(Boolean).join("");

  if (!rows) return "";
  return `<div class="info-grid">${rows}</div>`;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Approval handler ─────────────────────────────────────────────────────────

async function handleApproval(orderId) {
  const btn     = document.getElementById("approve-btn");
  const btnText = document.getElementById("approve-btn-text");
  if (!btn) return;

  btn.disabled = true;
  if (btnText) btnText.textContent = "Procesando...";

  const approvalData = {
    aprobadoCliente: true,
    fechaAprobacion: new Date().toISOString(),
  };

  try {
    // Write to public collection (always works if rules allow public updates)
    await updateDoc(doc(db, COLLECTIONS.ordenesPublicas, orderId), approvalData);

    // Best-effort sync to internal collection (requires permissive Firestore rules)
    try {
      await updateDoc(doc(db, COLLECTIONS.trabajos, orderId), approvalData);
    } catch {
      // Firestore rules may restrict public writes to trabajos — expected
    }

    // Re-render the budget section with approved state
    const budgetContainer = document.getElementById("budget-section-wrapper");
    if (budgetContainer) {
      budgetContainer.innerHTML = renderBudgetSection({
        ...currentOrder,
        aprobadoCliente: true,
        fechaAprobacion: approvalData.fechaAprobacion,
      });
    }

    // Update timeline entry
    const timelineContainer = document.getElementById("timeline-wrapper");
    if (timelineContainer) {
      timelineContainer.innerHTML = renderTimeline({
        ...currentOrder,
        aprobadoCliente: true,
        fechaAprobacion: approvalData.fechaAprobacion,
      });
    }

  } catch (err) {
    console.error("[approval] Error:", err);
    btn.disabled = false;
    if (btnText) btnText.textContent = "Aprobar reparación";
    alert("No se pudo registrar la aprobación. Intentá de nuevo.");
  }
}

// ─── Main render ──────────────────────────────────────────────────────────────

// Reference kept for approval re-render
let currentOrder = null;

function renderOrder(order) {
  currentOrder = order;

  const estado   = order.estado || "Ingresado";
  const badgeCfg = STATUS_BADGE[estado] || STATUS_BADGE["Ingresado"];
  const msg      = STATUS_MESSAGE[estado] || STATUS_MESSAGE["Ingresado"];

  const equipoParts = [order.equipo, order.marca, order.modelo].filter(Boolean);
  const deviceStr   = equipoParts.join(" · ");

  document.getElementById("content").innerHTML = `
    <div class="card-inner">

      <!-- Hero -->
      <div class="hero">
        <div>
          <div class="hero-label">Orden de servicio</div>
          <div class="hero-order">${escapeHtml(order.numeroOrden || order.id || "—")}</div>
          ${deviceStr ? `<div class="hero-device">${escapeHtml(deviceStr)}</div>` : ""}
        </div>
        <div class="status-badge ${badgeCfg.cls}">
          <span class="dot"></span>
          ${badgeCfg.label}
        </div>
      </div>

      <!-- Progress stepper -->
      ${renderStepper(estado)}

      <!-- Status message -->
      <div class="status-msg">${msg}</div>

      <!-- Info grid -->
      ${renderInfoGrid(order)}

      <!-- Budget section (wrapper for re-render on approval) -->
      <div id="budget-section-wrapper">${renderBudgetSection(order)}</div>

      <!-- Timeline (wrapper for re-render on approval) -->
      <div id="timeline-wrapper">${renderTimeline(order)}</div>

    </div>

    <div class="footer">
      Esta página refleja el estado registrado por Cosmica.ar.<br>
      ¿Dudas? <a href="https://wa.me/5493886165965" target="_blank" rel="noopener">Escribinos por WhatsApp</a>
    </div>
  `;

  // Bind approval button if present
  const orderId = order.id;
  document.getElementById("approve-btn")?.addEventListener("click", () => handleApproval(orderId));
}

// ─── Error / boot ─────────────────────────────────────────────────────────────

function renderError(message) {
  document.getElementById("content").innerHTML = `
    <div class="state-box">
      <div style="font-size:36px;margin-bottom:16px;">🔍</div>
      <div class="state-title">No encontramos la orden</div>
      <div class="state-sub">${escapeHtml(message)}</div>
    </div>`;
}

async function boot() {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get("id")    || "";
  const orden  = params.get("orden") || "";

  if (!id && !orden) {
    renderError("No se indicó una orden para consultar.");
    return;
  }

  try {
    const order = id
      ? await getPublicOrder(id)
      : await findPublicOrderByNumeroOrden(orden);

    if (!order) {
      renderError("Todavía no hay información pública para esta orden. Verificá el número e intentá nuevamente.");
      return;
    }

    renderOrder(order);
  } catch (err) {
    console.error(err);
    renderError("No se pudo consultar el estado de la orden. Intentá más tarde.");
  }
}

boot();
