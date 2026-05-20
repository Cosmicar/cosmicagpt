/**
 * Cierre de Caja Taller — migración exacta del módulo legacy.
 *
 * Flujo operativo (cada sábado típicamente):
 *  1. Admin lista trabajos taller entregados pendientes de liquidar
 *  2. Sistema calcula: total · 80% operador · 20% Cósmica
 *  3. Admin confirma → todos los trabajos pasan a `liquidado: true`
 *  4. Se persiste un registro en `cierres_caja` para auditoría (mejora sobre legacy)
 *
 * Idéntica regla contable a legacy:
 *  - Taller liquidado → 20% Cósmica, 80% operador
 *  - Taller NO liquidado → pendiente de cierre
 *  - Remoto → 100% Cósmica (no entra en este cierre)
 */
import {
  collection, query, where, getDocs, writeBatch, serverTimestamp,
  addDoc, orderBy, limit
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "../../../js/firebase.js";
import { COLLECTIONS, WORK_STATUS, SERVICE_TYPES } from "../../../js/domain.js";
import { getCurrentSession } from "../core/session.js";

const CIERRES_COLLECTION = 'cierres_caja';

/**
 * Devuelve los trabajos taller entregados que aún NO están liquidados.
 * Idéntica query a la legacy work-repository.js → getTrabajosNoLiquidados.
 */
export async function getTrabajosNoLiquidados() {
  const q = query(
    collection(db, COLLECTIONS.trabajos),
    where('tipo',   '==', SERVICE_TYPES.taller),
    where('estado', '==', WORK_STATUS.entregado),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, _ref: d.ref, ...d.data() }))
    .filter(t => t.liquidado !== true);
}

/**
 * Calcula el resumen contable del cierre.
 *
 * @param {Array}  trabajos          Lista de trabajos taller no liquidados
 * @param {number} [comisionEmpresa] % de comisión empresa (default 20% = legacy)
 * @returns {{count, total, empresa, operador, pctEmpresa, pctOperador}}
 */
export function calcularCierreSummary(trabajos, comisionEmpresa = 20) {
  const total = trabajos.reduce((s, t) => s + Number(t.precio || 0), 0);
  const pctEmp = comisionEmpresa / 100;
  return {
    count:       trabajos.length,
    total,
    empresa:     total * pctEmp,
    operador:    total * (1 - pctEmp),
    pctEmpresa:  comisionEmpresa,
    pctOperador: 100 - comisionEmpresa,
  };
}

/**
 * Liquida la caja: marca todos los trabajos como `liquidado: true` en batch atómico
 * y graba un registro de auditoría en `cierres_caja`.
 */
export async function liquidarCaja(trabajos, summary) {
  if (!trabajos || trabajos.length === 0) {
    return { ok: false, error: 'No hay trabajos para liquidar.' };
  }

  try {
    // 1. Batch update de trabajos
    const batch = writeBatch(db);
    trabajos.forEach(t => batch.update(t._ref, {
      liquidado:    true,
      liquidadoAt:  serverTimestamp(),
    }));
    await batch.commit();

    // 2. Audit trail (soft-fail si las rules bloquean)
    const session = getCurrentSession();
    try {
      const cierreDoc = {
        count:        summary.count,
        total:        summary.total,
        empresa:      summary.empresa,
        operador:     summary.operador,
        pctEmpresa:   summary.pctEmpresa,
        pctOperador:  summary.pctOperador,
        trabajosIds:  trabajos.map(t => t.id),
        trabajosNumeros: trabajos.map(t => t.numeroOrden).filter(Boolean),
        liquidadoPorEmail: session?.user?.email  || 'sistema',
        liquidadoPorUid:   session?.user?.uid    || null,
        liquidadoPorNombre: session?.profile?.nombre || null,
        createdAt:    serverTimestamp(),
      };
      await addDoc(collection(db, CIERRES_COLLECTION), cierreDoc);
    } catch (auditErr) {
      // Soft fail — el batch update YA pasó. No revertimos.
      console.warn('[cierre-caja] audit trail write failed (rules?):', auditErr.message);
    }

    return { ok: true, count: trabajos.length };
  } catch (err) {
    console.error('[cierre-caja] liquidarCaja failed:', err);
    return { ok: false, error: err.message || 'Error al liquidar la caja.' };
  }
}

/**
 * Devuelve el historial de cierres anteriores (para auditoría/reportes).
 */
export async function getCierresHistorial(n = 12) {
  try {
    const q = query(
      collection(db, CIERRES_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(n)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('[cierre-caja] getCierresHistorial failed:', err);
    return [];
  }
}
