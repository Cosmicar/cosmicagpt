/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  COSMICA — Test/Demo Data Cleanup                               ║
 * ║                                                                  ║
 * ║  DEFAULT MODE: --dry-run (no mutations, only reports)            ║
 * ║                                                                  ║
 * ║  Usage:                                                          ║
 * ║    node scripts/cleanup-test-data.mjs               (dry-run)    ║
 * ║    node scripts/cleanup-test-data.mjs --apply       (DESTRUCTIVE)║
 * ║    node scripts/cleanup-test-data.mjs --apply --tickets-only     ║
 * ║                                                                  ║
 * ║  Safety:                                                         ║
 * ║    - Never deletes documents not matching test heuristics        ║
 * ║    - Never deletes admin users                                   ║
 * ║    - Never deletes config documents                              ║
 * ║    - Logs every action to scripts/reports/                       ║
 * ║    - REQUIRES recent backup (refuses --apply otherwise)          ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const APPLY        = args.has('--apply');
const TICKETS_ONLY = args.has('--tickets-only');
const CLIENTS_ONLY = args.has('--clients-only');
const USERS_ONLY   = args.has('--users-only');
const SCOPE_ALL    = !TICKETS_ONLY && !CLIENTS_ONLY && !USERS_ONLY;

const SA_PATH = join(__dirname, 'service-account.json');
if (!existsSync(SA_PATH)) {
  console.error('❌ Missing scripts/service-account.json');
  process.exit(1);
}

// ── SAFETY GATE: require a recent backup before --apply ──────────────────
function findRecentBackup() {
  const backupsDir = join(__dirname, 'backups');
  if (!existsSync(backupsDir)) return null;
  const files = readdirSync(backupsDir).filter(f => f.startsWith('backup-') && f.endsWith('.json'));
  if (!files.length) return null;
  const latest = files
    .map(f => ({ f, mtime: statSync(join(backupsDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0];
  const ageHours = (Date.now() - latest.mtime) / 3_600_000;
  return { name: latest.f, ageHours };
}

if (APPLY) {
  const backup = findRecentBackup();
  if (!backup) {
    console.error('❌ --apply requires a recent backup in scripts/backups/');
    console.error('   Run: node scripts/backup-firestore.mjs');
    process.exit(1);
  }
  if (backup.ageHours > 24) {
    console.error(`❌ Latest backup is ${backup.ageHours.toFixed(1)}h old (>24h).`);
    console.error('   Re-run: node scripts/backup-firestore.mjs');
    process.exit(1);
  }
  console.log(`✔ Backup safety gate passed: ${backup.name} (${backup.ageHours.toFixed(1)}h old)\n`);
}

const serviceAccount = JSON.parse(readFileSync(SA_PATH, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Heuristics (kept conservative — false positives are safer than data loss) ──
const TEST_EMAIL_PATTERNS = [/test/i, /^a@/i, /^demo@/i, /sample@/i, /example\.com$/i];
const TEST_NAME_EXACT = new Set(['test', 'demo', 'prueba', 'ejemplo', 'lorem', 'ipsum', 'asdf', 'qwer', 'xxxx', 'aaaa']);
const PROTECTED_ROLES = new Set(['admin', 'tester']);

function isTestEmail(s) {
  if (!s) return false;
  return TEST_EMAIL_PATTERNS.some(rx => rx.test(s));
}
function isTestNameExact(s) {
  if (!s) return false;
  return TEST_NAME_EXACT.has(String(s).toLowerCase().trim());
}

const log = {
  startedAt: new Date().toISOString(),
  mode: APPLY ? 'APPLY' : 'DRY-RUN',
  scope: { all: SCOPE_ALL, tickets: TICKETS_ONLY, clients: CLIENTS_ONLY, users: USERS_ONLY },
  toDelete: { trabajos: [], clientes: [], usuarios: [] },
  skipped:  { protectedUsers: [], hasRealActivity: [] },
  errors: [],
};

console.log(`▶ Cleanup mode: ${APPLY ? '🔴 APPLY (destructive)' : '🟢 DRY-RUN (safe)'}`);
console.log(`▶ Scope:        ${SCOPE_ALL ? 'all collections' : Object.keys(log.scope).filter(k => log.scope[k]).join(', ')}\n`);

// ── Identify test trabajos ───────────────────────────────────────────────
if (SCOPE_ALL || TICKETS_ONLY) {
  console.log('▶ Scanning trabajos for test patterns...');
  const snap = await db.collection('trabajos').get();
  snap.forEach(doc => {
    const d = doc.data();
    if (isTestNameExact(d.nombre) || isTestNameExact(d.equipo) || isTestNameExact(d.problema)) {
      log.toDelete.trabajos.push({
        id: doc.id,
        numeroOrden: d.numeroOrden,
        nombre: d.nombre,
        equipo: d.equipo,
        problema: d.problema,
        estado: d.estado,
        reason: 'exact-name-match',
      });
    }
  });
  console.log(`  ${log.toDelete.trabajos.length} test trabajos identified\n`);
}

// ── Identify test clientes (but skip if they have non-test trabajos) ─────
if (SCOPE_ALL || CLIENTS_ONLY) {
  console.log('▶ Scanning clientes for test patterns...');
  const clientesSnap = await db.collection('clientes').get();

  // Index of clienteId → ticket count (to avoid deleting clients with real history)
  const ticketsSnap = await db.collection('trabajos').get();
  const ticketsByClient = new Map();
  ticketsSnap.forEach(d => {
    const cid = d.data().clienteId;
    if (cid) ticketsByClient.set(cid, (ticketsByClient.get(cid) || 0) + 1);
  });

  clientesSnap.forEach(doc => {
    const d = doc.data();
    const matchesTest = isTestNameExact(d.nombre) || isTestEmail(d.email);
    if (!matchesTest) return;

    const ticketCount = ticketsByClient.get(doc.id) || 0;
    if (ticketCount > 0) {
      log.skipped.hasRealActivity.push({
        id: doc.id, nombre: d.nombre, email: d.email, ticketsLinked: ticketCount,
      });
      return;
    }

    log.toDelete.clientes.push({
      id: doc.id, nombre: d.nombre, apellido: d.apellido, email: d.email,
      reason: 'exact-name-match + zero-tickets',
    });
  });
  console.log(`  ${log.toDelete.clientes.length} test clientes identified`);
  console.log(`  ${log.skipped.hasRealActivity.length} candidates skipped (have linked tickets)\n`);
}

// ── Identify test usuarios (NEVER delete admin/tester) ──────────────────
if (SCOPE_ALL || USERS_ONLY) {
  console.log('▶ Scanning usuarios for test patterns...');
  const snap = await db.collection('usuarios').get();
  snap.forEach(doc => {
    const d = doc.data();
    if (PROTECTED_ROLES.has(d.rol)) {
      log.skipped.protectedUsers.push({ id: doc.id, email: d.email, rol: d.rol });
      return;
    }
    if (isTestEmail(d.email) || isTestNameExact(d.nombre)) {
      log.toDelete.usuarios.push({
        id: doc.id, email: d.email, nombre: d.nombre, rol: d.rol,
        reason: 'test-pattern + non-admin',
      });
    }
  });
  console.log(`  ${log.toDelete.usuarios.length} test usuarios identified`);
  console.log(`  ${log.skipped.protectedUsers.length} admin/tester users skipped\n`);
}

// ── Summary ──────────────────────────────────────────────────────────────
const total = log.toDelete.trabajos.length + log.toDelete.clientes.length + log.toDelete.usuarios.length;
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Total candidate deletions: ${total}`);
console.log(`    trabajos:  ${log.toDelete.trabajos.length}`);
console.log(`    clientes:  ${log.toDelete.clientes.length}`);
console.log(`    usuarios:  ${log.toDelete.usuarios.length}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ── Apply or skip ────────────────────────────────────────────────────────
if (!APPLY) {
  console.log('\n  This was a DRY-RUN. No documents were deleted.');
  console.log('  Review the report below, ensure a fresh backup, then re-run with --apply.\n');
} else {
  console.log('\n  ⚠  Executing deletions in 5 seconds. CTRL+C to abort.');
  await new Promise(r => setTimeout(r, 5_000));

  const deleteBatch = async (col, items) => {
    let done = 0;
    for (const item of items) {
      try {
        // For trabajos: delete history subcollection first
        if (col === 'trabajos') {
          const histRef = db.collection(col).doc(item.id).collection('history');
          const histSnap = await histRef.get();
          const histBatch = db.batch();
          histSnap.docs.forEach(h => histBatch.delete(h.ref));
          if (histSnap.size > 0) await histBatch.commit();
        }
        await db.collection(col).doc(item.id).delete();
        done++;
      } catch (err) {
        log.errors.push({ col, id: item.id, error: err.message });
      }
    }
    return done;
  };

  if (log.toDelete.trabajos.length) {
    const n = await deleteBatch('trabajos', log.toDelete.trabajos);
    console.log(`  ✔ Deleted ${n}/${log.toDelete.trabajos.length} trabajos`);
  }
  if (log.toDelete.clientes.length) {
    const n = await deleteBatch('clientes', log.toDelete.clientes);
    console.log(`  ✔ Deleted ${n}/${log.toDelete.clientes.length} clientes`);
  }
  if (log.toDelete.usuarios.length) {
    const n = await deleteBatch('usuarios', log.toDelete.usuarios);
    console.log(`  ✔ Deleted ${n}/${log.toDelete.usuarios.length} usuarios`);
  }
}

// ── Write report ─────────────────────────────────────────────────────────
const REPORTS_DIR = join(__dirname, 'reports');
if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
const reportPath = join(REPORTS_DIR, `cleanup-${log.mode.toLowerCase()}-${stamp}.json`);
log.completedAt = new Date().toISOString();
writeFileSync(reportPath, JSON.stringify(log, null, 2));
console.log(`\n✔ Report saved: ${reportPath}`);
process.exit(0);
