/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  COSMICA — Firestore JSON Safety Backup                         ║
 * ║                                                                  ║
 * ║  Exports all critical collections to a single timestamped JSON.  ║
 * ║  Use this BEFORE running any cleanup/migration script.           ║
 * ║                                                                  ║
 * ║  This is NOT a replacement for gcloud firestore export — it is   ║
 * ║  a human-readable JSON dump that you can restore via a custom    ║
 * ║  restore script if Firestore export is unavailable.              ║
 * ║                                                                  ║
 * ║  For full production backup, also run:                           ║
 * ║    gcloud firestore export gs://YOUR-BUCKET/backup-YYYY-MM-DD    ║
 * ║                                                                  ║
 * ║  Usage:                                                          ║
 * ║    node scripts/backup-firestore.mjs                             ║
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

function serializeTimestamps(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(serializeTimestamps);
  if (obj.toDate && typeof obj.toDate === 'function') {
    return { __firestore_timestamp__: obj.toDate().toISOString() };
  }
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = serializeTimestamps(v);
  return out;
}

const BACKUPS_DIR = join(__dirname, 'backups');
if (!existsSync(BACKUPS_DIR)) mkdirSync(BACKUPS_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
const dump = {
  generatedAt: new Date().toISOString(),
  project: serviceAccount.project_id,
  collections: {},
};

console.log(`▶ Backing up project: ${serviceAccount.project_id}`);
for (const col of COLLECTIONS) {
  try {
    const snap = await db.collection(col).get();
    const docs = [];
    // Also pull subcollections for trabajos.history
    for (const doc of snap.docs) {
      const data = serializeTimestamps(doc.data());
      const entry = { id: doc.id, data };
      if (col === 'trabajos') {
        try {
          const histSnap = await doc.ref.collection('history').get();
          entry.history = histSnap.docs.map(h => ({ id: h.id, data: serializeTimestamps(h.data()) }));
        } catch { /* no history is OK */ }
      }
      docs.push(entry);
    }
    dump.collections[col] = docs;
    console.log(`  ${col.padEnd(20)} ${String(docs.length).padStart(6)} docs`);
  } catch (err) {
    dump.collections[col] = { error: err.message };
    console.log(`  ${col.padEnd(20)}  N/A   (${err.code || 'error'})`);
  }
}

const outPath = join(BACKUPS_DIR, `backup-${stamp}.json`);
writeFileSync(outPath, JSON.stringify(dump, null, 2));
console.log(`\n✔ Backup saved: ${outPath}`);
console.log(`  Size: ${(Buffer.byteLength(JSON.stringify(dump)) / 1024 / 1024).toFixed(2)} MB`);
console.log('\n  ⚠ ALSO run: gcloud firestore export gs://YOUR-BUCKET/...');
console.log('    for an authoritative Firestore-native backup.');
process.exit(0);
