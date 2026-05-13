import { AsyncView } from '../core/async-view.js';
import { getClientes } from '../services/clientes.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { render as renderClientCard } from '../components/client-card.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';

/**
 * Vista de Clientes
 */
export class ClientesView extends AsyncView {
  constructor() {
    super();
    this.containerId = 'clientes-container';
  }

  async loadData() {
    return await getClientes();
  }

  renderContent(clientes) {
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
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-lg); margin-top: var(--space-xl);">
    `;
    
    clientes.forEach(cliente => {
      html += renderClientCard(cliente);
    });
    
    html += `</div>`;
    return html;
  }

  renderEmpty() {
    return super.renderEmpty('No hay clientes registrados en el sistema.');
  }
}
