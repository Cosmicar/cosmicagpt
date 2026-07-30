# Cósmica | Web pública

Este repositorio contiene exclusivamente la web institucional y comercial de Cósmica.

## Arquitectura canónica

| Dominio | Función | Repositorio | Rama de producción |
| --- | --- | --- | --- |
| `www.cosmica.ar` / `cosmica.ar` | Servicios, asistencia remota, marketing y cobertura nacional | `Cosmicar/cosmicagpt` | `main` |
| `app.cosmica.ar` | Cósmica.app para talleres y comercios | `Cosmicar/cosmica-app` | `main` |

## Reglas de separación

1. Este repositorio no debe servir, compilar ni reescribir tráfico para una copia local de Cósmica.app.
2. Las rutas históricas `/app`, `/staff`, `/login` y `/panel` redirigen al dominio oficial `app.cosmica.ar`.
3. El directorio legado `apps/cosmica-app/` queda excluido del despliegue de la web pública hasta su eliminación definitiva.
4. La única rama autorizada como fuente de producción para la web es `main`.
5. Las ramas `claude/*`, `agent/*` y otros experimentos históricos no representan producción y no deben conectarse a dominios.

## Contenido vigente

- Home de servicios técnicos.
- Flujo de asistencia remota.
- Planes y contacto por WhatsApp.
- Directorio nacional y páginas provinciales.
- SEO, sitemap y datos estructurados.

## Validación

El despliegue ejecuta:

```bash
node scripts/validate-project-boundaries.mjs
node scripts/validate-marketing.mjs
```

La primera validación impide que vuelvan a incorporarse reescrituras hacia copias legacy de la app. La segunda genera y verifica la web, las páginas provinciales y el sitemap.

## Contactos oficiales

- Correo: `hola@cosmica.ar`
- Facebook: `@somoscosmica`
- Instagram: `@somoscosmica.ar`
- X: `@somoscosmica`
- Threads: `@somoscosmica.ar`

## Nota sobre material legado

El historial del repositorio conserva archivos y ramas de etapas anteriores. Ese material no es fuente de verdad. Toda decisión nueva debe partir de esta arquitectura canónica y de las ramas `main` de ambos repositorios.
