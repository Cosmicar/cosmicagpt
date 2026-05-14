import { AsyncView } from '../core/async-view.js';
import { getTickets, updateTicketStatus } from '../services/tickets.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { render as renderTicketCard } from '../components/ticket-card.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';
import { renderEmptyState, renderCardSkeletonList } from '../components/app-state.js';
import { WORK_STATUS } from '../../../js/domain.js';
import { showToast } from '../components/toast.js';
import { canAccess } from '../core/session.js';

/**
 * Vista de Tickets / Trabajos con Búsqueda y Filtros Rápidos
 */
const VIEW_MODES = [
  { key: 'compact',     label: '⊟',  title: 'Compacto'  },
  { key: 'comfortable', label: '⊞',  title: 'Normal'    },
  { key: 'expanded',    label: '▦',  title: 'Expandido' },
  { key: 'table',       label: '≡',  title: 'Tabla'     },
];
const VM_STORAGE_KEY = 'ticketsViewMode';

export class TicketsView extends AsyncView {
  constructor() {
    super();
    this.containerId = 'tickets-container';
    this.allTickets = [];
    this.currentFilter = 'all';
    this.currentTerm = '';
    const saved = localStorage.getItem(VM_STORAGE_KEY) || 'comfortable';
    const isMobile = window.innerWidth < 768;
    this.viewMode = (saved === 'table' && isMobile) ? 'comfortable' : saved;
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
    this.allTickets = await getTickets();
    return this.allTickets;
  }

  /**
   * Override para usar skeletons de cards
   */
  renderLoading() {
    return `
      <div style="margin-top: var(--space-xl);">
        <div class="skeleton" style="width: 250px; height: 32px; margin-bottom: var(--space-lg);"></div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: var(--space-lg);">
          ${renderCardSkeletonList(6)}
        </div>
      </div>
    `;
  }

  renderContent(tickets) {
    let html = renderBreadcrumb([
      { label: 'Operaciones', href: '#dashboard', icon: '⚙️' },
      { label: 'Trabajos', href: '#tickets', icon: '🛠️' }
    ]);
    
    html += renderSectionHeader('Tickets / Trabajos', 'Listado de órdenes de servicio en el sistema.', '🛠️ Módulo');
    
    // Controles de búsqueda y filtros
    html += `
      <div style="margin-top: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-md);" class="animate-fade-in">
        
        <div class="flex-between">
          <div style="position: relative; flex: 1; min-width: 250px; max-width: 500px;">
            <input type="text" id="ticket-search" class="input" placeholder="Buscar por cliente, orden o problema..." style="padding-left: 40px; margin-bottom: 0;">
            <span style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); opacity: 0.5; pointer-events: none;">🔍</span>
          </div>
          
          <div style="display: flex; gap: var(--space-md); align-items: center; flex-wrap: wrap;">
            <div style="display: flex; gap: 5px; background: rgba(255,255,255,0.05); padding: 4px; border-radius: var(--radius-md); border: 1px solid var(--border); flex-wrap: wrap;">
              <button class="btn btn-sm btn-filter active" data-filter="all">Todos</button>
              <button class="btn btn-sm btn-filter" data-filter="pendiente">Pendiente</button>
              <button class="btn btn-sm btn-filter" data-filter="proceso">En proceso</button>
              <button class="btn btn-sm btn-filter" data-filter="finalizado">Finalizado</button>
            </div>

            ${this.renderViewModeSelector()}

            <a href="#ticket-nuevo" class="btn btn-primary btn-sm">
              <i>➕</i> Nuevo Trabajo
            </a>
          </div>
        </div>

      </div>
      
      <div id="tickets-grid" class="grid-stack vm-${this.viewMode}" style="margin-top: var(--space-xl);">
        ${this.viewMode === 'table' ? this.renderTable(tickets) : this.renderCards(tickets)}
      </div>
    `;
    return html;
  }

  renderCards(tickets) {
    if (tickets.length === 0) {
      return `
        <div style="grid-column: 1 / -1;">
          ${renderEmptyState('No se encontraron trabajos que coincidan con los filtros.')}
        </div>
      `;
    }
    return tickets.map(t => renderTicketCard(t)).join('');
  }

  onContentReady() {
    const searchInput = document.getElementById('ticket-search');
    const filterButtons = document.querySelectorAll('.btn-filter');
    const grid = document.getElementById('tickets-grid');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.currentTerm = e.target.value.toLowerCase().trim();
        this.applyFilters(grid);
      });
      searchInput.focus();
    }

    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.applyFilters(grid);
      });
    });

    // View mode selector
    document.querySelectorAll('.vm-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (mode === this.viewMode) return;

        const wasTable = this.viewMode === 'table';
        const isTable  = mode === 'table';

        this.viewMode = mode;
        localStorage.setItem(VM_STORAGE_KEY, mode);

        grid.classList.remove('vm-compact', 'vm-comfortable', 'vm-expanded', 'vm-table');
        grid.classList.add(`vm-${mode}`);

        document.querySelectorAll('.vm-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (wasTable || isTable) {
          const filtered = this.getFilteredTickets();
          grid.innerHTML = isTable ? this.renderTable(filtered) : this.renderCards(filtered);
          this.initStatusSelectors();
        }
      });
    });

    this.initStatusSelectors();
  }

  initStatusSelectors() {
    const statusSelectors = document.querySelectorAll('.status-selector');
    statusSelectors.forEach(select => {
      select.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        const newStatus = e.target.value;
        await this.handleStatusChange(id, newStatus, e.target);
      });
    });
  }

  async handleStatusChange(id, newStatus, selectElement) {
    selectElement.disabled = true;
    const result = await updateTicketStatus(id, newStatus);
    
    if (result.success) {
      showToast('Estado actualizado', 'success');
      
      // Actualizar el badge visualmente sin recargar
      const badge = document.getElementById(`badge-${id}`);
      if (badge) {
        badge.textContent = newStatus;
        badge.classList.remove('badge-cyan', 'badge-orange', 'badge-green', 'badge-gray');
        
        if (newStatus === WORK_STATUS.ingresado) badge.classList.add('badge-cyan');
        if (newStatus === WORK_STATUS.enReparacion) badge.classList.add('badge-orange');
        if (newStatus === WORK_STATUS.listo) badge.classList.add('badge-green');
        if (newStatus === WORK_STATUS.entregado) badge.classList.add('badge-gray');
      }

      // Actualizar cache local para que los filtros sigan funcionando correctamente
      const ticket = this.allTickets.find(t => t.id === id);
      if (ticket) ticket.estado = newStatus;

    } else {
      showToast(result.error || 'Error al cambiar estado', 'error');
      // Se podría restaurar el valor previo si fuera necesario
    }
    selectElement.disabled = false;
  }

  getFilteredTickets() {
    let filtered = this.allTickets;

    if (this.currentFilter !== 'all') {
      filtered = filtered.filter(t => {
        const estado = t.estado;
        if (this.currentFilter === 'pendiente') return estado === WORK_STATUS.ingresado;
        if (this.currentFilter === 'proceso') return estado === WORK_STATUS.enReparacion;
        if (this.currentFilter === 'finalizado') return [WORK_STATUS.listo, WORK_STATUS.entregado].includes(estado);
        return true;
      });
    }

    if (this.currentTerm) {
      filtered = filtered.filter(t =>
        (t.nombre && t.nombre.toLowerCase().includes(this.currentTerm)) ||
        (t.apellido && t.apellido.toLowerCase().includes(this.currentTerm)) ||
        (t.numeroOrden && String(t.numeroOrden).toLowerCase().includes(this.currentTerm)) ||
        (t.problema && t.problema.toLowerCase().includes(this.currentTerm))
      );
    }

    return filtered;
  }

  applyFilters(grid) {
    const filtered = this.getFilteredTickets();
    grid.innerHTML = this.viewMode === 'table' ? this.renderTable(filtered) : this.renderCards(filtered);
    this.initStatusSelectors();
  }

  renderTable(tickets) {
    if (tickets.length === 0) {
      return `<div style="grid-column: 1 / -1;">${renderEmptyState('No se encontraron trabajos que coincidan con los filtros.')}</div>`;
    }
    const statusOptions = [
      WORK_STATUS.ingresado,
      WORK_STATUS.enReparacion,
      WORK_STATUS.listo,
      WORK_STATUS.entregado,
    ];
    return `
      <div class="tickets-table-wrapper">
        <table class="tickets-table">
          <thead>
            <tr>
              <th>Orden</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Equipo</th>
              <th>Fecha</th>
              <th>Plan</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${tickets.map(t => this.renderTableRow(t, statusOptions)).join('')}
          </tbody>
        </table>
      </div>`;
  }

  renderTableRow(ticket, statusOptions) {
    const estado = ticket.estado || WORK_STATUS.ingresado;
    let badgeClass = 'badge-cyan';
    if (estado === WORK_STATUS.enReparacion) badgeClass = 'badge-orange';
    if (estado === WORK_STATUS.listo)        badgeClass = 'badge-green';
    if (estado === WORK_STATUS.entregado)    badgeClass = 'badge-gray';

    const fecha   = ticket.fechaIngreso ? new Date(ticket.fechaIngreso).toLocaleDateString('es-AR') : '—';
    const equipo  = [ticket.equipo, ticket.marca].filter(Boolean).join(' ') || '—';
    const cliente = [ticket.nombre, ticket.apellido].filter(Boolean).join(' ') || 'Sin nombre';
    const plan    = ticket.planServicio
      ? ticket.planServicio.charAt(0).toUpperCase() + ticket.planServicio.slice(1)
      : '—';
    const canEdit = canAccess('edit-ticket');

    return `
      <tr>
        <td class="tt-orden">#${ticket.numeroOrden || '—'}</td>
        <td class="tt-cliente" title="${cliente}">${cliente}</td>
        <td><span class="badge ${badgeClass}" id="badge-${ticket.id}">${estado}</span></td>
        <td class="tt-equipo">${equipo}</td>
        <td class="tt-fecha">${fecha}</td>
        <td class="tt-plan">${plan}</td>
        <td class="tt-acciones">
          ${canEdit ? `
            <div style="display:flex;align-items:center;gap:6px;">
              <select class="status-selector" data-id="${ticket.id}">
                ${statusOptions.map(opt => `<option value="${opt}" ${estado === opt ? 'selected' : ''}>${opt}</option>`).join('')}
              </select>
              <a href="#ticket-edit?id=${ticket.id}" class="btn btn-sm btn-secondary" style="padding:4px 8px;">📝</a>
            </div>
          ` : '—'}
        </td>
      </tr>`;
  }

  renderEmpty() {
    return super.renderEmpty('No hay tickets o órdenes de trabajo registradas.');
  }
}
