# Asistencia remota · migración a Remotto

Fecha de diagnóstico: 2026-11-07. Estado: **publicación de la web autorizada por Cris, con AnyDesk como alternativa**. No equivale a homologación completa de Remotto ni autoriza la fase de órdenes.

## Fuentes y baseline

- Web: `Cosmicar/cosmicagpt@main`, `6c9cc8c16924a7748f5f7995b5307fbe6a28e1af`. AGENTS, README, FUNCIONALIDADES, RELEASE_NOTES, HTML, CSS, JS, plantilla provincial, build y pruebas.
- Vercel: proyecto `cosmicagpt`, producción READY `dpl_7hEKq2Kd46FZDfMHFK4fA5VukwmM`, mismo commit. `/asistencia.html` usaba AnyDesk en este baseline previo a la migración. No había PR abierto en la consulta inicial.
- App: `Cosmicar/cosmica-app@main`, `a6e169ff7c62be889facfcd5845fdf5c6027c93c`. AGENTS, COSMICA_CONTEXT/PENDING/CHANGELOG, norma visual A1.1, órdenes/detalle, roles y alertas de soporte. Revisados editor remoto, action de conexión, tipos y eventos.
- Supabase principal ACTIVE_HEALTHY. Consulta exclusivamente de metadatos de `service_orders` y `order_events`; sin lecturas de clientes ni escrituras.
- Proveedor: [recursos](https://remotto.app/es/recursos), [descargas](https://remotto.app/es/descargas), [ayuda](https://remotto.app/es/ayuda), [personalización](https://remotto.app/es/ayuda/personalizacion) y panel autenticado Mi cuenta → Inicio → Etapa 3.

## Inventario y decisión

| Superficie | Antes | Propuesta |
| --- | --- | --- |
| `asistencia.html` | Descarga AnyDesk → abrir → enviar ID a WhatsApp | Código del técnico → Remotto Connect → autorización y cierre |
| `marketing/assistance.js` | ID opcional 6–12 dígitos; progreso | Sin campo de código/ID propio; progreso explícito versionado; carga voluntaria del widget |
| `marketing/remotto-connect.{html,js,css}` | No existe | Adaptador mínimo del snippet oficial dentro de iframe aislado |
| `index.html` | AnyDesk como principal | Remotto Connect |
| `template-provincia.html` y 24 páginas generadas | AnyDesk como principal | Misma sustitución, sin alterar servicios, precios o SEO |
| Build y pruebas | Contratos AnyDesk; imagen de ID publicada | Contratos Remotto y fallo del widget; imagen histórica excluida de dist |
| Cósmica.app | Editor de herramienta/ID y eventos existentes | Sólo diagnóstico y propuesta, ninguna implementación |

Se conservan `/asistencia` y `/asistencia.html`, canonical, accesos, contacto y activos A1.1. La guía mantiene superficies claras y usa obsidiana como fondo exterior. AnyDesk/RustDesk quedan en contingencias coordinadas. Las notas históricas no se reescriben como si Remotto ya estuviera publicado.

## Connect Box: evidencia y límites

El panel de Remotto entrega explícitamente **ISL ConnectBox v2**. Esto confirma compatibilidad con ISL para este widget; no se deduce de que ambos productos compartan fabricante. El snippet público de la cuenta no contiene tokens, dominio personalizado ni identificador de cliente:

- jQuery 3.6.0 desde jsDelivr, con SRI suministrado por Remotto.
- `https://www.islonline.com/static/v7/scripts/islonline-join.jquery-v2.min.js`.
- Bootstrap 4.6.0 CSS desde jsDelivr, con SRI suministrado por Remotto.
- `ISLOnlineJoin({ serverUrl: 'https://www.islonline.net', languageCode: 'pt', showBubble: false })`.

El adaptador usa `es` para la atención en español; su renderizado en español quedó comprobado en Preview. La sesión válida sigue pendiente de homologación. El sitio comercial anuncia Connect Box en Base y separa White Label como adicional. No se contrató ninguno ni se habilitó personalización de la aplicación. Confirmar condiciones de la cuenta al contratar.

**Aislamiento y privacidad:** carga tras un clic explícito con aviso de destinatarios y enlace de privacidad. Iframe `sandbox` con scripts/formularios/ventanas emergentes/descargas, sin `allow-same-origin`, cámara, micrófono ni navegación superior. Bootstrap no afecta el CSS de Cósmica. Sin puente `postMessage`, parámetros de sesión, campos propios de código o GA4 en el iframe. El proveedor recibe los datos de conexión del navegador cuando el cliente elige cargarlo; al conectarse, el código lo procesa ISL. Cósmica persiste sólo números de pasos, nunca código, contraseña o contenido de sesión. No se graba la pantalla.

**Fallo seguro:** error de carga o timeout de 15 s muestra alternativa; la descarga oficial y WhatsApp permanecen en la página incluso sin JavaScript. Una carga tardía no inicializa el widget tras timeout. La interfaz no equipara progreso, apertura de programa o carga de formulario con una sesión conectada. No se instala Agent ni acceso desatendido.

**Verificación real de Preview:** el script de ISL no resultó accesible por descarga directa desde el entorno ni apertura como documento, pero sí cargó como recurso del formulario en el navegador. Se comprobó el widget en español dentro del iframe con sandbox, campo vacío, validación de código requerido y progreso sin conexión. No se ingresaron códigos de sesión ni se ejecutó acceso remoto. No se agrega SRI inventado ni copia del script oficial mutable; se limita al iframe sin acceso al origen padre. El build empaqueta CSS y loader propios dentro del HTML del widget para que el sandbox no dependa de cookies SameSite de la Preview protegida. Cris autorizó publicar la guía y el widget conservando AnyDesk como alternativa. Descarga real y sesión supervisada con código válido siguen pendientes; no se declara una homologación completa. No relajar el sandbox sin revisión; si el proveedor exige más privilegios, mantener el flujo de descarga oficial.

## Licencia y evaluación

Cris informó prueba del 6 al 13/11/2026, 5 operadores, 5 equipos y 2 canales; intención de comprar sólo un mes de Base y un canal, ARS 14.900 como referencia comercial, impuestos por confirmar. La pestaña Suscripción del panel consultado muestra **sin suscripción activa**, sin fecha de finalización ni próximo cobro. No permite confirmar el vencimiento del trial; debe verificarse en el portal/licencia correspondiente antes de comprar. No se crearon pagos ni recordatorios automáticos.

Windows a Windows: prueba previa satisfactoria informada por Cris; no es una nueva homologación. Android: Free/Locked Mouse probados e incómodos; mouse relativo tipo touchpad sigue sin confirmación del proveedor. No migrar definitivamente el trabajo móvil hasta resolverlo o comprobar una contingencia aceptable.

## Cósmica.app · propuesta mínima pendiente de aprobación

Seguimiento y criterios de aceptación: [issue #496](https://github.com/Cosmicar/cosmica-app/issues/496). No autoriza implementación.

El remoto ya es una modalidad de `service_orders`: `service_type`, `remote_tool`, `remote_id`, `os_version`. El editor admite texto libre; no requiere una base paralela. `updateRemoteConnection` exige `edit:orders`, `assertCanManageOrder` y filtro por tenant. El timeline usa `order_events` (`tenant_id`, `service_order_id`, tipo, título/descripción, autor/fecha, `is_public`). El helper genérico `createOrderEvent` no expresa un guard granular de permiso/asignación en su implementación actual: **no reutilizarlo directamente para nuevas mutaciones sensibles sin verificar y reforzar ese contrato**, coordinando con #477.

Propuesta acotada, sin API:

1. En el detalle de una orden `remote`, ofrecer Remotto como opción del editor y enlaces fijos HTTPS a la guía/portal oficial, sin códigos ni datos de cliente en la URL. No modificar automáticamente otras herramientas ni históricos.
2. Comprobar en servidor sesión/perfil activo, tenant, capability Workshop, entitlement `remote_assistance`, permiso vigente y scope remoto/asignación para leer o registrar. Reusar Auth y autorización actuales; UI sin permiso no ofrece la acción.
3. Inicio y finalización son acciones **manuales e internas** de intervención, distintas del estado de la orden y del estado real de Remotto. Registrar consentimiento declarado, técnico, marcas temporales y observaciones mínimas en la trazabilidad existente, privadas por defecto. No persistir códigos temporales en `remote_id`.
4. Diseñar antes de escribir el emparejado de inicio/fin y la idempotencia (incluido doble clic, dos técnicos, reintentos y reconexión). Verificar constraints, RLS y permisos vigentes de eventos y su visibilidad en tracking; no dar por segura una política sólo porque filtra tenant. No modificar RLS productiva en esta fase.
5. Abrir el proveedor no mueve estado, Caja, comisión, cobro ni factura. Cerrar intervención tampoco equivale a Entregado. Los avisos de soporte existentes convocan administradores; no reutilizarlos automáticamente para cada intervención.
6. Validar con identidades sintéticas roles, revocación, asignación, scope, Free/Pro, otro tenant, tracking público y ausencia de efectos contables. Anuncio segmentado sólo al publicar una función real.

Remotto no confirmó WebAPI2/REST para Base: la documentación de ISL no concede derechos de API en Remotto. No hay endpoints privados, automatización de sesiones ni credenciales en frontend. Una API futura requiere documentación oficial y autorización comercial. NACHO no cambia: el registro interno identifica proveedor sin acoplar el ciclo de la orden a él.

## Validación y publicación

- Baseline y propuesta: `npm run build` aprobados, 31 pruebas en la propuesta; separación web/app, marca original, enlaces locales, generación provincial y sitemap verificados.
- 11 pruebas específicas de asistencia/widget: confirmaciones, restauración/reset, móvil Android simulado, ausencia de carga automática, hosts fijos, fallo de jQuery/ISL y timeout. Pruebas del loader usan stubs: no prueban una sesión real ni disponibilidad remota.
- Código `3258aba`: Vercel Preview READY y CI GitHub Actions #93 (`42389968713`) aprobado. Verificados renderizado de escritorio (1358 px), vista móvil (390 px, sin desbordes horizontales), carga real del widget aislado en español, campo vacío y rechazo de código requerido, confirmación/reset de progreso y consola sin errores en las vistas verificadas. Iframe de 500 px y título ajustado para no recortar el formulario. No se enviaron códigos aleatorios.
- Preview verificada: https://cosmicagpt-5fn3j4ylg-cosmicars-projects.vercel.app/asistencia (código `3258aba`, protegida por Vercel). PR de publicación: https://github.com/Cosmicar/cosmicagpt/pull/58.
- Pendiente: descarga/ejecución real, entrada de código válido supervisada, autorización/cierre, reconexión y Android físico. La vista estrecha no homologa el control remoto de Android. No usar códigos aleatorios que puedan pertenecer a sesiones ajenas.
- Decisión de Cris del 2026-11-07: publicar Remotto como principal, manteniendo AnyDesk como alternativa. Autoriza integrar y desplegar el PR #58 después de los checks; no autoriza pagos, acceso desatendido, sesiones remotas automáticas ni la fase Cósmica.app. La prueba real continúa abierta. Al publicar, verificar commit servido, HTTP/rutas, recursos, consola/logs y enlace oficial. Rollback por revert del PR; sin migraciones ni sesiones guardadas.
