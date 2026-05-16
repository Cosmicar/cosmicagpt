import { BaseView } from './base-view.js';
import { renderLoadingState, renderErrorState, renderEmptyState } from '../components/app-state.js';

/**
 * Especialización de BaseView para manejar datos asíncronos de forma estandarizada.
 * Automatiza los estados de carga, error y vacío.
 */
export class AsyncView extends BaseView {
  constructor(params) {
    super(params);
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

    // Reset any pending stale timer — fresh data is being loaded
    this._resetStaleTimer();

    try {
      const data = await this.loadData();

      // Guard: si la ruta cambió mientras cargábamos, el container ya fue
      // desmontado del DOM. Escribir sobre él contaminaría la vista nueva.
      if (!container.isConnected) return;

      if (!data || (Array.isArray(data) && data.length === 0)) {
        container.innerHTML = this.renderEmpty();
      } else {
        container.innerHTML = this.renderContent(data);
        // Gancho opcional para bindeo de eventos después de renderizar el contenido real
        this.onContentReady(data);
      }

      // Start stale timer if the view opted in (set this._staleTimerMs in constructor)
      this._resetStaleTimer();
    } catch (error) {
      if (!container.isConnected) return; // Navegación ocurrió durante el fetch
      console.error(`Error en AsyncView (${this.constructor.name}):`, error);
      container.innerHTML = this.renderError(error.message);
    }
  }

  /**
   * Clears any running stale timer and starts a new one if this._staleTimerMs
   * is set on the view.  When the timer fires it injects a subtle "⟳ Actualizar"
   * button into the first .sticky-ops-bar found in the document.
   * Subclasses opt in by setting `this._staleTimerMs` in their constructor.
   */
  _resetStaleTimer() {
    clearTimeout(this._staleTimerId);
    this._staleTimerId = null;
    if (!this._staleTimerMs) return;

    this._staleTimerId = setTimeout(() => {
      // Don't duplicate the indicator if it's already there
      if (document.getElementById('cosmica-stale-indicator')) return;

      const bar = document.querySelector('.sticky-ops-bar');
      if (!bar) return;

      const btn = document.createElement('button');
      btn.id = 'cosmica-stale-indicator';
      btn.className = 'btn btn-sm';
      btn.style.cssText = [
        'color:var(--accent-orange)',
        'border-color:rgba(249,115,22,0.3)',
        'font-size:11px',
        'margin-left:auto',
        'flex-shrink:0',
      ].join(';');
      btn.textContent = '⟳ Actualizar datos';
      btn.setAttribute('title', 'Los datos pueden estar desactualizados. Haz clic para recargar.');
      btn.addEventListener('click', () => {
        btn.remove();
        this.fetchAndRender();
      });
      bar.appendChild(btn);
    }, this._staleTimerMs);
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
    // Por defecto usa el genérico, pero las subclases pueden sobreescribir para usar skeletons específicos
    return renderLoadingState();
  }

  renderError(message) {
    return renderErrorState(message);
  }

  renderEmpty() {
    return renderEmptyState('No se encontraron resultados.');
  }
}
