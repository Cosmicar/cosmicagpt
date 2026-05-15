import {
  collection, getDocs, getDoc, doc,
  addDoc, updateDoc, writeBatch,
  query, orderBy, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "../../../js/firebase.js";
import { COLLECTIONS } from "../../../js/domain.js";
import { cacheWrap, cacheInvalidate } from '../core/cache.js';

const COL = COLLECTIONS.inventario;
const CACHE_KEY = 'inventario:list';

// ── Read ─────────────────────────────────────────────────────────────────────

export function getInventario() {
  return cacheWrap(CACHE_KEY, async () => {
    const q = query(collection(db, COL), orderBy('nombre', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}

export async function getInventarioItem(id) {
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) throw new Error('Repuesto no encontrado.');
  return { id: snap.id, ...snap.data() };
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function createInventarioItem(data) {
  try {
    if (!data.nombre?.trim() || !data.categoria?.trim()) {
      throw new Error('Nombre y categoría son obligatorios.');
    }
    const item = {
      nombre:     data.nombre.trim(),
      sku:        data.sku?.trim() || '',
      categoria:  data.categoria.trim(),
      stock:      Number(data.stock      || 0),
      stockMinimo: Number(data.stockMinimo || 0),
      costo:      Number(data.costo      || 0),
      proveedor:  data.proveedor?.trim() || '',
      createdAt:  serverTimestamp(),
      updatedAt:  serverTimestamp(),
    };
    const ref = await addDoc(collection(db, COL), item);
    cacheInvalidate(CACHE_KEY);
    return { success: true, id: ref.id };
  } catch (err) {
    console.error('Error al crear repuesto:', err);
    return { success: false, error: err.message };
  }
}

export async function updateInventarioItem(id, data) {
  try {
    if (!data.nombre?.trim() || !data.categoria?.trim()) {
      throw new Error('Nombre y categoría son obligatorios.');
    }
    await updateDoc(doc(db, COL, id), {
      nombre:     data.nombre.trim(),
      sku:        data.sku?.trim() || '',
      categoria:  data.categoria.trim(),
      stock:      Number(data.stock      || 0),
      stockMinimo: Number(data.stockMinimo || 0),
      costo:      Number(data.costo      || 0),
      proveedor:  data.proveedor?.trim() || '',
      updatedAt:  serverTimestamp(),
    });
    cacheInvalidate(CACHE_KEY);
    return { success: true };
  } catch (err) {
    console.error('Error al actualizar repuesto:', err);
    return { success: false, error: err.message };
  }
}

// ── Stock ─────────────────────────────────────────────────────────────────────

/**
 * Ajusta el stock de un repuesto. delta positivo = aumentar, negativo = disminuir.
 */
export async function adjustStock(id, delta) {
  try {
    await updateDoc(doc(db, COL, id), {
      stock:     increment(delta),
      updatedAt: serverTimestamp(),
    });
    cacheInvalidate(CACHE_KEY);
    return { success: true };
  } catch (err) {
    console.error('Error al ajustar stock:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Realiza múltiples ajustes de stock en una sola operación atómica.
 * Valida que ningún item quede con stock negativo ANTES de commitear.
 * Si alguno falla la validación, aborta TODA la operación (sin commits parciales).
 *
 * @param {Array} adjustments - Array de { id, delta }
 * @returns {Promise<{success: boolean, error?: string, code?: string, itemNombre?: string}>}
 */
export async function batchAdjustStock(adjustments) {
  if (!adjustments.length) return { success: true };

  try {
    // ── Pre-validation: read current stock for every consuming item ──────────
    const consuming = adjustments.filter(a => a.id && a.delta < 0);
    if (consuming.length > 0) {
      const snaps = await Promise.all(consuming.map(a => getDoc(doc(db, COL, a.id))));

      for (let i = 0; i < consuming.length; i++) {
        const { id, delta } = consuming[i];
        const snap = snaps[i];
        if (!snap.exists()) {
          return { success: false, error: `Repuesto no encontrado (${id})`, code: 'NOT_FOUND' };
        }
        const currentStock = Number(snap.data().stock || 0);
        if (currentStock + delta < 0) {
          const nombre = snap.data().nombre || id;
          console.warn('[inventario] batchAdjustStock aborted — insufficient stock:', {
            id, nombre, currentStock, delta, wouldBe: currentStock + delta,
          });
          return {
            success:    false,
            error:      `Stock insuficiente para ${nombre}`,
            code:       'INSUFFICIENT_STOCK',
            itemNombre: nombre,
          };
        }
      }
    }

    // ── All validations passed — commit in one batch ──────────────────────────
    const batch = writeBatch(db);
    for (const { id, delta } of adjustments) {
      if (!id || delta === 0) continue;
      batch.update(doc(db, COL, id), {
        stock:     increment(delta),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    cacheInvalidate(CACHE_KEY);
    return { success: true };
  } catch (err) {
    console.error('Error en batchAdjustStock:', err);
    return { success: false, error: err.message };
  }
}

export async function decreaseStock(id, quantity) {
  return adjustStock(id, -Math.abs(quantity));
}

// ── Local filter (no extra Firestore reads) ───────────────────────────────────

export function filterInventario(items, term) {
  if (!term) return items;
  const t = term.toLowerCase();
  return items.filter(i =>
    (i.nombre    && i.nombre.toLowerCase().includes(t)) ||
    (i.sku       && i.sku.toLowerCase().includes(t))    ||
    (i.categoria && i.categoria.toLowerCase().includes(t))
  );
}

// ── Stock badge helpers ───────────────────────────────────────────────────────

export function stockStatus(item) {
  const stock = Number(item.stock || 0);
  const min   = Number(item.stockMinimo || 0);
  if (stock === 0)        return 'empty';   // sin stock
  if (stock <= min)       return 'low';     // stock bajo
  return 'ok';
}

export function stockBadgeClass(item) {
  const s = stockStatus(item);
  if (s === 'empty') return 'badge-danger';
  if (s === 'low')   return 'badge-orange';
  return 'badge-green';
}

export function stockBadgeLabel(item) {
  const s = stockStatus(item);
  if (s === 'empty') return 'Sin stock';
  if (s === 'low')   return `Stock bajo (${item.stock})`;
  return `Stock OK (${item.stock})`;
}
