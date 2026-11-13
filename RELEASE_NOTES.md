## 2026-11-13 · Instalación de Cósmica.app

- La web pública deja de anunciar una PWA propia. El sitio de instalación del sistema es `app.cosmica.ar`.

## 2026-11-10 · Corrección de contraste de precios en /planes

- Corrige la regresión visual: las tarjetas oscuras de Mercurio, Venus y Planeta X mostraban el importe casi negro porque `planes-refresh.css` aplicaba un color previsto para fondos claros.
- Agrega la regla específica para tarjetas del bloque `#detalle` con texto blanco cálido `#F6F3F0`, sin alterar estilos de variantes claras ni los valores de las tarifas.
- Versiona la carga de `planes-refresh.css` para evitar reutilizar CSS anterior en caché del navegador.
- Agrega prueba de regresión de contraste, jerarquía de CSS, presencia de las 3 tarifas y enlaces de hoja de estilos.
- No cambia rutas SEO, redirecciones, Remotto, Cósmica.app ni el tema navideño.

## 2026-11-10 · Edición estacional de fin de año en la landing

- La home incorpora acentos festivos discretos en carmesí/obsidiana/blanco cálido y cintillo de consulta remota para el cierre de año, sin alterar el logotipo A1.1.
- El cintillo y el mensaje junto al CTA final sólo se muestran entre el 10/11 y el 31/12/2026 según la fecha de Jujuy; el 1/1/2027 se ocultan automáticamente. Se activa la clase de tema antes del primer pintado para evitar saltos por JavaScript diferido.
- Enlace WhatsApp con mensaje de consulta específico, usando la infraestructura de atribución existente `wa-link` y `data-source=holiday-hero`.
- Nada de landing de reset, descuentos inventados, garantías nuevas, precios alterados, cambios de Remotto, redirecciones, canonical ni Cósmica.app.
- Se incluye la hoja `marketing/holiday-2026.css` y regresión de límites de fechas, marca y rutas `tests/holiday-2026.test.mjs`.

## 2026-11-10 · Asistencia remota primero: captación móvil y claridad

- Se prioriza la asistencia remota integral sobre un servicio único de reseteo; no se crean nuevas landings de impresoras.
- Encabezado móvil ofrece acceso a WhatsApp visible sin abrir el menú, con nombre accesible y área táctil de 44 px.
- Portada separa consulta y diagnóstico inicial de ingreso de código para sesiones ya coordinadas. Explica alcance, presupuesto y consentimiento antes de conectarse, sin prometer resolución en todos los casos.
- Barra inferior móvil prioriza consulta por WhatsApp y conserva acceso a Remotto; respeta safe-area, foco de teclado y pantallas apaisadas.
- Conserva metadatos canónicos, tarifas de los tres servicios, estructura de navegación, navegación a Cósmica.app, GA4 y redirecciones. No cambia la guía segura ni el widget de Remotto.
- Auditoría y mediciones recomendadas en `AUDITORIA_REMOTA_MOBILE_2026-11-10.md`. Nueva regresión `tests/remote-mobile.test.mjs` integrada a `npm run build`.

## 2026-11-10 · Consistencia SEO y sitemap (PR aislado)

- Unifica `https://www.cosmica.ar/` como URL pública canónica del sitio, coherente con la redirección del dominio raíz.
- Corrige la generación de sitemap para conservar las cuatro URLs Cósmica BOX y las 24 páginas provinciales: 33 rutas canónicas.
- Actualiza canonical, OG, schema, robots, el generador y la sincronización de marca. Añade controles de `dist` posteriores al build que comprueban canonical y sitemap sin variantes redundantes.
- No modifica `vercel.json`, `app.cosmica.ar`, Remotto, compras, precios, GA4, marca, ni la producción.
- Validación final en Google Search Console queda pendiente de publicar y de consultar las URL efectivamente excluidas.

## 2026-11-07 · Código de sesión visible y descarga manual alternativa

- Connect Box pasa al bloque inicial y se carga automáticamente, sin desplegable ni botón de carga. En móvil se muestra antes del texto introductorio.
- El técnico entrega el código y el cliente lo ingresa directamente. La descarga manual queda como alternativa secundaria; AnyDesk/RustDesk se conservan para contingencias.
- Se mantiene el formulario oficial aislado, el aviso de terceros y la privacidad de los códigos. Sin cambios operativos de la aplicación.

## 2026-11-07 · Asistencia Remotto · publicación autorizada

- Nueva guía con código del técnico, Remotto Connect y autorización/cierre; se retira el envío de ID desde la web. Remotto pasa a ser principal en portada y cobertura provincial.
- Snippet de Connect Box confirmado en el panel de Remotto; carga voluntaria, iframe aislado, fallo/timeout con descarga oficial y WhatsApp. AnyDesk y RustDesk quedan como contingencias coordinadas.
- Marca A1.1 original, canonical/rutas y separación web/app preservados. Sin pagos, API, sesiones propias, cambios de órdenes, RLS, Caja o NACHO.
- Build y 31 pruebas aprobados; carga real del widget verificada en español; sesión con código válido y Android físico pendientes. Cris autorizó publicar conservando AnyDesk como alternativa. El panel consultado no confirma el vencimiento del trial. Diagnóstico y propuesta de órdenes en `ASISTENCIA_REMOTTO.md`.

## 2026-11-02 · Navegación de portada compacta y adaptable

- En `/`, se priorizan Servicios, Planes, Cósmica BOX y Cósmica.app. Cómo funciona, Reseñas, Taller en Jujuy y Preguntas pasan al desplegable accesible **Más**; todos conservan sus destinos.
- La barra de escritorio baja a 64 px con acciones compactas. Entre tablet y móvil se ofrece menú desplazable, con acceso a asistencia y a WhatsApp; en pantallas estrechas se evita competir con el logo.
- `Más` se cierra al navegar, pulsar Escape o tocar fuera. Se añadió prueba de regresión en el build.
- Sin cambios de tarifas Mercurio/Venus/Planeta X, contrato Free/PRO, ventas Cósmica BOX, marca A1.1, SEO ni servicios del sistema.

## 2026-11-02 · Ajuste de alcance: cotización PRO solamente para Cósmica.app

- Se restauran exactamente los precios públicos, textos, enlaces y datos estructurados de los servicios Mercurio, Venus y Planeta X, incluidos portada, /planes, las páginas provinciales y sus pruebas. La cotización personalizada no aplica a estos servicios.
- Cósmica.app mantiene Free con alta directa y el botón **CONSULTAR PRECIO PRO** mediante WhatsApp, consultando rubro, usuarios y funcionalidades. Las adaptaciones especiales se presupuestan por separado.
- No se modifica el precio operativo interno del SaaS ni suscripciones existentes; Cósmica BOX continúa independiente.

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
