import { APP_ROUTES } from "./config.js";
import { createOperatorUser, getSession, logout, requirePanelSession } from "./auth-service.js";
import { canReenterWork, isAdmin, WORK_STATUS } from "./domain.js";
import { printTicket } from "./ticket.js?v=20260503-public-bridge";
import {
  findClienteByDni,
  findTrabajosByClienteId,
  findTrabajosByNumeroOrden,
  getCliente,
  getTrabajo,
  listClientesMap,
  listTrabajos,
  getPreciosPlanes,
  setPreciosPlanes
} from "./work-repository.js";
import {
  changeWorkStatus,
  reenterWork,
  removeWork,
  saveWorkForm,
  resetAccountancy
} from "./work-service.js";
import {
  $,
  daysRemaining,
  daysSince,
  escapeHtml,
  formatDate,
  formatDateTime,
  formatMoney,
  onlyDigits,
  showAlertError
} from "./utils.js";

const state = {
  session: null,
  edit: {
    trabajoId: null,
    clienteId: null
  },
  ingresosData: [],
  periodoActual: "hoy",
  searchId: 0
};

const STATUS_CLASS = {
  [WORK_STATUS.ingresado]: "badge-ingresado",
  [WORK_STATUS.enReparacion]: "badge-reparacion",
  [WORK_STATUS.listo]: "badge-listo",
  [WORK_STATUS.entregado]: "badge-entregado",
  [WORK_STATUS.reingresada]: "badge-reingresada"
};

function boot() {
  bindGlobalActions();
  requirePanelSession({
    onReady: async (session) => {
      state.session = session;
      const email = session.user.email || "";
      const nombreCorto = email.split('@')[0];
      const nombreMostrar = session.profile?.nombre || nombreCorto || "Usuario";
      $("usuarioLogueado").innerText = nombreMostrar;
      renderRoleUi();
      await loadInitialWorkList();
      await actualizarTotalesDashboard();
    },
    onUnauthorized: () => {
      const orden = new URLSearchParams(window.location.search).get("orden");
      if (orden) {
        window.location.href = `estado.html?orden=${encodeURIComponent(orden)}`;
        return;
      }
      window.location.href = APP_ROUTES.login;
    },
    onError: (error) => {
      showAlertError(error, "No se pudo validar tu usuario.");
      window.location.href = APP_ROUTES.login;
    }
  });
}

function bindGlobalActions() {
  window.logout = logout;
  window.showTab = showTab;
  window.cancelarEdicion = cancelarEdicion;
  window.buscarClienteAutofill = buscarClienteAutofill;
  window.editarTrabajo = editarTrabajo;
  window.guardarCliente = guardarCliente;
  window.buscar = buscar;
  window.limpiarBusqueda = limpiarBusqueda;
  window.cargar = cargar;
  window.cambiarEstado = cambiarEstado;
  window.reingresarTrabajo = reingresarTrabajo;
  window.borrarTrabajo = borrarTrabajo;
  window.imprimirTicket = imprimirTicket;
  window.setPeriodo = setPeriodo;
  window.cargarIngresos = cargarIngresos;
  window.exportarExcel = exportarExcel;
  window.crearUsuario = crearUsuario;
  window.resetearContabilidad = resetearContabilidad;
  window.borrarTodasLasOrdenes = borrarTodasLasOrdenes;

  // ── Planes de servicio: admin ───────────────────────────────
  window.cargarPreciosPlanes = async function () {
    try {
      const data = await getPreciosPlanes();
      if ($("precioBronce"))   $("precioBronce").value   = data.bronce   || "";
      if ($("precioOro"))      $("precioOro").value      = data.oro      || "";
      if ($("precioPlatinum")) $("precioPlatinum").value = data.platinum || "";
      if ($("precioReset"))    $("precioReset").value    = data.reset    || "";
    } catch (error) {
      console.error("Error al cargar precios:", error);
    }
  };

  window.guardarPreciosPlanes = async function () {
    try {
      await setPreciosPlanes({
        bronce:   $("precioBronce")?.value,
        oro:      $("precioOro")?.value,
        platinum: $("precioPlatinum")?.value,
        reset:    $("precioReset")?.value
      });
      alert("Precios de planes actualizados correctamente.");
    } catch (error) {
      console.error("Error al guardar precios:", error);
      alert("Hubo un error al guardar los precios.");
    }
  };
  window.inyectarDatosDePrueba = async () => {
    try {
      const { inyectarDatosDePrueba } = await import("./sandbox-repository.js");
      await inyectarDatosDePrueba();
      alert("\u2705 Órdenes de prueba generadas. Recargando...");
      await limpiarBusqueda();
      await cargar("");
    } catch (err) {
      showAlertError(err, "No se pudieron generar las órdenes de prueba.");
    }
  };

  const servicioInput = $("servicioRealizado");
  if (servicioInput) {
    servicioInput.addEventListener("input", () => {
      const diagContainer = $("diagnostico").parentElement;
      if (servicioInput.value.trim() !== "") {
        diagContainer.style.display = "none";
      } else {
        diagContainer.style.display = "block";
      }
    });
  }

  // ── Plan de servicio: mostrar/ocultar según tipo ────────────────
  document.getElementById("tipo")?.addEventListener("change", (e) => {
    const container = document.getElementById("containerPlanServicio");
    if (container) {
      container.style.display = e.target.value === "remoto" ? "block" : "none";
      if (e.target.value !== "remoto" && document.getElementById("planServicio")) {
        document.getElementById("planServicio").value = "";
      }
    }
  });

  // ── Plan de servicio: autocompletar precio ──────────────────────
  // Cargamos los precios al iniciar para tenerlos en memoria
  getPreciosPlanes().then((data) => { state._preciosPlanes = data; }).catch(() => {});

  document.getElementById("planServicio")?.addEventListener("change", (e) => {
    const plan = e.target.value;
    const precios = state._preciosPlanes || {};
    const precioInput = document.getElementById("precio");
    if (!precioInput) return;
    if (plan && precios[plan] != null) {
      precioInput.value = precios[plan];
    } else {
      precioInput.value = "";
    }
  });
}

async function loadInitialWorkList() {
  const orden = new URLSearchParams(window.location.search).get("orden");
  if (orden) {
    $("busquedaDni").value = orden;
    await cargar(orden);
    return;
  }

  $("listaTrabajos").innerHTML = `
    <div class="empty-state">
      🔍 Buscá un DNI, número de orden o presioná "Ver todos".
    </div>
  `;
}

async function actualizarTotalesDashboard() {
  try {
    // 1. Consultar a la base de datos respetando RBAC
    const trabajos = await listTrabajos(state.session?.profile);
    
    // 2. Cálculos matemáticos puros (sin inyectar listas visuales)
    const hoy = new Date().toISOString().split("T")[0];
    const mesActual = new Date().toISOString().slice(0, 7);
    let totalDia = 0;
    let totalMes = 0;

    trabajos.forEach((t) => {
      if (t.estado === WORK_STATUS.entregado && t.fechaEntregado) {
        if (String(t.fechaEntregado).startsWith(hoy)) totalDia += Number(t.precio || 0);
        if (String(t.fechaEntregado).startsWith(mesActual)) totalMes += Number(t.precio || 0);
      }
    });

    // 3. Modificar únicamente los elementos del DOM contables
    const elDia = document.getElementById("totalDia");
    const elMes = document.getElementById("totalMes");
    if (elDia) elDia.innerText = formatMoney(totalDia);
    if (elMes) elMes.innerText = formatMoney(totalMes);

  } catch (error) {
    console.error("No se pudo calcular la contabilidad del dashboard:", error);
  }
}

function renderRoleUi() {
  const admin = isAdmin(state.session?.profile) || state.session?.profile?.rol === 'tester';
  document.querySelectorAll(".admin-section").forEach((el) => {
    el.style.display = admin ? "" : "none";
  });

  const kpiRemoto = document.getElementById("kpiCardRemoto");
  if (kpiRemoto) {
    kpiRemoto.style.display = admin ? "" : "none";
  }

  const provinciaSelect = document.getElementById("provincia");
  const tipoSelect = document.getElementById("tipo");
  
  if (!admin) {
    if (provinciaSelect) {
      provinciaSelect.value = "Jujuy";
      provinciaSelect.disabled = true;
    }
    if (tipoSelect) {
      tipoSelect.value = "taller";
      tipoSelect.disabled = true;
    }
  } else {
    if (provinciaSelect) provinciaSelect.disabled = false;
    if (tipoSelect) tipoSelect.disabled = false;
  }

  const reqDni = document.getElementById("reqDni");
  if (reqDni) {
    reqDni.style.display = admin ? "none" : "inline";
  }

  // ── Botón Sandbox: solo visible para tester ───────────────
  const sandboxBtnId = "btnSandboxInyectar";
  const isTesterSession = state.session?.profile?.rol === 'tester';
  let sandboxBtn = document.getElementById(sandboxBtnId);
  if (isTesterSession) {
    if (!sandboxBtn) {
      sandboxBtn = document.createElement("button");
      sandboxBtn.id = sandboxBtnId;
      sandboxBtn.className = "btn btn-secondary";
      sandboxBtn.style.cssText = "background:rgba(255,170,0,0.15);border:1px solid var(--warning);color:var(--warning);margin-bottom:16px;";
      sandboxBtn.innerHTML = "🎲 Generar órdenes de prueba";
      sandboxBtn.onclick = () => window.inyectarDatosDePrueba();
      const listaDiv = document.getElementById("listaTrabajos");
      if (listaDiv) listaDiv.parentElement.insertBefore(sandboxBtn, listaDiv);
    }
    sandboxBtn.style.display = "";
  } else if (sandboxBtn) {
    sandboxBtn.style.display = "none";
  }
}

function showTab(id) {
  document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  $("tab-" + id)?.classList.add("active");

  const tabs = document.querySelectorAll(".tab");
  const map = { trabajos: 0, nuevo: 1, ingresos: 2, admin: 3 };
  if (tabs[map[id]]) tabs[map[id]].classList.add("active");
}

function badgeEstado(estado) {
  return `<span class="badge ${STATUS_CLASS[estado] || ""}">${escapeHtml(estado || "—")}</span>`;
}

function limpiarCampos() {
  ["nombre", "apellido", "dni", "telefono", "equipo", "marca", "modelo", "problema", "precio", "diagnostico", "servicioRealizado"]
    .forEach((id) => {
      const el = $(id);
      if (el) el.value = "";
    });
  $("provincia").value = "";

  // Valor por defecto de "tipo" basado en el rol: admin → remoto, resto → taller
  const inputTipo = $("tipo");
  if (inputTipo) {
    const esAdmin = state.session?.profile?.rol === 'admin';
    inputTipo.value = esAdmin ? "remoto" : "taller";
    inputTipo.dispatchEvent(new Event('change'));
  }

  // Re-aplicar restricciones de rol al limpiar el formulario
  renderRoleUi();
}

function cancelarEdicion() {
  state.edit = { trabajoId: null, clienteId: null };
  limpiarCampos();
  $("modoEdicionBanner").style.display = "none";
  $("btnCancelar").style.display = "none";
}

async function buscarClienteAutofill() {
  const dniVal = $("dni").value.trim();
  if (!dniVal) return;

  try {
    const cliente = await findClienteByDni(dniVal);
    if (!cliente) return;
    $("nombre").value = cliente.nombre || "";
    $("apellido").value = cliente.apellido || "";
    $("telefono").value = cliente.telefono || "";
    $("provincia").value = cliente.provincia || "";
  } catch (error) {
    showAlertError(error, "No se pudo buscar el cliente.");
  }
}

async function editarTrabajo(trabajoId, clienteId) {
  try {
    const [trabajo, cliente] = await Promise.all([
      getTrabajo(trabajoId),
      getCliente(clienteId)
    ]);
    if (!trabajo || !cliente) throw new Error("No se encontró la orden o el cliente.");

    $("nombre").value = cliente.nombre || "";
    $("apellido").value = cliente.apellido || "";
    $("dni").value = cliente.dni || "";
    $("telefono").value = cliente.telefono || "";
    $("provincia").value = cliente.provincia || "";
    $("tipo").value = trabajo.tipo || "taller";
    $("equipo").value = trabajo.equipo || "";
    $("marca").value = trabajo.marca || "";
    $("modelo").value = trabajo.modelo || "";
    $("problema").value = trabajo.problema || "";
    $("diagnostico").value = trabajo.diagnostico || "";
    $("servicioRealizado").value = trabajo.servicioRealizado || "";
    $("precio").value = trabajo.precio ?? 0;

    // Plan de servicio (solo remoto)
    if ($("containerPlanServicio")) {
      $("containerPlanServicio").style.display = trabajo.tipo === "remoto" ? "block" : "none";
    }
    if ($("planServicio")) $("planServicio").value = trabajo.planServicio || "";

    const diagContainer = $("diagnostico").parentElement;
    if ($("servicioRealizado").value.trim() !== "") {
      diagContainer.style.display = "none";
    } else {
      diagContainer.style.display = "block";
    }

    state.edit = { trabajoId, clienteId };
    $("modoEdicionBanner").style.display = "block";
    $("btnCancelar").style.display = "inline-flex";

    showTab("nuevo");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    showAlertError(error, "No se pudo abrir la edición.");
  }
}

function readWorkForm() {
  return {
    nombre: $("nombre").value.trim(),
    apellido: $("apellido").value.trim(),
    dni: onlyDigits($("dni").value),
    telefono: onlyDigits($("telefono").value),
    provincia: $("provincia").value,
    tipo: $("tipo").value,
    equipo: $("equipo").value.trim(),
    marca: $("marca").value.trim(),
    modelo: $("modelo").value.trim(),
    precio: Number($("precio").value),
    problema: $("problema").value.trim(),
    diagnostico: document.getElementById("diagnostico") ? document.getElementById("diagnostico").value.trim() : "",
    servicioRealizado: document.getElementById("servicioRealizado") ? document.getElementById("servicioRealizado").value.trim() : "",
    planServicio: document.getElementById("planServicio") ? document.getElementById("planServicio").value : ""
  };
}

async function guardarCliente() {
  try {
    const result = await saveWorkForm(readWorkForm(), state.edit, state.session?.profile);
    cancelarEdicion();
    limpiarCampos();
    alert(result.mode === "created"
      ? `Registrado. Orden: ${result.numeroOrden}`
      : "Orden actualizada correctamente");
    showTab("trabajos");
    await cargar();
  } catch (error) {
    showAlertError(error, "No se pudo guardar la orden.");
  }
}

async function buscar() {
  const value = $("busquedaDni").value.trim();
  if (!value) return;
  
  const btn = document.querySelector(".search-bar .btn-secondary");
  const originalText = btn.innerText;
  btn.innerText = "Buscando...";
  btn.disabled = true;
  
  await cargar(value);
  
  btn.innerText = originalText;
  btn.disabled = false;
}

async function limpiarBusqueda() {
  $("busquedaDni").value = "";
  $("filtroEstado").value = "";
  
  const btn = document.querySelector(".search-bar .btn-edit");
  const originalText = btn.innerText;
  btn.innerText = "Cargando...";
  btn.disabled = true;
  
  await cargar("", { cargarTodos: true });
  
  btn.innerText = originalText;
  btn.disabled = false;
}

async function cargar(filtro = "", options = {}) {
  const currentSearchId = ++state.searchId;
  const cont = $("listaTrabajos");
  cont.innerHTML = "<div class='empty-state'>Cargando...</div>";

  try {
    const hoy = new Date().toISOString().split("T")[0];
    const mesActual = new Date().toISOString().slice(0, 7);
    const estadoFiltro = $("filtroEstado").value;
    const filtroLimpio = String(filtro || "").trim();
    const cargarTodos = options.cargarTodos === true || (!filtroLimpio && options.fromFilter === true);

    if (!filtroLimpio && !cargarTodos) {
      cont.innerHTML = `
        <div class="empty-state">
          Buscá un DNI, número de orden o presioná "Ver todos".
        </div>
      `;
      return;
    }

    let trabajos = [];
    let clientes = {};
    let clientesWarning = "";

    if (cargarTodos) {
      trabajos = await listTrabajos(state.session?.profile);
      try {
        clientes = await listClientesMap();
      } catch (error) {
        clientesWarning = error?.code || error?.message || "No se pudo leer clientes";
        console.warn("No se pudo cargar clientes:", error);
      }
    } else {
      const porOrden = await findTrabajosByNumeroOrden(filtroLimpio, state.session?.profile);
      let clienteEncontrado = null;

      try {
        clienteEncontrado = await findClienteByDni(filtroLimpio);
      } catch (error) {
        clientesWarning = error?.code || error?.message || "No se pudo leer clientes";
        console.warn("No se pudo buscar cliente por DNI:", error);
      }

      const porCliente = clienteEncontrado
        ? await findTrabajosByClienteId(clienteEncontrado.id, state.session?.profile).catch(() => [])
        : [];

      trabajos = mergeTrabajosById([...porOrden, ...porCliente]);
      if (clienteEncontrado) clientes[clienteEncontrado.id] = clienteEncontrado;
    }

    if (currentSearchId !== state.searchId) return;

    let totalDia = 0;
    let totalMes = 0;
    const resultados = [];

    trabajos.forEach((trabajo) => {
      const cliente = clientes[trabajo.clienteId];

      if (trabajo.estado === WORK_STATUS.entregado && trabajo.fechaEntregado) {
        if (String(trabajo.fechaEntregado).startsWith(hoy)) totalDia += Number(trabajo.precio || 0);
        if (String(trabajo.fechaEntregado).startsWith(mesActual)) totalMes += Number(trabajo.precio || 0);
      }

      if (estadoFiltro && trabajo.estado !== estadoFiltro) return;

      resultados.push({ trabajo, cliente });
    });

    resultados.sort((a, b) => new Date(b.trabajo.fechaIngreso) - new Date(a.trabajo.fechaIngreso));

    $("totalDia").innerText = formatMoney(totalDia);
    $("totalMes").innerText = formatMoney(totalMes);

    if (!resultados.length) {
      cont.innerHTML = "<div class='empty-state'>No se encontraron resultados</div>";
      return;
    }

    cont.innerHTML = "";
    if (clientesWarning) {
      const warning = document.createElement("div");
      warning.style.background = "rgba(255,170,0,.1)";
      warning.style.border = "1px solid rgba(255,170,0,.3)";
      warning.style.color = "var(--warning)";
      warning.style.borderRadius = "8px";
      warning.style.padding = "10px 14px";
      warning.style.marginBottom = "16px";
      warning.style.fontSize = "13px";
      warning.textContent = `⚠️ Trabajos cargados, pero no se pudieron leer datos de clientes (${clientesWarning}).`;
      cont.appendChild(warning);
    }
    resultados.forEach(({ trabajo, cliente }) => cont.appendChild(renderTrabajoCard(trabajo, cliente)));

    if (resultados.length === 1) {
      const card = cont.querySelector(".card-trabajo");
      if (card) {
        card.style.border = "2px solid var(--accent)";
        card.style.boxShadow = "0 0 20px rgba(0,255,204,.15)";
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  } catch (error) {
    console.error(error);
    const detalle = error?.code || error?.message || "Error desconocido";
    cont.innerHTML = `<div class='empty-state'>No se pudieron cargar los trabajos.<br><small>${escapeHtml(detalle)}</small></div>`;
  }
}

function mergeTrabajosById(trabajos) {
  const map = new Map();
  trabajos.forEach((trabajo) => {
    if (trabajo?.id) map.set(trabajo.id, trabajo);
  });
  return [...map.values()];
}

function renderTrabajoCard(t, c = {}) {
  const card = document.createElement("div");
  card.className = "card-trabajo";

  const diasSinMover = daysSince(t.fechaIngreso);
  const alertaDemora = diasSinMover > 5
    && t.estado !== WORK_STATUS.entregado
    && t.estado !== WORK_STATUS.reingresada;
  if (alertaDemora) card.classList.add("alerta-demora");

  let garantiaHtml = "";
  if (t.estado === WORK_STATUS.entregado && t.fechaEntregado) {
    const dias = daysRemaining(t.fechaEntregado, t.garantiaDias || 90);
    garantiaHtml = dias > 0
      ? `<div class="card-garantia">Garantía: ${dias} días restantes</div>`
      : `<div class="card-garantia vencida">Garantía vencida</div>`;
  }

  const telClean = onlyDigits(c?.telefono || "");
  const linkEstado = `https://cosmica.ar/estado.html?orden=${t.numeroOrden || ""}`;
  const waMsg = encodeURIComponent(
    `Hola ${c?.nombre || ""}, te contactamos de Cosmica.ar.\n\n` +
    `Tu equipo *${t.equipo || ""}* (Orden ${t.numeroOrden || ""}) está *${t.estado || ""}*.\n\n` +
    `Podés revisar el estado de tu equipo y tu garantía en el siguiente enlace:\n` +
    `${linkEstado}\n\n` +
    `¡Cualquier consulta avisanos!`
  );
  const btnWa = telClean
    ? `<a href="https://wa.me/549${telClean}?text=${waMsg}" target="_blank" rel="noopener">
         <button class="btn btn-sm btn-wa">WhatsApp</button>
       </a>`
    : "";

  const bloqueado = t.estado === WORK_STATUS.entregado || t.estado === WORK_STATUS.reingresada;
  const admin  = isAdmin(state.session?.profile) || state.session?.profile?.rol === 'tester';
  const operatorCanEdit = state.session?.profile?.rol === "operador" && t.tipo === "taller";
  const canEdit   = admin || operatorCanEdit;
  const canDelete = admin || (state.session?.profile?.rol === "operador" && t.tipo === "taller" && t.estado !== "Entregado");
  let botonesHtml = "";

  if (!bloqueado) {
    botonesHtml = `
      <div class="card-actions-wrapper">
        <div class="btn-group">
          <div class="btn-group-title">Cambiar Estado</div>
          <button class="btn btn-sm btn-reparacion" onclick="cambiarEstado('${t.id}','${WORK_STATUS.enReparacion}')">En reparaci\u00f3n</button>
          <button class="btn btn-sm btn-listo" onclick="cambiarEstado('${t.id}','${WORK_STATUS.listo}')">Listo</button>
          <button class="btn btn-sm btn-entregado" onclick="cambiarEstado('${t.id}','${WORK_STATUS.entregado}')">Entregado</button>
        </div>
        <div class="btn-group">
          <div class="btn-group-title">Acciones</div>
          ${canEdit ? `<button class="btn btn-sm btn-edit" onclick="editarTrabajo('${t.id}','${t.clienteId}')">Editar</button>` : ""}
          ${canDelete ? `<button class="btn btn-sm btn-danger" onclick="borrarTrabajo('${t.id}')">Borrar</button>` : ""}
          <button class="btn btn-sm btn-ticket" onclick="imprimirTicket('${t.id}')">Ticket</button>
          ${btnWa}
        </div>
      </div>
    `;
  } else if (canReenterWork(t.estado)) {
    botonesHtml = `
      <div class="card-actions-wrapper">
        <div class="btn-group">
          <div class="btn-group-title">Acciones</div>
          <button class="btn btn-sm btn-reingreso" onclick="reingresarTrabajo('${t.id}')">Reingresar</button>
          <button class="btn btn-sm btn-ticket" onclick="imprimirTicket('${t.id}')">Ticket</button>
          ${btnWa}
        </div>
      </div>
    `;
  } else {
    botonesHtml = `
      <div class="card-actions-wrapper">
        <div class="btn-group">
          <span class="reingresada-label">Orden reingresada</span>
          ${btnWa}
        </div>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-nombre">${escapeHtml(c?.nombre || "—")} ${escapeHtml(c?.apellido || "")}</div>
        <div class="card-meta">
          DNI: ${escapeHtml(c?.dni || "—")} | Orden: ${escapeHtml(t.numeroOrden || "—")}
          ${t.ordenOriginal ? ` | Reingreso de: <b>${escapeHtml(t.ordenOriginal)}</b>` : ""}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
        ${badgeEstado(t.estado)}
        ${alertaDemora ? `<span class="demora-tag">${diasSinMover} días sin actualizar</span>` : ""}
      </div>
    </div>
    <div class="card-info">
      <div class="card-info-item"><b>Equipo:</b> ${escapeHtml(t.equipo || "—")}</div>
      <div class="card-info-item"><b>Tipo:</b> ${escapeHtml(t.tipo || "—")}</div>
      <div class="card-info-item"><b>Marca:</b> ${escapeHtml(t.marca || "—")}</div>
      <div class="card-info-item"><b>Modelo:</b> ${escapeHtml(t.modelo || "—")}</div>
    </div>
    <div class="card-problema">${escapeHtml(t.problema || "—")}</div>
    ${t.diagnostico ? `<div class="card-problema" style="background: rgba(0,229,255,0.1); color: var(--accent2);"><b>Diagnóstico:</b> ${escapeHtml(t.diagnostico)}</div>` : ""}
    ${t.servicioRealizado ? `<div class="card-problema" style="background: rgba(16,185,129,0.1); color: var(--success);"><b>Servicio Realizado:</b> ${escapeHtml(t.servicioRealizado)}</div>` : ""}
    <div class="card-precio">$${formatMoney(t.precio)}</div>
    ${garantiaHtml}
    <div class="card-fechas">
      Ingreso: ${formatDateTime(t.fechaIngreso)}<br>
      Reparado: ${formatDateTime(t.fechaReparado)}<br>
      Entregado: ${formatDateTime(t.fechaEntregado)}
    </div>
    <div class="card-buttons">${botonesHtml}</div>
  `;

  return card;
}

async function cambiarEstado(id, estado) {
  try {
    await changeWorkStatus(id, estado);
    await cargar($("busquedaDni").value.trim());
  } catch (error) {
    showAlertError(error, "No se pudo cambiar el estado.");
  }
}

async function reingresarTrabajo(id) {
  try {
    const trabajo = await getTrabajo(id);
    if (!trabajo) throw new Error("No se encontró la orden.");
    if (!confirm(`¿Reingresar el equipo ${trabajo.equipo || ""}?\nSe creará una nueva orden para este cliente.`)) return;

    const nuevoPrecioStr = prompt("Precio para esta reparación:", trabajo.precio ?? 0);
    if (nuevoPrecioStr === null) return;

    const numeroOrden = await reenterWork(id, Number(nuevoPrecioStr), state.session?.profile);
    alert(`Reingreso registrado. Nueva orden: ${numeroOrden}`);
    await cargar($("busquedaDni").value.trim());
  } catch (error) {
    showAlertError(error, "No se pudo reingresar la orden.");
  }
}

async function borrarTrabajo(id) {
  if (!confirm("¿Eliminar esta orden? No se puede deshacer.")) return;

  try {
    await removeWork(id, state.session?.profile);
    alert("Eliminado correctamente");
    await cargar($("busquedaDni").value.trim());
  } catch (error) {
    showAlertError(error, "No se pudo borrar la orden.");
  }
}

async function borrarTodasLasOrdenes() {
  if (!confirm("⚠️ ¿Estás absolutamente seguro? Esta acción borrará TODO el historial de trabajos y no se puede deshacer.")) return;
  if (!confirm("⚠️ RECONFIRMACIÓN: ¿Confirmas que deseas eliminar toda la base de datos de órdenes?")) return;

  const btn = document.querySelector(".btn-danger[onclick='borrarTodasLasOrdenes()']");
  if (btn) btn.disabled = true;

  try {
    const { deleteAllWorks } = await import("./work-service.js");
    await deleteAllWorks(state.session?.profile);
    alert("✅ Todas las órdenes han sido eliminadas correctamente. El sistema empieza de cero.");
    await limpiarBusqueda();
  } catch (error) {
    showAlertError(error, "No se pudieron borrar todas las órdenes.");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function imprimirTicket(id) {
  try {
    await printTicket(id);
  } catch (error) {
    showAlertError(error, "No se pudo imprimir el ticket.");
  }
}

function getRangoPeriodo(periodo) {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = hoy.getMonth();
  const day = hoy.getDate();

  if (periodo === "hoy") {
    return [
      new Date(year, month, day, 0, 0, 0),
      new Date(year, month, day, 23, 59, 59, 999)
    ];
  }
  if (periodo === "semana") {
    const lunes = new Date(hoy);
    lunes.setDate(day - ((hoy.getDay() || 7) - 1));
    lunes.setHours(0, 0, 0, 0);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    domingo.setHours(23, 59, 59, 999);
    return [lunes, domingo];
  }
  if (periodo === "mes") {
    return [
      new Date(year, month, 1, 0, 0, 0),
      new Date(year, month + 1, 0, 23, 59, 59, 999)
    ];
  }
  if (periodo === "mes_anterior") {
    return [
      new Date(year, month - 1, 1, 0, 0, 0),
      new Date(year, month, 0, 23, 59, 59, 999)
    ];
  }
  if (periodo === "custom") {
    const desde = $("fechaDesde").value;
    const hasta = $("fechaHasta").value;
    if (!desde || !hasta) return [null, null];
    return [
      new Date(`${desde}T00:00:00`),
      new Date(`${hasta}T23:59:59`)
    ];
  }
  return [null, null];
}

function setPeriodo(periodo, btn) {
  state.periodoActual = periodo;
  document.querySelectorAll(".period-btn").forEach((b) => b.classList.remove("active"));
  btn?.classList.add("active");
  $("fechaCustom").style.display = periodo === "custom" ? "flex" : "none";
  cargarIngresos();
}

async function cargarIngresos() {
  try {
    const [desde, hasta] = getRangoPeriodo(state.periodoActual);
    const [trabajos, clientes] = await Promise.all([
      listTrabajos(state.session?.profile),
      listClientesMap()
    ]);

    let totalGeneral = 0;
    let totalTaller = 0;
    let totalRemoto = 0;
    const filas = [];

    trabajos.forEach((t) => {
      if (t.estado !== WORK_STATUS.entregado || !t.fechaEntregado) return;

      const fe = new Date(t.fechaEntregado);
      if (desde && hasta && (fe < desde || fe > hasta)) return;

      const precio = Number(t.precio || 0);
      totalGeneral += precio;
      if (t.tipo === "taller") totalTaller += precio;
      else totalRemoto += precio;

      filas.push({ t, c: clientes[t.clienteId] || {}, fe, precio });
    });

    filas.sort((a, b) => b.fe - a.fe);
    state.ingresosData = filas;

    $("kpiTotal").innerText = "$" + formatMoney(totalGeneral);
    $("kpiTaller").innerText = "$" + formatMoney(totalTaller);
    $("kpiRemoto").innerText = "$" + formatMoney(totalRemoto);
    $("kpiOrdenes").innerText = filas.length;

    const tbody = $("ingresosTablaBody");
    if (!filas.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px;">
        Sin entregas en el período seleccionado
      </td></tr>`;
      return;
    }

    tbody.innerHTML = filas.map(({ t, c, fe, precio }) => `
      <tr>
        <td><b>${escapeHtml(t.numeroOrden || "—")}</b></td>
        <td>${escapeHtml(c.nombre || "—")} ${escapeHtml(c.apellido || "")}</td>
        <td>${escapeHtml(t.equipo || "—")}</td>
        <td><span class="tipo-badge tipo-${escapeHtml(t.tipo || "taller")}">${escapeHtml(t.tipo || "—")}</span></td>
        <td>${formatDate(fe)}</td>
        <td class="monto">$${formatMoney(precio)}</td>
      </tr>
    `).join("");
  } catch (error) {
    showAlertError(error, "No se pudieron cargar los ingresos.");
  }
}

function exportarExcel() {
  if (!state.ingresosData || state.ingresosData.length === 0) {
    alert("No hay datos para exportar en este período.");
    return;
  }

  const data = state.ingresosData.map(({ t, c, fe, precio }) => ({
    "Orden": t.numeroOrden || "-",
    "Cliente": `${c.nombre || ""} ${c.apellido || ""}`.trim() || "Sin nombre",
    "DNI": c.dni || "",
    "Equipo": t.equipo || "-",
    "Tipo": t.tipo === "taller" ? "Taller" : "Remoto",
    "Fecha Entrega": fe.toLocaleDateString("es-AR"),
    "Monto": Number(precio || 0)
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Ingresos");

  XLSX.writeFile(workbook, `Ingresos_Cosmica_${new Date().toISOString().split("T")[0]}.xlsx`);
}

async function resetearContabilidad() {
  if (!confirm("¿Estás seguro? Esto eliminará o reseteará todos los trabajos facturados de prueba.")) {
    return;
  }
  try {
    await resetAccountancy(state.session?.profile);
    alert("✅ Contabilidad reseteada correctamente (precios en $0).");
    await cargarIngresos();
    await cargar(document.getElementById("busquedaDni").value.trim(), { fromFilter: true });
  } catch (error) {
    showAlertError(error, "No se pudo resetear la contabilidad.");
  }
}

async function crearUsuario() {
  const email = $("newEmail").value.trim();
  const password = $("newPass").value;

  if (!email || !password) {
    alert("Completá email y contraseña.");
    return;
  }
  if (password.length < 6) {
    alert("La contraseña debe tener al menos 6 caracteres.");
    return;
  }

  try {
    const result = await createOperatorUser({
      email,
      password,
      adminProfile: getSession().profile
    });

    alert("Usuario operador creado: " + result.email);
    $("newEmail").value = "";
    $("newPass").value = "";
  } catch (error) {
    showAlertError(error, "No se pudo crear el usuario.");
  }
}

boot();

// ── PWA: Registro del Service Worker ──────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[PWA] Service Worker registrado con éxito', reg))
      .catch(err => console.warn('[PWA] Error al registrar Service Worker', err));
  });
}
