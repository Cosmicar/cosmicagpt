import {
  getProductos,
  addProducto,
  getVentas,
  registrarVenta
} from "./inventario-repository.js";

import { escapeHtml, formatMoney, formatDate } from "./utils.js";
import { printTicketVenta } from "./ticket.js";
import { getCachedSystemConfig, getSystemConfig, logSystem } from "./system-service.js";

let _productosCache = [];
let _ventasCache = [];
let _subSeccionActual = "productos";
let _carrito = [];

function getCachedInventarioActivo() {
  return getCachedSystemConfig().inventarioActivo !== false;
}

function getCachedVentasActivas() {
  const config = getCachedSystemConfig();
  return config.inventarioActivo !== false && config.ventasActivas !== false;
}

// Inicialización
window.cargarModuloInventario = async function() {
  try {
    const config = await getSystemConfig();
    if (!config.inventarioActivo) {
      renderModuloDesactivado("Inventario desactivado temporalmente.");
      return;
    }

    await cargarProductos();
    if (config.ventasActivas) {
      await cargarVentas();
    } else {
      _ventasCache = [];
    }
    renderActual();
  } catch (error) {
    console.error("Error al cargar módulo inventario:", error);
    await logSystem("error_inventario_carga", { message: error.message });
    renderModuloDesactivado("No se pudo cargar inventario. El panel principal sigue activo.");
  }
};

function renderModuloDesactivado(mensaje) {
  ["productosTablaBody", "ventasTablaBody", "stockTablaBody", "bajoStockTablaBody"].forEach((id) => {
    const tbody = document.getElementById(id);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--warning);padding:20px;">${escapeHtml(mensaje)}</td></tr>`;
    }
  });
}

async function cargarProductos() {
  try {
    _productosCache = await getProductos();
  } catch (error) {
    console.error("Error al cargar productos:", error);
  }
}

async function cargarVentas() {
  try {
    _ventasCache = await getVentas();
  } catch (error) {
    console.error("Error al cargar ventas:", error);
  }
}

function renderActual() {
  if (_subSeccionActual === "productos") {
    renderProductos(_productosCache);
  } else if (_subSeccionActual === "ventas") {
    renderVentas(_ventasCache);
  } else if (_subSeccionActual === "stock") {
    renderStock(_productosCache);
  } else if (_subSeccionActual === "bajo_stock") {
    renderBajoStock(_productosCache);
  } else if (_subSeccionActual === "reportes") {
    renderReportes(_productosCache, _ventasCache);
  }
}

window.setSubSeccionInventario = function(seccion, btn) {
  _subSeccionActual = seccion;
  
  // Actualizar UI de botones
  document.querySelectorAll("#tab-inventario .period-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  
  // Ocultar todos los contenidos de subsecciones
  document.querySelectorAll(".sub-inv-content").forEach(c => c.style.display = "none");
  
  // Mostrar el seleccionado
  const content = document.getElementById(`sub-inv-${seccion}`);
  if (content) content.style.display = "block";
  
  renderActual();
};

function renderProductos(productos) {
  const tbody = document.getElementById("productosTablaBody");
  if (!tbody) return;
  
  if (!productos.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px;">No hay productos registrados</td></tr>`;
    return;
  }
  
  tbody.innerHTML = productos.map(p => `
    <tr>
      <td>${escapeHtml(p.sku || "—")}</td>
      <td>${escapeHtml(p.nombre || "—")}</td>
      <td>${escapeHtml(p.tipo || "—")}</td>
      <td>${escapeHtml(p.categoria || "—")}</td>
      <td>${p.stock || 0}</td>
      <td>$${formatMoney(p.precioVenta || 0)}</td>
      <td>
        <span style="color:var(--muted);">—</span>
      </td>
    </tr>
  `).join("");
}

function renderVentas(ventas) {
  const tbody = document.getElementById("ventasTablaBody");
  if (!tbody) return;
  
  if (!ventas.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px;">No hay ventas registradas</td></tr>`;
    return;
  }
  
  tbody.innerHTML = ventas.map(v => `
    <tr>
      <td>${formatDate(v.fecha) || "—"}</td>
      <td>${escapeHtml(v.cliente || "Consumidor Final")}</td>
      <td>${v.items ? v.items.length : 0} items</td>
      <td>$${formatMoney(v.total || 0)}</td>
      <td>${escapeHtml(v.metodoPago || "—")}</td>
      <td>
        <span style="color:var(--muted);">—</span>
      </td>
    </tr>
  `).join("");
}

function renderStock(productos) {
  const tbody = document.getElementById("stockTablaBody");
  if (!tbody) return;
  
  if (!productos.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px;">No hay productos registrados</td></tr>`;
    return;
  }
  
  tbody.innerHTML = productos.map(p => `
    <tr>
      <td>${escapeHtml(p.nombre || "—")}</td>
      <td>${escapeHtml(p.sku || "—")}</td>
      <td>${p.stock || 0}</td>
      <td><span style="color:var(--muted);">—</span></td>
    </tr>
  `).join("");
}

function renderBajoStock(productos) {
  const tbody = document.getElementById("bajoStockTablaBody");
  if (!tbody) return;
  
  const bajoStock = productos.filter(p => p.stock <= (p.stockMinimo || 0));
  
  if (!bajoStock.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--success);padding:20px;">No hay productos con bajo stock</td></tr>`;
    return;
  }
  
  tbody.innerHTML = bajoStock.map(p => `
    <tr>
      <td>${escapeHtml(p.nombre || "—")}</td>
      <td>${escapeHtml(p.sku || "—")}</td>
      <td>${p.stock || 0}</td>
      <td>${p.stockMinimo || 0}</td>
    </tr>
  `).join("");
}

function renderReportes(productos, ventas) {
  const repValorizacion = document.getElementById("repValorizacion");
  const repVentasMes = document.getElementById("repVentasMes");
  const repProdActivos = document.getElementById("repProdActivos");
  
  if (!repValorizacion || !repVentasMes || !repProdActivos) return;
  
  const valorizacion = productos.reduce((acc, p) => acc + (p.stock || 0) * (p.precioCompra || 0), 0);
  
  const hoy = new Date();
  const mesActual = hoy.toISOString().slice(0, 7);
  const ventasDelMes = ventas.filter(v => v.fecha && v.fecha.startsWith(mesActual));
  const totalVentasMes = ventasDelMes.reduce((acc, v) => acc + (v.total || 0), 0);
  
  repValorizacion.innerText = `$${formatMoney(valorizacion)}`;
  repVentasMes.innerText = `$${formatMoney(totalVentasMes)}`;
  repProdActivos.innerText = productos.filter(p => p.activo).length;
}

// Modals Producto
window.abrirModalProducto = function() {
  if (!getCachedInventarioActivo()) {
    alert("Inventario está desactivado temporalmente.");
    return;
  }
  const overlay = document.getElementById("modalProductoOverlay");
  if (!overlay) return;
  overlay.hidden = false;
  overlay.removeAttribute("inert");
  overlay.setAttribute("aria-hidden", "false");
  overlay.classList.add("open");
};

window.cerrarModalProducto = function() {
  const overlay = document.getElementById("modalProductoOverlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("inert", "");
  overlay.hidden = true;
  limpiarFormularioProducto();
};

function limpiarFormularioProducto() {
  document.getElementById("prodNombre").value = "";
  document.getElementById("prodSku").value = "";
  document.getElementById("prodTipo").value = "producto";
  document.getElementById("prodCategoria").value = "";
  document.getElementById("prodPrecioCompra").value = "";
  document.getElementById("prodPrecioVenta").value = "";
  document.getElementById("prodStock").value = "";
  document.getElementById("prodStockMinimo").value = "5";
  document.getElementById("prodProveedor").value = "";
  document.getElementById("prodDescripcion").value = "";
}

window.guardarProducto = async function() {
  const config = await getSystemConfig();
  if (!config.inventarioActivo) {
    alert("Inventario está desactivado temporalmente.");
    return;
  }

  const nombre = document.getElementById("prodNombre").value.trim();
  const precioVenta = document.getElementById("prodPrecioVenta").value;
  const stock = document.getElementById("prodStock").value;
  
  if (!nombre || !precioVenta || !stock) {
    alert("Por favor completa los campos obligatorios (*)");
    return;
  }
  
  const precioVentaNum = Number(precioVenta);
  const stockNum = Number(stock);
  
  if (isNaN(precioVentaNum) || isNaN(stockNum)) {
    alert("Por favor ingresa valores numéricos válidos para Precio de Venta y Stock.");
    return;
  }
  
  const data = {
    nombre,
    sku: document.getElementById("prodSku").value.trim(),
    tipo: document.getElementById("prodTipo").value,
    categoria: document.getElementById("prodCategoria").value.trim(),
    precioCompra: Number(document.getElementById("prodPrecioCompra").value) || 0,
    precioVenta: precioVentaNum,
    stock: stockNum,
    stockMinimo: Number(document.getElementById("prodStockMinimo").value) || 0,
    proveedor: document.getElementById("prodProveedor").value.trim(),
    descripcion: document.getElementById("prodDescripcion").value.trim()
  };

  
  try {
    await addProducto(data);
    await logSystem("producto_creado", { nombre: data.nombre, sku: data.sku, stock: data.stock });
    alert("✅ Producto guardado correctamente.");
    cerrarModalProducto();
    await window.cargarModuloInventario(); // Recargar
  } catch (error) {
    await logSystem("error_producto_guardar", { message: error.message, nombre }).catch(() => {});
    alert("Error al guardar el producto: " + error.message);
  }
};

window.filtrarProductos = function(termino) {
  const t = termino.toLowerCase().trim();
  if (!t) {
    renderProductos(_productosCache);
    return;
  }
  const filtrados = _productosCache.filter(p => 
    p.nombre?.toLowerCase().includes(t) || 
    p.sku?.toLowerCase().includes(t)
  );
  renderProductos(filtrados);
};

// ── MÓDULO DE VENTAS (POS) ───────────────────────────────────────

window.abrirModalVenta = function() {
  const config = getCachedInventarioActivo();
  if (!config) {
    alert("Inventario está desactivado temporalmente.");
    return;
  }
  if (!getCachedVentasActivas()) {
    alert("Ventas está desactivado temporalmente.");
    return;
  }
  const overlay = document.getElementById("modalVentaOverlay");
  if (!overlay) return;
  overlay.hidden = false;
  overlay.removeAttribute("inert");
  overlay.setAttribute("aria-hidden", "false");
  overlay.classList.add("open");
  _carrito = [];
  renderCarrito();
  document.getElementById("busquedaVentaProducto").value = "";
  document.getElementById("resultadosBusquedaVenta").style.display = "none";
};

window.cerrarModalVenta = function() {
  const overlay = document.getElementById("modalVentaOverlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("inert", "");
  overlay.hidden = true;
};

window.buscarProductosVenta = function(termino) {
  const t = termino.toLowerCase().trim();
  const resultadosDiv = document.getElementById("resultadosBusquedaVenta");
  
  if (!t) {
    resultadosDiv.style.display = "none";
    return;
  }
  
  const filtrados = _productosCache.filter(p => 
    p.activo && (
      p.nombre?.toLowerCase().includes(t) || 
      p.sku?.toLowerCase().includes(t) ||
      p.categoria?.toLowerCase().includes(t)
    )
  );
  
  if (!filtrados.length) {
    resultadosDiv.innerHTML = `<div style="padding:10px; color:var(--muted); text-align:center;">No se encontraron productos</div>`;
    resultadosDiv.style.display = "block";
    return;
  }
  
  resultadosDiv.innerHTML = filtrados.map(p => `
    <div style="padding:10px; border-bottom:1px solid var(--border); cursor:pointer; display:flex; justify-content:space-between; align-items:center;" onclick="agregarAlCarrito('${p.id}')">
      <div>
        <div style="font-weight:bold;">${escapeHtml(p.nombre)}</div>
        <div style="font-size:12px; color:var(--muted);">${escapeHtml(p.sku || "Sin SKU")} | Stock: ${p.stock || 0}</div>
      </div>
      <div style="font-weight:bold; color:var(--success);">$${formatMoney(p.precioVenta)}</div>
    </div>
  `).join("");
  
  resultadosDiv.style.display = "block";
};

window.agregarAlCarrito = function(productoId) {
  const producto = _productosCache.find(p => p.id === productoId);
  if (!producto) return;
  
  if (producto.stock <= 0) {
    alert("No hay stock disponible de este producto.");
    return;
  }
  
  const itemExistente = _carrito.find(item => item.productoId === productoId);
  
  if (itemExistente) {
    if (itemExistente.cantidad >= producto.stock) {
      alert("No puedes agregar más de este producto. Supera el stock disponible.");
      return;
    }
    itemExistente.cantidad += 1;
    itemExistente.subtotal = itemExistente.cantidad * itemExistente.precioUnitario;
  } else {
    _carrito.push({
      productoId: producto.id,
      sku: producto.sku || "",
      nombre: producto.nombre,
      cantidad: 1,
      precioUnitario: producto.precioVenta,
      subtotal: producto.precioVenta
    });
  }
  
  // Ocultar resultados de búsqueda
  document.getElementById("resultadosBusquedaVenta").style.display = "none";
  document.getElementById("busquedaVentaProducto").value = "";
  
  renderCarrito();
};

window.actualizarCantidad = function(productoId, cambio) {
  const item = _carrito.find(item => item.productoId === productoId);
  if (!item) return;
  
  const producto = _productosCache.find(p => p.id === productoId);
  
  const nuevaCantidad = item.cantidad + cambio;
  
  if (nuevaCantidad <= 0) {
    window.eliminarDelCarrito(productoId);
    return;
  }
  
  if (producto && nuevaCantidad > producto.stock) {
    alert("No hay suficiente stock.");
    return;
  }
  
  item.cantidad = nuevaCantidad;
  item.subtotal = item.cantidad * item.precioUnitario;
  
  renderCarrito();
};

window.eliminarDelCarrito = function(productoId) {
  _carrito = _carrito.filter(item => item.productoId !== productoId);
  renderCarrito();
};

function renderCarrito() {
  const tbody = document.getElementById("carritoTablaBody");
  if (!tbody) return;
  
  if (!_carrito.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--muted); padding:10px;">El carrito está vacío</td></tr>`;
    document.getElementById("ventaTotal").innerText = "0.00";
    return;
  }
  
  tbody.innerHTML = _carrito.map(item => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
      <td style="padding:8px;">
        <div style="font-weight:bold;">${escapeHtml(item.nombre)}</div>
        <div style="font-size:11px; color:var(--muted);">${escapeHtml(item.sku)}</div>
      </td>
      <td style="padding:8px;">
        <div style="display:flex; align-items:center; gap:5px;">
          <button class="btn btn-sm btn-secondary" style="padding:2px 6px;" onclick="actualizarCantidad('${item.productoId}', -1)">-</button>
          <span>${item.cantidad}</span>
          <button class="btn btn-sm btn-secondary" style="padding:2px 6px;" onclick="actualizarCantidad('${item.productoId}', 1)">+</button>
        </div>
      </td>
      <td style="padding:8px;">$${formatMoney(item.precioUnitario)}</td>
      <td style="padding:8px; font-weight:bold;">$${formatMoney(item.subtotal)}</td>
      <td style="padding:8px; text-align:right;">
        <button class="btn btn-sm btn-danger" style="padding:2px 6px;" onclick="eliminarDelCarrito('${item.productoId}')">✕</button>
      </td>
    </tr>
  `).join("");
  
  const total = _carrito.reduce((acc, item) => acc + item.subtotal, 0);
  document.getElementById("ventaTotal").innerText = formatMoney(total);
}

window.confirmarVenta = async function() {
  const btn = document.getElementById("btnConfirmarVenta");
  if (btn) btn.disabled = true;

  const config = await getSystemConfig();
  if (!config.inventarioActivo || !config.ventasActivas) {
    if (btn) btn.disabled = false;
    alert("Ventas está desactivado temporalmente.");
    return;
  }

  if (!_carrito.length) {
    if (btn) btn.disabled = false;
    alert("El carrito está vacío.");
    return;
  }
  
  const cliente = document.getElementById("ventaCliente").value.trim() || "Consumidor Final";
  const metodoPago = document.getElementById("ventaMetodoPago").value;
  const total = _carrito.reduce((acc, item) => acc + item.subtotal, 0);
  
  const venta = {
    cliente,
    items: _carrito,
    total,
    metodoPago,
    fecha: new Date().toISOString()
  };
  
  try {
    await registrarVenta(venta);
    await logSystem("venta_registrada", {
      total: venta.total,
      items: venta.items.map(item => ({ productoId: item.productoId, cantidad: item.cantidad }))
    });
    alert("✅ Venta registrada correctamente.");
    cerrarModalVenta();
    await window.cargarModuloInventario(); // Recargar datos
    
    // Generar ticket de venta
    try {
      printTicketVenta(venta);
    } catch (err) {
      console.error("Error al generar ticket:", err);
      alert("La venta se registró pero no se pudo abrir la ventana del ticket.");
    }
  } catch (error) {
    await logSystem("error_venta_registrar", { message: error.message, total }, "error").catch(() => {});

    alert("Error al registrar la venta: " + error.message);
  } finally {
    if (btn) btn.disabled = false;
  }

};
