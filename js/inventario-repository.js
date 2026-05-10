import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "./firebase.js";
import { COLLECTIONS, TIPO_MOVIMIENTO } from "./domain.js";
import { getSession } from "./auth-service.js";

// ── Getters de colección dinámicos (evalúados en tiempo de ejecución) ──
const isTesterSession = () => getSession()?.profile?.rol === 'tester';
const getProductosCol = () => isTesterSession() ? "productos_demo" : COLLECTIONS.productos;
const getMovimientosCol = () => isTesterSession() ? "movimientos_stock_demo" : COLLECTIONS.movimientos_stock;
const getVentasCol = () => isTesterSession() ? "ventas_demo" : COLLECTIONS.ventas;

export async function getProductos() {
  const q = collection(db, getProductosCol());
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getProducto(id) {
  const snap = await getDoc(doc(db, getProductosCol(), id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function addProducto(data) {
  const session = getSession();
  const docData = {
    ...data,
    stock: Number(data.stock || 0),
    activo: true,
    fechaCreacion: new Date().toISOString(),
    usuario: session?.user?.email || "sistema"
  };
  const ref = await addDoc(collection(db, getProductosCol()), docData);
  
  // Registrar movimiento inicial si el stock es > 0
  if (docData.stock > 0) {
    await registrarMovimiento({
      productoId: ref.id,
      tipo: TIPO_MOVIMIENTO.ingreso,
      motivo: "Stock inicial",
      cantidad: docData.stock
    });
  }
  
  return ref.id;
}

export async function updateProducto(id, data) {
  // Ignoramos el stock para evitar modificaciones directas
  const { stock, ...rest } = data;
  await updateDoc(doc(db, getProductosCol(), id), rest);
}

export async function registrarMovimiento(movimiento) {
  const session = getSession();
  const { productoId, tipo, motivo, cantidad } = movimiento;
  
  await runTransaction(db, async (transaction) => {
    const prodRef = doc(db, getProductosCol(), productoId);
    const prodSnap = await transaction.get(prodRef);
    
    if (!prodSnap.exists()) {
      throw new Error("El producto no existe.");
    }
    
    const prodData = prodSnap.data();
    let nuevoStock = Number(prodData.stock || 0);
    const cant = Number(cantidad);
    
    if (tipo === TIPO_MOVIMIENTO.ingreso || (tipo === TIPO_MOVIMIENTO.ajuste && cant > 0)) {
      nuevoStock += cant;
    } else if (tipo === TIPO_MOVIMIENTO.salida || tipo === TIPO_MOVIMIENTO.venta || tipo === TIPO_MOVIMIENTO.reparacion || (tipo === TIPO_MOVIMIENTO.ajuste && cant < 0)) {
      nuevoStock -= Math.abs(cant);
    }
    
    if (nuevoStock < 0) {
      throw new Error("No hay suficiente stock para realizar esta operación.");
    }
    
    // Actualizar stock del producto
    transaction.update(prodRef, { stock: nuevoStock });
    
    // Registrar movimiento
    const movRef = doc(collection(db, getMovimientosCol()));
    transaction.set(movRef, {
      productoId,
      tipo,
      motivo,
      cantidad: cant,
      usuario: session?.user?.email || "sistema",
      fecha: new Date().toISOString()
    });
  });
}

export async function getMovimientos(productoId = null) {
  let q = collection(db, getMovimientosCol());
  if (productoId) {
    q = query(q, where("productoId", "==", productoId));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function registrarVenta(venta) {
  const session = getSession();
  const docData = {
    ...venta,
    usuario: session?.user?.email || "sistema",
    fecha: new Date().toISOString()
  };
  
  await runTransaction(db, async (transaction) => {
    // 1. Validar stock de todos los items
    for (const item of venta.items) {
      const prodRef = doc(db, getProductosCol(), item.productoId);
      const prodSnap = await transaction.get(prodRef);
      if (!prodSnap.exists()) throw new Error(`Producto ${item.productoId} no existe.`);
      const prodData = prodSnap.data();
      if (prodData.stock < item.cantidad) {
        throw new Error(`Stock insuficiente para ${prodData.nombre}. Disponible: ${prodData.stock}`);
      }
    }
    
    // 2. Descontar stock y registrar movimientos
    for (const item of venta.items) {
      const prodRef = doc(db, getProductosCol(), item.productoId);
      const prodSnap = await transaction.get(prodRef);
      const prodData = prodSnap.data();
      
      transaction.update(prodRef, { stock: prodData.stock - item.cantidad });
      
      const movRef = doc(collection(db, getMovimientosCol()));
      transaction.set(movRef, {
        productoId: item.productoId,
        tipo: TIPO_MOVIMIENTO.venta,
        motivo: `Venta a ${venta.cliente || "Consumidor Final"}`,
        cantidad: item.cantidad,
        usuario: session?.user?.email || "sistema",
        fecha: new Date().toISOString()
      });
    }
    
    // 3. Registrar la venta
    const ventaRef = doc(collection(db, getVentasCol()));
    transaction.set(ventaRef, docData);
  });
}

export async function getVentas() {
  const q = collection(db, getVentasCol());
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
