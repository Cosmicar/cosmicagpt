# ARCHITECTURE - Cósmica

## Estructura de Módulos
El sistema está construido con Javascript Vanilla (puro) utilizando módulos ES6. No se utilizan frameworks pesados para mantener el sistema liviano y compatible con GitHub Pages.

- `panel.html`: Archivo principal de la interfaz de usuario.
- `js/panel.js`: Lógica principal del panel de control y gestión de órdenes.
- `js/inventario.js`: Lógica de la interfaz de inventario y ventas.
- `js/inventario-repository.js`: Acceso a datos (Firestore) para inventario y ventas.
- `js/work-service.js`: Lógica de negocio para órdenes de trabajo.
- `js/work-repository.js`: Acceso a datos (Firestore) para órdenes y clientes.
- `js/system-service.js`: Configuración del sistema, Safe Mode y Logger.
- `js/domain.js`: Constantes, estados y reglas de negocio.

## Colecciones de Firestore
- `clientes`: Datos de clientes.
- `trabajos`: Órdenes de servicio técnico.
- `productos`: Catálogo de repuestos y productos.
- `ventas`: Registro de transacciones del POS.
- `movimientos_stock`: Historial de ingresos, salidas, ventas y reservas.
- `config`: Documento `system` para control de módulos.
- `system_logs`: Registro de auditoría y errores.

*Nota: Para usuarios con rol 'tester', se utilizan colecciones con sufijo `_demo` (ej. `productos_demo`).*

## Flujos Clave

### Flujo de Órdenes e Inventario
1. Se crea la orden (`Ingresado`).
2. Se pasa a `En reparación` y se pueden agregar repuestos.
3. Al agregar un repuesto, se registra un movimiento de tipo `reserva`.
4. Al pasar la orden a `Entregado`, se ejecuta una transacción que descuenta el stock real y confirma la reserva.

### Flujo de Ventas (POS)
1. Se agregan productos al carrito.
2. Se valida el stock disponible.
3. Al confirmar, una transacción de Firestore valida el stock final, descuenta las cantidades y registra la venta y los movimientos de stock.

## Safe Mode
El sistema consulta periódicamente (o al cargar) el documento `config/system`. Si `inventarioActivo` o `ventasActivas` están en `false`, las interfaces correspondientes se bloquean o muestran advertencias, protegiendo el sistema sin romper la operación de órdenes técnicas.

## Logger
La función `logSystem(tipo, payload, level)` permite registrar eventos en la colección `system_logs`. Se utiliza para auditar operaciones críticas y registrar fallos en transacciones.
