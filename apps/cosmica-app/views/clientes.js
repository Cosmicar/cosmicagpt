import { AsyncView } from '../core/async-view.js';
import { getClientes } from '../services/clientes.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { render as renderClientCard } from '../components/client-card.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';
import { renderEmptyState } from '../components/app-state.js';

/**
 * Vista de Clientes con Búsqueda Rápida Local
 */
export class ClientesView extends AsyncView {
  constructor() {
    super();
    this.containerId = 'clientes-container';
    this.allClientes = [];
  }

  async loadData() {
    this.allClientes = await getClientes();
    return this.allClientes;
  }

  renderContent(clientes) {
    let html = renderBreadcrumb([
      { label: 'Administración', href: '#dashboard', icon: '📁' },
      { label: 'Clientes', href: '#clientes', icon: '👥' }
    ]);
    
    html += renderSectionHeader('Clientes', 'Listado de clientes registrados en el sistema Cosmica.', '👥 Módulo');
    
    // Controles de búsqueda y acción
    html += `
      <div style="margin-top: var(--space-lg); display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: var(--space-md);">
        <div style="position: relative; flex: 1; min-width: 250px; max-width: 450px;">
          <input type="text" id="cliente-search" class="input-field" placeholder="Buscar por nombre, DNI o teléfono..." style="padding-left: 40px; margin-bottom: 0;">
          <span style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); opacity: 0.5;">🔍</span>
        </div>
        <a href="#cliente-nuevo" class="btn btn-primary">
          <i>➕</i> Nuevo Cliente
        </a>
      </div>
      
      <div id="clientes-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-lg); margin-top: var(--space-xl);">
        ${this.renderCards(clientes)}
      </div>
    `;
    return html;
  }

  /**
   * Renderiza solo el grid de cards
   */
  renderCards(clientes) {
    if (clientes.length === 0) {
      return `
        <div style="grid-column: 1 / -1;">
          ${renderEmptyState('No se encontraron clientes que coincidan con la búsqueda.')}
        </div>
      `;
    }
    return clientes.map(c => renderClientCard(c)).join('');
  }

  onContentReady() {
    const searchInput = document.getElementById('cliente-search');
    const grid = document.getElementById('clientes-grid');
    
    if (searchInput && grid) {
      searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        this.filter(term, grid);
      });
      
      // Auto-focus en búsqueda para mejor UX
      searchInput.focus();
    }
  }

  filter(term, grid) {
    if (!term) {
      grid.innerHTML = this.renderCards(this.allClientes);
      return;
    }

    const filtered = this.allClientes.filter(c => {
      return (
        (c.nombre && c.nombre.toLowerCase().includes(term)) ||
        (c.dni && c.dni.toLowerCase().includes(term)) ||
        (c.telefono && c.telefono.toLowerCase().includes(term))
      );
    });

    grid.innerHTML = this.renderCards(filtered);
  }

  renderEmpty() {
    return super.renderEmpty('No hay clientes registrados en el sistema.');
  }
}
