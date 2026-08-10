# Cósmica | Web pública

Este repositorio contiene exclusivamente la web institucional y comercial de Cósmica.

## Arquitectura canónica

| Dominio | Función | Repositorio | Rama de producción |
| --- | --- | --- | --- |
| `www.cosmica.ar` / `cosmica.ar` | Servicios, asistencia remota, marketing y cobertura nacional | `Cosmicar/cosmicagpt` | `main` |
| `app.cosmica.ar` | Cósmica.app para talleres y comercios | `Cosmicar/cosmica-app` | `main` |

## Reglas de separación

1. Este repositorio no sirve, compila ni conserva una copia local de Cósmica.app.
2. Las rutas históricas `/app`, `/staff`, `/login`, `/panel` y `/estado`, incluidas sus variantes `.html`, redirigen al dominio oficial `app.cosmica.ar`.
3. La única rama autorizada como fuente de producción para la web es `main`.
4. Las ramas experimentales no representan producción y no deben conectarse a dominios.
5. El legado eliminado permanece recuperable en el historial de Git, pero no forma parte del árbol vigente.

## Contenido vigente

- Home de servicios técnicos.
- Flujo de asistencia remota.
- Servicios por intervención **Mercurio**, **Venus** y **Planeta X** en `/planes`.
- Membresía para negocios **Cósmica+** en `/plus`, separada de las intervenciones técnicas y con precio base de referencia en USD.
- Contacto por WhatsApp.
- Directorio nacional y páginas provinciales.
- SEO, sitemap y datos estructurados.

## Validación

El despliegue ejecuta:

```bash
node scripts/validate-project-boundaries.mjs
node scripts/validate-marketing.mjs
```

La primera validación impide que regresen copias o archivos de la aplicación antigua. La segunda genera y verifica la web, las páginas provinciales y el sitemap.

## Contactos oficiales

- Correo: `hola@cosmica.ar`
- Facebook: `@somoscosmica`
- Instagram: `@somoscosmica.ar`
- X: `@somoscosmica`
- Threads: `@somoscosmica.ar`

## Fuente de verdad

Toda decisión nueva debe partir de `main` en `Cosmicar/cosmicagpt` para la web y de `main` en `Cosmicar/cosmica-app` para el sistema. Ningún archivo, snapshot o rama histórica reemplaza esa regla.
