# Reglas de trabajo de la web pública de Cósmica

## Contexto obligatorio

Antes de modificar `cosmica.ar`:

1. Leer `README.md` de este repositorio.
2. Revisar `FUNCIONALIDADES.md`, `RELEASE_NOTES.md` y los documentos del área afectada.
3. Para cualquier tarea que también involucre la aplicación, planes, módulos, Supabase, Vercel o identidad compartida, leer `Cosmicar/cosmica-app/docs/COSMICA_CONTEXT.md` y `Cosmicar/cosmica-app/AGENTS.md`.
4. Revisar commits e issues recientes de ambos repositorios cuando el alcance sea transversal.

La memoria de conversaciones no reemplaza el estado actual de `main`.

## Límites del repositorio

- `Cosmicar/cosmicagpt` y `main` son la única fuente productiva de `cosmica.ar` y `www.cosmica.ar`.
- `Cosmicar/cosmica-app` y `app.cosmica.ar` contienen la aplicación SaaS, paneles, PWA y Supabase.
- Este repositorio no debe contener una copia del sistema, login, dashboard, panel, base de datos ni código operativo de Cósmica.app.
- Las rutas históricas de aplicación deben redirigir a `app.cosmica.ar`.
- `Cosmicar/cosmicar` es un prototipo histórico y no debe usarse como fuente productiva.

## Marca y contenido

- En texto se escribe **Cósmica** con tilde.
- El símbolo y el logotipo oficial usan la C carmesí gestual sin acento, tilde ni trazo flotante.
- La norma visual compartida vive en `Cosmicar/cosmica-app/docs/brand/18-resumen-visual-oficial-a1-1.md`.
- No redibujar ni reinterpretar activos oficiales.
- No anunciar funciones de la aplicación que estén marcadas como futuras o no entregadas.
- Los planes, límites y módulos publicados deben contrastarse con el catálogo y contexto actuales de `cosmica-app`.

## Implementación

- Acotar cada cambio al pedido aprobado.
- Mantener SEO, datos estructurados, sitemap, redirects y páginas provinciales.
- No introducir dependencias o flujos de aplicación para resolver una necesidad de marketing.
- No exponer claves, endpoints internos, RPCs directos ni detalles sensibles de Supabase.
- Los cambios transversales deben coordinarse con una actualización del contexto maestro cuando alteren dominios, canales, arquitectura, marca o propuesta del producto.

## Validación

Ejecutar las validaciones del repositorio:

```bash
node scripts/validate-project-boundaries.mjs
node scripts/validate-marketing.mjs
```

Agregar las comprobaciones específicas que correspondan al cambio. No desplegar si falla una validación requerida.

## Cierre

- Confirmar la rama y el commit exactos.
- Verificar el dominio productivo y sus rutas principales después del despliegue.
- Confirmar que no reaparecieron archivos o rutas de la aplicación dentro de la web pública.
- Actualizar documentación y contexto compartido cuando la decisión afecte al ecosistema completo.
