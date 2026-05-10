# Checklist Operativo para Producción - Cósmica

Antes de liberar la versión para uso real, se deben verificar los siguientes puntos:

## 🔐 Autenticación y Acceso
- [ ] El login funciona correctamente con Firebase Auth.
- [ ] Los roles (admin, operador, tester) restringen las vistas adecuadas.
- [ ] La sesión persiste o requiere re-login según la política.

## 🛠️ Órdenes Técnicas
- [ ] Se pueden crear órdenes sin errores.
- [ ] El cambio de estado a "Entregado" realiza los descuentos de stock si hay repuestos asociados.
- [ ] La eliminación de órdenes libera las reservas.

## 📦 Inventario y Ventas
- [ ] No se pueden vender productos con stock 0.
- [ ] No se pueden agregar al carrito más unidades de las disponibles.
- [ ] Las transacciones de venta fallan limpiamente si se agota el stock en el último segundo.

## 📄 Tickets
- [ ] La generación de tickets de servicio se abre en una ventana nueva y se puede imprimir.
- [ ] La generación de tickets de venta se abre y muestra los datos correctos.

## 🔥 Firestore
- [ ] Las reglas de seguridad (`firestore.rules`) están desplegadas y restringen accesos no autorizados.
- [ ] No hay escrituras en colecciones principales desde cuentas de 'tester'.
- [ ] Se cuenta con un plan de backups periódicos (manual o automático en Firebase).

## 🛡️ Estabilidad (Hardening)
- [ ] Los botones de Guardar y Confirmar Venta se deshabilitan durante la espera.
- [ ] No se permiten valores `NaN` en los formularios de productos.

## 📊 Monitoreo
- [ ] Los errores críticos se registran en `system_logs`.
- [ ] El Safe Mode responde a los cambios en el documento `config/system`.
