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
import { canAccess } from '../core/session.js';

/**
 * Vista de Clientes con Búsqueda Rápida Local
 */
const VIEW_MODES = [
  { key: 'compact',     label: '⊟',  title: 'Compacto'  },
  { key: 'comfortable', label: '⊞',  title: 'Normal'    },
  { key: 'expanded',    label: '▦',  title: 'Expandido' },
  { key: 'table',       label: '☰',  title: 'Tabla'     },
];
const VM_STORAGE_KEY = 'clientsViewMode';

export class ClientesView extends AsyncView {
  constructor(params) {
    super(params);
    this.containerId   = 'clientes-container';
    this.allClientes   = [];
    this._page         = 1;
    this._pageSize     = 50;
    this._currentTerm  = '';
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
    
    // Pre-agrupa tickets por clienteId para badge count en O(n)
    const ticketCountMap = new Map();
    tickets.forEach(t => {
      ticketCountMap.set(t.clienteId, (ticketCountMap.get(t.clienteId) || 0) + 1);
    });

    this.allClientes = clientes.map(c => {
      const ticketCount = ticketCountMap.get(c.id) || 0;
      return {
        ...c,
        ticketCount,
        badge: getClientBadge(ticketCount),
        // Pre-index para búsqueda — calculado una vez, no en cada keystroke
        _searchIndex: [
          c.nombre || '', c.apellido || '', c.dni || '',
          c.telefono || '', c.email || ''
        ].join(' ').toLowerCase(),
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
      <div class="operational-controls flex-between animate-fade-in" style="margin-top: var(--space-md); background: rgba(255,255,255,0.02); padding: 12px; border-radius: var(--radius-lg); border: 1px solid var(--border);">
        <div class="search-wrapper">
          <input type="text" id="cliente-search" class="input" placeholder="Buscar por nombre, DNI o teléfono...">
          <span class="search-icon">🔍</span>
        </div>
        
        <div style="display: flex; gap: var(--space-md); align-items: center;">
          ${this.renderViewModeSelector()}
          <a href="#cliente-nuevo" class="btn btn-primary btn-sm" style="box-shadow: var(--shadow-glow);">
            <i>➕</i> Nuevo Cliente
          </a>
        </div>
      </div>
      
      <div id="clientes-grid" class="grid-stack vm-${this.viewMode}" style="margin-top: var(--space-lg);">
        ${this.renderCards(this.getPagedClientes(clientes))}
      </div>
      <div id="cl-pagination-bar"></div>
    `;
    return html;
  }

  /**
   * Renderiza solo el grid de cards
   */
  renderCards(clientes) {
    if (clientes.length === 0) {
      const cta = this._currentTerm 
        ? '<button class="btn btn-sm btn-secondary" onclick="document.getElementById(\'cliente-search\').value=\'\'; document.getElementById(\'cliente-search\').dispatchEvent(new Event(\'input\'))">Limpiar búsqueda</button>'
        : '<a href="#cliente-nuevo" class="btn btn-sm btn-primary">➕ Registrar cliente</a>';
      return `
        <div style="grid-column: 1 / -1;">
          ${renderEmptyState('No se encontraron clientes que coincidan con la búsqueda.', '👥', cta)}
        </div>
      `;
    }

    if (this.viewMode === 'table') {
      const canEdit  = canAccess('create-client');
      // Merge is a destructive admin tool — gate it behind admin/tester role only.
      // Non-admin roles (operador, recepcion, tecnico) cannot fuse client records.
      const canMerge = canAccess('merge-clientes');
      return `
        <div class="tickets-table-wrapper" style="height: auto; max-height: calc(100vh - 310px);">
          <table class="tickets-table">
            <thead>
              <tr>
                <th style="width: 22%; white-space: nowrap;">Cliente</th>
                <th style="width: 12%; white-space: nowrap;">DNI</th>
                <th style="width: 14%; white-space: nowrap;">Teléfono</th>
                <th style="width: 18%; white-space: nowrap;">Email</th>
                <th style="width: 12%; white-space: nowrap;">Provincia</th>
                <th style="width: 10%; min-width: 100px; white-space: nowrap; text-align: center;">Etiquetas</th>
                <th style="width: 12%; min-width: 130px; white-space: nowrap; text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${clientes.map(c => `
                <tr data-id="${c.id}">
                  <td class="tt-cliente" title="${c.nombre || ''} ${c.apellido || ''}">
                    ${c.nombre || 'Sin Nombre'} ${c.apellido || ''}
                  </td>
                  <td class="tt-equipo" style="white-space: nowrap;">${c.dni || '—'}</td>
                  <td class="tt-equipo text-truncate" style="max-width: 150px; white-space: nowrap;">${c.telefono || '—'}</td>
                  <td class="tt-equipo text-truncate" style="max-width: 200px; white-space: nowrap;">${c.email || '—'}</td>
                  <td class="tt-equipo text-truncate" style="max-width: 150px; white-space: nowrap;">${c.provincia || '—'}</td>
                  <td style="text-align: center; white-space: nowrap;">
                    ${c.badge ? `<div class="badge ${c.badge.class}" style="font-size: 10px; display: inline-block;">${c.badge.label}</div>` : '—'}
                  </td>
                  <td style="text-align: right; white-space: nowrap;">
                    ${canEdit ? `
                      <div class="client-actions" style="display: flex; justify-content: flex-end; gap: 4px;">
                        <a href="#cliente-edit?id=${c.id}" class="btn btn-sm btn-secondary client-edit-btn" style="padding: 4px 8px; font-size: 12px;" title="Editar">📝</a>
                        ${canMerge ? `
                          <button class="btn btn-sm btn-secondary client-merge-btn" data-id="${c.id}" style="padding: 4px 8px; font-size: 12px; color: var(--accent-cyan); border-color: rgba(0, 229, 255, 0.1);" title="Fusionar (admin)">🔗</button>
                        ` : ''}
                        <button class="btn btn-sm btn-secondary client-delete-btn" data-id="${c.id}" style="padding: 4px 8px; font-size: 12px; color: var(--danger); border-color: rgba(255, 71, 87, 0.1);" title="Eliminar">🗑</button>
                      </div>
                    ` : '—'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    return clientes.map(c => renderClientCard(c)).join('');
  }

  // ── Pagination helpers ────────────────────────────────────────────────────

  getFilteredClientes() {
    if (!this._currentTerm) return this.allClientes;
    const q = this._currentTerm;
    return this.allClientes.filter(c => c._searchIndex ? c._searchIndex.includes(q) : false);
  }

  getPagedClientes(list) {
    const start = (this._page - 1) * this._pageSize;
    return list.slice(start, start + this._pageSize);
  }

  updateClientesPagination(total) {
    const bar = document.getElementById('cl-pagination-bar');
    if (!bar) return;

    const totalPages = Math.ceil(total / this._pageSize);
    const hasPrev    = this._page > 1;
    const hasNext    = this._page < totalPages;
    const start      = Math.min((this._page - 1) * this._pageSize + 1, total || 1);
    const end        = Math.min(this._page * this._pageSize, total);

    if (totalPages <= 1) {
      bar.innerHTML = `<div style="padding-bottom: calc(var(--space-xl) + 80px + env(safe-area-inset-bottom, 20px));"></div>`;
      return;
    }

    bar.innerHTML = `
      <div style="
        display:flex;align-items:center;gap:var(--space-md);flex-wrap:wrap;
        justify-content:center;padding:var(--space-md) var(--space-lg);
        padding-bottom: calc(var(--space-xl) + 80px + env(safe-area-inset-bottom, 20px));
        border-top:1px solid rgba(255,255,255,0.06); margin-top:var(--space-lg);
      ">
        <button class="btn btn-sm btn-secondary" id="clpg-prev" ${hasPrev ? '' : 'disabled'}>← Anterior</button>
        <span style="font-size:var(--font-sm);color:var(--text-muted);">
          <strong style="color:var(--text-primary);">${start}–${end}</strong> de
          <strong style="color:var(--text-primary);">${total}</strong>
        </span>
        <button class="btn btn-sm btn-secondary" id="clpg-next" ${hasNext ? '' : 'disabled'}>Siguiente →</button>
      </div>`;

    const grid = document.getElementById('clientes-grid');
    document.getElementById('clpg-prev')?.addEventListener('click', () => {
      this._page--;
      if (grid) this.applyClientFilter(grid);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.getElementById('clpg-next')?.addEventListener('click', () => {
      this._page++;
      if (grid) this.applyClientFilter(grid);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  applyClientFilter(grid) {
    const filtered = this.getFilteredClientes();
    grid.innerHTML  = this.renderCards(this.getPagedClientes(filtered));
    this.updateClientesPagination(filtered.length);
  }

  // ── Event wiring ─────────────────────────────────────────────────────────

  onContentReady() {
    const searchInput = document.getElementById('cliente-search');
    const grid = document.getElementById('clientes-grid');

    if (searchInput && grid) {
      let _searchDebounce = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(_searchDebounce);
        _searchDebounce = setTimeout(() => {
          this._currentTerm = e.target.value.toLowerCase().trim();
          this._page = 1; // Nueva búsqueda → página 1
          this.applyClientFilter(grid);
        }, 200);
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
        
        if (grid) this.applyClientFilter(grid);
        
        grid?.classList.remove('vm-compact', 'vm-comfortable', 'vm-expanded', 'vm-table');
        grid?.classList.add(`vm-${mode}`);
        document.querySelectorAll('.vm-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Delegated actions on grid
    grid?.addEventListener('click', async (e) => {
      const delBtn = e.target.closest('.client-delete-btn');
      if (delBtn) { this.handleDelete(delBtn.dataset.id); return; }
      const mergeBtn = e.target.closest('.client-merge-btn');
      if (mergeBtn) { this.handleMerge(mergeBtn.dataset.id); return; }
    });

    // Render inicial de paginación
    this.updateClientesPagination(this.getFilteredClientes().length);
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
    // Defense-in-depth: even if the button somehow surfaces for non-admin roles
    // (DOM manipulation, stale cache), the handler refuses to execute.
    if (!canAccess('merge-clientes')) {
      showToast('Acción reservada para administradores', 'error');
      return;
    }
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

  renderEmpty() {
    return renderEmptyState('No hay clientes registrados en el sistema.');
  }
}
