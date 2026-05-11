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
import { logSystem } from "./system-service.js";


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
  
  try {
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
      } else if (tipo === TIPO_MOVIMIENTO.reserva && nuevoStock < Math.abs(cant)) {
        throw new Error("No hay suficiente stock para reservar.");
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
  } catch (error) {
    await logSystem("error_registrar_movimiento", { message: error.message, movimiento }, "error").catch(() => {});
    throw error;
  }

}

export async function reservarStock(productoId, cantidad, motivo = "Reserva para orden") {
  await registrarMovimiento({
    productoId,
    tipo: TIPO_MOVIMIENTO.reserva,
    motivo,
    cantidad
  });
}

export async function confirmarReserva(productoId, cantidad, motivo = "Consumo en reparación") {
  await registrarMovimiento({
    productoId,
    tipo: TIPO_MOVIMIENTO.reparacion,
    motivo,
    cantidad
  });
}

export async function devolverReserva(productoId, cantidad, motivo = "Devolución de reserva") {
  await registrarMovimiento({
    productoId,
    tipo: TIPO_MOVIMIENTO.devolucion,
    motivo,
    cantidad
  });
}

export async function confirmarItemsOrden(trabajoId) {
  const session = getSession();
  const trabajosCol = isTesterSession() ? "trabajos_demo" : COLLECTIONS.trabajos;
  
  await runTransaction(db, async (transaction) => {
    const trabajoRef = doc(db, trabajosCol, trabajoId);
    const trabajoSnap = await transaction.get(trabajoRef);
    
    if (!trabajoSnap.exists()) {
      throw new Error("La orden no existe.");
    }
    
    const trabajoData = trabajoSnap.data();
    const itemsInventario = trabajoData.itemsInventario || [];
    let modificado = false;
    
    for (const item of itemsInventario) {
      if (item.estado !== "reservado") continue;
      
      const prodRef = doc(db, getProductosCol(), item.productoId);
      const prodSnap = await transaction.get(prodRef);
      
      if (!prodSnap.exists()) {
        throw new Error(`El producto ${item.nombre} no existe.`);
      }
      
      const prodData = prodSnap.data();
      let nuevoStock = Number(prodData.stock || 0) - Number(item.cantidad);
      
      if (nuevoStock < 0) {
        throw new Error(`No hay suficiente stock para ${item.nombre}.`);
      }
      
      // Actualizar stock del producto
      transaction.update(prodRef, { stock: nuevoStock });
      
      // Registrar movimiento
      const movRef = doc(collection(db, getMovimientosCol()));
      transaction.set(movRef, {
        productoId: item.productoId,
        tipo: TIPO_MOVIMIENTO.reparacion,
        motivo: `Consumo en reparación (Orden ${trabajoData.numeroOrden || trabajoId})`,
        cantidad: item.cantidad,
        usuario: session?.user?.email || "sistema",
        fecha: new Date().toISOString()
      });
      
      // Mark item as confirmed
      item.estado = "confirmado";
      modificado = true;
    }
    
    // Actualizar la orden si hubo cambios
    if (modificado) {
      transaction.update(trabajoRef, { itemsInventario });
    }
  });
}

export async function devolverItemsOrden(trabajoId, productoId = null, forzar = false) {
  const session = getSession();
  const trabajosCol = isTesterSession() ? "trabajos_demo" : COLLECTIONS.trabajos;
  
  await runTransaction(db, async (transaction) => {
    const trabajoRef = doc(db, trabajosCol, trabajoId);
    const trabajoSnap = await transaction.get(trabajoRef);
    
    if (!trabajoSnap.exists()) {
      throw new Error("La orden no existe.");
    }
    
    const trabajoData = trabajoSnap.data();
    const itemsInventario = trabajoData.itemsInventario || [];
    let modificado = false;
    
    for (const item of itemsInventario) {
      if (productoId && item.productoId !== productoId) continue;
      
      // Si no es forzado, solo devolvemos reservados.
      // Si es forzado (modo admin), devolvemos también confirmados.
      const estadosValidos = forzar ? ["reservado", "confirmado"] : ["reservado"];
      if (!estadosValidos.includes(item.estado)) continue;
      
      // Restaurar stock del producto
      const prodRef = doc(db, getProductosCol(), item.productoId);
      const prodSnap = await transaction.get(prodRef);
      
      if (prodSnap.exists()) {
        const prodData = prodSnap.data();
        const nuevoStock = Number(prodData.stock || 0) + Number(item.cantidad);
        transaction.update(prodRef, { stock: nuevoStock });
      }

      // Registrar movimiento de devolución
      const movRef = doc(collection(db, getMovimientosCol()));
      transaction.set(movRef, {
        productoId: item.productoId,
        tipo: TIPO_MOVIMIENTO.devolucion,
        motivo: `Devolución de reserva (Orden ${trabajoData.numeroOrden || trabajoId})`,
        cantidad: item.cantidad,
        usuario: session?.user?.email || "sistema",
        fecha: new Date().toISOString()
      });
      
      // Mark item as devuelto
      item.estado = "devuelto";
      modificado = true;
    }
    
    // Actualizar la orden si hubo cambios
    if (modificado) {
      transaction.update(trabajoRef, { itemsInventario });
    }
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
    const productosPorId = new Map();
    const cantidadesPorProducto = new Map();

    venta.items.forEach((item) => {
      cantidadesPorProducto.set(
        item.productoId,
        (cantidadesPorProducto.get(item.productoId) || 0) + Number(item.cantidad || 0)
      );
    });

    // 1. Validar stock de todos los items
    for (const [productoId, cantidadTotal] of cantidadesPorProducto) {
      const prodRef = doc(db, getProductosCol(), productoId);
      const prodSnap = await transaction.get(prodRef);
      if (!prodSnap.exists()) throw new Error(`Producto ${productoId} no existe.`);
      const prodData = prodSnap.data();
      if (prodData.stock < cantidadTotal) {
        throw new Error(`Stock insuficiente para ${prodData.nombre}. Disponible: ${prodData.stock}`);
      }
      productosPorId.set(productoId, { ref: prodRef, data: prodData, cantidadTotal });
    }
    
    // 2. Descontar stock y registrar movimientos
    for (const [productoId, producto] of productosPorId) {
      const { ref: prodRef, data: prodData, cantidadTotal } = producto;
      
      transaction.update(prodRef, { stock: prodData.stock - cantidadTotal });

      const movRef = doc(collection(db, getMovimientosCol()));
      transaction.set(movRef, {
        productoId,
        tipo: TIPO_MOVIMIENTO.venta,
        motivo: `Venta a ${venta.cliente || "Consumidor Final"}`,
        cantidad: cantidadTotal,
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
