# Estructura de Colecciones - Firestore

## 1. Colección: `clientes`
Almacena la información de los clientes.

**Campos:**
- `nombre` (string): Nombre del cliente.
- `apellido` (string): Apellido del cliente.
- `dni` (string): Documento de identidad.
- `telefono` (string): Teléfono de contacto.
- `email` (string): Correo electrónico.
- `fechaCreacion` (string): Timestamp ISO.

---

## 2. Colección: `trabajos`
Almacena las órdenes de servicio técnico.

**Campos:**
- `numeroOrden` (string): Identificador único (ej. T-1001).
- `clienteId` (string): ID del cliente en la colección `clientes`.
- `nombre` (string): Nombre del cliente (denormalizado).
- `apellido` (string): Apellido del cliente (denormalizado).
- `equipo` (string): Tipo de equipo (celular, notebook, etc.).
- `marca` (string): Marca del equipo.
- `modelo` (string): Modelo del equipo.
- `falla` (string): Descripción del problema.
- `estado` (string): `Ingresado`, `En reparación`, `Listo`, `Entregado`.
- `precio` (number): Costo de la reparación.
- `itemsInventario` (array): Lista de repuestos utilizados.
  - Snapshot: `{ productoId, sku, nombre, cantidad, precioUnitario, subtotal, estado }`
- `fechaIngreso` (string): Timestamp ISO.

---

## 3. Colección: `productos`
Catálogo de productos y repuestos.

**Campos:**
- `nombre` (string): Nombre del producto.
- `sku` (string): Código único.
- `tipo` (string): `repuesto` o `producto`.
- `precioVenta` (number): Precio al público.
- `stock` (number): Cantidad física disponible.
- `stockMinimo` (number): Umbral para alertas.
- `activo` (boolean): Estado del producto.

---

## 4. Colección: `ventas`
Registro de transacciones del POS.

**Campos:**
- `cliente` (string): Nombre del cliente o "Consumidor Final".
- `items` (array): Lista de productos vendidos.
- `total` (number): Suma de subtotales.
- `metodoPago` (string): `efectivo`, `transferencia`, etc.
- `fecha` (string): Timestamp ISO.

---

## 5. Colección: `movimientos_stock`
Historial de auditoría de stock.

**Campos:**
- `productoId` (string): ID del producto.
- `tipo` (string): `ingreso`, `salida`, `venta`, `reserva`, `devolucion`.
- `cantidad` (number): Cantidad afectada.
- `motivo` (string): Descripción del movimiento.
- `usuario` (string): Email del operador.
- `fecha` (string): Timestamp ISO.
