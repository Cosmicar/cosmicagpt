import { BaseView } from '../core/base-view.js';
import { getClientes } from '../services/clientes.js';
import { renderLoadingState, renderErrorState, renderEmptyState } from '../components/app-state.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { render as renderClientCard } from '../components/client-card.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';

/**
 * Vista de Clientes
 */
export class ClientesView extends BaseView {
  render() {
    return `
      <div id="clientes-container">
        ${renderLoadingState()}
      </div>
    `;
  }

  afterRender() {
    this.loadClientesData();
  }

  async loadClientesData() {
    const container = document.getElementById('clientes-container');
    if (!container) return;
    
    try {
      const clientes = await getClientes();
      
      if (clientes.length === 0) {
        container.innerHTML = renderEmptyState('No hay clientes registrados en el sistema.');
        return;
      }
      
      let html = renderBreadcrumb([
        { label: 'Administración', href: '#dashboard', icon: '📁' },
        { label: 'Clientes', href: '#clientes', icon: '👥' }
      ]);
      
      html += renderSectionHeader('Clientes', 'Listado de clientes registrados en el sistema Cosmica.', '👥 Módulo');
      
      html += `
        <div style="margin-top: var(--space-lg); display: flex; justify-content: flex-end;">
          <a href="#cliente-nuevo" class="btn btn-primary">
            <i>➕</i> Nuevo Cliente
          </a>
        </div>
      `;
      
      html += `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-lg); margin-top: var(--space-xl);">
      `;
      
      clientes.forEach(cliente => {
        html += renderClientCard(cliente);
      });
      
      html += `</div>`;
      container.innerHTML = html;
      
    } catch (error) {
      console.error("Error al cargar datos de clientes en la vista:", error);
      container.innerHTML = renderErrorState('No se pudo cargar el listado de clientes. Verifica tu conexión.');
    }
  }
}
