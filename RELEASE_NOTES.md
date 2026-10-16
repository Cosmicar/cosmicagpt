## 2026-10-16 · Planes de servicio técnico: presentación y elección renovadas

- Rediseño editorial de `/planes` con la identidad A1.1 y continuidad con la nueva página de asistencia. Mantiene las ilustraciones secundarias de los tres servicios y los logotipos oficiales originales.
- Los precios siguen sin cambios: Mercurio ARS 24.900, Venus ARS 35.900 y Planeta X desde ARS 49.900, por intervención. No son suscripciones y no incluyen licencias comerciales de terceros salvo indicación.
- Hero más directo con resumen de precios, orientación accesible para síntomas (sin diagnóstico automático), tarjeta de WhatsApp contextualizada, comparación horizontal accesible en móvil, secciones de confianza y preguntas frecuentes.
- Los metadatos FAQ JSON-LD reflejan las mismas respuestas visibles, sin afirmar "el más elegido" sin evidencia. Cósmica.app continúa separada de los servicios técnicos.
- Agrega `tests/plans.test.mjs` al build junto con las otras pruebas. Sin cambios de producto, plan PRO, base de datos, usuarios ni permisos.

## 2026-10-16 · Asistencia remota: página renovada

- Rediseño visual de `/asistencia.html` con identidad A1.1, hero editorial con fotografía existente optimizada, mensajes de confianza, tres tarjetas de conexión, contraste y comportamiento responsive.
- El cliente puede completar un ID de AnyDesk opcional y llevarlo al mensaje de WhatsApp. Validación local de 6–12 dígitos: el ID nunca se guarda en el navegador, en GA4 ni en el servidor. Si no lo escribe, puede completar el mensaje directamente en WhatsApp.
- El progreso deja de asumir que una descarga sucedió sólo por abrir el enlace: requiere confirmación explícita del usuario. Se conserva el almacenamiento local tolerante a errores, el aviso móvil, la descarga oficial, RustDesk como alternativa y la salida de soporte humano.
- Pruebas de regresión `tests/assistance.test.mjs` incluidas en `npm run build` junto con las verificaciones generales. Sin cambios de precios, Supabase, aplicación, permisos ni datos de clientes.

## 2026-10-15· Fotografías de marketing

- Reemplaza las tres fotos de portada por una serie editorial generada con una modelo adulta: presentación, consulta y trabajo resuelto. Paleta carmesí, luz natural y mayor resolución; no representa a una clienta ni integrante real del equipo.
- Entrega WebP optimizados, variante de 640 px para el hero y proporción completa en la foto de confianza para conservar rostro y postura. El hero compartido mejora también la cobertura provincial.
- Corrige el bloqueo de build introducido por `docs/soporte/casos`: admite únicamente Markdown en esa ubicación interna y mantiene su exclusión de `dist`. Continúan prohibidos código y rutas de la aplicación.
- Prompts, activos y criterios de entrega en `MARKETING_IMAGENES.md`. Sin cambios de marca, servicios, tarifas o producto.

## 2026-10-13 · Retiro comercial de Cósmica+

- Se retira la membresía Cósmica+ y su precio de referencia en USD de la oferta pública.
- `/plus` y `/plus.html` redirigen permanentemente a Cósmica.app. La portada y `/planes` ahora enlazan al software Free/PRO.
- Se excluyen la página retirada y sus estilos del build, se actualizan sitemap y validaciones. Los servicios técnicos Mercurio, Venus y Planeta X continúan por intervención.
- No modifica planes, cobros, suscripciones ni datos de Supabase. Las entradas históricas que siguen debajo conservan su valor documental, no describen ofertas vigentes.

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
