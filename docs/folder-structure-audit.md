# Auditoría de Estructura de Carpetas

## 1. Árbol Resumido de la Estructura Actual

```text
.
├── components/
│   └── ui/               # Archivos CSS para componentes de interfaz.
├── js/
│   ├── Agentes IA/       # Carpeta vacía, nombre con espacios (Inconsistente).
│   └── ...               # Archivos JS con la lógica principal de la app.
├── labs/
│   └── cosmo-cm/         # Módulo experimental Next.js (Movido recientemente).
├── release/
│   ├── app/              # Copia antigua de los archivos de la raíz (Duplicación).
│   ├── backups/          # Guías de respaldo (Markdown), no respaldos reales (Ambiguo).
│   ├── docs/             # Documentación del proyecto.
│   ├── firestore/        # Reglas de Firestore y ejemplos (Duplicación).
│   └── release_notes/    # Notas de versión.
├── styles/               # Archivos CSS globales.
└── [Archivos en la raíz] # HTML, imágenes y configuraciones (Servidos por Netlify).
```

## 2. Problemas Detectados

### Carpetas Duplicadas / Redundantes
- **`release/app`**: Contiene una copia casi idéntica de los archivos de la raíz (HTML, JS, imágenes). Al comparar tamaños, se observa que los archivos en `js/` de la raíz son más recientes y grandes que los de `release/app/js/`. Esto sugiere que `release/app` es un snapshot antiguo y genera confusión sobre la fuente de verdad.
- **`release/firestore/firestore.rules`**: Este archivo es idéntico al `firestore.rules` que se encuentra en la raíz del proyecto.

### Carpetas Ambiguas y Nombres Inconsistentes
- **`js/Agentes IA`**: El nombre contiene un espacio. Rompe la convención de nombres en minúsculas y sin espacios (o con guiones) usada en el resto del proyecto. Además, la carpeta está vacía.
- **`release/backups`**: El nombre sugiere que contiene archivos de respaldo (zip, sql, etc.), pero solo contiene guías en formato Markdown (`backup_checklist.md`, `restore_guide.md`).

### Posibles Builds Mezclados con Source
- No se detectaron carpetas de build estándar (como `dist`, `.next` fuera de labs, o `build`).
- Sin embargo, `release/app` parece actuar como una carpeta de "distribución" o "release" manual que contiene código fuente duplicado en lugar de assets compilados. Dado que el sitio se sirve directamente de la raíz (según `netlify.toml`), `release/app` parece innecesaria para el despliegue actual.

### Estructuras Legacy Problemáticas
- La raíz contiene una mezcla de archivos de código (HTML), imágenes de assets (`cliente1.jpg`, `anydesk-logo.png`), y configuraciones. En una estructura moderna, estos assets suelen estar en una carpeta `/public` o `/assets`.

## 3. Clasificación y Recomendaciones

### Mantener
- **`labs/cosmo-cm`**: Correctamente aislado como módulo experimental.
- **`js/`** (archivos de la raíz): Contiene la lógica activa del sistema legacy.
- **`styles/`** y **`components/ui/`**: Estructura funcional para el manejo de estilos CSS.

### Mover / Archivar
- **`release/app`**: **Archivar**. Mover a una carpeta de histórico (ej. `archive/legacy-snapshot-v0.9`) para evitar confusiones con el código fuente activo de la raíz. No se recomienda eliminar directamente hasta confirmar que no hay referencias relativas que apunten allí (aunque la búsqueda inicial no reveló dependencias).
- **`js/Agentes IA`**: **Archivar** o eliminar. Al estar vacía y mal nombrada, no aporta valor. Si se planea usar, renombrar a `agentes-ia`.
- **`release/firestore/firestore.rules`**: **Archivar** o eliminar. La versión de la raíz parece ser la activa.

### Revisar Manualmente
- **`release/backups`**: Se recomienda renombrar a `release/backup-guides` para reflejar mejor su contenido.
- **Assets en la raíz**: Se recomienda evaluar mover las imágenes y recursos estáticos a una carpeta `/assets` o `/public` en el futuro para limpiar la raíz del proyecto.
