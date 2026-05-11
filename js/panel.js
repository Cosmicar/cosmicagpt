import { APP_ROUTES } from "./config.js";
import { createOperatorUser, getSession, logout, requirePanelSession } from "./auth-service.js";
import { canReenterWork, isAdmin, WORK_STATUS } from "./domain.js";
import { printTicket } from "./ticket.js?v=20260503-public-bridge";
import {
  activarPush,
  desactivarPush,
  pushEstaActivo,
  registrarSWFcm
} from "./fcm-service.js";
import {
  findClienteByDni,
  findTrabajosByClienteId,
  findTrabajosByNumeroOrden,
  getCliente,
  getTrabajo,
  listClientesMap,
  listTrabajos,
  getPreciosPlanes,
  setPreciosPlanes,
  suscribirseANuevosTrabajos,
  getTrabajosNoLiquidados,
  liquidarCajaBatch,
  listClientesCRM,
  listTrabajosByClienteIdCRM,
  updateCliente,
  deleteCliente,
  migrarClientesGeolocalizados
} from "./work-repository.js";
import {
  changeWorkStatus,
  reenterWork,
  removeWork,
  updateWork,
  createWork,
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
import { getCachedSystemConfig, getSystemConfig, logSystem } from "./system-service.js";

const state = {
  session: null,
  edit: {
    trabajoId: null,
    clienteId: null,
    modoAdminEdicion: false
  },
  ingresosData: [],
  periodoActual: "hoy",
  searchId: 0,
  selectedClienteIdForNewWork: null
};

const STATUS_CLASS = {
  [WORK_STATUS.ingresado]: "badge-ingresado",
  [WORK_STATUS.enReparacion]: "badge-reparacion",
  [WORK_STATUS.listo]: "badge-listo",
  [WORK_STATUS.entregado]: "badge-entregado",
  [WORK_STATUS.reingresada]: "badge-reingresada"
};

// -- Sistema de Notificaciones FCM (Campanita) ----------------------------

function actualizarUiBell(activo) {
  // En lugar de IDs, actualizamos todos los elementos por clase
  const btnBells   = document.querySelectorAll('.btn-bell-toggle');
  const bellIcons  = document.querySelectorAll('.bell-icon');
  const bellLabels = document.querySelectorAll('.bell-label');
  const bellStatusList = document.querySelectorAll('.bell-status');

  bellIcons.forEach(icon => {
    icon.textContent = activo ? '🔔' : '🔕';
  });

  bellLabels.forEach(label => {
    label.textContent = activo
      ? 'Desactivar notificaciones en este dispositivo'
      : 'Activar notificaciones en este dispositivo';
  });

  bellStatusList.forEach(status => {
    status.textContent = activo ? 'Estado: ✅ activo en este dispositivo' : 'Estado: desactivado';
    status.style.color = activo ? 'var(--success)' : 'var(--muted)';
  });

  btnBells.forEach(btn => {
    btn.style.borderColor = activo ? 'var(--accent2)' : 'rgba(0,229,255,0.3)';
    btn.style.background  = activo ? 'rgba(0,229,255,0.2)' : 'rgba(0,229,255,0.1)';
  });
}

window.togglePushNotifications = async function() {
  const activo = pushEstaActivo();
  try {
    if (activo) {
      await desactivarPush();
      actualizarUiBell(false);
    } else {
      await activarPush(state.session);
      actualizarUiBell(true);
    }
  } catch (err) {
    console.error('[FCM] toggle error:', err);
    alert('Warning: ' + (err.message || 'No se pudo cambiar las notificaciones.'));
  }
};

async function dispararPushBackend(title, body) {
  try {
    await fetch('https://api-cosmica.netlify.app/.netlify/functions/send-push', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title, body, rol: 'admin' })
    });
  } catch (err) {
    console.warn('[FCM] dispararPushBackend error:', err.message);
  }
}

let _unsubscribeNotificaciones = null;

function iniciarListenerNotificaciones(profile) {
  // Limpiar listener anterior si existe (ej. al cambiar de sesión)
  if (_unsubscribeNotificaciones) {
    _unsubscribeNotificaciones();
    _unsubscribeNotificaciones = null;
  }

  // Helper interno: enruta la notificación por SW (móvil) o API clásica (desktop)
  function dispararNotificacion(titulo, opciones) {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready
        .then((registration) => registration.showNotification(titulo, opciones))
        .catch(() => new Notification(titulo, opciones));
    } else {
      new Notification(titulo, opciones);
    }
  }

  _unsubscribeNotificaciones = suscribirseANuevosTrabajos(profile, (snapshot) => {
    if (Notification.permission !== "granted") return;

    snapshot.docChanges().forEach((change) => {
      const data = change.doc.data();

      // ── Evento 1: Nuevo trabajo ingresado ────────────────────
      if (change.type === "added") {
        dispararNotificacion("🔔 Nuevo Trabajo Ingresado", {
          body: `Equipo: ${data.equipo || "—"}  |  Orden: ${data.numeroOrden || "—"}`,
          icon: "/cosmica-logo.png",
          badge: "/cosmica-logo.png"
        });
        return;
      }

      // ── Evento 2: Trabajo marcado como Entregado ─────────────
      if (change.type === "modified" && data.estado === WORK_STATUS.entregado) {
        const rol = profile?.rol;

        // Admin: notifica siempre (taller + remoto)
        // Operador: notifica solo trabajos de taller
        const debeNotificar =
          rol === "admin" ||
          (rol === "operador" && data.tipo === "taller");

        if (!debeNotificar) return;

        dispararNotificacion("✅ Servicio Entregado", {
          body: `Equipo: ${data.equipo || "—"}  |  Orden: ${data.numeroOrden || "—"}`,
          icon: "/cosmica-logo.png",
          badge: "/cosmica-logo.png"
        });
      }
    });

    // Actualizar rendimiento del operador en tiempo real al haber cambios
    if (profile?.rol === "operador") {
      calcularRendimientoOperador();
    }
  });
}

function boot() {
  bindGlobalActions();
  requirePanelSession({
    onReady: async (session) => {
      state.session = session;
      const email = session.user.email || "";
      const nombreCorto = email.split('@')[0];
      const nombreMostrar = session.profile?.nombre || nombreCorto || "Usuario";
      $("usuarioLogueado").innerText = nombreMostrar;
      await getSystemConfig();
      renderRoleUi();
      initAutocomplete();
      await loadInitialWorkList();
      await actualizarTotalesDashboard();

      // Iniciar FCM SW en background (no bloquea el boot)
      registrarSWFcm().catch(err => console.warn('[FCM] registrarSWFcm:', err));

      // Sincronizar UI de campanita con el estado guardado
      actualizarUiBell(pushEstaActivo());

      iniciarListenerNotificaciones(session.profile);
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
  window.confirmarDesacople = confirmarDesacople;
  window.abrirModalMergeClientes = abrirModalMergeClientes;
  window.setPeriodo = setPeriodo;
  window.cargarIngresos = cargarIngresos;
  window.exportarExcel = exportarExcel;
  window.crearUsuario = crearUsuario;
  window.resetearContabilidad = resetearContabilidad;
  window.borrarTodasLasOrdenes = borrarTodasLasOrdenes;

  window.ejecutarMigracionClienteCodigo = async function() {
    const { migrarClienteCodigoFaltantes } = await import("./work-repository.js");
    const count = await migrarClienteCodigoFaltantes(state.session?.profile);
    alert(`Migración completada. Se migraron ${count} clientes.`);
    await loadDirectorioClientes();
  };

  window.ejecutarAuditoriaYReparacion = async function() {
    // Verificar permisos antes de intentar acceder a Firestore
    const profile = state.session?.profile;
    if (!isAdmin(profile)) {
      alert("⛔ Solo los administradores pueden ejecutar la depuración de la base de datos.");
      return;
    }
    if (!confirm("⚠️ ¿Iniciar depuración de la base de datos?\nEsto unificará clientes duplicados y eliminará órdenes doble-submit. Se registrarán los cambios en la consola.")) return;
    try {
      const { auditarYRepararBD } = await import("./repair-service.js");
      await auditarYRepararBD();
      alert("✅ Depuración finalizada. Revisar consola para más detalles.");
      await limpiarBusqueda();
    } catch (e) {
      console.error("[REPAIR] Error completo:", e);
      alert("Error en la auditoría: " + e.message);
    }
  };

  window.ejecutarAuditoriaProfunda = async function() {
    if (!confirm("🔬 ¿Ejecutar auditoría profunda de integridad?\\n\\nModo: SOLO LECTURA (no modifica datos).\\nSe analizarán todas las colecciones y se reportarán hallazgos en la consola.")) return;
    try {
      const { ejecutarAuditoriaProfunda } = await import("./deep-audit.js");
      const resultado = await ejecutarAuditoriaProfunda();
      const s = resultado.summary;
      alert(`🔬 Auditoría completada.\\n\\n🔴 Críticos: ${s.CRITICO}\\n🟡 Medios: ${s.MEDIO}\\n🟢 Bajos: ${s.BAJO}\\nℹ️ Info: ${s.INFO}\\n\\nTotal: ${resultado.findings.length} hallazgos.\\n\\nRevisar consola (F12) para el detalle completo.`);
    } catch (e) {
      alert("Error en la auditoría profunda: " + e.message);
      console.error(e);
    }
  };
  
  // ── Notificaciones FCM (Campanita) ──────────────────────────────────────────────
  // togglePushNotifications ya está definida como window.* arriba

  // ── 🥚 Easter Egg: 7 clics rápidos en el logo ──────────────
  (function () {
    const logoEl = document.querySelector(".logo");
    if (!logoEl) return;
    let clicks = 0;
    let timer  = null;
    logoEl.addEventListener("click", () => {
      clicks++;
      clearTimeout(timer);
      timer = setTimeout(() => { clicks = 0; }, 1000);
      if (clicks === 7) {
        clicks = 0;
        clearTimeout(timer);
        alert("Astra esta trabajando para hacerte feliz (L)");
      }
    });
  })();

  // ── Mi Rendimiento (operador) ───────────────────────────────
  window.calcularRendimientoOperador = calcularRendimientoOperador;

  // ── CRM / Directorio ────────────────────────────────────────
  window.loadDirectorioClientes = loadDirectorioClientes;
  window.filtrarDirectorio      = filtrarDirectorio;
  window.abrirPerfilCliente     = abrirPerfilCliente;
  window.cerrarPerfilCliente    = cerrarPerfilCliente;
  window.guardarCambiosCliente  = guardarCambiosCliente;
  window.eliminarCliente        = eliminarCliente;
  window.nuevoTrabajoDesdeCliente = nuevoTrabajoDesdeCliente;
  window.facturarDesdeCliente     = facturarDesdeCliente;



  // ── Estadísticas Admin ──────────────────────────────────────
  window.calcularEstadisticasAdmin = calcularEstadisticasAdmin;

  // ── Cierre de Caja Taller ───────────────────────────────────
  window.calcularCierreTaller = async function () {
    try {
      _trabajosPendientesCierre = await getTrabajosNoLiquidados();
      const total = _trabajosPendientesCierre.reduce((s, t) => s + Number(t.precio || 0), 0);
      const operador = total * 0.80;
      const empresa  = total * 0.20;

      const elTotal = document.getElementById("cierreTotalSinLiquidar");
      const elOp    = document.getElementById("cierreOperador");
      const elEmp   = document.getElementById("cierreEmpresa");
      if (elTotal) elTotal.innerText = formatMoney(total);
      if (elOp)    elOp.innerText    = formatMoney(operador);
      if (elEmp)   elEmp.innerText   = formatMoney(empresa);

      const btnConfirmar = document.getElementById("btnConfirmarLiquidacion");
      if (btnConfirmar) {
        btnConfirmar.style.display = _trabajosPendientesCierre.length > 0 ? "" : "none";
      }

      if (_trabajosPendientesCierre.length === 0) {
        alert("✅ No hay trabajos de taller pendientes de liquidar.");
      }
    } catch (error) {
      showAlertError(error, "No se pudo calcular el cierre de caja.");
    }
  };

  window.confirmarLiquidacionCaja = async function () {
    if (!_trabajosPendientesCierre.length) return;
    const confirmado = confirm(
      `¿Confirmar cierre de caja para ${_trabajosPendientesCierre.length} trabajo(s)?\n` +
      `Esta acción marcará los trabajos como liquidados y no se puede deshacer.`
    );
    if (!confirmado) return;

    try {
      await liquidarCajaBatch(_trabajosPendientesCierre);
      _trabajosPendientesCierre = [];

      // Resetear UI
      ["cierreTotalSinLiquidar", "cierreOperador", "cierreEmpresa"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerText = "0";
      });
      const btnConfirmar = document.getElementById("btnConfirmarLiquidacion");
      if (btnConfirmar) btnConfirmar.style.display = "none";

      alert("✅ Caja liquidada correctamente. Los totales globales se han actualizado.");
      await actualizarTotalesDashboard();
    } catch (error) {
      showAlertError(error, "No se pudo confirmar la liquidación.");
    }
  };

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

// ── Regla contable: cuánto aporta un trabajo al total global ────
// Remoto: 100% del precio
// Taller: para el operador 80% (su ganancia), para la empresa 20% (solo si está liquidado)
function calcularContribContable(t, profile) {
  const precio = Number(t.precio || 0);
  if (t.tipo !== "taller") return precio;          // remoto → 100%
  
  const rol = (profile?.rol || "").toLowerCase();
  if (rol === "operador") return precio * 0.80;    // operador ve su 80%
  if (t.liquidado === true) return precio * 0.20;  // taller liquidado → 20% para Cósmica
  return 0;                                        // taller sin liquidar → $0 para Cósmica
}

// ── Cierre de Caja Taller — estado temporal del cálculo ─────────
let _trabajosPendientesCierre = [];

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

// ══════════════════════════════════════════════════════════════
// ESTADÍSTICAS GENERALES (solo admin)
// ══════════════════════════════════════════════════════════════

let _chartProvincias = null; // instancias Chart.js para destruir antes de recrear
let _chartTipos      = null;

async function calcularEstadisticasAdmin() {
  if (state.session?.profile?.rol !== "admin") return;

  // 1. Obtener datos usando las funciones ya importadas en el top-level
  let trabajos = [];
  let clientesMap = {};
  try {
    [trabajos, clientesMap] = await Promise.all([
      listTrabajos(state.session.profile),
      listClientesMap()
    ]);
  } catch (err) {
    console.error("calcularEstadisticasAdmin:", err);
    return;
  }

  // 2. KPIs e Inicialización
  let totalServicios = trabajos.length;
  let facturacionGlobalBruta = 0;
  let cajaCosmicaNetoReal = 0;
  let pendienteLiquidarCosmica = 0;
  let deudaOperadores = 0;
  let entregadosCount = 0;

  const porProvincia = {};
  const porTipo = { taller: 0, remoto: 0 };

  trabajos.forEach((t) => {
    // Agrupar provincias para todos los servicios
    const cliente = clientesMap[t.clienteId];
    const prov = (cliente?.provincia || "Desconocida").trim() || "Desconocida";
    porProvincia[prov] = (porProvincia[prov] || 0) + 1;

    // Cálculos financieros solo para servicios Entregados
    if (t.estado === WORK_STATUS.entregado) {
      const precio = Number(t.precio || 0);
      facturacionGlobalBruta += precio;
      entregadosCount++;

      if (t.tipo === "remoto") {
        cajaCosmicaNetoReal += precio;
        porTipo.remoto++;
      } else {
        porTipo.taller++;
        if (t.liquidado === true) {
          cajaCosmicaNetoReal += precio * 0.20;
        } else {
          pendienteLiquidarCosmica += precio * 0.20;
          deudaOperadores += precio * 0.80;
        }
      }
    }
  });

  const ticketPromedio = entregadosCount > 0 ? (facturacionGlobalBruta / entregadosCount) : 0;

  const elTotal = document.getElementById("statTotalServicios");
  const elFactBruta = document.getElementById("statFacturacionBruta");
  const elCajaCosmica = document.getElementById("statCajaCosmica");
  const elPendienteCosmica = document.getElementById("statPendienteCosmica");
  const elDeudaOperadores = document.getElementById("statDeudaOperadores");
  const elTicketPromedio = document.getElementById("statTicketPromedio");

  if (elTotal) elTotal.innerText = totalServicios;
  if (elFactBruta) elFactBruta.innerText = formatMoney(facturacionGlobalBruta);
  if (elCajaCosmica) elCajaCosmica.innerText = formatMoney(cajaCosmicaNetoReal);
  if (elPendienteCosmica) elPendienteCosmica.innerText = formatMoney(pendienteLiquidarCosmica);
  if (elDeudaOperadores) elDeudaOperadores.innerText = formatMoney(deudaOperadores);
  if (elTicketPromedio) elTicketPromedio.innerText = formatMoney(ticketPromedio);

  // 4. Paleta de colores
  const PALETTE = [
    "rgba(0,229,255,.75)","rgba(255,94,0,.75)","rgba(139,92,246,.75)",
    "rgba(16,185,129,.75)","rgba(245,158,11,.75)","rgba(255,0,127,.75)",
    "rgba(99,179,237,.75)","rgba(251,191,36,.75)","rgba(167,243,208,.75)"
  ];
  const provLabels  = Object.keys(porProvincia);
  const provData    = provLabels.map((k) => porProvincia[k]);
  const provColors  = provLabels.map((_, i) => PALETTE[i % PALETTE.length]);

  const chartOpts = {
    plugins: {
      legend: { labels: { color: "#cdd6f4", font: { size: 12 } } }
    }
  };

  // 5. Gráfico de provincias (doughnut)
  const ctxProv = document.getElementById("graficoProvincias")?.getContext("2d");
  if (ctxProv) {
    if (_chartProvincias) _chartProvincias.destroy();
    _chartProvincias = new Chart(ctxProv, {
      type: "doughnut",
      data: {
        labels: provLabels,
        datasets: [{ data: provData, backgroundColor: provColors, borderWidth: 1, borderColor: "rgba(255,255,255,.08)" }]
      },
      options: { ...chartOpts, cutout: "55%" }
    });
  }

  // 6. Gráfico de tipos (bar)
  const ctxTipo = document.getElementById("graficoTiposServicio")?.getContext("2d");
  if (ctxTipo) {
    if (_chartTipos) _chartTipos.destroy();
    _chartTipos = new Chart(ctxTipo, {
      type: "bar",
      data: {
        labels: ["Taller", "Remoto"],
        datasets: [{
          label: "Servicios",
          data: [porTipo.taller, porTipo.remoto],
          backgroundColor: ["rgba(0,229,255,.6)","rgba(255,94,0,.6)"],
          borderRadius: 8, borderWidth: 0
        }]
      },
      options: {
        ...chartOpts,
        scales: {
          x: { ticks: { color: "#cdd6f4" }, grid: { color: "rgba(255,255,255,.05)" } },
          y: { ticks: { color: "#cdd6f4" }, grid: { color: "rgba(255,255,255,.05)" }, beginAtZero: true }
        }
      }
    });
  }

  // 7. Módulo de Expansión Geográfica (Ranking y Recomendaciones)
  // Convertir a array y ordenar
  const ranking = Object.entries(porProvincia)
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);
    
  // Renderizar Top 5
  const rankingListEl = document.getElementById("rankingProvinciasList");
  if (rankingListEl) {
    if (ranking.length === 0) {
      rankingListEl.innerHTML = '<div class="empty-state" style="font-size:13px;padding:10px;">No hay datos geográficos.</div>';
    } else {
      rankingListEl.innerHTML = ranking.slice(0, 5).map((r, i) => {
        const pct = totalServicios > 0 ? ((r.cantidad / totalServicios) * 100).toFixed(1) : 0;
        return `<div style="display:flex;justify-content:space-between;align-items:center;background:var(--card);padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.03);">
          <span><strong style="color:var(--accent2);">${i+1}.</strong> ${escapeHtml(r.nombre)}</span>
          <span style="font-weight:600;">${r.cantidad} <span style="font-size:11px;font-weight:normal;color:var(--muted);">(${pct}%)</span></span>
        </div>`;
      }).join("");
    }
  }



  // 8. KPIs Avanzados Activos
  
  // Tasa de Retención de Clientes
  const jobsPerClient = {};
  trabajos.forEach(t => {
    if (t.clienteId) {
      jobsPerClient[t.clienteId] = (jobsPerClient[t.clienteId] || 0) + 1;
    }
  });
  
  let clientesRepetidos = 0;
  let totalClientesConTrabajos = 0;
  for (const cid in jobsPerClient) {
    totalClientesConTrabajos++;
    if (jobsPerClient[cid] > 1) {
      clientesRepetidos++;
    }
  }
  const tasaRetencion = totalClientesConTrabajos > 0 ? (clientesRepetidos / totalClientesConTrabajos) * 100 : 0;
  document.getElementById("statRetencion").innerText = `${tasaRetencion.toFixed(1)}%`;

  // Tiempo Promedio de Resolución
  let sumatoriaHoras = 0;
  let trabajosValidos = 0;
  trabajos.forEach(t => {
    if (t.estado === WORK_STATUS.entregado && t.fechaIngreso && t.fechaEntregado) {
      const ms = new Date(t.fechaEntregado) - new Date(t.fechaIngreso);
      if (ms > 0) {
        sumatoriaHoras += ms / (1000 * 60 * 60);
        trabajosValidos++;
      }
    }
  });
  const promedioHoras = trabajosValidos > 0 ? (sumatoriaHoras / trabajosValidos) : 0;
  document.getElementById("statTiempoResolucion").innerText = `${promedioHoras.toFixed(1)} hs`;

  // Top Problema Frecuente
  const problemasMap = {};
  trabajos.forEach(t => {
    if (t.problema) {
      const prob = t.problema.toLowerCase().trim();
      if (prob.length > 3 && prob !== "ninguno" && prob !== "no enciende" && prob !== "lento") { 
         // Optional: add some basic stopwords filter if needed, but let's keep it simple
         problemasMap[prob] = (problemasMap[prob] || 0) + 1;
      }
    }
  });
  let maxCount = 0;
  let topProblemaNombre = "--";
  for (const prob in problemasMap) {
    if (problemasMap[prob] > maxCount) {
      maxCount = problemasMap[prob];
      topProblemaNombre = prob.charAt(0).toUpperCase() + prob.slice(1);
    }
  }
  document.getElementById("statTopProblema").innerText = topProblemaNombre;
}

// ══════════════════════════════════════════════════════════════
// CRM / DIRECTORIO DE CLIENTES
// ══════════════════════════════════════════════════════════════

let _crmClientesCache = [];        // cache local para filtrado instantáneo
let _crmClienteActualId = null;    // ID del cliente cuyo perfil está abierto

async function loadDirectorioClientes() {
  const listaEl = document.getElementById("lista-clientes");
  if (!listaEl) return;
  listaEl.innerHTML = "<div class='empty-state'>Cargando directorio...</div>";

  try {
    _crmClientesCache = await listClientesCRM(state.session?.profile);
    _crmClientesCache.sort((a, b) =>
      (a.apellido || "").localeCompare(b.apellido || "", "es")
    );

    if (!_crmClientesCache.length) {
      const esOperador = state.session?.profile?.rol === "operador";
      const msg = esOperador
        ? "No hay clientes de taller registrados aún. Los clientes aparecerán aquí cuando ingreses un nuevo servicio de taller."
        : "El directorio de clientes está vacío. Los clientes se crean automáticamente al registrar un nuevo ingreso.";
      listaEl.innerHTML = `<div class='empty-state'>${msg}</div>`;
      return;
    }

    renderDirectorio(_crmClientesCache);
  } catch (error) {
    listaEl.innerHTML = `<div class='empty-state'>Error al cargar directorio: ${escapeHtml(error?.message || "")}</div>`;
  }
}

function renderDirectorio(clientes) {
  const listaEl = document.getElementById("lista-clientes");
  if (!listaEl) return;
  if (!clientes.length) {
    listaEl.innerHTML = "<div class='empty-state'>No se encontraron clientes.</div>";
    return;
  }
  listaEl.innerHTML = "";
  clientes.forEach((c) => listaEl.appendChild(renderTarjetaCliente(c)));
}

function renderTarjetaCliente(c) {
  const card = document.createElement("div");
  card.style.cssText = "background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px;cursor:pointer;transition:border-color .2s,box-shadow .2s;";
  card.onmouseenter = () => { card.style.borderColor = "var(--accent2)"; card.style.boxShadow = "0 0 14px rgba(0,229,255,.12)"; };
  card.onmouseleave = () => { card.style.borderColor = "var(--border)";  card.style.boxShadow = "none"; };
  card.onclick = () => abrirPerfilCliente(c.id);

  const origen = c.origenContacto === "remoto"
    ? `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(255,94,0,.12);color:var(--accent);">Remoto</span>`
    : `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(0,229,255,.1);color:var(--accent2);">Taller</span>`;

  const unificadoBadge = c.status === "merged" 
    ? `<span class="badge" style="background:rgba(255,170,0,0.1);color:var(--warning);font-size:10px;padding:2px 6px;border:1px solid var(--warning);">UNIFICADO</span>` 
    : "";

  card.innerHTML = `
    <div style="font-size:16px;font-weight:700;color:var(--accent2);margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;">
      <span>${escapeHtml(c.apellido || "—")}, ${escapeHtml(c.nombre || "—")}</span>
      ${unificadoBadge}
    </div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:8px;">
      <span style="color:var(--accent2);font-weight:bold;">${escapeHtml(c.clienteCodigo || "CLI-???")}</span> &nbsp;·&nbsp; DNI: ${escapeHtml(c.dni || "—")} &nbsp;·&nbsp; Tel: ${escapeHtml(c.telefono || "—")}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <span style="font-size:12px;color:var(--muted);">${escapeHtml(c.provincia || "—")}</span>
      ${origen}
    </div>
    <div style="display:grid;grid-template-columns:1fr;gap:8px;">
      <button class="btn btn-sm btn-primary" style="width:100%;font-size:11px;padding:6px;" onclick="event.stopPropagation(); window.nuevoTrabajoDesdeCliente('${c.id}')">
        ➕ Nuevo Trabajo
      </button>
    </div>
  `;
  return card;
}

function filtrarDirectorio(termino) {
  const t = (termino || "").toLowerCase().trim();
  if (!t) { renderDirectorio(_crmClientesCache); return; }
  const filtrados = _crmClientesCache.filter((c) =>
    c?.nombre?.toLowerCase().includes(t)    ||
    c?.apellido?.toLowerCase().includes(t)  ||
    c?.dni?.toLowerCase().includes(t)       ||
    c?.telefono?.toLowerCase().includes(t)
  );
  renderDirectorio(filtrados);
}

async function abrirPerfilCliente(clienteId) {
  const c = _crmClientesCache.find((x) => x.id === clienteId);
  if (!c) return;
  _crmClienteActualId = clienteId;

  // Poblar formulario
  document.getElementById("crmNombre").value    = c.nombre    || "";
  document.getElementById("crmApellido").value  = c.apellido  || "";
  document.getElementById("crmDni").value       = c.dni       || "";
  document.getElementById("crmTelefono").value  = c.telefono  || "";
  document.getElementById("crmProvincia").value = c.provincia || "";
  document.getElementById("crmOrigen").value    = c.origenContacto || "";

  // Admin y operador pueden editar — solo tester queda en modo lectura
  const esTester = state.session?.profile?.rol === "tester";
  ["crmNombre","crmApellido","crmDni","crmTelefono","crmProvincia","crmOrigen"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = esTester;
  });
  const btnWrapper = document.getElementById("crmBtnGuardarWrapper");
  if (btnWrapper) btnWrapper.style.display = esTester ? "none" : "";

  // Mostrar perfil
  const perfilEl = document.getElementById("crm-perfil");
  if (perfilEl) {
    perfilEl.style.display = "";
    perfilEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Cargar historial de servicios
  await cargarHistorialCliente(clienteId);
}

function cerrarPerfilCliente() {
  const perfilEl = document.getElementById("crm-perfil");
  if (perfilEl) perfilEl.style.display = "none";
  _crmClienteActualId = null;
}

async function cargarHistorialCliente(clienteId) {
  const contenedor = document.getElementById("historial-servicios-cliente");
  if (!contenedor) return;
  contenedor.innerHTML = "<div class='empty-state' style='font-size:13px;'>Cargando historial...</div>";

  try {
    const trabajos = await listTrabajosByClienteIdCRM(clienteId, state.session?.profile);
    if (!trabajos.length) {
      contenedor.innerHTML = "<div class='empty-state' style='font-size:13px;'>Este cliente no tiene servicios registrados aún.</div>";
      return;
    }
    const filas = trabajos.map((t) => `
      <tr>
        <td style="padding:8px 6px;font-size:12px;color:var(--muted);">${formatDate(t.fechaIngreso) || "—"}</td>
        <td style="padding:8px 6px;font-size:13px;">${escapeHtml(t.equipo || "—")}</td>
        <td style="padding:8px 6px;">${badgeEstado(t.estado)}</td>
        <td style="padding:8px 6px;font-size:13px;color:var(--success);font-weight:600;">$${formatMoney(t.precio || 0)}</td>
        <td style="padding:8px 6px;font-size:12px;color:var(--muted);">${escapeHtml(t.numeroOrden || "—")}</td>
      </tr>`).join("");

    contenedor.innerHTML = `
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="color:var(--muted);font-size:12px;text-align:left;border-bottom:1px solid rgba(255,255,255,.08);">
            <th style="padding:6px 6px;">Fecha</th>
            <th style="padding:6px 6px;">Equipo</th>
            <th style="padding:6px 6px;">Estado</th>
            <th style="padding:6px 6px;">Precio</th>
            <th style="padding:6px 6px;">Orden</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>`;
  } catch (err) {
    contenedor.innerHTML = `<div class='empty-state' style='font-size:13px;'>No se pudo cargar el historial: ${escapeHtml(err?.message || "")}</div>`;
  }
}

async function guardarCambiosCliente() {
  if (!_crmClienteActualId) return;
  // Admin y operador pueden guardar; tester no (sus campos quedan disabled)
  const rol = state.session?.profile?.rol;
  if (rol !== "admin" && rol !== "operador") return;

  const datos = {
    nombre:    document.getElementById("crmNombre")?.value.trim()    || "",
    apellido:  document.getElementById("crmApellido")?.value.trim()  || "",
    dni:       document.getElementById("crmDni")?.value.trim()       || "",
    telefono:  document.getElementById("crmTelefono")?.value.trim()  || "",
    provincia: document.getElementById("crmProvincia")?.value.trim() || "",
    origenContacto: document.getElementById("crmOrigen")?.value || ""
  };

  if (!datos.nombre) { alert("El nombre del cliente es obligatorio."); return; }

  try {
    await updateCliente(_crmClienteActualId, datos);
    // Actualizar cache local
    const idx = _crmClientesCache.findIndex((c) => c.id === _crmClienteActualId);
    if (idx !== -1) _crmClientesCache[idx] = { ..._crmClientesCache[idx], ...datos };
    renderDirectorio(_crmClientesCache);
    alert("✅ Datos del cliente actualizados correctamente.");
  } catch (err) {
    showAlertError(err, "No se pudo guardar los cambios.");
  }
}

async function eliminarCliente() {
  if (!_crmClienteActualId) return;
  if (state.session?.profile?.rol !== "admin") return;

  const nombre = document.getElementById("crmNombre")?.value.trim() || "este cliente";
  const apellido = document.getElementById("crmApellido")?.value.trim() || "";
  const nombreCompleto = [nombre, apellido].filter(Boolean).join(" ");

  // Doble confirmación — acción irreversible
  const confirmado = confirm(
    `⚠️ ¿Eliminar al cliente "${nombreCompleto}" del directorio?\n\n` +
    `Sus órdenes de servicio NO se borrarán, solo el registro del cliente.\n` +
    `Esta acción es irreversible.`
  );
  if (!confirmado) return;

  try {
    await deleteCliente(_crmClienteActualId);

    // Quitar del cache local y re-renderizar sin recargar Firestore
    _crmClientesCache = _crmClientesCache.filter((c) => c.id !== _crmClienteActualId);
    cerrarPerfilCliente();
    renderDirectorio(_crmClientesCache);

    alert(`✅ Cliente "${nombreCompleto}" eliminado del directorio.`);
  } catch (err) {
    showAlertError(err, "No se pudo eliminar el cliente.");
  }
}

/**
 * Redirige al tab 'nuevo' y pre-completa los datos del cliente
 * @param {string} clienteId 
 */
function nuevoTrabajoDesdeCliente(clienteId) {
  const c = _crmClientesCache.find(x => x.id === clienteId);
  if (!c) return;

  limpiarCampos(); // Resetear el formulario
  
  $("nombre").value    = c.nombre    || "";
  $("apellido").value  = c.apellido  || "";
  $("dni").value       = c.dni       || "";
  $("telefono").value  = c.telefono  || "";
  $("provincia").value = c.provincia || "";

  showTab('nuevo');
  
  // Hacer scroll al inicio y enfocar en el siguiente campo lógico (equipo)
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => {
    const inputEquipo = $("equipo");
    if (inputEquipo) inputEquipo.focus();
  }, 300);
}

/**
 * Abre el modal de facturación AFIP pre-completado
 * @param {string} clienteId 
 */
function facturarDesdeCliente(clienteId) {
  const c = _crmClientesCache.find(x => x.id === clienteId);
  if (!c) return;

  const razon = `${c.nombre || ""} ${c.apellido || ""}`.trim();
  const dni = c.dni || "";
  
  abrirModalFactura();
  
  // Pre-completar modal
  const inputRazon = document.getElementById('factRazon');
  const inputDoc   = document.getElementById('factNroDoc');
  const selectDoc  = document.getElementById('factTipoDoc');
  
  if (inputRazon) inputRazon.value = razon;
  if (inputDoc)   inputDoc.value   = dni;
  
  if (selectDoc) {
    if (dni.length === 11) {
      selectDoc.value = 'cuit';
    } else if (dni.length >= 7) {
      selectDoc.value = 'dni';
    } else {
      selectDoc.value = 'sin_doc';
    }
    // Disparar evento para que se muestre el campo de documento
    if (typeof actualizarCampoDoc === 'function') actualizarCampoDoc();
  }

  const inputMonto = document.getElementById('factMonto');
  if (inputMonto) setTimeout(() => inputMonto.focus(), 300);
}

// ── Rendimiento del operador ────────────────────────────────────
// Filtra trabajos de taller creados por el operador actual.
async function calcularRendimientoOperador() {
  const profile = state.session?.profile;
  const emailOperador = (profile?.email || state.session?.user?.email || "").toLowerCase().trim();

  let todos = [];
  try {
    // Intentar obtener lista fresca para que el rendimiento sea real-time
    todos = await listTrabajos(profile);
  } catch (err) {
    console.warn("Error al cargar rendimiento real-time:", err);
    // Fallback al cache de ingresos si existe
    todos = (state.ingresosData || []).map(({ t }) => t);
  }

  // Si aún no hay trabajos, no podemos calcular nada
  if (!todos.length) {
    console.log("No hay trabajos cargados para calcular rendimiento.");
  }

  const misTrabajosTaller = todos.filter((t) => t.tipo === "taller");

  const misEntregados = misTrabajosTaller.filter(t => t.estado === WORK_STATUS.entregado);
  const misEnProceso  = misTrabajosTaller.filter(t => t.estado !== WORK_STATUS.entregado && t.estado !== WORK_STATUS.reingresada);

  let totalIngresos = 0; // Lo que el operador generó (80% de sus entregados)
  let totalAportes  = 0; // Lo que aportó a la empresa (20% de sus entregados)

  misEntregados.forEach((t) => {
    const precio = Number(t.precio || 0);
    totalIngresos += precio * 0.80;
    totalAportes  += precio * 0.20;
  });

  // Inyectar KPIs
  const elCant    = document.getElementById("rendCantidad");
  const elProceso = document.getElementById("rendProceso");
  const elLiq     = document.getElementById("rendLiquidado");
  const elPend    = document.getElementById("rendPendiente");

  if (elCant)    elCant.innerText    = misEntregados.length;
  if (elProceso) elProceso.innerText = misEnProceso.length;
  if (elLiq)     elLiq.innerText     = formatMoney(totalIngresos);
  if (elPend)    elPend.innerText    = formatMoney(totalAportes);

  // Tabla de detalle
  const tabla = document.getElementById("rendDetalleTabla");
  if (tabla) {
    if (!misTrabajosTaller.length) {
      tabla.innerHTML = `<div class="empty-state" style="font-size:13px;">
        Aún no hay trabajos de taller registrados.
      </div>`;
    } else {
      const filas = misTrabajosTaller
        .sort((a,b) => new Date(b.fechaIngreso) - new Date(a.fechaIngreso))
        .map((t) => {
          const esEntregado = t.estado === WORK_STATUS.entregado;
          const estadoLiq = t.liquidado ? "✅ Liquidado" : (esEntregado ? "⏳ Pendiente" : "🛠️ En curso");
          const colorLiq  = t.liquidado ? "var(--success)" : (esEntregado ? "var(--warning)" : "var(--muted)");
          const cobro  = formatMoney(Number(t.precio || 0) * 0.80);
          return `<tr>
            <td style="padding:10px 6px;"><b>${t.numeroOrden || "—"}</b></td>
            <td style="padding:10px 6px;">${escapeHtml(t.equipo || "—")}</td>
            <td style="padding:10px 6px;">$${formatMoney(Number(t.precio || 0))}</td>
            <td style="padding:10px 6px;color:${esEntregado ? 'var(--success)' : 'var(--muted)'};font-weight:600;">$${cobro}</td>
            <td style="padding:10px 6px;color:${colorLiq}">${estadoLiq}</td>
          </tr>`;
        }).join("");

      tabla.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:10px;">
          <thead>
            <tr style="color:var(--muted);text-align:left;border-bottom:1px solid rgba(255,255,255,.1);">
              <th style="padding:8px 6px;">Orden</th>
              <th style="padding:8px 6px;">Equipo</th>
              <th style="padding:8px 6px;">Precio</th>
              <th style="padding:8px 6px;">Tu cobro (80%)</th>
              <th style="padding:8px 6px;">Estado</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>`;
    }
  }
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
        // Regla contable: taller solo suma si está liquidado (20%), remoto suma 100%
        const contrib = calcularContribContable(t, state.session?.profile);
        if (String(t.fechaEntregado).startsWith(hoy)) totalDia += contrib;
        if (String(t.fechaEntregado).startsWith(mesActual)) totalMes += contrib;
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
  
  if (!admin) {
    document.querySelectorAll(".admin-section").forEach((el) => el.remove());
    document.querySelectorAll(".filtro-admin").forEach((el) => el.remove());
  } else {
    document.querySelectorAll(".admin-section").forEach((el) => {
      el.style.display = "";
    });
    document.querySelectorAll(".filtro-admin").forEach((el) => {
      el.style.display = "";
    });
  }

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
    if (tipoSelect) {
      tipoSelect.disabled = false;
      // Solo asignar "remoto" si el formulario no está en modo edición
      if (!state.edit?.trabajoId) {
        tipoSelect.value = "remoto";
        tipoSelect.dispatchEvent(new Event('change'));
      }
    }
  }

  const reqDni = document.getElementById("reqDni");
  if (reqDni) reqDni.style.display = "none"; // DNI opcional para todos los roles

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
  // ── Pestaña Mi Rendimiento: solo visible para operador ──────
  const tabRendimiento = document.getElementById("tabRendimiento");
  const esOperador     = state.session?.profile?.rol === 'operador';
  if (tabRendimiento) tabRendimiento.style.display = esOperador ? "" : "none";

  // ── Pestaña Directorio: visible para admin y operador (no tester) ─
  const tabCRM = document.getElementById("tabCRM");
  if (tabCRM) {
    const verDirectorio = admin || esOperador;
    tabCRM.style.display = verDirectorio ? "" : "none";
  }
}

function showTab(id) {
  // Ocultar todos los paneles de contenido y desactivar todos los tabs
  document.querySelectorAll(".tab-content").forEach((t) => {
    t.classList.remove("active");
    t.style.display = "none";
  });
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));

  // Activar el panel destino por ID (no por posición, evita bugs con tabs ocultos)
  const panel = document.getElementById("tab-" + id);
  if (panel) {
    panel.style.display = "";
    panel.classList.add("active");
  }

  // Activar la pestaña del menú que llamó a este tab
  const tabBtn = document.querySelector(".tab[onclick*=\"'" + id + "'\"]");
  if (tabBtn) tabBtn.classList.add("active");
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
  
  state.currentItemsInventario = [];
  renderItemsInventario();
  
  state.selectedClienteIdForNewWork = null;
}


function cancelarEdicion() {
  state.edit = { trabajoId: null, clienteId: null, modoAdminEdicion: false };
  limpiarCampos();
  $("modoEdicionBanner").style.display = "none";
  $("btnCancelar").style.display = "none";
  if (document.getElementById("adminCorrectionContainer")) {
    document.getElementById("adminCorrectionContainer").style.display = "none";
  }
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

async function editarTrabajo(trabajoId, _clienteIdObsoleto, modoAdmin = false) {
  try {
    state.edit.modoAdminEdicion = modoAdmin;
    if (modoAdmin) {
      alert("⚠️ ATENCIÓN: Entrando en MODO EDICIÓN ADMINISTRATIVA.\n\nLas modificaciones en órdenes entregadas o históricas deben realizarse con precaución para no romper la integridad del sistema.");
    }
    if (document.getElementById("adminCorrectionContainer")) {
      document.getElementById("adminCorrectionContainer").style.display = modoAdmin ? "flex" : "none";
      document.getElementById("chkModoCorreccion").checked = false;
    }

    // REGLA CRÍTICA ANTI-CONTAMINACIÓN:
    // Leemos el trabajo PRIMERO para obtener el clienteId canónico desde Firestore.
    // NO usamos el parámetro _clienteIdObsoleto porque puede venir de un botón HTML
    // renderizado ANTES de un desacople, apuntando al clienteId viejo.
    const trabajo = await getTrabajo(trabajoId);
    if (!trabajo) throw new Error("No se encontró la orden.");
    
    const canonicalClienteId = trabajo.clienteId;
    if (!canonicalClienteId) throw new Error("La orden no tiene clienteId válido.");

    // Detectar y loggear si el parámetro HTML difiere del valor en Firestore
    if (_clienteIdObsoleto && _clienteIdObsoleto !== canonicalClienteId) {
      import("./system-service.js").then(({ logSystem }) => {
        logSystem("[CLIENT_ID_MUTATION_BLOCKED]", {
          trabajoId,
          clienteIdHTMLObsoleto: _clienteIdObsoleto,
          clienteIdCanonicoFirestore: canonicalClienteId,
          motivo: "El parámetro del botón difería del clienteId en Firestore — se usó el de Firestore"
        }).catch(() => {});
      });
    }

    const cliente = await getCliente(canonicalClienteId);
    if (!cliente) throw new Error("No se encontró el cliente de la orden.");

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

    // Usar SIEMPRE el clienteId canónico de Firestore
    state.edit.trabajoId = trabajoId;
    state.edit.clienteId = canonicalClienteId;
    state.currentItemsInventario = trabajo.itemsInventario || [];
    renderItemsInventario();

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
    planServicio: document.getElementById("planServicio") ? document.getElementById("planServicio").value : "",
    itemsInventario: state.currentItemsInventario,
    clienteId: state.selectedClienteIdForNewWork
  };
}


async function guardarCliente() {
  if (window._processingGuardar) return;
  window._processingGuardar = true;
  const btn = $("btnGuardarCliente");
  if (btn) btn.disabled = true;
  try {
    const formData = readWorkForm();
    
    // Si estamos en modo admin, verificar que el checkbox esté marcado
    if (state.edit.modoAdminEdicion) {
      const chk = document.getElementById("chkModoCorreccion");
      if (chk && !chk.checked) {
        throw new Error("Debés activar el 'Modo Corrección' (checkbox) para guardar cambios en una orden bloqueada.");
      }
    }

    let result;
    if (state.edit.trabajoId) {
      result = await updateWork(formData, state.edit, state.session?.profile);
    } else {
      result = await createWork(formData, state.session?.profile);
      
      if (result.requiresClientSelection) {
        abrirModalCoincidencias(result.matches, formData);
        return; // El flujo continúa en el modal
      }
    }
    
    const wasCreated = result.mode === "created";
    cancelarEdicion();
    limpiarCampos();
    alert(wasCreated
      ? `Registrado. Orden: ${result.numeroOrden}`
      : "Orden actualizada correctamente");
    showTab("trabajos");
    if (result.numeroOrden) {
      $("busquedaDni").value = result.numeroOrden;
      await cargar(result.numeroOrden);
    } else {
      await cargar();
    }

    // Push a admins cuando se registra un trabajo nuevo
    if (wasCreated) {
      dispararPushBackend(
        '🔔 Nuevo Trabajo Registrado',
        `Orden: ${result.numeroOrden} | Tipo: ${formData.tipo || 'General'}`.trim()
      );
    }
  } catch (error) {
    await logSystem("error_guardar_orden", { message: error.message }, "error").catch(() => {});
    showAlertError(error, "No se pudo guardar la orden.");
  } finally {
    // Si no se abrió el modal, liberamos el botón
    if (!document.getElementById("modalCoincidenciasCliente")) {
      window._processingGuardar = false;
      if (btn) btn.disabled = false;
    }
  }
}

function abrirModalCoincidencias(matches, formData) {
  const modalId = "modalCoincidenciasCliente";
  const oldModal = document.getElementById(modalId);
  if (oldModal) oldModal.remove();

  const modal = document.createElement("div");
  modal.id = modalId;
  modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;";

  const content = document.createElement("div");
  content.style.cssText = "background:var(--bg-card, #1a1a1a);padding:24px;border-radius:12px;width:90%;max-width:600px;border:1px solid var(--accent, #00ffcc);box-shadow:0 0 20px rgba(0,255,204,0.2);color:white;";

  content.innerHTML = `
    <h3 style="color:var(--warning, #ffaa00);margin-top:0;">⚠️ Posibles clientes encontrados</h3>
    <p>Se detectaron coincidencias en la base de datos. Por favor, selecciona una opción:</p>
    <div style="max-height:300px;overflow-y:auto;margin:16px 0;background:rgba(0,0,0,0.3);border-radius:8px;padding:8px;">
      ${matches.map(m => `
        <div class="match-item" style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center;">
          <div>
            <span style="color:var(--accent);font-weight:bold;">${m.clienteCodigo || "S/C"}</span> | 
            <b>${escapeHtml(m.nombre)}</b><br>
            <small style="color:var(--muted);">${m.telefono} | ${m.alias || 'Sin alias'}</small>
          </div>
          <div style="text-align:right;">
            <span class="badge" style="background:rgba(0,255,204,0.1);color:var(--accent);font-size:11px;">Score: ${m.score}</span><br>
            <button class="btn btn-sm btn-edit" style="margin-top:4px;" onclick="window._seleccionarClienteMatch('${m.clienteId}')">Usar Cliente</button>
          </div>
        </div>
      `).join('')}
    </div>
    <div style="display:flex;justify-content:space-between;gap:12px;">
      <button class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove(); window._processingGuardar=false; if($('btnGuardarCliente')) $('btnGuardarCliente').disabled=false;">Cancelar</button>
      <button class="btn btn-success" style="background:var(--success);color:black;" onclick="window._forzarCrearCliente()">Crear Cliente Nuevo</button>
    </div>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  window._seleccionarClienteMatch = async (clienteId) => {
    modal.remove();
    await completarCreacionOrden({ ...formData, clienteId });
  };

  window._forzarCrearCliente = async () => {
    modal.remove();
    await completarCreacionOrden(formData, true);
  };
}

async function completarCreacionOrden(formData, forceCreateNewClient = false) {
  const btn = $("btnGuardarCliente");
  try {
    const result = await createWork(formData, state.session?.profile, forceCreateNewClient);
    
    cancelarEdicion();
    limpiarCampos();
    alert(`Registrado. Orden: ${result.numeroOrden}`);
    showTab("trabajos");
    if (result.numeroOrden) {
      $("busquedaDni").value = result.numeroOrden;
      await cargar(result.numeroOrden);
    } else {
      await cargar();
    }

    dispararPushBackend(
      '🔔 Nuevo Trabajo Registrado',
      `Orden: ${result.numeroOrden} | Tipo: ${formData.tipo || 'General'}`.trim()
    );
  } catch (error) {
    showAlertError(error, "No se pudo completar la creación de la orden.");
  } finally {
    window._processingGuardar = false;
    if (btn) btn.disabled = false;
  }
}


async function buscar() {
  const value = $("busquedaDni").value.trim();
  if (!value) return;
  
  const btn = document.querySelector(".search-bar .btn-secondary");
  if (btn) { btn.innerText = "Buscando..."; btn.disabled = true; }
  
  try {
    await cargar(value);
  } finally {
    if (btn) { btn.innerText = "Buscar"; btn.disabled = false; }
  }
}

async function limpiarBusqueda() {
  $("busquedaDni").value = "";
  $("filtroEstado").value = "";
  
  const btn = document.querySelector(".search-bar .btn-edit");
  if (btn) { btn.innerText = "Cargando..."; btn.disabled = true; }
  
  try {
    await cargar("", { cargarTodos: true });
  } finally {
    if (btn) { btn.innerText = "Ver todos"; btn.disabled = false; }
  }
}

async function cargar(filtro = "", options = {}) {
  const currentSearchId = ++state.searchId;
  const cont = $("listaTrabajos");
  cont.innerHTML = "<div class='empty-state'>Cargando...</div>";

  try {
    const hoy = new Date().toISOString().split("T")[0];
    const mesActual = new Date().toISOString().slice(0, 7);
    const estadoFiltro = $("filtroEstado")?.value || "";
    const tipoFiltro = $("filtroTipo")?.value || "";
    const ordenFiltro = $("filtroOrden")?.value || "recientes";
    const sinMovimientoFiltro = Number($("filtroSinMovimiento")?.value || 0);
    const soloActivosFiltro = $("chkSoloActivos")?.checked || false;
    const filtroLimpio = String(filtro || "").trim();
    const cargarTodos = options.cargarTodos === true || (!filtroLimpio && options.fromFilter === true);

    if (!filtroLimpio && !cargarTodos) {
      cont.innerHTML = `
        <div class="empty-state">
          Buscá por DNI, número de orden, nombre o apellido — o presioná "Ver todos".
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

      // ── Búsqueda por Nombre / Apellido ─────────────────────────────
      // Si no se encontraron resultados por DNI u orden, intentamos una
      // búsqueda de texto completo en nombre y apellido del cliente.
      if (!trabajos.length) {
        let todosTrabajos = [];
        let todosClientes = {};
        try {
          [todosTrabajos, todosClientes] = await Promise.all([
            listTrabajos(state.session?.profile),
            listClientesMap()
          ]);
        } catch (err) {
          clientesWarning = err?.code || err?.message || "No se pudo leer clientes";
        }
        const term = filtroLimpio.toLowerCase();
        const clientesFiltrados = Object.values(todosClientes).filter((c) =>
          c?.nombre?.toLowerCase().includes(term) ||
          c?.apellido?.toLowerCase().includes(term)
        );
        const idsMatch = new Set(clientesFiltrados.map((c) => c.id));
        trabajos = todosTrabajos.filter((t) => idsMatch.has(t.clienteId));
        // Merge clientes encontrados para que las cards puedan mostrar datos
        clientesFiltrados.forEach((c) => { clientes[c.id] = c; });
      }
    }

    if (currentSearchId !== state.searchId) return;

    let totalDia = 0;
    let totalMes = 0;
    const resultados = [];
    
    let activosCount = 0;
    let listosCount = 0;
    let entregadosHoyCount = 0;
    let abandonadosCount = 0;

    trabajos.forEach((trabajo) => {
      const cliente = clientes[trabajo.clienteId];
      
      const ref = trabajo.updatedAt || trabajo.fechaReparado || trabajo.fechaEntregado || trabajo.fechaIngreso;
      const dias = Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);

      const isActivo = [WORK_STATUS.ingresado, WORK_STATUS.enReparacion, WORK_STATUS.listo].includes(trabajo.estado);
      if (isActivo) activosCount++;
      if (trabajo.estado === WORK_STATUS.listo) listosCount++;
      if (trabajo.estado === WORK_STATUS.entregado && trabajo.fechaEntregado && trabajo.fechaEntregado.startsWith(hoy)) {
        entregadosHoyCount++;
      }
      if (dias >= 7 && trabajo.estado !== WORK_STATUS.entregado && trabajo.estado !== WORK_STATUS.reingresada) {
        abandonadosCount++;
      }

      if (trabajo.estado === WORK_STATUS.entregado && trabajo.fechaEntregado) {
        // Regla contable: taller solo suma si está liquidado (20%), remoto suma 100%
        const contrib = calcularContribContable(trabajo, state.session?.profile);
        if (String(trabajo.fechaEntregado).startsWith(hoy)) totalDia += contrib;
        if (String(trabajo.fechaEntregado).startsWith(mesActual)) totalMes += contrib;
      }

      if (estadoFiltro && trabajo.estado !== estadoFiltro) return;
      if (tipoFiltro && (trabajo.tipo || "").toLowerCase() !== tipoFiltro.toLowerCase()) return;
      
      if (soloActivosFiltro) {
        const activos = [WORK_STATUS.ingresado, WORK_STATUS.enReparacion, WORK_STATUS.listo];
        if (!activos.includes(trabajo.estado)) return;
      }
      if (sinMovimientoFiltro > 0) {
        const ref = trabajo.updatedAt || trabajo.fechaReparado || trabajo.fechaEntregado || trabajo.fechaIngreso;
        const dias = Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
        if (dias < sinMovimientoFiltro) return;
      }

      resultados.push({ trabajo, cliente });
    });

    resultados.sort((a, b) => {
      const ta = new Date(a.trabajo.updatedAt || a.trabajo.fechaReparado || a.trabajo.fechaEntregado || a.trabajo.fechaIngreso);
      const tb = new Date(b.trabajo.updatedAt || b.trabajo.fechaReparado || b.trabajo.fechaEntregado || b.trabajo.fechaIngreso);
      return ordenFiltro === "antiguos" ? ta - tb : tb - ta;
    });

    $("totalDia").innerText = formatMoney(totalDia);
    $("totalMes").innerText = formatMoney(totalMes);
    
    if ($("countActivos")) $("countActivos").innerText = activosCount;
    if ($("countListos")) $("countListos").innerText = listosCount;
    if ($("countEntregadosHoy")) $("countEntregadosHoy").innerText = entregadosHoyCount;
    if ($("countAbandonados")) $("countAbandonados").innerText = abandonadosCount;

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

window.aplicarFiltroRapido = function(tipo) {
  const busqueda = document.getElementById('busquedaDni').value.trim();
  if (tipo === 'abandonados') {
    if ($("filtroEstado")) $("filtroEstado").value = "";
    if ($("filtroSinMovimiento")) $("filtroSinMovimiento").value = "7";
    if ($("filtroOrden")) $("filtroOrden").value = "recientes";
    if ($("chkSoloActivos")) $("chkSoloActivos").checked = false;
  } else if (tipo === 'listos') {
    if ($("filtroEstado")) $("filtroEstado").value = "Listo";
    if ($("filtroSinMovimiento")) $("filtroSinMovimiento").value = "";
    if ($("filtroOrden")) $("filtroOrden").value = "recientes";
    if ($("chkSoloActivos")) $("chkSoloActivos").checked = false;
  }
  cargar(busqueda, { fromFilter: true });
};

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

  const diasSinMover = daysSince(t.updatedAt || t.fechaReparado || t.fechaEntregado || t.fechaIngreso);
  const isActivo = t.estado !== WORK_STATUS.entregado && t.estado !== WORK_STATUS.reingresada;

  if (isActivo) {
    if (diasSinMover >= 7) {
      card.style.border = "1px solid var(--danger)";
      card.style.boxShadow = "0 0 15px rgba(255,0,127,0.2)";
    } else if (diasSinMover >= 3) {
      card.style.border = "1px solid var(--warning)";
    }
  }

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
          ${admin ? `<button class="btn btn-sm btn-warning" style="background:rgba(255,170,0,0.1);color:var(--warning);" onclick="confirmarDesacople('${t.id}','${t.numeroOrden}')">🔓 Desacoplar</button>` : ""}
          ${canDelete ? `<button class="btn btn-sm btn-danger" onclick="borrarTrabajo('${t.id}')">${t.reingreso ? "Eliminar Reingreso" : "Borrar"}</button>` : ""}
          <button class="btn btn-sm btn-ticket" onclick="imprimirTicket('${t.id}')">Ticket</button>
          ${btnWa}
        </div>
      </div>
    `;
  } else {
    // Estado Bloqueado (Entregado o Reingresada)
    const isReingresada = t.estado === WORK_STATUS.reingresada;
    botonesHtml = `
      <div class="card-actions-wrapper">
        <div class="btn-group">
          <div class="btn-group-title">Acciones ${admin ? '<span class="badge badge-admin">MODO ADMIN</span>' : ''}</div>
          ${canReenterWork(t.estado) ? `<button class="btn btn-sm btn-reingreso" onclick="reingresarTrabajo('${t.id}')">Reingresar</button>` : ""}
          
          ${admin ? `
            <button class="btn btn-sm btn-edit btn-admin" onclick="editarTrabajo('${t.id}','${t.clienteId}', true)">Editar (Admin)</button>
            <button class="btn btn-sm btn-warning btn-admin" style="background:rgba(255,170,0,0.1);color:var(--warning);" onclick="confirmarDesacople('${t.id}','${t.numeroOrden}')">🔓 Desacoplar Cliente</button>
            <button class="btn btn-sm btn-danger btn-admin" onclick="borrarTrabajo('${t.id}')">${t.reingreso ? "Eliminar Reingreso" : "Borrar (Admin)"}</button>
          ` : ""}
          
          <button class="btn btn-sm btn-ticket" onclick="imprimirTicket('${t.id}')">Ticket</button>
          ${btnWa}
          ${isReingresada ? `<span class="reingresada-label">Orden reingresada</span>` : ""}
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
        ${(diasSinMover >= 3 && isActivo) ? `<span class="demora-tag" style="color: ${diasSinMover >= 7 ? 'var(--danger)' : 'var(--warning)'}">${diasSinMover} días sin actualizar</span>` : ""}
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

function confirmarDesacople(trabajoId, numeroOrden) {
  const modalId = "modalConfirmarDesacople";
  const oldModal = document.getElementById(modalId);
  if (oldModal) oldModal.remove();

  const modal = document.createElement("div");
  modal.id = modalId;
  modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;";

  const content = document.createElement("div");
  content.style.cssText = "background:var(--bg-card, #1a1a1a);padding:24px;border-radius:12px;width:90%;max-width:500px;border:1px solid var(--warning, #ffaa00);box-shadow:0 0 20px rgba(255,170,0,0.2);color:white;";

  content.innerHTML = `
    <h3 style="color:var(--warning, #ffaa00);margin-top:0;">🔓 Desacoplar Cliente</h3>
    <p>Esta acción creará un nuevo cliente independiente para esta orden específica (<b>${numeroOrden}</b>).</p>
    <p>La orden dejará de compartir identidad con otras órdenes históricas.</p>
    <p style="color:var(--muted);">¿Continuar?</p>
    <div style="display:flex;justify-content:space-between;gap:12px;margin-top:20px;">
      <button class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove()">Cancelar</button>
      <button class="btn btn-warning" id="btnEjecutarDesacople" style="background:var(--warning);color:black;">Desacoplar</button>
    </div>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  const btnEjecutar = content.querySelector("#btnEjecutarDesacople");
  btnEjecutar.onclick = async () => {
    btnEjecutar.disabled = true;
    btnEjecutar.innerText = "Procesando...";
    try {
      const { desacoplarClienteOrden } = await import("./work-service.js");
      const res = await desacoplarClienteOrden(trabajoId, numeroOrden, state.session?.profile);
      
      modal.remove();
      alert(`✅ Desacople exitoso. Se creó el cliente con código ${res.clienteCodigoNuevo}`);
      
      // Recargar la búsqueda actual para ver los cambios
      await cargar($("busquedaDni").value.trim());
    } catch (error) {
      alert(`Error: ${error.message}`);
      btnEjecutar.disabled = false;
      btnEjecutar.innerText = "Desacoplar";
    }
  };
}

async function cambiarEstado(id, estado) {
  try {
    await changeWorkStatus(id, estado);
    await cargar($("busquedaDni").value.trim());
  } catch (error) {
    await logSystem("error_cambiar_estado", { trabajoId: id, estado, message: error.message }).catch(() => {});
    showAlertError(error, "No se pudo cambiar el estado.");
  }
}

async function reingresarTrabajo(id) {
  if (window._processingReingreso) return;
  window._processingReingreso = true;
  try {
    const res = await _reingresarTrabajo(id);
    return res;
  } finally {
    window._processingReingreso = false;
  }
}

async function _reingresarTrabajo(id) {
  try {
    const trabajo = await getTrabajo(id);
    if (!trabajo) throw new Error("No se encontró la orden.");
    if (!confirm(`¿Reingresar el equipo ${trabajo.equipo || ""}?\nSe creará una nueva orden para este cliente.`)) return;

    const nuevoPrecioStr = prompt("Precio para esta reparación:", trabajo.precio ?? 0);
    if (nuevoPrecioStr === null) return;

    const numeroOrden = await reenterWork(id, Number(nuevoPrecioStr), state.session?.profile);
    alert(`Reingreso registrado. Nueva orden: ${numeroOrden}`);
    $("busquedaDni").value = numeroOrden;
    await cargar(numeroOrden);
  } catch (error) {
    showAlertError(error, "No se pudo reingresar la orden.");
  }
}

async function borrarTrabajo(id) {
  if (window._processingBorrar) return;
  window._processingBorrar = true;
  try {
    const res = await _borrarTrabajo(id);
    return res;
  } finally {
    window._processingBorrar = false;
  }
}

async function _borrarTrabajo(id) {
  if (!confirm("¿Eliminar esta orden? No se puede deshacer.")) return;

  try {
    await removeWork(id, state.session?.profile);
    alert("Eliminado correctamente");
    await cargar($("busquedaDni").value.trim());
  } catch (error) {
    await logSystem("error_borrar_orden", { trabajoId: id, message: error.message }).catch(() => {});
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
      // Regla contable: taller solo suma si está liquidado (20%), remoto suma 100%
      const contribGlobal = calcularContribContable(t, state.session?.profile);
      totalGeneral += contribGlobal;
      if (t.tipo === "taller") totalTaller += contribGlobal;
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

// ── MÓDULO DE INTEGRACIÓN INVENTARIO-TICKET ───────────────────────

state.currentItemsInventario = [];

let _repuestoSearchTimer = null;

window.buscarRepuestosParaOrden = function(termino) {
  if (getCachedSystemConfig().inventarioActivo === false) {
    const resultadosDiv = document.getElementById("resultadosBusquedaRepuesto");
    if (resultadosDiv) {
      resultadosDiv.innerHTML = `<div style="padding:10px; color:var(--warning); text-align:center;">Inventario desactivado temporalmente</div>`;
      resultadosDiv.style.display = "block";
    }
    return;
  }

  // Debounce 300ms para evitar queries excesivas en tipeo rápido
  clearTimeout(_repuestoSearchTimer);
  _repuestoSearchTimer = setTimeout(() => {
    _buscarRepuestosInterno(termino);
  }, 300);
};

function _buscarRepuestosInterno(termino) {
  const t = termino.toLowerCase().trim();
  const resultadosDiv = document.getElementById("resultadosBusquedaRepuesto");
  if (!resultadosDiv) return;
  
  if (!t) {
    resultadosDiv.style.display = "none";
    return;
  }
  
  import("./inventario-repository.js").then(async (repo) => {
    const productos = await repo.getProductos();
    const filtrados = productos.filter(p => 
      p.activo && p.tipo === "repuesto" && (
        p.nombre?.toLowerCase().includes(t) || 
        p.sku?.toLowerCase().includes(t)
      )
    );
    
    if (!filtrados.length) {
      resultadosDiv.innerHTML = `<div style="padding:10px; color:var(--muted); text-align:center;">No se encontraron repuestos</div>`;
      resultadosDiv.style.display = "block";
      return;
    }
    
    resultadosDiv.innerHTML = filtrados.map(p => `
      <div style="padding:10px; border-bottom:1px solid var(--border); cursor:pointer; display:flex; justify-content:space-between; align-items:center;" onclick="agregarRepuestoAOrden('${p.id}')">
        <div>
          <div style="font-weight:bold;">${escapeHtml(p.nombre)}</div>
          <div style="font-size:12px; color:var(--muted);">${escapeHtml(p.sku || "Sin SKU")} | Stock: ${p.stock || 0}</div>
        </div>
        <div style="font-weight:bold; color:var(--success);">$${formatMoney(p.precioVenta)}</div>
      </div>
    `).join("");
    
    resultadosDiv.style.display = "block";
  }).catch((error) => showAlertError(error, "No se pudieron cargar los repuestos."));
};

window.agregarRepuestoAOrden = function(productoId) {
  if (getCachedSystemConfig().inventarioActivo === false) {
    alert("Inventario está desactivado temporalmente.");
    return;
  }

  import("./inventario-repository.js").then(async (repo) => {
    const producto = await repo.getProducto(productoId);
    if (!producto) return;
    
    if (producto.stock <= 0) {
      alert("No hay stock disponible de este repuesto.");
      return;
    }
    
    const itemExistente = state.currentItemsInventario.find(item => item.productoId === productoId);
    
    if (itemExistente) {
      if (itemExistente.cantidad >= producto.stock) {
        alert("No puedes agregar más de este repuesto. Supera el stock disponible.");
        return;
      }
      itemExistente.cantidad += 1;
      itemExistente.subtotal = itemExistente.cantidad * itemExistente.precioUnitario;
    } else {
      state.currentItemsInventario.push({
        productoId: producto.id,
        sku: producto.sku || "",
        nombre: producto.nombre,
        cantidad: 1,
        precioUnitario: producto.precioVenta,
        subtotal: producto.precioVenta,
        estado: "reservado"
      });
    }
    
    const inputPrecio = document.getElementById("precio");
    if (inputPrecio) {
      const currentPrecio = Number(inputPrecio.value) || 0;
      inputPrecio.value = currentPrecio + Number(producto.precioVenta || 0);
    }
    
    const resultados = document.getElementById("resultadosBusquedaRepuesto");
    const buscador = document.getElementById("buscarRepuestoInput");
    if (resultados) resultados.style.display = "none";
    if (buscador) buscador.value = "";
    
    renderItemsInventario();
    logSystem("repuesto_agregado_orden", { productoId, cantidad: 1 }).catch(() => {});
  }).catch((error) => showAlertError(error, "No se pudo agregar el repuesto."));
};

window.actualizarCantidadRepuesto = function(productoId, cambio) {
  if (getCachedSystemConfig().inventarioActivo === false) {
    alert("Inventario está desactivado temporalmente.");
    return;
  }

  const item = state.currentItemsInventario.find(item => item.productoId === productoId);
  if (!item) return;
  
  if (item.estado !== "reservado") {
    alert("Solo se pueden modificar items en estado reservado.");
    return;
  }
  
  import("./inventario-repository.js").then(async (repo) => {
    const producto = await repo.getProducto(productoId);
    const nuevaCantidad = item.cantidad + cambio;
    
    if (nuevaCantidad <= 0) {
      window.eliminarRepuestoDeOrden(productoId);
      return;
    }
    
    if (producto && nuevaCantidad > producto.stock) {
      alert("No hay suficiente stock.");
      return;
    }
    
    const inputPrecio = document.getElementById("precio");
    if (inputPrecio) {
      const currentPrecio = Number(inputPrecio.value) || 0;
      inputPrecio.value = Math.max(0, currentPrecio + (Number(producto?.precioVenta || 0) * cambio));
    }
    
    item.cantidad = nuevaCantidad;
    item.subtotal = item.cantidad * item.precioUnitario;
    
    renderItemsInventario();
    logSystem("repuesto_cantidad_actualizada", { productoId, cambio, cantidad: nuevaCantidad }).catch(() => {});
  }).catch((error) => showAlertError(error, "No se pudo actualizar el repuesto."));
};

window.eliminarRepuestoDeOrden = function(productoId) {
  const item = state.currentItemsInventario.find(item => item.productoId === productoId);
  if (!item) return;
  
  if (!confirm(`¿Eliminar ${item.nombre} de la orden?`)) return;
  
  if (item.estado === "reservado") {
    const inputPrecio = document.getElementById("precio");
    if (inputPrecio) {
      const currentPrecio = Number(inputPrecio.value) || 0;
      inputPrecio.value = Math.max(0, currentPrecio - item.subtotal);
    }
  }
  
  item.estado = "devuelto";
  renderItemsInventario();
  logSystem("repuesto_devuelto_orden", { productoId, cantidad: item.cantidad }).catch(() => {});
};

function renderItemsInventario() {
  const tbody = document.getElementById("repuestosOrdenTablaBody");
  if (!tbody) return;
  
  if (!state.currentItemsInventario.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:10px;">No hay repuestos agregados</td></tr>`;
    return;
  }
  
  tbody.innerHTML = state.currentItemsInventario.map(item => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
      <td style="padding:8px;">
        <div style="font-weight:bold;">${escapeHtml(item.nombre)}</div>
        <div style="font-size:11px; color:var(--muted);">${escapeHtml(item.sku)}</div>
      </td>
      <td style="padding:8px;">
        <div style="display:flex; align-items:center; gap:5px;">
          ${item.estado === 'reservado' ? `
            <button class="btn btn-sm btn-secondary" style="padding:2px 6px;" onclick="actualizarCantidadRepuesto('${item.productoId}', -1)">-</button>
            <span>${item.cantidad}</span>
            <button class="btn btn-sm btn-secondary" style="padding:2px 6px;" onclick="actualizarCantidadRepuesto('${item.productoId}', 1)">+</button>
          ` : `<span>${item.cantidad}</span>`}
        </div>
      </td>
      <td style="padding:8px;">$${formatMoney(item.precioUnitario)}</td>
      <td style="padding:8px; font-weight:bold;">$${formatMoney(item.subtotal)}</td>
      <td style="padding:8px;"><span class="badge badge-${item.estado}">${item.estado}</span></td>
      <td style="padding:8px; text-align:right;">
        ${item.estado === 'reservado' ? `
          <button class="btn btn-sm btn-danger" style="padding:2px 6px;" onclick="eliminarRepuestoDeOrden('${item.productoId}')">✕</button>
        ` : ''}
      </td>
    </tr>
  `).join("");
}

let versionClicks = 0;
window.easterEgg = function() {
  versionClicks++;
  if (versionClicks === 5) {
    alert("Astra esta trabajando para hacerte feliz (L)");
    versionClicks = 0;
  }
};

function initAutocomplete() {
  const dniInput = $("dni");
  const telInput = $("telefono");

  if (dniInput) {
    dniInput.addEventListener("input", debounce(async (e) => {
      const val = e.target.value.trim();
      if (val.length >= 4) {
        await detectarDuplicado({ dni: val });
      }
    }, 500));
  }

  if (telInput) {
    telInput.addEventListener("input", debounce(async (e) => {
      const val = e.target.value.trim();
      if (val.length >= 6) {
        await detectarDuplicado({ telefono: val });
      }
    }, 500));
  }
}

let _ultimoClienteDetectadoId = null;

async function detectarDuplicado(criterio) {
  const { findClienteMatch } = await import("./work-repository.js");
  const matches = await findClienteMatch(criterio);

  if (matches && matches.length > 0) {
    const match = matches[0];
    
    if (match.clienteId === _ultimoClienteDetectadoId) return;
    _ultimoClienteDetectadoId = match.clienteId;

    try {
      const { logSystem } = await import("./system-service.js");
      await logSystem("[DUPLICATE_DETECTED]", {
        operador: state.session?.user?.email || "N/A",
        clienteDetectadoId: match.clienteId,
        score: match.score
      });
    } catch (e) {}

    const { getCliente, findTrabajosByClienteId } = await import("./work-repository.js");
    const cliente = await getCliente(match.clienteId);
    const trabajos = await findTrabajosByClienteId(match.clienteId, state.session?.profile);

    mostrarModalAlertaDuplicado(cliente, trabajos.length, match.score);
  } else {
    _ultimoClienteDetectadoId = null;
  }
}

function mostrarModalAlertaDuplicado(cliente, cantOrdenes, score) {
  const modalId = "modalAlertaDuplicado";
  const oldModal = document.getElementById(modalId);
  if (oldModal) oldModal.remove();

  const modal = document.createElement("div");
  modal.id = modalId;
  modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;";

  const content = document.createElement("div");
  content.style.cssText = "background:var(--bg-card, #1a1a1a);padding:24px;border-radius:12px;width:90%;max-width:400px;border:1px solid var(--warning, #ffaa00);box-shadow:0 0 20px rgba(255,170,0,0.2);color:white;";

  content.innerHTML = `
    <h3 style="color:var(--warning, #ffaa00);margin-top:0;">⚠ Cliente existente encontrado</h3>
    <div style="background:rgba(0,0,0,0.3);padding:12px;border-radius:8px;margin:16px 0;">
      <div style="color:var(--accent);font-weight:bold;">${cliente.clienteCodigo || "S/C"}</div>
      <div style="font-size:18px;font-weight:bold;">${cliente.nombre} ${cliente.apellido || ""}</div>
      <div style="color:var(--muted);">${cliente.telefono || "Sin teléfono"}</div>
      <div style="color:var(--muted);">${cliente.dni || "Sin DNI"}</div>
      <div style="margin-top:8px;font-size:12px;"><span class="badge" style="background:rgba(0,255,204,0.1);color:var(--accent);">${cantOrdenes} órdenes registradas</span></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <button class="btn btn-success" style="background:var(--success);color:black;" id="btnUsarExistente">Usar Cliente Existente</button>
      <button class="btn btn-secondary" id="btnCrearNuevoForzado">Crear Cliente Nuevo</button>
      <button class="btn btn-link" style="color:var(--muted);" onclick="document.getElementById('${modalId}').remove()">Cancelar</button>
    </div>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  content.querySelector("#btnUsarExistente").onclick = () => {
    $("nombre").value = cliente.nombre || "";
    $("apellido").value = cliente.apellido || "";
    $("telefono").value = cliente.telefono || "";
    $("dni").value = cliente.dni || "";
    $("provincia").value = cliente.provincia || "";
    
    state.selectedClienteIdForNewWork = cliente.id;
    
    modal.remove();
  };

  content.querySelector("#btnCrearNuevoForzado").onclick = async () => {
    try {
      const { logSystem } = await import("./system-service.js");
      await logSystem("[DUPLICATE_OVERRIDE]", {
        operador: state.session?.user?.email || "N/A",
        clienteDetectadoId: cliente.id
      });
    } catch (e) {}

    state.selectedClienteIdForNewWork = null;
    modal.remove();
  };
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function abrirModalMergeClientes() {
  const modalId = "modalMergeClientes";
  const oldModal = document.getElementById(modalId);
  if (oldModal) oldModal.remove();

  const modal = document.createElement("div");
  modal.id = modalId;
  modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;";

  const content = document.createElement("div");
  content.style.cssText = "background:var(--bg-card, #1a1a1a);padding:24px;border-radius:12px;width:90%;max-width:500px;border:1px solid var(--border);color:white;";

  content.innerHTML = `
    <h3 style="margin-top:0;">🔗 Unir Clientes</h3>
    <p style="color:var(--muted);font-size:13px;">Las órdenes del Cliente B se moverán al Cliente A. El Cliente B quedará marcado como fusionado.</p>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0;">
      <div>
        <label style="color:var(--success);">Cliente A (Principal)</label>
        <input id="mergeClienteA" placeholder="ID o Código" style="width:100%;padding:8px;background:var(--card);border:1px solid var(--border);border-radius:6px;color:white;">
        <div id="infoClienteA" style="font-size:12px;margin-top:4px;color:var(--muted);"></div>
      </div>
      <div>
        <label style="color:var(--danger);">Cliente B (Duplicado)</label>
        <input id="mergeClienteB" placeholder="ID o Código" style="width:100%;padding:8px;background:var(--card);border:1px solid var(--border);border-radius:6px;color:white;">
        <div id="infoClienteB" style="font-size:12px;margin-top:4px;color:var(--muted);"></div>
      </div>
    </div>

    <div style="display:flex;justify-content:flex-end;gap:10px;">
      <button class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove()">Cancelar</button>
      <button class="btn btn-primary" id="btnConfirmarMerge" style="background:var(--success);color:black;">Confirmar Unión</button>
    </div>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  const searchClient = async (idOrCode, targetInfoDiv) => {
    if (!idOrCode) {
      targetInfoDiv.innerHTML = "";
      return null;
    }
    const { listClientesMap } = await import("./work-repository.js");
    const clientes = await listClientesMap();
    
    let cliente = clientes[idOrCode];
    if (!cliente) {
      cliente = Object.values(clientes).find(c => c.clienteCodigo === idOrCode);
    }

    if (cliente) {
      const { findTrabajosByClienteId } = await import("./work-repository.js");
      const trabajos = await findTrabajosByClienteId(cliente.id, state.session?.profile);
      
      targetInfoDiv.innerHTML = `
        <div style="color:white;font-weight:bold;">${cliente.nombre} ${cliente.apellido || ""}</div>
        <div>${cliente.clienteCodigo || "S/C"} | ${trabajos.length} órdenes</div>
      `;
      return cliente.id;
    } else {
      targetInfoDiv.innerHTML = "<span style='color:var(--danger);'>No encontrado</span>";
      return null;
    }
  };

  let clienteAId = null;
  let clienteBId = null;

  content.querySelector("#mergeClienteA").oninput = debounce(async (e) => {
    clienteAId = await searchClient(e.target.value.trim(), content.querySelector("#infoClienteA"));
  }, 500);

  content.querySelector("#mergeClienteB").oninput = debounce(async (e) => {
    clienteBId = await searchClient(e.target.value.trim(), content.querySelector("#infoClienteB"));
  }, 500);

  content.querySelector("#btnConfirmarMerge").onclick = async () => {
    if (!clienteAId || !clienteBId) {
      alert("Por favor selecciona ambos clientes válidos.");
      return;
    }
    if (clienteAId === clienteBId) {
      alert("No puedes unir un cliente consigo mismo.");
      return;
    }

    if (!confirm("¿Estás seguro de que deseas unir estos clientes? Esta acción moverá todas las órdenes del Cliente B al Cliente A.")) {
      return;
    }

    const btn = content.querySelector("#btnConfirmarMerge");
    btn.disabled = true;
    btn.innerText = "Procesando...";

    try {
      const { mergeClientes } = await import("./work-service.js");
      const result = await mergeClientes(clienteAId, clienteBId, state.session?.profile);
      alert(`Éxito. Se movieron ${result.ordenesMovidas} órdenes.`);
      modal.remove();
      await loadDirectorioClientes();
    } catch (error) {
      alert("Error: " + error.message);
      btn.disabled = false;
      btn.innerText = "Confirmar Unión";
    }
  };
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
