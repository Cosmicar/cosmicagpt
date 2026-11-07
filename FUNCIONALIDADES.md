# Cósmica · Funcionalidades de la web pública

Revisado: 2026-09-15. Repositorio: `Cosmicar/cosmicagpt`, rama canónica: `main`.

| Ruta | Función |
| --- | --- |
| `/` | Asistencia remota, problemas frecuentes, servicios, reseñas y contacto. |
| `/planes` | Servicios Mercurio, Venus y Planeta X por intervención, precios en ARS, orientador de síntomas no diagnóstico, comparativa móvil, FAQ coherente con SEO y contacto contextualizado por WhatsApp. |
| `/plus` y `/plus.html` | Redirigen permanentemente a Cósmica.app. |
| `/asistencia` y `/asistencia.html` | Código del técnico, Remotto Connect y autorización/cierre. Connect Box oficial visible en el bloque inicial y cargado automáticamente, con aislamiento; descarga manual como alternativa y WhatsApp disponible. AnyDesk/RustDesk secundarios. Publicación autorizada por Cris el 2026-11-07; prueba supervisada con código válido aún pendiente; ver `ASISTENCIA_REMOTTO.md`. |
| `/serviciotecnico` | Servicio presencial en Ramírez de Velazco 111, San Salvador de Jujuy. |
| `/soporte-tecnico-remoto-argentina` | Directorio nacional de cobertura remota. |
| `/pc-lenta-{provincia}` y variantes `.html` | 24 páginas provinciales generadas desde plantillas y datos. |

La comunicación de Cósmica.app conserva Free con acceso directo y presenta **CONSULTAR PRECIO PRO** mediante WhatsApp, evaluando rubro, usuarios y funcionalidades. Las adaptaciones adicionales se cotizan por separado; esta web no modifica la suscripción ni el precio interno del SaaS. Cósmica BOX conserva los valores de sus productos digitales independientes.

La web incorpora metadatos, datos estructurados, sitemap, robots, recursos oficiales de marca y enlaces de WhatsApp contextualizados. El build integra GA4 `G-LM3ZVTL6YW` en las páginas públicas (excepto 404), solo para los dominios productivos. Registra visitas y eventos `whatsapp_click` y `assistance_click` mediante una etiqueta directa, sin GTM adicional. Los eventos propios no incluyen mensajes ni IDs de asistencia. La recepción debe comprobarse en Tiempo real de GA4.

Clientes, órdenes, ventas, caja, inventario, usuarios, facturación, permisos, paneles y PWA pertenecen a [Cósmica.app](https://app.cosmica.ar), en `Cosmicar/cosmica-app`. No se implementan aquí. Los accesos operativos históricos redirigen a la aplicación según `vercel.json`.

El contenido anterior describía el sistema legado de mayo de 2026. Se conserva en el historial Git y no es una referencia del producto vigente.

Para validar, ejecutar el `buildCommand` de `vercel.json`: límites, marketing, generación provincial, contactos, sincronización de marca y comprobación de originales. La sincronización de marca debe preceder a su comprobación final.
