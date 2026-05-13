/**
 * Estructura base para vistas del SaaS Cosmica
 * Proporciona un ciclo de vida mínimo para evitar hacks temporales.
 */
export class BaseView {
  /**
   * Genera el HTML de la vista.
   * @returns {string} HTML string
   */
  render() {
    return '';
  }

  /**
   * Se ejecuta inmediatamente después de inyectar el HTML en el DOM.
   * Ideal para bindear eventos y manipular el DOM directamente.
   */
  afterRender() {
    // Implementar en subclases
  }

  /**
   * Se ejecuta antes de remover la vista del DOM.
   * Ideal para limpiar eventos, timers o suscripciones.
   */
  destroy() {
    // Implementar en subclases
  }
}
