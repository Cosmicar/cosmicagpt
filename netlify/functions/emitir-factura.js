/**
 * Netlify Function: emitir-factura
 * Emite una Factura C electrónica mediante el Web Service de AFIP (WSFE).
 *
 * Variables de entorno requeridas (Netlify > Site configuration > Environment variables):
 *   AFIP_CUIT         — CUIT del emisor (sin guiones), ej: 20123456789
 *   AFIP_CERT         — Certificado X.509 en formato PEM (contenido completo, no path)
 *   AFIP_PRIVATE_KEY  — Clave privada RSA en formato PEM (contenido completo, no path)
 *   AFIP_PTO_VTA      — Número de punto de venta habilitado en AFIP, ej: 1
 *
 * Modo actual: HOMOLOGACIÓN (production: false) — NO emite facturas reales.
 * Para pasar a producción, cambiar `production: true` en la inicialización de Afip.
 */

const Afip = require('@afipsdk/afip.js');

// ── Constantes AFIP (Factura C) ────────────────────────────────────────────
const TIPO_COMPROBANTE_FACTURA_C = 11; // Factura C
const TIPO_DOC_CUIT              = 80; // CUIT
const TIPO_DOC_DNI               = 96; // DNI (consumidor final)
const TIPO_DOC_CONSUMIDOR_FINAL  = 99; // Consumidor final sin documento
const MONEDA_PESOS               = 'PES';

// ── Helper: obtener fecha AFIP (yyyymmdd) ──────────────────────────────────
function getFechaAfip() {
  const hoy = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return parseInt(hoy.toISOString().split('T')[0].replace(/-/g, ''));
}

// ── Helper: determinar tipo de documento y número ──────────────────────────
// Regla para Factura C:
//   - Si el receptor es CUIT (11 dígitos) → DocTipo 80
//   - Si el receptor es DNI (7 u 8 dígitos) → DocTipo 96
//   - Si no se provee documento → DocTipo 99 (Consumidor Final), DocNro 0
function resolverDocumento(docRaw) {
  if (!docRaw) return { DocTipo: TIPO_DOC_CONSUMIDOR_FINAL, DocNro: 0 };

  const doc = String(docRaw).replace(/\D/g, ''); // solo dígitos

  if (doc.length === 11) return { DocTipo: TIPO_DOC_CUIT, DocNro: parseInt(doc) };
  if (doc.length >= 7 && doc.length <= 8) return { DocTipo: TIPO_DOC_DNI, DocNro: parseInt(doc) };

  // Fallback: Consumidor Final
  return { DocTipo: TIPO_DOC_CONSUMIDOR_FINAL, DocNro: 0 };
}

// ── Inicialización de la instancia de AFIP ────────────────────────────────
// Se hace fuera del handler para reutilizarla entre llamadas "warm" de Lambda.
// afip.js acepta el contenido del certificado y la clave directamente como string.
let afipInstance = null;

function getAfipInstance() {
  if (afipInstance) return afipInstance;

  const cuit = process.env.AFIP_CUIT;
  const cert = process.env.AFIP_CERT;
  const privateKey = process.env.AFIP_PRIVATE_KEY;

  if (!cuit || !cert || !privateKey) {
    throw new Error(
      'Faltan variables de entorno: AFIP_CUIT, AFIP_CERT y/o AFIP_PRIVATE_KEY no están configuradas.'
    );
  }

  afipInstance = new Afip({
    CUIT: parseInt(cuit),
    cert,
    privateKey,
    production: false, // ← MODO HOMOLOGACIÓN. Cambiar a `true` para producción.
  });

  return afipInstance;
}

// ── Handler principal ──────────────────────────────────────────────────────
exports.handler = async function (event) {
  // 1. Solo aceptar POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método no permitido. Usar POST.' }),
    };
  }

  // 2. Parsear body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Body inválido. Se esperaba JSON.' }),
    };
  }

  const { documento, monto, concepto } = body;

  // 3. Validar campos requeridos
  if (!monto || isNaN(Number(monto)) || Number(monto) <= 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: '"monto" es requerido y debe ser un número positivo.' }),
    };
  }

  const importeTotal = Math.round(Number(monto) * 100) / 100; // redondear a 2 decimales

  // 4. Para Factura C: el monto es el total (sin discriminar IVA).
  //    Los monotributistas no desglosan IVA → ImpNeto = ImpTotal, ImpIVA = 0.
  const { DocTipo, DocNro } = resolverDocumento(documento);

  // 5. Concepto: 1=Productos, 2=Servicios, 3=Productos y Servicios
  //    Si el body envía "concepto" como número (1/2/3), se usa directamente.
  //    Si es texto ("servicios", "productos"), se mapea. Default: 2 (Servicios).
  const conceptoMap = { productos: 1, servicios: 2, 'productos y servicios': 3 };
  let conceptoNum = 2; // Servicios por defecto (más común en soporte técnico)
  if (typeof concepto === 'number' && [1, 2, 3].includes(concepto)) {
    conceptoNum = concepto;
  } else if (typeof concepto === 'string') {
    conceptoNum = conceptoMap[concepto.toLowerCase().trim()] ?? 2;
  }

  try {
    const afip = getAfipInstance();
    const ptoVta = parseInt(process.env.AFIP_PTO_VTA || '1');

    // 6. Obtener el último comprobante emitido para calcular el número siguiente
    let ultimoComprobante;
    try {
      ultimoComprobante = await afip.ElectronicBilling.getLastVoucher(ptoVta, TIPO_COMPROBANTE_FACTURA_C);
    } catch (wsErr) {
      // Si el WS de AFIP responde con error (ej: no hay comprobantes), asumimos 0
      console.warn('[AFIP] getLastVoucher error:', wsErr?.message);
      ultimoComprobante = 0;
    }

    const nroComprobante = ultimoComprobante + 1;
    const fechaAfip = getFechaAfip();

    // 7. Armar el objeto de datos según el schema de AFIP
    const datosFactura = {
      CantReg:    1,                          // 1 comprobante a registrar
      PtoVta:     ptoVta,
      CbteTipo:   TIPO_COMPROBANTE_FACTURA_C, // 11 = Factura C
      Concepto:   conceptoNum,
      DocTipo:    DocTipo,
      DocNro:     DocNro,
      CbteDesde:  nroComprobante,
      CbteHasta:  nroComprobante,
      CbteFch:    fechaAfip,
      ImpTotal:   importeTotal,
      ImpTotConc: 0,                          // Neto no gravado
      ImpNeto:    importeTotal,               // Monotributo: total = neto (sin IVA)
      ImpOpEx:    0,
      ImpIVA:     0,                          // Monotributo no discrimina IVA
      ImpTrib:    0,
      MonId:      MONEDA_PESOS,
      MonCotiz:   1,
    };

    // 8. Emitir la factura
    const resultado = await afip.ElectronicBilling.createVoucher(datosFactura);

    // 9. Respuesta exitosa
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok:             true,
        numeroComprobante: nroComprobante,
        cae:            resultado.CAE,
        caeFchVto:      resultado.CAEFchVto,
        ptoVta:         ptoVta,
        tipo:           'Factura C',
        monto:          importeTotal,
        fechaEmision:   String(fechaAfip),
        ambiente:       'HOMOLOGACION', // ← Cambiar a 'PRODUCCION' junto con production: true
      }),
    };

  } catch (err) {
    // ── Manejo de errores robusto ─────────────────────────────────────────
    console.error('[emitir-factura] Error:', err);

    // Detectar si AFIP está caído o hay timeout de red
    const isNetworkError =
      err?.code === 'ECONNREFUSED' ||
      err?.code === 'ETIMEDOUT' ||
      err?.code === 'ENOTFOUND' ||
      err?.message?.toLowerCase().includes('timeout') ||
      err?.message?.toLowerCase().includes('econnreset');

    if (isNetworkError) {
      return {
        statusCode: 503,
        body: JSON.stringify({
          ok: false,
          error: 'Los servidores de AFIP/ARCA no están disponibles en este momento. Intentá en unos minutos.',
          codigo: 'AFIP_UNAVAILABLE',
        }),
      };
    }

    // Error de negocio de AFIP (CAE rechazado, datos inválidos, etc.)
    if (err?.message?.includes('Error en la respuesta de WSFE') || err?.Observaciones) {
      return {
        statusCode: 422,
        body: JSON.stringify({
          ok: false,
          error: 'AFIP rechazó el comprobante. Verificá los datos ingresados.',
          detalle: err?.Observaciones || err?.message,
          codigo: 'AFIP_REJECTED',
        }),
      };
    }

    // Error genérico
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: 'Error interno al emitir la factura.',
        detalle: err?.message || 'Error desconocido',
        codigo: 'INTERNAL_ERROR',
      }),
    };
  }
};
