# Cósmica - Notas de Lanzamiento (Release Notes)
**Fecha:** 11 de Mayo de 2026  
**Estado:** Estable | Optimizado | Listo para Operación

Este documento resume las mejoras, correcciones y nuevas funcionalidades implementadas en la versión actual del sistema de gestión Cósmica.

---

## 🚀 Nuevas Características y Mejoras UX

### 🔍 Panel de Búsqueda de Trabajos Avanzado
Se rediseñó por completo la sección de búsqueda para mejorar la productividad de los operadores:
*   **Filtros de Tipo de Servicio:** Ahora es posible filtrar por *Taller*, *Remoto* o *Mixto*.
*   **Filtros de Demora (Admin):** Filtros rápidos para ver trabajos sin movimiento por más de 3, 7 o 15 días.
*   **Filtros Rápidos (Pills):**
    *   `Solo activos`: Muestra únicamente trabajos en estado *Ingresado*, *En reparación* o *Listo*.
    *   `⚠ Abandonados`: Filtra trabajos con más de 7 días sin actualizar.
    *   `📦 Listos`: Filtra trabajos listos para entrega.
*   **Tooltips de Actividad:** Al pasar el mouse (o mantener presionado en mobile) sobre la etiqueta de demora, se muestra la fecha y hora exacta del último movimiento.

### 🔄 Sincronización Automática
*   **Auto-Refresh Silencioso:** El panel se actualiza automáticamente cada 60 segundos.
*   **Detección de Actividad:** El refresco se pausa automáticamente si el usuario tiene un modal abierto o está editando un formulario para evitar pérdida de datos.
*   **Indicador de Sincronización:** Se añadió un texto en el título que indica la última hora de actualización exitosa.

---

## 🛠️ Correcciones Críticas (Fixes)

### ⏱️ Timezone y Reset Contable (Fix Argentina)
*   **Bug:** El contador "Entregado hoy" se reiniciaba a las 21:00 hs (Arg) debido al uso de la hora UTC.
*   **Solución:** Se implementaron helpers de fecha local (`isTodayLocal`) que garantizan que el reseteo ocurra exactamente a las 00:00:00 hora local del cliente.

### 🔗 Integración CRM - "Nuevo Trabajo"
*   **Bug:** El botón "Nuevo Trabajo" dentro del perfil del cliente no funcionaba por un problema de visibilidad de variables de módulo.
*   **Solución:** Se expuso el ID del cliente de forma segura al contexto global, permitiendo la creación fluida de órdenes pre-completadas desde el perfil.

### 👥 Integridad en Merge de Clientes
*   Se corrigió la inconsistencia post-merge que dejaba clientes "fantasma" o heredaba estados incorrectos (como marcar como "Taller" erróneamente).
*   Se aseguró que el historial de servicios se mueva íntegramente al cliente principal.

---

## ⚙️ Optimización y Rendimiento

### ⚡ Carga Acelerada y Renderizado No Bloqueante
*   **Carga en Paralelo:** Las consultas de trabajos y mapeo de clientes ahora se ejecutan en paralelo, reduciendo el tiempo de espera inicial.
*   **Prioridad Visual:** Los contadores operativos (Activos, Listos, etc.) se calculan y muestran **inmediatamente** al llegar los datos. El renderizado pesado de las tarjetas de trabajos se difiere unos milisegundos para no congelar la pantalla.
*   **Carga Bajo Demanda:** Se eliminó la carga masiva automática al entrar al panel. Ahora el sistema espera una búsqueda o la aplicación de un filtro, ahorrando recursos de Firebase.

---

## 🛡️ Seguridad y Reglas de Negocio
*   **Hardening de UI:** Los elementos administrativos (como filtros específicos y botones de borrado) no solo se ocultan, sino que se eliminan físicamente del DOM si el usuario no tiene rol de admin.
*   **Estructura Intacta:** No se modificaron estructuras en Firestore ni se rompieron desacoples existentes.

---
*Cósmica - "Usted está aquí para siempre"*
