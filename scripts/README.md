# Cósmica — Production Scripts

Tooling para la transición de **legacy → SaaS oficial**. Todos los scripts son
ejecutables localmente con Node.js + Firebase Admin SDK, **sin desplegar nada**.

## Setup (una vez)

1. **Service Account JSON**
   - Firebase Console → ⚙ Project Settings → Service Accounts
   - "Generate New Private Key" → guardá el JSON como `scripts/service-account.json`
   - **NUNCA** lo commitees (ya está en `.gitignore`)

2. **Dependencias**
   ```bash
   npm install firebase-admin
   ```

3. **Verificá el proyecto**
   ```bash
   node scripts/audit-firestore.mjs
   ```
   Debe imprimir `Auditing project: cosmica-clientes` al inicio.

## Scripts disponibles

| Script | Modo default | Mutaciones |
|--------|-------------|------------|
| `audit-firestore.mjs` | read-only | ❌ Nunca |
| `backup-firestore.mjs` | read-only | ❌ Nunca |
| `cleanup-test-data.mjs` | **dry-run** | Solo con `--apply` + backup reciente |

## Orden de ejecución recomendado

```bash
# 1. Auditar — entender qué hay en la base
node scripts/audit-firestore.mjs

# 2. Backup JSON local (además del export oficial de gcloud)
node scripts/backup-firestore.mjs

# 3. Backup oficial Firestore (recomendado)
gcloud firestore export gs://YOUR-BUCKET/backup-$(date +%Y%m%d)

# 4. Ver qué borraría el cleanup (sin tocar nada)
node scripts/cleanup-test-data.mjs

# 5. Si todo OK, aplicar
node scripts/cleanup-test-data.mjs --apply
```

## Flags

### `cleanup-test-data.mjs`
- `--dry-run` (default si omitís `--apply`) — solo reporta
- `--apply` — ejecuta deletions; **REQUIERE backup < 24h de antigüedad**
- `--tickets-only` — solo trabajos
- `--clients-only` — solo clientes
- `--users-only` — solo usuarios

## Heurísticas de detección de test/demo data

El cleanup borra **únicamente** documentos que matchean estos patrones:

- **Emails**: `test*`, `a@*`, `demo@*`, `sample@*`, `*@example.com`
- **Nombres exactos** (case-insensitive): `test`, `demo`, `prueba`, `ejemplo`, `lorem`, `ipsum`, `asdf`, `qwer`, `xxxx`, `aaaa`

**Protecciones implementadas:**
- Nunca borra usuarios con rol `admin` o `tester`
- Nunca borra clientes que tengan tickets reales asociados (los marca como `skipped: hasRealActivity`)
- Requiere backup < 24h antes de `--apply`
- Logguea cada operación en `scripts/reports/`

## Reportes generados

```
scripts/
├── reports/
│   ├── audit-2026-05-17T14-30.json    ← detalle completo
│   ├── audit-2026-05-17T14-30.txt     ← resumen legible
│   ├── cleanup-dry-run-...json        ← qué BORRARÍA
│   └── cleanup-apply-...json          ← qué BORRÓ + errores
└── backups/
    └── backup-2026-05-17T14-30.json   ← snapshot completo
```

## Rollback

Ver `MIGRATION_RUNBOOK.md` en la raíz del proyecto para procedimiento completo.

**Quick rollback** (post-cleanup): usá el JSON de `scripts/backups/` para restaurar
manualmente los documentos borrados, o aplicá el export de `gcloud firestore import`.
