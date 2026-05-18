/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  COSMICA — Firestore Production Audit                           ║
 * ║  READ-ONLY. Does NOT modify any document.                       ║
 * ║                                                                  ║
 * ║  Usage:                                                          ║
 * ║    1. Download service-account.json from Firebase Console        ║
 * ║       (Project Settings → Service Accounts → Generate New Key)   ║
 * ║    2. Save it as scripts/service-account.json (gitignored)       ║
 * ║    3. Run:  node scripts/audit-firestore.mjs                     ║
 * ║                                                                  ║
 * ║  The script writes:                                              ║
 * ║    - scripts/reports/audit-YYYYMMDD-HHmm.json                    ║
 * ║    - scripts/reports/audit-YYYYMMDD-HHmm.txt   (human-readable)  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SA_PATH = join(__dirname, 'service-account.json');

if (!existsSync(SA_PATH)) {
  console.error('❌ Missing scripts/service-account.json');
  console.error('   1. Firebase Console → Project Settings → Service Accounts');
  console.error('   2. Generate New Private Key → save as scripts/service-account.json');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(SA_PATH, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const COLLECTIONS = [
  'usuarios', 'clientes', 'trabajos', 'ordenesPublicas',
  'config', 'productos', 'ventas', 'movimientos_stock',
  'inventario', 'caja', 'cajaSesiones',
];

// Heuristics for spotting development/test data
const TEST_EMAIL_PATTERNS = [/test/i, /demo/i, /prueba/i, /ejemplo/i, /^a@/i, /^test@/i, /sample/i];
const TEST_NAME_PATTERNS = [/^test/i, /^demo/i, /^prueba/i, /^ejemplo/i, /^lorem/i, /^ipsum/i, /^x{2,}$/i, /^asdf/i, /^qwer/i];

const VALID_STATUSES = new Set([
  'Ingresado', 'En reparación', 'Esperando repuesto', 'Listo', 'Entregado', 'Reingresada',
]);

function isTestEmail(s) {
  if (!s) return false;
  return TEST_EMAIL_PATTERNS.some(rx => rx.test(s));
}
function isTestName(s) {
  if (!s) return false;
  return TEST_NAME_PATTERNS.some(rx => rx.test(s));
}
function isValidTimestamp(ts) {
  if (!ts) return false;
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (Number.isNaN(d.getTime())) return false;
    if (d.getFullYear() < 2020 || d.getFullYear() > 2100) return false;
    return true;
  } catch { return false; }
}

const report = {
  generatedAt: new Date().toISOString(),
  project: serviceAccount.project_id,
  collections: {},
  inconsistencies: {
    tickets_without_client_ref: [],
    tickets_with_invalid_status: [],
    tickets_with_invalid_timestamp: [],
    tickets_orphaned_clienteId: [],
    clients_without_phone: [],
    clients_duplicate_dni: [],
    clients_duplicate_phone: [],
    suspicious_test_users: [],
    suspicious_test_clients: [],
    suspicious_test_tickets: [],
    cajaSesiones_open_count: 0,
    cajaSesiones_open_old_days: [],
    reingreso_broken_chains: [],
  },
  totals: {},
  risks: [],
};

console.log(`▶ Auditing project: ${serviceAccount.project_id}`);
console.log(`▶ Collections: ${COLLECTIONS.join(', ')}\n`);

// ── 1. Collection counts ─────────────────────────────────────────────────
for (const col of COLLECTIONS) {
  try {
    const snap = await db.collection(col).count().get();
    const count = snap.data().count;
    report.collections[col] = { exists: true, documentCount: count };
    console.log(`  ${col.padEnd(20)} ${String(count).padStart(6)} docs`);
  } catch (err) {
    report.collections[col] = { exists: false, error: err.message };
    console.log(`  ${col.padEnd(20)}  N/A   (${err.code || 'error'})`);
  }
}
report.totals.totalCollections = COLLECTIONS.length;

// ── 2. Build clientes index for ticket cross-checking ────────────────────
console.log('\n▶ Loading clientes index...');
const clientesById = new Map();
const clientesByDni = new Map();
const clientesByTelefono = new Map();

try {
  const clientesSnap = await db.collection('clientes').get();
  clientesSnap.forEach(doc => {
    const data = doc.data();
    clientesById.set(doc.id, data);

    // Duplicate detection
    if (data.dni) {
      const list = clientesByDni.get(data.dni) || [];
      list.push({ id: doc.id, ...data });
      clientesByDni.set(data.dni, list);
    }
    if (data.telefono) {
      const tel = String(data.telefono).replace(/\D/g, '');
      const list = clientesByTelefono.get(tel) || [];
      list.push({ id: doc.id, ...data });
      clientesByTelefono.set(tel, list);
    }

    // Heuristics
    if (isTestName(data.nombre) || isTestEmail(data.email)) {
      report.inconsistencies.suspicious_test_clients.push({
        id: doc.id, nombre: data.nombre, apellido: data.apellido, email: data.email,
      });
    }
    if (!data.telefono) {
      report.inconsistencies.clients_without_phone.push({ id: doc.id, nombre: data.nombre });
    }
  });

  // Mark duplicates
  for (const [dni, list] of clientesByDni) {
    if (list.length > 1) {
      report.inconsistencies.clients_duplicate_dni.push({
        dni, count: list.length, ids: list.map(c => c.id),
      });
    }
  }
  for (const [tel, list] of clientesByTelefono) {
    if (list.length > 1) {
      report.inconsistencies.clients_duplicate_phone.push({
        telefono: tel, count: list.length, ids: list.map(c => c.id),
      });
    }
  }
  console.log(`  loaded ${clientesById.size} clientes`);
} catch (err) {
  report.risks.push(`Failed to load clientes: ${err.message}`);
}

// ── 3. Audit tickets/trabajos ────────────────────────────────────────────
console.log('\n▶ Auditing trabajos...');
try {
  const trabajosSnap = await db.collection('trabajos').get();
  const ticketsById = new Map();
  trabajosSnap.forEach(doc => {
    const data = doc.data();
    ticketsById.set(doc.id, data);

    // Missing client relation
    if (!data.clienteId) {
      report.inconsistencies.tickets_without_client_ref.push({
        id: doc.id, numeroOrden: data.numeroOrden, nombre: data.nombre,
      });
    } else if (!clientesById.has(data.clienteId)) {
      report.inconsistencies.tickets_orphaned_clienteId.push({
        id: doc.id, numeroOrden: data.numeroOrden, clienteId: data.clienteId,
      });
    }

    // Invalid status
    if (data.estado && !VALID_STATUSES.has(data.estado)) {
      report.inconsistencies.tickets_with_invalid_status.push({
        id: doc.id, numeroOrden: data.numeroOrden, estado: data.estado,
      });
    }

    // Invalid timestamps
    if (data.fechaIngreso && !isValidTimestamp(data.fechaIngreso)) {
      report.inconsistencies.tickets_with_invalid_timestamp.push({
        id: doc.id, field: 'fechaIngreso', value: String(data.fechaIngreso),
      });
    }

    // Test data heuristics
    if (isTestName(data.nombre) || isTestName(data.problema) || isTestName(data.equipo)) {
      report.inconsistencies.suspicious_test_tickets.push({
        id: doc.id, numeroOrden: data.numeroOrden, nombre: data.nombre,
        equipo: data.equipo, problema: data.problema,
      });
    }
  });

  // Reingreso chain integrity
  trabajosSnap.forEach(doc => {
    const data = doc.data();
    if (data.reingresoDe && !ticketsById.has(data.reingresoDe)) {
      report.inconsistencies.reingreso_broken_chains.push({
        ticketId: doc.id, missingParent: data.reingresoDe,
      });
    }
  });

  console.log(`  scanned ${ticketsById.size} trabajos`);
} catch (err) {
  report.risks.push(`Failed to audit trabajos: ${err.message}`);
}

// ── 4. Audit usuarios ───────────────────────────────────────────────────
console.log('\n▶ Auditing usuarios...');
try {
  const usersSnap = await db.collection('usuarios').get();
  usersSnap.forEach(doc => {
    const data = doc.data();
    if (isTestEmail(data.email) || isTestName(data.nombre)) {
      report.inconsistencies.suspicious_test_users.push({
        id: doc.id, email: data.email, nombre: data.nombre, rol: data.rol,
      });
    }
  });
  console.log(`  scanned ${usersSnap.size} usuarios`);
} catch (err) {
  report.risks.push(`Failed to audit usuarios: ${err.message}`);
}

// ── 5. Audit cajaSesiones ───────────────────────────────────────────────
console.log('\n▶ Auditing cajaSesiones...');
try {
  const sessionsSnap = await db.collection('cajaSesiones').where('estado', '==', 'abierta').get();
  report.inconsistencies.cajaSesiones_open_count = sessionsSnap.size;

  const now = Date.now();
  sessionsSnap.forEach(doc => {
    const data = doc.data();
    const opened = data.openedAt?.toDate ? data.openedAt.toDate().getTime() : new Date(data.openedAt || 0).getTime();
    const daysOpen = Math.floor((now - opened) / 86_400_000);
    if (daysOpen > 1) {
      report.inconsistencies.cajaSesiones_open_old_days.push({
        id: doc.id, openedBy: data.openedByName, daysOpen,
      });
    }
  });
  console.log(`  ${sessionsSnap.size} open sessions found`);
} catch (err) {
  report.risks.push(`Failed to audit cajaSesiones: ${err.message}`);
}

// ── 6. Build human-readable summary ──────────────────────────────────────
const lines = [];
lines.push('═══════════════════════════════════════════════════════════════');
lines.push('  COSMICA — Firestore Audit Report');
lines.push(`  ${report.generatedAt}`);
lines.push(`  Project: ${report.project}`);
lines.push('═══════════════════════════════════════════════════════════════');
lines.push('');
lines.push('━━ COLLECTIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
for (const [col, info] of Object.entries(report.collections)) {
  if (info.exists) lines.push(`  ${col.padEnd(22)} ${String(info.documentCount).padStart(6)} docs`);
  else lines.push(`  ${col.padEnd(22)}  N/A   (${info.error || 'missing'})`);
}
lines.push('');
lines.push('━━ INCONSISTENCIES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const inc = report.inconsistencies;
lines.push(`  Tickets sin clienteId:               ${inc.tickets_without_client_ref.length}`);
lines.push(`  Tickets con clienteId huérfano:      ${inc.tickets_orphaned_clienteId.length}`);
lines.push(`  Tickets con estado inválido:         ${inc.tickets_with_invalid_status.length}`);
lines.push(`  Tickets con timestamp inválido:      ${inc.tickets_with_invalid_timestamp.length}`);
lines.push(`  Reingresos con cadena rota:          ${inc.reingreso_broken_chains.length}`);
lines.push(`  Clientes sin teléfono:               ${inc.clients_without_phone.length}`);
lines.push(`  DNIs duplicados:                     ${inc.clients_duplicate_dni.length}`);
lines.push(`  Teléfonos duplicados:                ${inc.clients_duplicate_phone.length}`);
lines.push(`  Cajas abiertas > 1 día:              ${inc.cajaSesiones_open_old_days.length}`);
lines.push('');
lines.push('━━ TEST/DEMO DATA (cleanup candidates) ━━━━━━━━━━━━━━━━━━━━━━');
lines.push(`  Usuarios sospechosos test/demo:      ${inc.suspicious_test_users.length}`);
lines.push(`  Clientes sospechosos test/demo:      ${inc.suspicious_test_clients.length}`);
lines.push(`  Tickets sospechosos test/demo:       ${inc.suspicious_test_tickets.length}`);
lines.push('');
if (report.risks.length) {
  lines.push('━━ RISKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  report.risks.forEach(r => lines.push(`  ⚠  ${r}`));
  lines.push('');
}
lines.push('━━ NEXT STEPS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
lines.push('  1. Review the JSON report for detailed items.');
lines.push('  2. Run: node scripts/cleanup-test-data.mjs --dry-run');
lines.push('  3. Backup: node scripts/backup-firestore.mjs');
lines.push('  4. Apply: node scripts/cleanup-test-data.mjs --apply');
lines.push('');

// ── 7. Write reports ─────────────────────────────────────────────────────
const REPORTS_DIR = join(__dirname, 'reports');
if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);

writeFileSync(join(REPORTS_DIR, `audit-${stamp}.json`), JSON.stringify(report, null, 2));
writeFileSync(join(REPORTS_DIR, `audit-${stamp}.txt`), lines.join('\n'));

console.log('\n' + lines.join('\n'));
console.log(`\n✔ Reports written to scripts/reports/audit-${stamp}.{json,txt}`);
process.exit(0);
