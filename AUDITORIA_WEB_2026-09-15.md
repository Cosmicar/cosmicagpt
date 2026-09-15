# Auditoría general de cosmica.ar

Fecha: 2026-09-15. Base: `Cosmicar/cosmicagpt`, `main`, commit `bb153c0b30175fe50bf9c12d6e9531fccc6fd722`.

## Resultado

La web está operativa y conserva una propuesta clara de asistencia remota. Conviene mejorar conversión, accesibilidad y mantenimiento antes de plantear un rediseño completo. Esta rama contiene una propuesta; no equivale a una publicación.

## Evidencia

- Revisados AGENTS, README, funcionalidades, release notes, generadores, validadores, scripts de marketing, configuración y workflow; últimos cinco commits y búsqueda de issues sin resultados del conector.
- Consultados AGENTS, contexto, pendientes, decisiones y norma visual A1.1 de `cosmica-app`. No se modificó esa aplicación ni se auditó su backend.
- Vercel: `www.cosmica.ar` resuelve al despliegue `dpl_F8FyLLeZpCxPawaAyQaRN9t7ypBB`, READY, main y SHA coincidente. No reporta errores runtime en siete días; al ser una web estática, esto no sustituye pruebas de navegador.
- Veinte rutas HTTP consultadas: home, planes, plus, asistencia, taller, hub, landing Jujuy, robots y sitemap responden 200. `/app`, `/staff`, `/login`, `/panel` y `/estado` responden 308 hacia la aplicación. `/app.html` y `/staff.html` responden 404. Una ruta inexistente devuelve correctamente 404.
- Portada y asistencia inspeccionadas en navegador, con captura de escritorio y enlaces contextualizados. El clic de prueba en una FAQ agotó el tiempo del navegador: su interacción no se da por aprobada.
- El build completo de Vercel se reproduce localmente. El check de marca aislado falla en dos HTML fuente que se normalizan mediante el paso previo de sincronización; no es un fallo del build completo.

## Hallazgos

| Prioridad | Evidencia | Acción |
| --- | --- | --- |
| Alta | `/app.html` y `/staff.html` devuelven 404 aunque README promete variantes HTML. | Corrección preparada y contrato ampliado. |
| Alta | Cuatro preguntas estructuradas diferentes de las cinco visibles en la portada. | Corrección preparada y comprobación de paridad agregada. |
| Alta | 5.523 archivos versionados dentro de `node_modules`, unos 73 MB locales. El paquete conserva Firebase Admin y AFIP del legado. | Retirar dependencias y archivos sin consumidores, revisar lockfile y probar build limpio en una tarea acotada. |
| Alta | `outputDirectory` es la raíz. `/scripts/README.md` y `/FUNCIONALIDADES.md` se descargan desde producción con HTTP 200. | Generar una carpeta de salida con lista explícita de activos públicos, excluyendo herramientas, dependencias e informes. No se detectó ni se afirma una filtración de credenciales. |
| Media | FUNCIONALIDADES y RELEASE_NOTES describían el sistema antiguo como vigente. `scripts/README.md` aún contiene instrucciones históricas. | Dos documentos corregidos; ordenar herramientas junto con la limpieza del paquete. |
| Media | El workflow de PR omite cambios aislados de index, asistencia, plus, varios CSS y marca; no ejecuta todo el contrato del build. | Unificar CI con el build de Vercel e incluir límites, contactos y marca. |
| Media | Aviso fuera de horario con carmesí oscuro sobre fondo oscuro, de baja legibilidad en la captura. | Corregir colores semánticos y medir contraste en ambos estados. |
| Media | PNG oficial del encabezado de aproximadamente 1,2 MB, mostrado a tamaño pequeño. Las fotos WebP de marketing ya son livianas. | Conservar originales y generar derivados aprobados sin redibujar; medir transferencia y LCP. |
| Media | Eventos en `dataLayer` sin cargador ni destino de analítica encontrado en el código propio inspeccionado. | Verificar configuración externa y conectar medición de consultas, asistencia y planes. No se afirma ausencia de analítica fuera del código. |
| Media | Cobertura provincial y algunos enlaces/estilos se insertan en la home por JavaScript. | Llevar contenido y navegación esenciales al HTML generado. |
| Media | Planes y Cósmica+ muestran una conversión fechada el 07/08/2026. Se identifica como ejemplo, pero puede confundir. | Mantener USD 19,90 y consultar importe vigente, o definir actualización de cotización. No cambiar tarifas sin decisión comercial. |
| Media | Asistencia escribe progreso en localStorage sin capturar errores; marca pasos por clic, no por descarga o envío confirmado. | Tolerar almacenamiento bloqueado, validar datos guardados y aclarar el progreso orientativo. Riesgo de código, no fallo reproducido. |

## Propuesta de actualización visible

1. Portada: conservar identidad y mensaje centrado en el problema; jerarquizar consulta principal y acceso secundario para quien ya coordinó asistencia.
2. Taller de Jujuy: agregar acceso visible cerca del inicio y en navegación. Hoy aparece en la cobertura inferior; la landing presencial ya tiene dirección, horarios y mapa.
3. Servicios: facilitar comparación Mercurio/Venus/Planeta X y distinguir intervenciones, Cósmica+ y software de gestión.
4. Confianza: verificar las citas originales de reseñas, cifras y vigencia del perfil de Google antes de renovarlas. No se verificó su autenticidad ni el total de equipos en esta auditoría.
5. Medición: comparar consultas por origen, clics y abandono de la guía antes/después; no inventar tasas o puntuaciones.
6. Astra: incorporar una pieza editorial sólo con alcance e identidad confirmados, sin prometer soporte automático aún no disponible en la web.

## Validación y límites

Ejecutar el `buildCommand` exacto de Vercel y revisar el diff. Antes de publicar: CI, preview y rutas corregidas sobre el SHA propuesto.

Pendientes: prueba visual real en móvil/tablet, teclado, contraste calculado, Lighthouse/Core Web Vitals de campo, HTTP de las 24 provincias, todos los destinos externos, Search Console y analítica de conversión. No se enviaron mensajes ni IDs remotos.

Es una auditoría de la web pública y su entrega, no una certificación de seguridad ni una auditoría de Supabase.

## Comprobaciones de la propuesta

Build completo aprobado en una copia temporal sin node_modules, con 24 provincias generadas y 34 HTML validados contra los 12 activos originales. Pruebas negativas aprobadas: una FAQ desalineada y una redirección legacy ausente provocan el rechazo correspondiente. `git diff --check` sin errores.

## Correcciones autorizadas y ejecutadas

El responsable autorizó realizar las correcciones necesarias después de revisar este informe. Se completaron aislamiento de salida pública, retiro de node_modules y dependencias/herramientas heredadas, eliminación del middleware del sistema anterior, CI completo sin commits automáticos, contraste del horario, acceso al taller, tolerancia de almacenamiento en asistencia y retiro del ejemplo histórico en pesos. Los hallazgos de la tabla anterior son evidencia del baseline, no una lista actual de pendientes.

La optimización de derivados del logo, la contratación/configuración de analítica y el rediseño integral no forman parte de este lote. Se preservaron los binarios oficiales y los precios base.
