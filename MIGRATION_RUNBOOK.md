# Cósmica — Production Migration Runbook

**Versión**: 1.0
**Fecha**: 2026-05-17
**Estado**: Pre-cutover

Esta guía describe el procedimiento operativo para hacer del **SaaS** (`apps/cosmica-app/`)
la plataforma oficial, retirando el **legacy** (`panel.html`) en modo histórico.

---

## 🔑 Hallazgo clave

Legacy y SaaS **comparten la misma instancia de Firestore** (`cosmica-clientes`) y las **mismas colecciones**.
**No hay migración de datos entre bases** — solo:

1. Limpiar datos test/demo de la base compartida
2. Desactivar la UI legacy para escrituras (banner + read-only opcional)
3. Pulir el login del SaaS para producción
4. Garantizar rollback

---

## 📋 Pre-flight checklist

Antes de iniciar el cutover, confirmá:

- [ ] Credenciales `scripts/service-account.json` descargadas y guardadas (NO commit)
- [ ] `npm install firebase-admin` ejecutado
- [ ] Acceso a Firebase Console (`cosmica-clientes`)
- [ ] Acceso a `gcloud` CLI con el proyecto seleccionado
- [ ] Reglas Firestore desplegadas (`firebase deploy --only firestore:rules`)
- [ ] SaaS desplegado en URL final (test que `/apps/cosmica-app/` carga)
- [ ] Avisaste al equipo: ventana de mantenimiento de ~30 minutos

---

## 🚀 Procedimiento (orden estricto)

### Fase 1 — Auditoría pre-migración

```bash
# Sin tocar nada — read-only
node scripts/audit-firestore.mjs
```

**Output esperado**: `scripts/reports/audit-YYYYMMDD-HHmm.{json,txt}` con:
- Conteos por colección
- Tickets sin clienteId
- Tickets con clienteId huérfano
- Tickets con estado/timestamp inválido
- Reingresos con cadena rota
- Clientes sin teléfono
- Duplicados de DNI/teléfono
- Datos sospechosos test/demo
- Cajas abiertas > 1 día

**Acción**: revisá el `.txt`. Si hay > 20 tickets con clienteId huérfano o > 5 cajas abiertas viejas, **NO continúes** — investigá primero.

### Fase 2 — Backups (doble redundancia)

```bash
# (a) Backup JSON local — rápido, human-readable
node scripts/backup-firestore.mjs

# (b) Backup oficial Firestore — autoritativo, restaurable con import
gcloud firestore export gs://cosmica-clientes-backups/backup-$(date +%Y%m%d-%H%M)
```

**Verificá**:
- `scripts/backups/backup-*.json` existe y > 100 KB
- El export de `gcloud` terminó sin error

### Fase 3 — Cleanup test/demo (DRY-RUN primero)

```bash
# Ver QUÉ borraría — sin tocar nada
node scripts/cleanup-test-data.mjs
```

**Revisá** `scripts/reports/cleanup-dry-run-*.json`:
- ¿Los candidatos a borrar son realmente test/demo?
- ¿Algún cliente real está en la lista? Verificá nombre + email + teléfono
- ¿Los `skipped.hasRealActivity` están correctamente protegidos?

**Si todo OK**, aplicá:

```bash
# DESTRUCTIVO — requiere backup < 24h
node scripts/cleanup-test-data.mjs --apply
```

Espera 5 segundos de gracia antes de borrar (CTRL+C aborta). Output: `cleanup-apply-*.json`.

**Si dudás**, usá scopes:

```bash
node scripts/cleanup-test-data.mjs --apply --tickets-only   # Solo trabajos
node scripts/cleanup-test-data.mjs --apply --users-only     # Solo usuarios
node scripts/cleanup-test-data.mjs --apply --clients-only   # Solo clientes
```

### Fase 4 — Activación legacy sunset

El SaaS ya está activo. Tareas:

1. **Banner legacy ya en `panel.html`** — usuarios verán "Sistema migrado a Cósmica App SaaS" con CTA a `/apps/cosmica-app/`
2. **(Opcional)** Si querés bloquear escrituras en legacy:
   - Editá `js/work-service.js` y agregá guard en `createWork`:
     ```js
     export async function createWork(data) {
       throw new Error('Sistema en modo histórico. Usá Cósmica App SaaS para nuevos trabajos.');
     }
     ```
   - Pero esto rompe la migración inversa rápida. **Recomendado**: dejar legacy escribible 7 días, luego bloquear.

### Fase 5 — Verificación operativa (QA)

Abrí el SaaS y verificá:

- [ ] Login funciona con un operador real
- [ ] Dashboard muestra los conteos correctos (Pendientes / En Reparación / Listos / Demorados)
- [ ] Click en KPI Pendientes filtra correctamente la lista
- [ ] Tabla de tickets renderiza sin columnas rotas
- [ ] Tabla de clientes renderiza sin columnas rotas
- [ ] Botón "Fusionar" en clientes **solo visible** para admin/tester
- [ ] Crear un ticket nuevo funciona end-to-end
- [ ] Imprimir ticket no falla
- [ ] Inteligencia Operacional muestra KPIs ejecutivos
- [ ] Donut "Servicios por Provincia" renderiza con segmentos correctos
- [ ] Sidebar compacto persiste entre sesiones
- [ ] PWA instalable en mobile (botón aparece en login)
- [ ] Sin errores `undefined` o `null` visibles en UI
- [ ] Sin errores en DevTools Console
- [ ] Activity feed muestra eventos recientes

### Fase 6 — Confirmación final

Si todo pasa:

- [ ] Comunicá al equipo: **"Cósmica App SaaS es el sistema oficial"**
- [ ] Marcá fecha de "freeze" del legacy (ej. 7 días desde hoy)
- [ ] Programá un segundo audit a las 48h post-cutover para detectar regresiones silenciosas

---

## 🔄 Rollback

### Escenario A: cleanup borró algo de más

```bash
# Restaurar desde JSON local (rápido)
node scripts/restore-from-backup.mjs scripts/backups/backup-YYYYMMDD-HHmm.json
# (Script no implementado en este pase — fácil de armar siguiendo el formato del backup)
```

```bash
# Restaurar desde Firestore export oficial (autoritativo)
gcloud firestore import gs://cosmica-clientes-backups/backup-YYYYMMDD-HHmm
# ⚠ Esto restaura TODA la base, sobrescribiendo cambios posteriores
```

### Escenario B: el SaaS falla en producción

1. **Inmediato**: avisá al equipo que usen el legacy `/panel.html` mientras se investiga
2. El banner legacy es solo decorativo, NO bloquea la operación
3. Identificá el bug en consola del browser → fix → redeploy
4. Si es crítico y no se puede arreglar en < 30 min:
   - Comentá el banner en `panel.html`
   - Comunicá: "Sistema legacy reactivado por mantenimiento del SaaS"

### Escenario C: regla Firestore mal desplegada → permission errors

```bash
git log -- firestore.rules         # ver historial de rules
git checkout HEAD~1 firestore.rules # versión anterior
firebase deploy --only firestore:rules
```

---

## ⚠️ Riesgos detectados (mitigados)

| Riesgo | Mitigación |
|--------|-----------|
| Cleanup borra cliente real | Heurísticas conservadoras (solo matches EXACTOS de nombres comunes test); clientes con tickets se protegen automáticamente |
| Cleanup borra admin | Protected roles (`admin`, `tester`) nunca se borran |
| `--apply` sin backup | Safety gate: requiere backup < 24h en `scripts/backups/` |
| Service account leak | `.gitignore` cubre `service-account.json` |
| Cache stale post-deploy | Service Worker bumpea cache (`v3.x`) en cada release |
| Legacy y SaaS escriben simultáneamente | Aceptable durante ventana de transición; ambos usan mismas colecciones |
| Usuario olvida última email | LoginView recuerda último email exitoso en localStorage |
| Reingresos pierden cadena | Audit detecta `reingreso_broken_chains`; cleanup NUNCA borra trabajos con `reingresoDe` apuntando a docs vivos |
| Cajas abiertas perdidas | Audit reporta `cajaSesiones_open_old_days`; admin debe cerrarlas manualmente antes de migrar |

---

## 📂 Inventario de archivos modificados en este pase

```
scripts/
├── audit-firestore.mjs        ← NEW  (read-only audit)
├── backup-firestore.mjs       ← NEW  (JSON dump)
├── cleanup-test-data.mjs      ← NEW  (dry-run by default)
├── README.md                  ← NEW
└── .gitignore                 ← NEW  (protege service-account.json)

apps/cosmica-app/
├── views/login.js             ← rewritten (production polish, remember email, PWA CTA)
├── index.html                 ← + CSS .login-* (premium login)
└── sw.js                      ← cache bump

panel.html                     ← + banner "Sistema migrado a Cósmica App SaaS"

MIGRATION_RUNBOOK.md           ← THIS FILE
```

Cero modificación a:
- `firestore.rules`
- Lógica de negocio (tickets / clientes / inventario / finanzas services)
- Estructura de colecciones
- Indexes Firestore
- Rutas SaaS
- Auth/session
- Otros views (dashboard / tickets / clientes / inventario / finanzas / configuracion)

---

## 📞 Quick reference

| Comando | Qué hace | Mutaciones |
|---------|----------|-----------|
| `node scripts/audit-firestore.mjs` | Reporte de inconsistencias | ❌ |
| `node scripts/backup-firestore.mjs` | Dump JSON de toda la DB | ❌ |
| `node scripts/cleanup-test-data.mjs` | Lista qué borraría | ❌ |
| `node scripts/cleanup-test-data.mjs --apply` | Borra test/demo | ✅ |
| `gcloud firestore export gs://...` | Backup oficial GCS | ❌ |
| `gcloud firestore import gs://...` | Restaurar export | ✅ |
| `firebase deploy --only firestore:rules` | Deploy reglas | ✅ |

---

**Última recomendación**: hacé un audit hoy. Mirá el reporte. NO borres nada hasta haber revisado item por item lo que el cleanup quiere borrar en modo dry-run. La paranoia operativa salva producción.
