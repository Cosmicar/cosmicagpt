/**
 * Servicio de Facturación AFIP
 *
 * Arquitectura: el SaaS consume el endpoint Netlify Function ya existente
 * que aloja la lógica de AFIP (@afipsdk/afip.js + certificados).
 * Aquí solo manejamos: orquestar el fetch, normalizar la respuesta,
 * y persistir el historial en Firestore (colección `facturas`).
 */
import { collection, addDoc, query, orderBy, where, limit, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "../../../js/firebase.js";
import { getCurrentSession } from "../core/session.js";

const ENDPOINT = 'https://api-cosmica.netlify.app/.netlify/functions/emitir-factura';
const FACTURAS_COLLECTION = 'facturas';

/**
 * Tipos de documento AFIP (códigos oficiales)
 * 80 = CUIT
 * 96 = DNI
 * 99 = Consumidor Final / Sin documento
 */
export const TIPO_DOC = Object.freeze({
  cuit:     { codigo: 80, label: 'CUIT',           maxLen: 11 },
  dni:      { codigo: 96, label: 'DNI',            maxLen: 8  },
  sin_doc:  { codigo: 99, label: 'Consumidor Final', maxLen: 0  },
});

export const COND_IVA = Object.freeze({
  consumidor_final: 'Consumidor Final',
  monotributo:      'Monotributista',
  responsable_insc: 'Responsable Inscripto',
  exento:           'Exento',
});

/**
 * Emite una factura llamando al endpoint AFIP externo.
 *
 * @param {Object} input
 * @param {number} input.monto              Total a facturar
 * @param {string} input.descripcion        Descripción del servicio
 * @param {string} [input.razonSocial]      Razón social / nombre del receptor
 * @param {string} input.tipoDoc            'cuit' | 'dni' | 'sin_doc'
 * @param {string} [input.nroDoc]           Número de documento (vacío si sin_doc)
 * @param {string} [input.condIva]          'consumidor_final' por defecto
 * @returns {Promise<{ok: boolean, data?: Object, error?: string}>}
 */
export async function emitirFactura(input) {
  const { monto, descripcion = 'Servicio de soporte técnico', razonSocial, tipoDoc, nroDoc, condIva = 'consumidor_final' } = input;

  // Validaciones cliente-side antes del fetch (mejor UX)
  if (!monto || monto <= 0) return { ok: false, error: 'El monto debe ser mayor a 0.' };
  if (!TIPO_DOC[tipoDoc]) return { ok: false, error: 'Tipo de documento inválido.' };
  if (tipoDoc !== 'sin_doc' && !nroDoc) return { ok: false, error: 'Falta el número de documento.' };

  const payload = {
    documento:   tipoDoc !== 'sin_doc' ? String(nroDoc).trim() : null,
    monto:       Number(monto),
    concepto:    'servicios',
    razonSocial: razonSocial?.trim() || null,
  };

  try {
    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();

    if (!resp.ok || !data.ok) {
      return {
        ok: false,
        error: data.error || `AFIP rechazó el comprobante (HTTP ${resp.status}).`,
        detalle: data.detalle,
      };
    }
    return { ok: true, data };
  } catch (networkErr) {
    console.error('[facturacion] network error:', networkErr);
    return {
      ok: false,
      error: 'No se pudo establecer conexión con ARCA/AFIP. Verificá tu red.',
    };
  }
}

/**
 * Persiste la factura emitida en Firestore (colección `facturas`).
 * Append-only — las facturas no se editan ni borran (auditoría).
 *
 * @param {Object} facturaData  La factura completa lista para guardar
 * @param {string} [ticketId]   Opcional: ID del ticket asociado
 * @returns {Promise<{ok: boolean, id?: string, error?: string}>}
 */
export async function saveFactura(facturaData, ticketId = null) {
  try {
    const session = getCurrentSession();
    const emisorEmail = session?.user?.email || 'sistema';
    const emisorUid   = session?.user?.uid || null;

    const doc = {
      ...facturaData,
      ticketId:    ticketId || null,
      emisorUid,
      emisorEmail,
      createdAt:   serverTimestamp(),
    };

    const ref = await addDoc(collection(db, FACTURAS_COLLECTION), doc);
    return { ok: true, id: ref.id };
  } catch (err) {
    console.error('[facturacion] saveFactura failed:', err);
    return { ok: false, error: err.message || 'Error al guardar factura.' };
  }
}

/**
 * Devuelve las facturas emitidas para un ticket específico.
 * Útil para mostrar "Este ticket ya tiene N facturas" en el quick-view.
 */
export async function getFacturasByTicket(ticketId) {
  if (!ticketId) return [];
  try {
    const q = query(
      collection(db, FACTURAS_COLLECTION),
      where('ticketId', '==', ticketId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('[facturacion] getFacturasByTicket failed:', err);
    return [];
  }
}

/**
 * Devuelve un Map<ticketId, factura[]> con las últimas N facturas que tienen
 * ticketId. Útil para enriquecer la lista de trabajos con un badge "Facturado"
 * en una sola lectura Firestore (en vez de una por ticket).
 *
 * El query NO requiere index compuesto: ordena solo por createdAt.
 */
export async function getFacturasMapByTicket(maxFacturas = 500) {
  try {
    const q = query(
      collection(db, FACTURAS_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(maxFacturas)
    );
    const snap = await getDocs(q);
    const map = new Map();
    snap.docs.forEach(d => {
      const data = d.data();
      if (!data.ticketId) return;
      if (!map.has(data.ticketId)) map.set(data.ticketId, []);
      map.get(data.ticketId).push({ id: d.id, ...data });
    });
    return map;
  } catch (err) {
    // Si las rules bloquean (ej. rol no autorizado) devolvemos map vacío —
    // la UI se degrada limpiamente y no muestra el badge "Facturado".
    // Silenciado: es comportamiento esperado para roles sin permiso.
    return new Map();
  }
}

/**
 * Devuelve las facturas más recientes para historial general.
 */
export async function getRecentFacturas(n = 50) {
  try {
    const q = query(
      collection(db, FACTURAS_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(n)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('[facturacion] getRecentFacturas failed:', err);
    return [];
  }
}

/**
 * Normaliza la respuesta del endpoint AFIP a un formato consistente para
 * persistir y generar PDF.
 */
export function buildFacturaRecord(afipResponse, formData) {
  const tipoDocCodigo = TIPO_DOC[formData.tipoDoc]?.codigo ?? 99;
  const fechaEmision  = afipResponse.fechaEmision;
  const fechaISO = fechaEmision
    ? `${fechaEmision.slice(0, 4)}-${fechaEmision.slice(4, 6)}-${fechaEmision.slice(6, 8)}`
    : new Date().toISOString().slice(0, 10);
  const fechaDisplay = fechaEmision
    ? `${fechaEmision.slice(6, 8)}/${fechaEmision.slice(4, 6)}/${fechaEmision.slice(0, 4)}`
    : new Date().toLocaleDateString('es-AR');

  return {
    // Para AFIP / QR
    tipo:               afipResponse.tipo || 'Factura C',
    numero:             String(afipResponse.numeroComprobante).padStart(8, '0'),
    nroComprobanteRaw:  afipResponse.numeroComprobante,
    cae:                afipResponse.cae,
    vto:                afipResponse.caeFchVto,
    monto:              afipResponse.monto,
    puntoVenta:         afipResponse.ptoVta || 1,
    ambiente:           afipResponse.ambiente || 'PRODUCCION',
    fechaISO,
    fecha:              fechaDisplay,
    // Receptor
    cliente:            formData.razonSocial || 'Consumidor Final',
    doc:                formData.nroDoc || '-',
    tipoDocRec:         tipoDocCodigo,
    nroDocRec:          formData.nroDoc || '0',
    condIva:            formData.condIva || 'consumidor_final',
    descripcion:        formData.descripcion || 'Servicio de soporte técnico',
  };
}
