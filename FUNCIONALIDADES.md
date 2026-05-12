# Cósmica - Catálogo de Funcionalidades
**Fecha:** 11 de Mayo de 2026  
**Documento:** Guía Funcional del Sistema

Este documento detalla todas las capacidades y herramientas que ofrece el sistema Cósmica para la gestión operativa y de clientes.

---

## 👥 1. Gestión de Clientes (CRM)

El sistema cuenta con un módulo completo de CRM para la trazabilidad de los clientes:
*   **Alta y Edición de Clientes:** Formulario para registrar Nombre, Apellido, DNI, Teléfono, Provincia y Origen del contacto.
*   **Identificación Secuencial:** Generación automática de códigos de cliente con formato `CLI-XXXX` para clientes activos.
*   **Búsqueda en Directorio:** Buscador de texto completo por Nombre, Apellido o DNI con filtrado instantáneo en memoria.
*   **Perfil y Trazabilidad:** Al abrir un cliente, se accede a su ficha completa y al historial cronológico de todos los servicios que ha solicitado.
*   **Herramienta de Unificación (Merge):** Permite fusionar dos fichas de clientes duplicadas, migrando de forma transparente todas las órdenes pasadas al perfil definitivo.

---

## 📋 2. Gestión de Órdenes de Trabajo

El núcleo operativo del sistema permite controlar el ciclo de vida de los servicios:
*   **Ingreso de Trabajos:** Creación de órdenes especificando tipo de servicio (*Taller*, *Remoto* o *Mixto*).
*   **Acceso Rápido desde Cliente:** Botón para crear un "Nuevo Trabajo" directamente desde la ficha del cliente, auto-completando sus datos.
*   **Control de Flujo de Estados:** Las órdenes avanzan por una secuencia lógica y controlada: `Ingresado` → `En reparación` → `Listo` → `Entregado` (o `Reingresada`).
*   **Buscador de Trabajos:** Motor que permite localizar órdenes específicas ingresando el DNI del cliente, el número de orden o el nombre.
*   **Filtros Avanzados:** Segmentación por estado de la orden, tipo de trabajo y alertas de inactividad (+3, +7 y +15 días).
*   **Filtros Rápidos (Pills):** Botones de un solo clic para aislar trabajos *Abandonados* y trabajos *Listos* para entrega.

---

## 📊 3. Dashboard y Control Contable

Pantalla principal con métricas en tiempo real para la toma de decisiones:
*   **Contadores Operativos:** Indicadores numéricos siempre visibles de trabajos *Activos*, *Listos*, *Entregados hoy* y *Abandonados*.
*   **Cálculo de Caja Diaria ("Entregado hoy"):** Suma de los ingresos generados por los trabajos entregados en el día en curso.
*   **Cálculo de Caja Mensual ("Entregado este mes"):** Acumulado de ingresos del mes actual.
*   **Regla de Contribución Contable:** El sistema calcula automáticamente el valor real para la empresa según si el trabajo es de taller (comisión del 20% al liquidar) o remoto (100%).

---

## 🔔 4. Servicios Especiales y Comunicación

*   **Notificaciones Push (FCM):** Sistema de alertas sonoras y visuales en tiempo real para nuevos trabajos, operando incluso en segundo plano a través de Service Workers.
*   **Impresión de Tickets:** Generador de comprobantes de servicio listos para imprimir y entregar al cliente.
*   **Pre-Facturación:** Interfaz preparada para la conexión con datos de facturación (AFIP) directamente vinculada a la orden de servicio.

---
*Cósmica - "Usted está aquí para siempre"*
