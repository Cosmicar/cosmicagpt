# Auditoría de conversión: asistencia remota y experiencia móvil
Fecha: 2026-11-10 · Repositorio: `Cosmicar/cosmicagpt`
Alcance: **web pública exclusivamente**. Cósmica.app y el servicio Remotto no se modifican.

## Decisión comercial
El servicio principal será **asistencia técnica remota integral en Argentina**: errores de Windows, lentitud, virus, programas y problemas de impresión que puedan resolverse por software. No se propone una landing dedicada al reseteo de almohadillas. Los resets siguen siendo una intervención específica, no el eje del posicionamiento.

## Evidencia disponible y límites
- Informe entregado por Cósmica, noviembre de 2026, origen Google Business Profile: octubre registra 470 impresiones/visualizaciones (+295 % interanual) y 80,8 % de visibilidad móvil. Reporta 40 consultas sobre impresoras y 26 sobre software. **Estas métricas son del perfil comercial de Google y no equivalen a visitas, conversiones ni porcentaje móvil del sitio web.**
- Auditoría de código de `main` antes del cambio: la home ya presentaba asistencia remota nacional, CTA de WhatsApp y Remotto, precios visibles y 24 páginas provinciales. `/asistencia.html` separa código del técnico, descarga y autorización, con salvaguardas de privacidad.
- Problema detectado: en hasta 560 px el header sólo mostraba el menú; `header-polish.css` ocultaba el botón de WhatsApp en el header para <=1180 px. El dock inferior existía, pero priorizaba en su texto el flujo «¿Ya coordinaste?» incluso para visitantes nuevos. La home tenía CTAs «Resolver mi problema ahora» e «Iniciar asistencia remota» con diferencias poco explícitas. «Tu PC vuelve a funcionar hoy» podía crear una expectativa de solución que depende del diagnóstico.
- **No se ejecutó una medición cuantitativa nueva de Core Web Vitals o Lighthouse**: no afirmar que mejoraron LCP, CLS, INP o conversiones sin medición comparativa. La imagen principal ya usaba WebP, `srcset`, tamaños explícitos y `fetchpriority=high`, y las imágenes inferiores usaban carga diferida.

## Cambios implementados en rama aislada
1. WhatsApp visible desde el encabezado de tablet/móvil: botón compacto de 44 × 44 px, nombre accesible, foco de teclado y destino oficial. La navegación original permanece.
2. Mensaje y CTA principal orientados a solicitar una evaluación inicial por WhatsApp, antes de recibir un código de sesión; segundo CTA reservado a clientes que **ya coordinaron**. Sin sugerir que un clic inicia una sesión por sí solo.
3. Mensaje de confianza verificable en el hero: evaluación remota, alcance/precio antes de comenzar y autorización del cliente. No promete reparar todos los casos en el día ni solucionar averías físicas remotamente.
4. Dock móvil prioriza WhatsApp, mantiene el acceso «Tengo código» y adapta áreas táctiles, `safe-area-inset-bottom`, foco y apaisado de baja altura.
5. Se preservan precios y contratación por intervención de Mercurio/Venus/Planeta X, página `/planes`, rutas SEO, las 24 provincias, `vercel.json`, canal de conversiones GA4 y flujo aislado de Remotto. Sin scripts ni dependencias nuevas.

## Pruebas y verificación antes de integrar
- `npm run build` debe pasar: pruebas de navegación, asistencia, Remotto y planes, además de nueva prueba `tests/remote-mobile.test.mjs` y validaciones de separación, marketing, marca, SEO y sitemap.
- Comprobar visualmente con navegador real o emulación de 320, 375/390, 720, 768 y 1180 px, iOS con safe area, Android, paisaje reducido, navegación por teclado y menú abierto/cerrado.
- En Preview, verificar que todos los CTA abren WhatsApp con origen comercial y que «Tengo código» lleva a la guía correcta sin transmitir códigos en URL ni analítica.
- Antes de producción, registrar una línea base de Lighthouse Mobile (LCP, CLS, INP si hay datos de campo) y comparar en la misma configuración después.
- Medir desde GA4 eventos existentes `whatsapp_click` y `assistance_click` segmentados por `source` (`nav`, `hero-primary`, `mobile-sticky`) y por dispositivo. Una apertura de WhatsApp **no equivale a un cliente adquirido**. Medir consultas reales y trabajos efectivamente concretados en seguimiento operativo, sin exportar IDs privados a GA4.

## Próximas hipótesis, no resultados medidos
- Mayor claridad entre «consultar» y «usar código» debería reducir sesiones iniciadas prematuramente y aumentar consultas calificadas.
- Priorizar el enlace de contacto en la zona visible del encabezado móvil puede mejorar la captación, pero requiere observar métricas y experiencia real.
- Reseteos pueden seguir apareciendo como un problema más dentro de impresoras, sin depender comercialmente de ese segmento.
