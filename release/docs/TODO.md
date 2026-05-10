# TODO - Cósmica

## 🐛 Bugs Menores / Validaciones Pendientes
- [ ] **Validación de SKU Único**: Actualmente Firestore no valida que el SKU no esté duplicado en la colección de productos. Se sugiere agregar una consulta de verificación antes de crear.
- [ ] **Validación de DNI**: Aunque ya no es obligatorio, si se ingresa, se podría validar el formato.

## 🚀 Mejoras Futuras (Fases Posteriores)
- [ ] **Cálculo de Márgenes**: Implementar el cálculo de costo real y margen de ganancia en base a `precioCompra` y `precioVenta`.
- [ ] **Estadísticas**: Dashboard de productos más vendidos, repuestos más usados y rendimiento de técnicos.
- [ ] **Firma Digital**: Firma del cliente al recibir el equipo (mencionada en fases iniciales).

## ⚓ Deuda Técnica
- [ ] **Manejo de Estado**: El estado está fragmentado en varios archivos (`state` en `panel.js`, variables locales en `inventario.js`). Se recomienda unificarlo en un store simple o un archivo de estado global.
- [ ] **Event Listeners**: El proyecto usa muchos manejadores inline (`onclick="..."`). Sería más limpio migrarlos a `addEventListener` para mejor separación de conceptos.

## ⚡ Optimizaciones Pendientes
- [ ] **Paginación**: Las listas de trabajos y productos cargan todos los documentos. Si la base de datos crece, impactará en rendimiento y costos de Firestore. Implementar paginación por scroll o botones.
- [ ] **Cache**: Mejorar el sistema de cache para evitar lecturas repetitivas de configuraciones.
