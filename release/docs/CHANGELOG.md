# CHANGELOG - Cósmica

## [v0.9-stable] - 2026-05-10

### Agregado
- **Módulo de Inventario**: Gestión de productos, stock, categorías y proveedores.
- **Módulo de Ventas (POS)**: Carrito de compras, registro de ventas y emisión de tickets (simulados).
- **Integración Inventario-Tickets**:
  - Posibilidad de agregar repuestos a las órdenes de trabajo.
  - Reserva de stock al agregar repuesto (no descuenta stock físico).
  - Confirmación de stock al entregar la orden (descuenta stock físico y registra movimiento).
  - Liberación de reserva al cancelar o eliminar la orden.
- **Logger del Sistema**: Registro de eventos y errores en Firestore (`system_logs`) con niveles de severidad.
- **Safe Mode**: Verificación de estado de módulos (activo/desactivo) antes de operar.

### Modificado
- `panel.html`: Se agregó la sección "🧩 Repuestos utilizados" y el modal de ventas.
- `js/panel.js`: Integración de funciones de búsqueda y adición de repuestos.
- `js/work-service.js`: Hook en el cambio de estado a "Entregado" para confirmar stock.
- `js/domain.js`: Agregados estados de reserva y tipos de movimiento.

### Solucionado (QA & Hardening)
- **Fix**: Bloqueo de doble click en el botón "Guardar" de órdenes para evitar duplicados.
- **Fix**: Bloqueo de doble click en el botón "Confirmar Venta" para evitar ventas duplicadas.
- **Fix**: Validación de tipos numéricos en la creación de productos para evitar valores `NaN` en Firestore.
- **Seguridad**: Validación de stock en transacciones de Firestore para evitar stock negativo en ventas concurrentes.
