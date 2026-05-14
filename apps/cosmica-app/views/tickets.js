import { AsyncView } from '../core/async-view.js';
import { getTickets, updateTicketStatus } from '../services/tickets.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { render as renderTicketCard } from '../components/ticket-card.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';
import { renderEmptyState, renderCardSkeletonList } from '../components/app-state.js';
import { WORK_STATUS } from '../../../js/domain.js';
import { showToast } from '../components/toast.js';

/**
 * Vista de Tickets / Trabajos con Búsqueda y Filtros Rápidos
 */
export class TicketsView extends AsyncView {
  constructor() {
    super();
    this.containerId = 'tickets-container';
    this.allTickets = [];
    this.currentFilter = 'all';
    this.currentTerm = '';
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
            <span style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); opacity: 0.5;">🔍</span>
          </div>
          
          <div style="display: flex; gap: var(--space-md); align-items: center; flex-wrap: wrap;">
            <div style="display: flex; gap: 5px; background: rgba(255,255,255,0.05); padding: 4px; border-radius: var(--radius-md); border: 1px solid var(--border); flex-wrap: wrap;">
              <button class="btn btn-sm btn-filter active" data-filter="all">Todos</button>
              <button class="btn btn-sm btn-filter" data-filter="pendiente">Pendiente</button>
              <button class="btn btn-sm btn-filter" data-filter="proceso">En proceso</button>
              <button class="btn btn-sm btn-filter" data-filter="finalizado">Finalizado</button>
            </div>

            <a href="#ticket-nuevo" class="btn btn-primary btn-sm">
              <i>➕</i> Nuevo Trabajo
            </a>
          </div>
        </div>

      </div>
      
      <div id="tickets-grid" class="grid-stack" style="margin-top: var(--space-xl); grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));">
        ${this.renderCards(tickets)}
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

  applyFilters(grid) {
    let filtered = this.allTickets;

    // 1. Filtro por Estado
    if (this.currentFilter !== 'all') {
      filtered = filtered.filter(t => {
        const estado = t.estado;
        if (this.currentFilter === 'pendiente') return estado === WORK_STATUS.ingresado;
        if (this.currentFilter === 'proceso') return estado === WORK_STATUS.enReparacion;
        if (this.currentFilter === 'finalizado') return [WORK_STATUS.listo, WORK_STATUS.entregado].includes(estado);
        return true;
      });
    }

    // 2. Búsqueda por Texto
    if (this.currentTerm) {
      filtered = filtered.filter(t => {
        return (
          (t.nombre && t.nombre.toLowerCase().includes(this.currentTerm)) ||
          (t.apellido && t.apellido.toLowerCase().includes(this.currentTerm)) ||
          (t.numeroOrden && String(t.numeroOrden).toLowerCase().includes(this.currentTerm)) ||
          (t.problema && t.problema.toLowerCase().includes(this.currentTerm))
        );
      });
    }

    grid.innerHTML = this.renderCards(filtered);
    this.initStatusSelectors(); // Re-bindear tras filtrar
  }

  renderEmpty() {
    return super.renderEmpty('No hay tickets o órdenes de trabajo registradas.');
  }
}
