# Cósmica · Cambios de la web pública

Este archivo corresponde a `Cosmicar/cosmicagpt`. Los cambios operativos de Cósmica.app se consultan en su propio repositorio.

## Correcciones de auditoría · 2026-09-15

- Completa `/app.html` y `/staff.html` con redirecciones permanentes a la aplicación oficial.
- Alinea las cinco preguntas y respuestas del JSON-LD de la portada con el contenido visible; agrega validación de paridad.
- Sustituye documentación del sistema antiguo por el alcance real de la web pública.
- Registra hallazgos, limitaciones y prioridades en `AUDITORIA_WEB_2026-09-15.md`.

- Publicación desde `dist` con lista de activos públicos y validación de recursos/sitemap; deja de servir documentación y herramientas.
- Retira 5.523 archivos de dependencias versionadas, paquetes y herramientas Firebase/AFIP heredados y middleware de la aplicación antigua.
- Unifica GitHub Actions y Vercel en `npm run build`, sin escrituras automáticas a las ramas.
- Mejora contraste del estado de atención y acceso al taller de Jujuy.
- Tolera almacenamiento bloqueado o datos inválidos en la guía de asistencia.
- Retira el ejemplo de cotización de agosto; conserva USD 19,90 y consulta del importe vigente.

No cambia precios base, servicios contratados ni condiciones comerciales.

## Último cambio verificado en producción · 2026-09-02

Commit `bb153c0b30175fe50bf9c12d6e9531fccc6fd722`, PR #35: Cósmica+ se describe como `Service`, conservando su oferta y evitando el marcado de producto físico.

Despliegue verificado en Vercel el 15 de septiembre. Esta referencia es fechada: futuras tareas deben consultar nuevamente la publicación activa.

Las notas anteriores sobre Firebase, clientes, caja y paneles correspondían al sistema histórico de mayo de 2026 y permanecen recuperables en Git.

## Optimización de entrega del logo · 2026-09-15

El build genera derivados PNG comprimidos en `dist/brand/optimized`, sin cambiar dimensiones, metadatos de color ni píxeles. Los originales y sus hashes siguen protegidos. El HTML público y el script de marca usan esos derivados, evitando reemplazar una imagen ya correcta durante la carga. Ahorro medido: aproximadamente 17 % por variante.

En esta entrega la medición seguía pendiente de una propiedad de analítica (resuelta en la entrada siguiente).

## Medición GA4 · 2026-09-15

Integra la propiedad indicada por el titular mediante el ID de medición `G-LM3ZVTL6YW`. Carga asíncrona en producción, visitas automáticas y clics de WhatsApp comercial y acceso a asistencia. Un listener compartido reemplaza los eventos locales anteriores y cubre páginas provinciales, planes y Cósmica+. No instala un contenedor GTM adicional ni activa planes pagos. Excluye query y fragmento de la URL de página y referencia; los eventos propios no envían mensajes ni IDs de asistencia. La recepción en el panel de GA4 requiere validación en Tiempo real.
