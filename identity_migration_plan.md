# Plan de Migración de Identidad de Clientes

## Objetivo
Analizar el estado actual del sistema de identidad de clientes y proponer un plan de migración quirúrgico para implementar el nuevo modelo de identidad fija (`clienteCodigo`) y eliminar la corrupción relacional.

---

## 1. Funciones Afectadas

Basado en la búsqueda de términos clave, las siguientes funciones y archivos serán impactados:

### `js/work-service.js`
* **`createWork()`**: Actualmente busca coincidencias usando `findClienteMatch` y decide si reutilizar un `clienteId` o crear uno nuevo. Aquí se debe implementar la lógica de "Sugerir coincidencias pero dejar que el humano decida" y la creación del `clienteCodigo`.
* **`updateWork()`**: Actualmente actualiza los datos del cliente directamente. Se debe modificar para que NO busque coincidencias ni cambie el `clienteId`, y use el payload sanitizado.
* **`reenterWork()`**: Crea una nueva orden manteniendo el `clienteId` original. Debe mantener también el `clienteCodigo`.

### `js/work-repository.js`
* **`createNewCliente()`**: (Referenciado como `createCliente` en la solicitud). Se debe modificar para generar y guardar el `clienteCodigo` usando una transacción.
* **`updateCliente()`**: Se debe asegurar que solo actualice los campos específicos (`nombre`, `apellido`, `telefono`, `dni`, `alias`) y no el `clienteCodigo`.
* **`findClienteMatch()`**: Actualmente busca por DNI, teléfono o nombre y devuelve la primera coincidencia. Se debe modificar para devolver una lista de posibles coincidencias (para que el operador decida) en lugar de un único resultado determinista.

### `js/panel.js`
* **`updateCliente`**: Se usa en el CRM para actualizar datos. Debe alinearse con las nuevas reglas de actualización segura.

### `js/repair-service.js` y `js/deep-audit.js`
* Ambos archivos asumen el modelo actual de duplicados y merges. Deberán ser actualizados en etapas posteriores para contemplar el `clienteCodigo` y la nueva filosofía de no-merge automático.

---

## 2. Riesgos Detectados

1. **Ruptura de Referencias Históricas:** Si se modifica el `document.id` de los clientes existentes, todas las órdenes que apuntan a ellos quedarán huérfanas. El plan debe asegurar que el `document.id` se mantenga y solo se agregue el `clienteCodigo`.
2. **Condiciones de Carrera en Generación de Código:** Si dos operadores crean un cliente al mismo tiempo, podrían generar el mismo `clienteCodigo` si no se usa una transacción Firestore estricta (como se solicita en la Etapa 2).
3. **Falsos Positivos en Búsqueda:** La búsqueda por teléfono o DNI vacío/genérico (ej. "0000000000") puede sugerir coincidencias masivas. Se debe sanitizar la búsqueda para ignorar valores vacíos o genéricos.
4. **Sobrescritura Accidental:** El flujo actual de `updateWork` sobrescribe los datos del cliente. Si el operador edita una orden vieja que compartía cliente por error, romperá los datos del cliente real.

---

## 3. Referencias de `clienteId`

El campo `clienteId` es la clave relacional en la colección `trabajos`.
* En `work-repository.js`, se usa en consultas como `where("clienteId", "==", clienteId)` para listar trabajos por cliente.
* En `work-service.js`, se pasa en el estado de edición y se usa para vincular la orden con el cliente.
* **Decisión:** `clienteId` (que contiene el `document.id` de Firestore) debe seguir siendo la clave de unión en la base de datos para no romper el historial. El `clienteCodigo` será un campo adicional en el documento del cliente para uso humano y visual.

---

## 4. Referencias de Teléfono / DNI

* **DNI:** Se usa en `findClienteByDni` y `findClienteMatch` como criterio de coincidencia fuerte.
* **Teléfono:** Se usa en `findClienteMatch` como criterio de coincidencia media.
* Ambos campos seguirán existiendo pero ya no forzarán un merge o reutilización automática. Solo servirán para poblar la lista de "Sugerencias" en la UI.

---

## Conclusión del Precheck
El sistema está listo para la Etapa 1. Las funciones críticas están identificadas. No se encontraron funciones llamadas exactamente `upsertCliente` (excepto en sandbox) ni `mergeCliente`, lo que simplifica la remoción de la lógica de merge automático ya que está embebida directamente en `createWork` y `repair-service.js`.

> [!NOTE]
> Este reporte cumple con la Etapa 1. No se han realizado modificaciones en el código.
