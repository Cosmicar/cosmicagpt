# Cósmica - Resumen General del Sistema
**Fecha:** 11 de Mayo de 2026  
**Documento:** Información de Arquitectura y Funcionalidad

Este documento proporciona una visión global y de alto nivel del funcionamiento del sistema Cósmica, desde la base de datos hasta la interfaz de usuario.

---

## 🗄️ 1. Base de Datos (Firestore)
*   **Tecnología:** Firebase Firestore (Base de datos NoSQL en tiempo real).
*   **Estructura de Colecciones:**
    *   `clientes`: Almacena datos de identidad (DNI), contacto y trazabilidad.
    *   `trabajos`: Registro de órdenes de servicio (Taller, Remoto, Mixto).
    *   `config`: Parámetros de configuración global y contadores de secuencias (ej. `clienteCodigo`).
*   **Seguridad:** Reglas granulares (`firestore.rules`) que restringen el acceso según el rol del usuario autenticado.

## 🧠 2. Capa de Datos y Lógica (JS Services)
*   **Repositorio (`work-repository.js`):** Gestiona la comunicación directa con Firestore. Realiza búsquedas avanzadas y operaciones complejas como la unificación (*merge*) de clientes sin pérdida de historial.
*   **Servicios (`work-service.js`):** Aplica las reglas operativas sobre los datos, gestionando el ciclo de vida de las órdenes y la lógica contable.

## ⚖️ 3. Reglas de Negocio y Dominio (`domain.js`)
*   **Estados de Orden:** Controla las transiciones válidas de los trabajos (Ingresado → En Reparación → Listo → Entregado).
*   **Lógica Contable:** Distribuye los ingresos según el tipo de trabajo (Taller vs. Remoto) y el estado de liquidación, aplicando las comisiones correspondientes.

## 🔐 4. Autenticación y Permisos (`auth-service.js`)
*   Gestión de sesiones y control de accesos basado en roles:
    *   **Admin:** Acceso total, métricas financieras y gestión estructural.
    *   **Operador:** Gestión diaria de clientes y órdenes de trabajo.
    *   **Tester:** Modo de solo lectura para auditorías o pruebas.

## 🖥️ 5. Interfaz y Experiencia de Usuario (`panel.js` / `panel.html`)
*   **Diseño "Space-Tech":** Interfaz inmersiva en modo oscuro con códigos de color de alto contraste para estados operativos.
*   **Panel Operativo:** Single Page Application (SPA) con buscador en tiempo real, filtros avanzados de demora y tipo de servicio.
*   **Optimización:** Renderizado no bloqueante y consultas en paralelo para asegurar fluidez incluso con grandes volúmenes de datos.

## 🔌 6. Módulos Especiales e Integraciones
*   **Notificaciones (`fcm-service.js`):** Firebase Cloud Messaging para alertas push en segundo plano.
*   **Impresión (`ticket.js`):** Generación de comprobantes físicos para el cliente.
*   **Facturación:** Módulo preparado para integración con parámetros fiscales (AFIP).

---
*Cósmica - "Usted está aquí para siempre"*
