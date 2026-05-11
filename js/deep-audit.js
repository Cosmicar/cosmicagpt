/**
 * deep-audit.js — Auditoría profunda de integridad Firestore
 * 
 * MODO: auditOnly = true
 * NO borra. NO modifica. NO mergea.
 * Solo detecta, lista, simula y reporta.
 */

import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { COLLECTIONS, WORK_STATUS } from "./domain.js";
import { logSystem } from "./system-service.js";

const auditOnly = true; // NUNCA cambiar a false sin backup previo

function log(category, severity, message, data = null) {
  const entry = { category, severity, message, data, timestamp: new Date().toISOString() };
  console.log(`[AUDIT][${severity}][${category}] ${message}`, data || "");
  return entry;
}

export async function ejecutarAuditoriaProfunda() {
  const findings = [];
  const f = (cat, sev, msg, data) => findings.push(log(cat, sev, msg, data));

  console.log("═══════════════════════════════════════════════");
  console.log("  AUDITORÍA PROFUNDA CÓSMICA — auditOnly=true");
  console.log("═══════════════════════════════════════════════");

  // ── 1. Cargar todos los datos ──────────────────────────────
  const [clientesSnap, trabajosSnap, productosSnap, ventasSnap, movimientosSnap] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.clientes)),
    getDocs(collection(db, COLLECTIONS.trabajos)),
    getDocs(collection(db, COLLECTIONS.productos)),
    getDocs(collection(db, COLLECTIONS.ventas)),
    getDocs(collection(db, COLLECTIONS.movimientos_stock))
  ]);

  const clientes = clientesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const trabajos = trabajosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const productos = productosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const ventas = ventasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const movimientos = movimientosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`\nDatos cargados: ${clientes.length} clientes, ${trabajos.length} trabajos, ${productos.length} productos, ${ventas.length} ventas, ${movimientos.length} movimientos\n`);

  // ── 2. AUDITORÍA DE CLIENTES ───────────────────────────────
  console.log("\n── CLIENTES ──────────────────────────────────");

  // 2.1 DNI duplicados
  const dniMap = {};
  for (const c of clientes) {
    const dni = (c.dni || "").trim();
    if (!dni) continue;
    if (!dniMap[dni]) dniMap[dni] = [];
    dniMap[dni].push(c);
  }
  for (const [dni, arr] of Object.entries(dniMap)) {
    if (arr.length > 1) {
      f("CLIENTES", "CRITICO", `DNI duplicado: ${dni}`, {
        dni,
        clientes: arr.map(c => ({ id: c.id, nombre: `${c.nombre} ${c.apellido}`, telefono: c.telefono }))
      });
    }
  }

  // 2.2 Teléfono duplicado (si DNI vacío)
  const telMap = {};
  for (const c of clientes) {
    const tel = (c.telefono || "").trim();
    if (!tel) continue;
    if (!telMap[tel]) telMap[tel] = [];
    telMap[tel].push(c);
  }
  for (const [tel, arr] of Object.entries(telMap)) {
    if (arr.length > 1) {
      f("CLIENTES", "MEDIO", `Teléfono duplicado: ${tel}`, {
        telefono: tel,
        clientes: arr.map(c => ({ id: c.id, nombre: `${c.nombre} ${c.apellido}`, dni: c.dni }))
      });
    }
  }

  // 2.3 Clientes sin datos válidos
  for (const c of clientes) {
    if (!c.nombre || !c.nombre.trim()) {
      f("CLIENTES", "MEDIO", `Cliente sin nombre`, { id: c.id, data: c });
    }
    if (!c.telefono || !c.telefono.trim()) {
      f("CLIENTES", "BAJO", `Cliente sin teléfono`, { id: c.id, nombre: `${c.nombre} ${c.apellido}` });
    }
  }

  // 2.4 Clientes huérfanos (sin órdenes)
  const clienteIdsConOrdenes = new Set(trabajos.map(t => t.clienteId));
  const clientesHuerfanos = clientes.filter(c => !clienteIdsConOrdenes.has(c.id));
  if (clientesHuerfanos.length > 0) {
    f("CLIENTES", "BAJO", `${clientesHuerfanos.length} clientes huérfanos (sin órdenes)`, {
      ids: clientesHuerfanos.map(c => ({ id: c.id, nombre: `${c.nombre} ${c.apellido}` }))
    });
  }

  // ── 3. AUDITORÍA DE ÓRDENES ────────────────────────────────
  console.log("\n── ÓRDENES ───────────────────────────────────");

  // 3.1 Números de orden duplicados
  const ordenMap = {};
  for (const t of trabajos) {
    const num = t.numeroOrden;
    if (!num) continue;
    if (!ordenMap[num]) ordenMap[num] = [];
    ordenMap[num].push(t);
  }
  for (const [num, arr] of Object.entries(ordenMap)) {
    if (arr.length > 1) {
      f("ORDENES", "CRITICO", `Orden duplicada: ${num}`, {
        numeroOrden: num,
        ordenes: arr.map(t => ({ id: t.id, clienteId: t.clienteId, estado: t.estado, equipo: t.equipo }))
      });
    }
  }

  // 3.2 clienteId inválidos
  const clienteIdsValidos = new Set(clientes.map(c => c.id));
  for (const t of trabajos) {
    if (!t.clienteId || !clienteIdsValidos.has(t.clienteId)) {
      f("ORDENES", "CRITICO", `Orden con clienteId inválido: ${t.numeroOrden}`, {
        id: t.id, numeroOrden: t.numeroOrden, clienteId: t.clienteId, estado: t.estado
      });
    }
  }

  // 3.3 Estados inconsistentes
  const estadosValidos = Object.values(WORK_STATUS);
  for (const t of trabajos) {
    if (!estadosValidos.includes(t.estado)) {
      f("ORDENES", "MEDIO", `Estado inválido en orden: ${t.numeroOrden}`, {
        id: t.id, estado: t.estado, estadosValidos
      });
    }
  }

  // 3.4 Huecos en numeración
  const remNums = [], talNums = [];
  for (const t of trabajos) {
    const num = t.numeroOrden || "";
    const match = num.match(/^(REM|TAL)-(\d+)$/);
    if (match) {
      (match[1] === "REM" ? remNums : talNums).push(parseInt(match[2], 10));
    }
  }
  [{ label: "REM", nums: remNums }, { label: "TAL", nums: talNums }].forEach(({ label, nums }) => {
    nums.sort((a, b) => a - b);
    const huecos = [];
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] - nums[i - 1] > 1) {
        for (let h = nums[i - 1] + 1; h < nums[i]; h++) {
          huecos.push(`${label}-${String(h).padStart(4, "0")}`);
        }
      }
    }
    if (huecos.length > 0) {
      f("ORDENES", "MEDIO", `Huecos en numeración ${label}`, { huecos, total: huecos.length });
    }
  });

  // 3.5 Verificar contadores config/ordenes
  try {
    const counterSnap = await getDoc(doc(db, COLLECTIONS.config, "ordenes"));
    const counterData = counterSnap.exists() ? counterSnap.data() : {};
    const maxRem = remNums.length > 0 ? Math.max(...remNums) : 0;
    const maxTal = talNums.length > 0 ? Math.max(...talNums) : 0;

    if ((counterData.remoto || 0) !== maxRem) {
      f("ORDENES", "CRITICO", `Contador REM desincronizado`, {
        counterFirestore: counterData.remoto, maxReal: maxRem
      });
    }
    if ((counterData.taller || 0) !== maxTal) {
      f("ORDENES", "CRITICO", `Contador TAL desincronizado`, {
        counterFirestore: counterData.taller, maxReal: maxTal
      });
    }
  } catch (e) {
    f("ORDENES", "CRITICO", `No se pudo leer config/ordenes`, { error: e.message });
  }

  // 3.6 Reingresos huérfanos
  for (const t of trabajos) {
    if (t.reingreso && t.ordenOriginal) {
      const original = trabajos.find(o => o.numeroOrden === t.ordenOriginal);
      if (!original) {
        f("ORDENES", "MEDIO", `Reingreso huérfano: ${t.numeroOrden} referencia a ${t.ordenOriginal} que no existe`, {
          id: t.id, numeroOrden: t.numeroOrden, ordenOriginal: t.ordenOriginal
        });
      }
    }
  }

  // ── 4. CASOS CRÍTICOS: REM-0030 a REM-0035 ────────────────
  console.log("\n── CASOS CRÍTICOS ────────────────────────────");

  const casosCriticos = ["REM-0030", "REM-0031", "REM-0032", "REM-0033", "REM-0034", "REM-0035"];
  for (const orden of casosCriticos) {
    const matches = trabajos.filter(t => t.numeroOrden === orden);
    if (matches.length === 0) {
      f("CASO_CRITICO", "INFO", `${orden}: No encontrada (posible hueco de numeración)`);
    } else if (matches.length === 1) {
      const t = matches[0];
      const cliente = clientes.find(c => c.id === t.clienteId);
      f("CASO_CRITICO", "INFO", `${orden}: OK`, {
        id: t.id, estado: t.estado, equipo: t.equipo,
        cliente: cliente ? `${cliente.nombre} ${cliente.apellido}` : `ROTO (${t.clienteId})`,
        reingreso: t.reingreso || false, ordenOriginal: t.ordenOriginal || null
      });
    } else {
      f("CASO_CRITICO", "CRITICO", `${orden}: DUPLICADA (${matches.length} copias)`, {
        copias: matches.map(t => ({ id: t.id, clienteId: t.clienteId, estado: t.estado }))
      });
    }
  }

  // ── 5. CASO: Bruno Duarte ──────────────────────────────────
  console.log("\n── CASO BRUNO DUARTE ─────────────────────────");

  const brunos = clientes.filter(c =>
    (c.nombre || "").toLowerCase().includes("bruno") &&
    (c.apellido || "").toLowerCase().includes("duarte")
  );
  if (brunos.length === 0) {
    f("CASO_CRITICO", "INFO", "Bruno Duarte: No encontrado en clientes");
  } else {
    for (const b of brunos) {
      const ordenesBruno = trabajos.filter(t => t.clienteId === b.id);
      f("CASO_CRITICO", brunos.length > 1 ? "CRITICO" : "INFO",
        `Bruno Duarte: Cliente encontrado (${brunos.length > 1 ? "POSIBLE DUPLICADO" : "único"})`, {
        clienteId: b.id, nombre: b.nombre, apellido: b.apellido, dni: b.dni, telefono: b.telefono,
        ordenes: ordenesBruno.map(t => ({
          id: t.id, numeroOrden: t.numeroOrden, estado: t.estado, equipo: t.equipo, reingreso: t.reingreso
        }))
      });
    }
  }

  // ── 6. AUDITORÍA INVENTARIO ────────────────────────────────
  console.log("\n── INVENTARIO ────────────────────────────────");

  // 6.1 Stock negativo
  for (const p of productos) {
    if ((p.stock || 0) < 0) {
      f("INVENTARIO", "CRITICO", `Stock negativo: ${p.nombre}`, {
        id: p.id, sku: p.sku, stock: p.stock
      });
    }
  }

  // 6.2 Movimientos inconsistentes (recalcular stock esperado)
  const stockCalculado = {};
  for (const m of movimientos) {
    if (!stockCalculado[m.productoId]) stockCalculado[m.productoId] = 0;
    const cant = Number(m.cantidad || 0);
    if (["ingreso", "devolucion"].includes(m.tipo)) {
      stockCalculado[m.productoId] += cant;
    } else if (["salida", "venta", "reparacion"].includes(m.tipo)) {
      stockCalculado[m.productoId] -= cant;
    } else if (m.tipo === "ajuste") {
      stockCalculado[m.productoId] += cant; // ajuste puede ser +/-
    }
    // reserva no cambia stock
  }

  for (const p of productos) {
    const esperado = stockCalculado[p.id] || 0;
    const actual = p.stock || 0;
    if (actual !== esperado) {
      f("INVENTARIO", "MEDIO", `Stock desincronizado: ${p.nombre}`, {
        id: p.id, sku: p.sku, stockActual: actual, stockCalculado: esperado,
        diferencia: actual - esperado
      });
    }
  }

  // ── 7. AUDITORÍA VENTAS ────────────────────────────────────
  console.log("\n── VENTAS ────────────────────────────────────");

  for (const v of ventas) {
    if (!v.items || v.items.length === 0) {
      f("VENTAS", "MEDIO", `Venta sin items`, { id: v.id, fecha: v.fecha, total: v.total });
    }
    if (!v.total || v.total <= 0) {
      f("VENTAS", "BAJO", `Venta con total $0 o negativo`, { id: v.id, fecha: v.fecha, total: v.total });
    }
  }

  // ── 8. RESUMEN ─────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════");
  console.log("  RESUMEN DE HALLAZGOS");
  console.log("═══════════════════════════════════════════════");

  const bySeverity = { CRITICO: 0, MEDIO: 0, BAJO: 0, INFO: 0 };
  findings.forEach(f => { bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1; });

  console.log(`🔴 CRÍTICOS: ${bySeverity.CRITICO}`);
  console.log(`🟡 MEDIOS:   ${bySeverity.MEDIO}`);
  console.log(`🟢 BAJOS:    ${bySeverity.BAJO}`);
  console.log(`ℹ️  INFO:     ${bySeverity.INFO}`);
  console.log(`\nTotal hallazgos: ${findings.length}`);
  console.log("═══════════════════════════════════════════════\n");

  // Registrar en system_logs para trazabilidad
  await logSystem("deep_audit_ejecutada", {
    totalHallazgos: findings.length,
    criticos: bySeverity.CRITICO,
    medios: bySeverity.MEDIO,
    bajos: bySeverity.BAJO,
    auditOnly
  }).catch(() => {});

  return { findings, summary: bySeverity, auditOnly };
}
