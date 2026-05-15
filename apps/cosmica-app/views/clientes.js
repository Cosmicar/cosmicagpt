import { AsyncView } from '../core/async-view.js';
import { getClientes, deleteCliente, mergeClientes } from '../services/clientes.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { render as renderClientCard } from '../components/client-card.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';
import { renderEmptyState, renderCardSkeletonList } from '../components/app-state.js';
import { seedPaletteCache } from '../components/command-palette.js';
import { showToast } from '../components/toast.js';
import { getTickets } from '../services/tickets.js';
import { getClientBadge } from '../core/intelligence.js';

/**
 * Vista de Clientes con Búsqueda Rápida Local
 */
const VIEW_MODES = [
  { key: 'compact',     label: '⊟',  title: 'Compacto'  },
  { key: 'comfortable', label: '⊞',  title: 'Normal'    },
  { key: 'expanded',    label: '▦',  title: 'Expandido' },
];
const VM_STORAGE_KEY = 'clientsViewMode';

export class ClientesView extends AsyncView {
  constructor() {
    super();
    this.containerId = 'clientes-container';
    this.allClientes = [];
    const saved = localStorage.getItem(VM_STORAGE_KEY) || 'comfortable';
    const isMobile = window.innerWidth < 768;
    this.viewMode = isMobile ? 'comfortable' : saved;
  }

  renderViewModeSelector() {
    return `
      <div class="vm-selector" style="
        display: flex; gap: 3px;
        background: rgba(255,255,255,0.04);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: 4px;
      ">
        ${VIEW_MODES.map(m => `
          <button
            class="btn btn-sm vm-btn ${this.viewMode === m.key ? 'active' : ''}"
            data-mode="${m.key}"
            title="${m.title}"
            style="min-width: 32px; font-size: 14px; padding: 4px 8px;"
          >${m.label}</button>
        `).join('')}
      </div>`;
  }

  async loadData() {
    const [clientes, tickets] = await Promise.all([getClientes(), getTickets()]);
    
    this.allClientes = clientes.map(c => {
      const ticketCount = tickets.filter(t => t.clienteId === c.id).length;
      return {
        ...c,
        ticketCount,
        badge: getClientBadge(ticketCount)
      };
    });

    seedPaletteCache({ clients: this.allClientes });
    return this.allClientes;
  }

  /**
   * Override para usar skeletons de cards
   */
  renderLoading() {
    return `
      <div style="margin-top: var(--space-xl);">
        <div class="skeleton" style="width: 200px; height: 32px; margin-bottom: var(--space-lg);"></div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-lg);">
          ${renderCardSkeletonList(6)}
        </div>
      </div>
    `;
  }

  renderContent(clientes) {
    let html = renderBreadcrumb([
      { label: 'Administración', href: '#dashboard', icon: '📁' },
      { label: 'Clientes', href: '#clientes', icon: '👥' }
    ]);
    
    html += renderSectionHeader('Clientes', 'Listado de clientes registrados en el sistema Cosmica.', '👥 Módulo');
    
    // Controles de búsqueda y acción
    html += `
      <div class="flex-between animate-fade-in" style="margin-top: var(--space-lg);">
        <div style="position: relative; flex: 1; min-width: 250px; max-width: 450px;">
          <input type="text" id="cliente-search" class="input" placeholder="Buscar por nombre, DNI o teléfono..." style="padding-left: 40px; margin-bottom: 0;">
          <span style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); opacity: 0.5; pointer-events: none;">🔍</span>
        </div>
        
        <div style="display: flex; gap: var(--space-md); align-items: center;">
          ${this.renderViewModeSelector()}
          <a href="#cliente-nuevo" class="btn btn-primary btn-sm">
            <i>➕</i> Nuevo Cliente
          </a>
        </div>
      </div>
      
      <div id="clientes-grid" class="grid-stack vm-${this.viewMode}" style="margin-top: var(--space-xl);">
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
      
      searchInput.focus();
    }

    // Selector de modo de vista
    document.querySelectorAll('.vm-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (mode === this.viewMode) return;

        this.viewMode = mode;
        localStorage.setItem(VM_STORAGE_KEY, mode);

        grid.classList.remove('vm-compact', 'vm-comfortable', 'vm-expanded');
        grid.classList.add(`vm-${mode}`);

        document.querySelectorAll('.vm-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Delegated actions on grid
    grid.addEventListener('click', async (e) => {
      const delBtn = e.target.closest('.client-delete-btn');
      if (delBtn) {
        this.handleDelete(delBtn.dataset.id);
        return;
      }
      const mergeBtn = e.target.closest('.client-merge-btn');
      if (mergeBtn) {
        this.handleMerge(mergeBtn.dataset.id);
        return;
      }
    });
  }

  async handleDelete(id) {
    if (!confirm('¿Estás seguro de eliminar este cliente? Esta acción no se puede deshacer.')) return;
    const res = await deleteCliente(id);
    if (res.success) {
      showToast('Cliente eliminado', 'success');
      this.fetchAndRender();
    } else {
      showToast(res.error || 'Error al eliminar', 'error');
    }
  }

  async handleMerge(sourceId) {
    const targetId = prompt('Ingrese el ID del cliente principal (Donde se fusionará este registro):');
    if (!targetId || targetId === sourceId) return;

    if (!confirm('Esta acción eliminará el cliente actual y mantendrá el principal. ¿Continuar?')) return;

    const res = await mergeClientes(targetId, sourceId);
    if (res.success) {
      showToast('Clientes fusionados correctamente', 'success');
      this.fetchAndRender();
    } else {
      showToast(res.error || 'Error al fusionar', 'error');
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
