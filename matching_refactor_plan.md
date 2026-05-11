# Plan de Refactorización de Matching de Clientes

## Objetivo
Auditar el sistema actual de búsqueda y coincidencia de clientes para eliminar los merges automáticos y la reutilización forzada de `clienteId`, preparando el terreno para un sistema donde el operador siempre decide.

---

## 1. Flujos Afectados

### A. Creación de Órdenes (`js/work-service.js` -> `createWork()`)
* **Estado Actual:** Llama a `findClienteMatch()`. Si encuentra una coincidencia (por DNI, teléfono o nombre), usa `window.confirm` para preguntar al usuario si desea reutilizar el cliente o actualizar sus datos. Si el usuario confirma, se reutiliza el `clienteId`.
* **Impacto:** Este es el punto principal de "auto reuse" y "auto merge". Debe ser desacoplado para que no tome decisiones automáticas ni use prompts bloqueantes de navegador.

### B. Búsqueda de Coincidencias (`js/work-repository.js` -> `findClienteMatch()`)
* **Estado Actual:** Ejecuta consultas secuenciales (DNI, luego Teléfono, luego Nombre). Retorna la **primera** coincidencia que encuentra como un objeto único `{ type, client }`.
* **Impacto:** Debe ser refactorizada para no detenerse en la primera coincidencia, sino acumular todas las coincidencias encontradas en un array y retornarlas con un score o tipo de coincidencia.

### C. Interfaz de Usuario (`js/panel.js`)
* **Estado Actual:** Llama a `createWork()` y espera que se resuelva o falle. No tiene control sobre el flujo de coincidencia (confía en los `window.confirm` que dispara `createWork`).
* **Impacto:** Deberá implementar el modal `modalCoincidenciasCliente` y manejar la pausa en el flujo de creación para esperar la decisión del operador.

---

## 2. Puntos Peligrosos (Hotspots)

1. **Uso de `window.confirm` en la capa de servicio:** `work-service.js` contiene lógica de UI (`window.confirm`). Esto dificulta la implementación de un modal personalizado en `panel.js`.
2. **Sobrescritura en coincidencia por DNI:** En `createWork()`, si coincide el DNI, el sistema actualiza el cliente casi de forma forzada si el operador acepta. Esto es peligroso si el DNI fue ingresado por error.
3. **Falta de paginación o límites en coincidencia:** Si `findClienteMatch` devuelve un array, debemos asegurar que no traiga cientos de documentos si el criterio es muy amplio (ej. un apellido común).

---

## 3. Riesgos Detectados

1. **Complejidad en el flujo asíncrono:** Pasar de un `confirm` bloqueante a un modal de UI requiere reestructurar `createWork` para que retorne un estado de "coincidencias encontradas" y permitir que la UI retome la operación después de que el usuario elija.
2. **Duplicación excesiva:** Al no forzar el reuso, si los operadores son perezosos y eligen siempre "Crear Nuevo", la base de datos se llenará de duplicados (aunque ahora rastreables por `clienteCodigo`).

---

## 4. Referencias Críticas

* `js/work-repository.js: findClienteMatch()` (Línea 39)
* `js/work-service.js: createWork()` (Línea 109)
* `js/panel.js` (Línea 1347 - llamada a `createWork`)

> [!NOTE]
> Este reporte cumple con la Etapa 3A. No se han realizado modificaciones en el código.
