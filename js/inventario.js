import {
  getProductos,
  addProducto,
  getVentas
} from "./inventario-repository.js";

import { escapeHtml, formatMoney, formatDate } from "./utils.js";

let _productosCache = [];
let _ventasCache = [];
let _subSeccionActual = "productos";

// Inicialización
window.cargarModuloInventario = async function() {
  await cargarProductos();
  await cargarVentas();
  renderActual();
};

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
        <button class="btn btn-sm btn-edit" onclick="editarProducto('${p.id}')">Editar</button>
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
        <button class="btn btn-sm btn-secondary" onclick="verDetalleVenta('${v.id}')">Ver</button>
      </td>
    </tr>
  `).join("");
}

function renderStock(productos) {
  const tbody = document.getElementById("stockTablaBody");
  if (!tbody) return;
  
  if (!productos.length) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:20px;">No hay productos registrados</td></tr>`;
    return;
  }
  
  tbody.innerHTML = productos.map(p => `
    <tr>
      <td>${escapeHtml(p.nombre || "—")}</td>
      <td>${escapeHtml(p.sku || "—")}</td>
      <td>${p.stock || 0}</td>
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

// Modals
window.abrirModalProducto = function() {
  document.getElementById("modalProductoOverlay").hidden = false;
  document.getElementById("modalProductoOverlay").removeAttribute("inert");
};

window.cerrarModalProducto = function() {
  document.getElementById("modalProductoOverlay").hidden = true;
  document.getElementById("modalProductoOverlay").setAttribute("inert", "");
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
  const nombre = document.getElementById("prodNombre").value.trim();
  const precioVenta = document.getElementById("prodPrecioVenta").value;
  const stock = document.getElementById("prodStock").value;
  
  if (!nombre || !precioVenta || !stock) {
    alert("Por favor completa los campos obligatorios (*)");
    return;
  }
  
  const data = {
    nombre,
    sku: document.getElementById("prodSku").value.trim(),
    tipo: document.getElementById("prodTipo").value,
    categoria: document.getElementById("prodCategoria").value.trim(),
    precioCompra: Number(document.getElementById("prodPrecioCompra").value) || 0,
    precioVenta: Number(precioVenta),
    stock: Number(stock),
    stockMinimo: Number(document.getElementById("prodStockMinimo").value) || 0,
    proveedor: document.getElementById("prodProveedor").value.trim(),
    descripcion: document.getElementById("prodDescripcion").value.trim()
  };
  
  try {
    await addProducto(data);
    alert("✅ Producto guardado correctamente.");
    cerrarModalProducto();
    await window.cargarModuloInventario(); // Recargar
  } catch (error) {
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
