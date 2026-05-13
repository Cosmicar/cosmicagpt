# Auditoría Técnica: Cosmica SaaS Core v1.0

**Fecha:** 13 de Mayo, 2026  
**Módulo:** `/apps/cosmica-app`  
**Estado General:** 🟢 Estable / Fase de Crecimiento

## 1. Análisis de Estructura y Arquitectura

### Fortalezas (OK)
- **Separación de Concernimientos:** Clara división entre `core`, `services`, `views` y `components`.
- **Desacople de Firebase:** La lógica de Firestore está confinada en `services`, permitiendo que las `views` sean agnósticas a la base de datos.
- **Router Modular:** Sistema de enrutamiento basado en hash funcional y fácil de extender.
- **Sistema de Diseño Consistente:** Uso de variables CSS globales y componentes visuales reutilizables (`breadcrumb`, `toast`, `form-field`).
- **Bootstrap de Sesión:** El puente entre el auth legacy y el nuevo SaaS está bien implementado en `core/session.js`.

### Riesgos Detectados (Revisar)
- **Vistas "Heavy":** Archivos como `cliente-form.js` están asumiendo doble responsabilidad: renderizado de HTML y lógica de eventos del DOM (`initFormHandlers`). 
- **DOM Reconciliation Manual:** El uso de `innerHTML` + `setTimeout` para re-bindear eventos es propenso a errores si la vista se vuelve muy dinámica.
- **Estilos In-JS:** Componentes como `toast.js` inyectan bloques `<style>` dinámicamente. Esto es útil para desacople pero puede fragmentar la gestión de estilos globales.

## 2. Detección de Inconsistencias

| Hallazgo | Clasificación | Observación |
| :--- | :--- | :--- |
| `toggleFormLoading` en views | **Refactor Futuro** | Lógica repetitiva. Debería ser un helper o parte de un "Base Form Component". |
| `setTimeout(() => initHandlers(), 0)` | **Riesgo Crítico** | Patrón frágil para el ciclo de vida del DOM. Si el render tarda más de lo esperado, los eventos no se bindean. |
| Dependencias relativas `../../../js/` | **Revisar** | El SaaS depende fuertemente de la carpeta `js` legacy. Un cambio en la raíz podría romper el SaaS sin aviso. |
| `toast-container` global | **OK** | Bien gestionado como singleton, evita duplicados en el DOM. |

## 3. Deuda Técnica

1. **Gestión de Estados Local:** No hay un store central (tipo Redux/Zustand ligero). Cada vista gestiona su propio estado de carga y errores.
2. **Validación de Formularios:** La validación está repartida entre el HTML nativo y lógica manual en los servicios. Falta un validador centralizado de esquemas.
3. **Layout Rigidez:** El sidebar y navbar están hardcodeados en el HTML base (`index.html`), lo que dificulta layouts condicionales (ej. modo kiosk o pantalla completa).

## 4. Recomendaciones Prioritarias

1. **Prioridad Alta:** Crear un `BaseView` o un sistema de "Lifecycle" para el Router que asegure que los eventos se bindeen después de que el DOM esté listo de forma determinística (sustituir el `setTimeout`).
2. **Prioridad Media:** Migrar las dependencias de `../../../js/` a una carpeta `shared` o `lib` dentro de `apps/cosmica-app` para blindar el núcleo SaaS contra cambios en el código legacy.
3. **Prioridad Baja:** Implementar un sistema de "Hooks" simple para manejar estados de formularios comunes (loading, error, reset).

---
*Fin del Reporte de Auditoría*
