import { BaseView } from './base-view.js';
import { renderLoadingState, renderErrorState, renderEmptyState } from '../components/app-state.js';

/**
 * Especialización de BaseView para manejar datos asíncronos de forma estandarizada.
 * Automatiza los estados de carga, error y vacío.
 */
export class AsyncView extends BaseView {
  constructor() {
    super();
    this.containerId = 'async-view-container';
  }

  /**
   * Render inicial que coloca el contenedor y el estado de carga.
   */
  render() {
    return `
      <div id="${this.containerId}">
        ${this.renderLoading()}
      </div>
    `;
  }

  /**
   * Ejecuta el fetch de datos automáticamente después del render inicial.
   */
  async afterRender() {
    await this.fetchAndRender();
  }

  /**
   * Orquestador del flujo asíncrono.
   */
  async fetchAndRender() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    try {
      const data = await this.loadData();

      if (!data || (Array.isArray(data) && data.length === 0)) {
        container.innerHTML = this.renderEmpty();
      } else {
        container.innerHTML = this.renderContent(data);
        // Gancho opcional para bindeo de eventos después de renderizar el contenido real
        this.onContentReady(data);
      }
    } catch (error) {
      console.error(`Error en AsyncView (${this.constructor.name}):`, error);
      container.innerHTML = this.renderError(error.message);
    }
  }

  /**
   * Métodos para sobreescribir en las subclases
   */

  async loadData() {
    throw new Error('Método loadData() debe ser implementado');
  }

  renderContent(data) {
    throw new Error('Método renderContent(data) debe ser implementado');
  }

  onContentReady(data) {
    // Opcional
  }

  renderLoading() {
    return renderLoadingState();
  }

  renderError(message) {
    return renderErrorState(message);
  }

  renderEmpty() {
    return renderEmptyState('No se encontraron resultados.');
  }
}
