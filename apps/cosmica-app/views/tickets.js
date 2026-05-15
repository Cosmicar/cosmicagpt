import { AsyncView } from '../core/async-view.js';
import { getTickets, updateTicketStatus, updateMultipleTicketStatus, isOverdue, isHighValue, needsApprovalCTA, reingresoTicket } from '../services/tickets.js';
import { ensureBudgetApprovedEvent } from '../services/ticket-history.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { render as renderTicketCard } from '../components/ticket-card.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';
import { renderEmptyState, renderCardSkeletonList } from '../components/app-state.js';
import { WORK_STATUS } from '../../../js/domain.js';
import { showToast } from '../components/toast.js';
import { canAccess } from '../core/session.js';
import { openTicketQuickView, badgeClass } from '../components/ticket-quick-view.js';
import { openTicketPrint } from '../components/ticket-print.js';
import { seedPaletteCache } from '../components/command-palette.js';

const VIEW_MODES = [
  { key: 'compact',     label: '⊟',  title: 'Compacto'  },
  { key: 'comfortable', label: '⊞',  title: 'Normal'    },
  { key: 'expanded',    label: '▦',  title: 'Expandido' },
  { key: 'table',       label: '≡',  title: 'Tabla'     },
];
const VM_STORAGE_KEY = 'ticketsViewMode';
const PERSISTENCE_KEY = 'tickets_view_state';

// Bulk action definitions — label shown in the floating bar
const BULK_ACTIONS = [
  { status: WORK_STATUS.enReparacion, label: 'En Reparación' },
  { status: WORK_STATUS.listo,        label: 'Marcar Listo'  },
  { status: WORK_STATUS.entregado,    label: 'Entregado'     },
];

export class TicketsView extends AsyncView {
  constructor() {
    super();
    this.containerId    = 'tickets-container';
    this.allTickets     = [];
    this.currentFilter  = 'all';
    this.currentTerm    = '';
    this.selectedTickets = new Set();  // ids of currently selected tickets
    this._onEsc          = null;       // stored for cleanup in destroy()

    // Load persisted state
    const persisted = JSON.parse(sessionStorage.getItem('ticketsViewState') || '{}');
    this.currentFilter = persisted.filter || 'all';
    this.currentTerm = persisted.term || '';
    this.savedScroll = persisted.scroll || 0;
    this.viewMode = persisted.viewMode || localStorage.getItem(VM_STORAGE_KEY) || 'comfortable';

    const isMobile = window.innerWidth < 768;
    if (this.viewMode === 'table' && isMobile) this.viewMode = 'comfortable';
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async loadData() {
    const { getClientes } = await import('../services/clientes.js');
    const [tickets, clients] = await Promise.all([getTickets(), getClientes()]);
    
    // Join client data for smart search (Phone, DNI)
    const clientMap = clients.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});
    this.allTickets = tickets.map(t => ({
      ...t,
      nombre: t.nombre || clientMap[t.clienteId]?.nombre || '',
      apellido: t.apellido || clientMap[t.clienteId]?.apellido || '',
      telefono: t.telefono || clientMap[t.clienteId]?.telefono || '',
      dni: t.dni || clientMap[t.clienteId]?.dni || ''
    }));

    seedPaletteCache({ tickets: this.allTickets });
    return this.allTickets;
  }

  destroy() {
    this.saveState();
    if (this._onEsc) {
      document.removeEventListener('keydown', this._onEsc);
      this._onEsc = null;
    }
    if (this._scrollListener) {
      window.removeEventListener('scroll', this._scrollListener);
      this._scrollListener = null;
    }
    this.selectedTickets.clear();
  }

  // ── Render helpers ────────────────────────────────────────────────────────

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

  renderBulkBar() {
    const canEdit = canAccess('edit-ticket');
    if (!canEdit) return '';
    return `
      <div id="bulk-bar" class="bulk-bar" role="toolbar" aria-label="Acciones masivas">
        <span id="bulk-count" class="bulk-count"></span>
        <div class="bulk-actions">
          ${BULK_ACTIONS.map(a => `
            <button class="btn btn-sm bulk-action-btn" data-status="${a.status}">
              ${a.label}
            </button>
          `).join('')}
          <button class="btn btn-sm bulk-clear-btn" id="bulk-clear-btn">✕ Limpiar</button>
        </div>
      </div>`;
  }

  renderContent(tickets) {
    let html = renderBreadcrumb([
      { label: 'Operaciones', href: '#dashboard', icon: '⚙️' },
      { label: 'Trabajos', href: '#tickets', icon: '🛠️' }
    ]);

    html += renderSectionHeader('Tickets / Trabajos', 'Listado de órdenes de servicio en el sistema.', '🛠️ Módulo');

    html += `
      <div style="margin-top: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-md);" class="animate-fade-in">

        <div class="flex-between">
          <div style="position: relative; flex: 1; min-width: 250px; max-width: 500px;">
            <input type="text" id="ticket-search" class="input" placeholder="Buscar por cliente, orden o problema..." style="padding-left: 40px; margin-bottom: 0;">
            <span style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); opacity: 0.5; pointer-events: none;">🔍</span>
          </div>

          <div style="display: flex; gap: var(--space-md); align-items: center; flex-wrap: wrap;">
            <div style="display: flex; gap: 5px; background: rgba(255,255,255,0.05); padding: 4px; border-radius: var(--radius-md); border: 1px solid var(--border); flex-wrap: wrap;">
              <button class="btn btn-sm btn-filter ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">Todos</button>
              <button class="btn btn-sm btn-filter ${this.currentFilter === 'pendiente' ? 'active' : ''}" data-filter="pendiente">Pendiente</button>
              <button class="btn btn-sm btn-filter ${this.currentFilter === 'proceso' ? 'active' : ''}" data-filter="proceso">En proceso</button>
              <button class="btn btn-sm btn-filter ${this.currentFilter === 'finalizado' ? 'active' : ''}" data-filter="finalizado">Finalizado</button>
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

      ${this.renderBulkBar()}
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
    return tickets.map(t => renderTicketCard(t, this.selectedTickets.has(t.id))).join('');
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
              <th class="tt-check"></th>
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
    const estado     = ticket.estado || WORK_STATUS.ingresado;
    const bc         = badgeClass(estado);
    const isSelected = this.selectedTickets.has(ticket.id);
    const fecha      = ticket.fechaIngreso ? new Date(ticket.fechaIngreso).toLocaleDateString('es-AR') : '—';
    const equipo     = [ticket.equipo, ticket.marca].filter(Boolean).join(' ') || '—';
    const cliente    = [ticket.nombre, ticket.apellido].filter(Boolean).join(' ') || 'Sin nombre';
    const plan       = ticket.planServicio
      ? ticket.planServicio.charAt(0).toUpperCase() + ticket.planServicio.slice(1)
      : '—';
    const canEdit    = canAccess('edit-ticket');
    const overdue    = isOverdue(ticket);
    const highValue  = isHighValue(ticket);
    const showCTA    = needsApprovalCTA(ticket) && canEdit;

    return `
      <tr data-ticket-id="${ticket.id}" style="cursor:pointer;" class="${isSelected ? 'ticket-selected' : ''}">
        <td class="tt-check">
          <input type="checkbox" class="ticket-checkbox" data-id="${ticket.id}" ${isSelected ? 'checked' : ''}>
        </td>
        <td class="tt-orden">#${ticket.numeroOrden || '—'}</td>
        <td class="tt-cliente" title="${cliente}">${cliente}</td>
        <td>
          <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-start;">
            <span class="badge ${bc}" id="badge-${ticket.id}">${estado}</span>
            ${overdue   ? '<span class="badge badge-orange rule-badge">⚠ DEMORADO</span>'  : ''}
            ${highValue ? '<span class="badge badge-gold rule-badge">💎 ALTO VALOR</span>' : ''}
          </div>
        </td>
        <td class="tt-equipo">${equipo}</td>
        <td class="tt-fecha">${fecha}</td>
        <td class="tt-plan">${plan}</td>
        <td class="tt-acciones tt-cta" data-id="${ticket.id}">
          <div style="display:flex;align-items:center;gap:6px;">
            ${showCTA ? `
              <button class="btn btn-sm btn-primary quick-repair-btn" data-id="${ticket.id}" style="white-space:nowrap;font-size:var(--font-xs);">🔧 Pasar a Reparación</button>
            ` : canEdit ? `
              <select class="status-selector" data-id="${ticket.id}">
                ${statusOptions.map(opt => `<option value="${opt}" ${estado === opt ? 'selected' : ''}>${opt}</option>`).join('')}
              </select>
              <a href="#ticket-edit?id=${ticket.id}" class="btn btn-sm btn-secondary" style="padding:4px 8px;" title="Editar">📝</a>
            ` : ''}
            <button class="btn btn-sm btn-secondary ticket-print-btn" data-id="${ticket.id}" style="padding:4px 8px;" title="Imprimir orden">🖨</button>
          </div>
        </td>
      </tr>`;
  }

  // ── Event wiring ──────────────────────────────────────────────────────────

  onContentReady() {
    const searchInput   = document.getElementById('ticket-search');
    const filterButtons = document.querySelectorAll('.btn-filter');
    const grid          = document.getElementById('tickets-grid');

    if (searchInput) {
      let _searchDebounce = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(_searchDebounce);
        _searchDebounce = setTimeout(() => {
          this.currentTerm = e.target.value.toLowerCase().trim();
          this.saveState();
          this.applyFilters(grid);
        }, 200); // 200ms debounce as requested
      });
      searchInput.value = this.currentTerm;
      
      // Autofocus (except mobile)
      const isMobile = window.innerWidth < 768;
      if (!isMobile) {
        setTimeout(() => searchInput.focus(), 100);
      }
    }

    // Scroll tracking
    let _scrollDebounce = null;
    this._scrollListener = () => {
      clearTimeout(_scrollDebounce);
      _scrollDebounce = setTimeout(() => this.saveState(), 200);
    };
    window.addEventListener('scroll', this._scrollListener);

    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.saveState();
        this.applyFilters(grid);
      });
    });

    document.querySelectorAll('.vm-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (mode === this.viewMode) return;

        const wasTable = this.viewMode === 'table';
        const isTable  = mode === 'table';

        this.viewMode = mode;
        localStorage.setItem(VM_STORAGE_KEY, mode);
        this.saveState();

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

    if (this.savedScroll > 0) {
      setTimeout(() => {
        window.scrollTo({ top: this.savedScroll, behavior: 'instant' });
      }, 150); // Slightly longer delay to ensure grid is fully rendered
    }

    grid.addEventListener('click', (e) => {
      const cb = e.target.closest('.ticket-checkbox');
      if (cb) {
        const id = cb.dataset.id;
        const isShift = e.shiftKey;
        
        if (isShift && this._lastClickedId && this.viewMode === 'table') {
          this.handleShiftSelect(id);
        } else {
          this.toggleTicketSelection(id);
          this._lastClickedId = id;
        }
        return;
      }
      const qrBtn = e.target.closest('.quick-repair-btn');
      if (qrBtn) {
        this.handleQuickRepair(qrBtn.dataset.id, qrBtn);
        return;
      }
      const qlBtn = e.target.closest('.quick-listo-btn');
      if (qlBtn) {
        e.stopPropagation();
        this.handleStatusChange(qlBtn.dataset.id, WORK_STATUS.listo, qlBtn);
        return;
      }
      const qeBtn = e.target.closest('.quick-entregar-btn');
      if (qeBtn) {
        e.stopPropagation();
        this.handleStatusChange(qeBtn.dataset.id, WORK_STATUS.entregado, qeBtn);
        return;
      }
      const riBtn = e.target.closest('.reingreso-btn');
      if (riBtn) {
        e.stopPropagation();
        this.handleReingreso(riBtn.dataset.id, riBtn);
        return;
      }
      const printBtn = e.target.closest('.ticket-print-btn');
      if (printBtn) {
        e.stopPropagation();
        const ticket = this.allTickets.find(t => t.id === printBtn.dataset.id);
        if (ticket) openTicketPrint(ticket);
        return;
      }
      if (e.target.closest('select, .btn, a, button')) return;
      const node = e.target.closest('[data-ticket-id]');
      if (!node) return;
      const ticket = this.allTickets.find(t => t.id === node.dataset.ticketId);
      if (ticket) this.openTicketDrawer(ticket);
    });

    const bulkBar = document.getElementById('bulk-bar');
    if (bulkBar) {
      bulkBar.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('.bulk-action-btn');
        if (actionBtn && !actionBtn.disabled) {
          this.executeBulkAction(actionBtn.dataset.status);
          return;
        }
        if (e.target.closest('#bulk-clear-btn')) {
          this.clearSelection();
        }
      });
    }

    this._onEsc = (e) => {
      if (e.key === 'Escape' && this.selectedTickets.size > 0) {
        this.clearSelection();
      }
      
      // Status Shortcuts (1-5)
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
      if (!isInput && /^[1-5]$/.test(e.key)) {
        const statusMap = {
          '1': WORK_STATUS.ingresado,
          '2': WORK_STATUS.enReparacion,
          '3': WORK_STATUS.esperandoRepuesto,
          '4': WORK_STATUS.listo,
          '5': WORK_STATUS.entregado
        };
        const newStatus = statusMap[e.key];
        
        // Apply to bulk selection if any
        if (this.selectedTickets.size > 0) {
          this.executeBulkAction(newStatus);
        } else {
          // Check if drawer is open and apply to that ticket
          const drawer = document.querySelector('.drawer-panel.is-open');
          if (drawer) {
            const select = drawer.querySelector('#qv-status-select');
            if (select) {
              select.value = newStatus;
              select.dispatchEvent(new Event('change'));
            }
          }
        }
      }
    };
    document.addEventListener('keydown', this._onEsc);

    this.initStatusSelectors();
  }

  openTicketDrawer(ticket) {
    openTicketQuickView(ticket, {
      onStatusChange: (id, newStatus) => {
        const badge = document.getElementById(`badge-${id}`);
        if (badge) {
          badge.textContent = newStatus;
          badge.className   = `badge ${badgeClass(newStatus)}`;
        }
        const cached = this.allTickets.find(t => t.id === id);
        if (cached) cached.estado = newStatus;
      },
    });
  }

  async handleQuickRepair(id, btn) {
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = '⏳...';

    await ensureBudgetApprovedEvent(id);
    const result = await updateTicketStatus(id, WORK_STATUS.enReparacion);

    if (result.success) {
      showToast('Pasado a Reparación', 'success');
      const ticket = this.allTickets.find(t => t.id === id);
      if (ticket) ticket.estado = WORK_STATUS.enReparacion;
      const badge = document.getElementById(`badge-${id}`);
      if (badge) {
        badge.textContent = WORK_STATUS.enReparacion;
        badge.className   = 'badge badge-orange';
      }
      const wrap = btn.closest('.quick-repair-wrap');
      if (wrap) wrap.remove();
      const ctaCell = document.querySelector(`td.tt-cta[data-id="${id}"]`);
      if (ctaCell) ctaCell.innerHTML = '';
    } else {
      showToast(result.error || 'Error', 'error');
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  async handleReingreso(id, btn) {
    if (!confirm('¿Generar un reingreso para este equipo?')) return;
    btn.disabled = true;
    const ticket = this.allTickets.find(t => t.id === id);
    if (!ticket) return;
    const res = await reingresoTicket(ticket);
    if (res.success) {
      showToast('Reingreso generado', 'success');
      window.location.hash = `#ticket-edit?id=${res.id}`;
    } else {
      showToast(res.error || 'Error', 'error');
      btn.disabled = false;
    }
  }

  initStatusSelectors() {
    document.querySelectorAll('.status-selector').forEach(select => {
      select.addEventListener('change', async (e) => {
        await this.handleStatusChange(e.target.dataset.id, e.target.value, e.target);
      });
    });
  }

  async handleStatusChange(id, newStatus, selectElement) {
    if (selectElement) selectElement.disabled = true;
    const result = await updateTicketStatus(id, newStatus);
    if (result.success) {
      showToast('Estado actualizado', 'success');
      const badge = document.getElementById(`badge-${id}`);
      if (badge) {
        badge.textContent = newStatus;
        badge.classList.remove('badge-cyan', 'badge-orange', 'badge-green', 'badge-gray');
        if (newStatus === WORK_STATUS.ingresado)    badge.classList.add('badge-cyan');
        if (newStatus === WORK_STATUS.enReparacion) badge.classList.add('badge-orange');
        if (newStatus === WORK_STATUS.listo)        badge.classList.add('badge-green');
        if (newStatus === WORK_STATUS.entregado)    badge.classList.add('badge-gray');
      }
      const ticket = this.allTickets.find(t => t.id === id);
      if (ticket) ticket.estado = newStatus;
      const ctaCell = document.querySelector(`td.tt-cta[data-id="${id}"]`);
      if (ctaCell && newStatus === WORK_STATUS.enReparacion) ctaCell.innerHTML = '';
    } else {
      showToast(result.error || 'Error', 'error');
      if (selectElement && selectElement.tagName === 'SELECT') {
        const ticket = this.allTickets.find(t => t.id === id);
        if (ticket) selectElement.value = ticket.estado;
      }
    }
    if (selectElement) selectElement.disabled = false;
  }

  saveState() {
    sessionStorage.setItem('ticketsViewState', JSON.stringify({
      filter: this.currentFilter,
      term: this.currentTerm,
      viewMode: this.viewMode,
      scroll: window.scrollY
    }));
  }

  getFilteredTickets() {
    let filtered = this.allTickets;
    if (this.currentFilter !== 'all') {
      filtered = filtered.filter(t => {
        const estado = t.estado;
        if (this.currentFilter === 'pendiente')  return estado === WORK_STATUS.ingresado;
        if (this.currentFilter === 'proceso')    return estado === WORK_STATUS.enReparacion;
        if (this.currentFilter === 'finalizado') return [WORK_STATUS.listo, WORK_STATUS.entregado].includes(estado);
        return true;
      });
    }
    if (this.currentTerm) {
      const q = this.currentTerm.toLowerCase();
      filtered = filtered.filter(t => {
        // Smart search searchable string
        const searchable = [
          t.numeroOrden || '',
          t.nombre || '',
          t.apellido || '',
          t.telefono || '',
          t.dni || '',
          t.equipo || '',
          t.marca || '',
          t.modelo || '',
          t.problema || ''
        ].join(' ').toLowerCase();
        
        return searchable.includes(q);
      });
    }
    return filtered;
  }

  applyFilters(grid) {
    const filtered = this.getFilteredTickets();
    grid.innerHTML  = this.viewMode === 'table' ? this.renderTable(filtered) : this.renderCards(filtered);
    this.initStatusSelectors();
  }

  toggleTicketSelection(id) {
    if (this.selectedTickets.has(id)) this.selectedTickets.delete(id);
    else this.selectedTickets.add(id);
    const cardEl = document.getElementById(`ticket-card-${id}`);
    if (cardEl) cardEl.classList.toggle('ticket-selected', this.selectedTickets.has(id));
    const rowEl = document.querySelector(`tr[data-ticket-id="${id}"]`);
    if (rowEl) rowEl.classList.toggle('ticket-selected', this.selectedTickets.has(id));
    const cb = document.querySelector(`.ticket-checkbox[data-id="${id}"]`);
    if (cb) cb.checked = this.selectedTickets.has(id);
    this.updateBulkBar();
  }

  updateBulkBar() {
    const bar   = document.getElementById('bulk-bar');
    const count = document.getElementById('bulk-count');
    if (!bar) return;
    const n = this.selectedTickets.size;
    bar.classList.toggle('is-visible', n > 0);
    if (count) count.textContent = `${n} seleccionado${n !== 1 ? 's' : ''}`;
  }

  clearSelection() {
    this.selectedTickets.clear();
    this._lastClickedId = null;
    document.querySelectorAll('.ticket-selected').forEach(el => el.classList.remove('ticket-selected'));
    document.querySelectorAll('.ticket-checkbox').forEach(cb => { cb.checked = false; });
    this.updateBulkBar();
  }

  handleShiftSelect(targetId) {
    const rows = Array.from(document.querySelectorAll('.tickets-table tbody tr'));
    const ids = rows.map(r => r.dataset.ticketId);
    
    const startIdx = ids.indexOf(this._lastClickedId);
    const endIdx   = ids.indexOf(targetId);
    
    if (startIdx === -1 || endIdx === -1) {
      this.toggleTicketSelection(targetId);
      this._lastClickedId = targetId;
      return;
    }

    const range = ids.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);
    
    // Determine if we are selecting or deselecting based on the target state
    const shouldSelect = !this.selectedTickets.has(targetId);
    
    range.forEach(id => {
      if (shouldSelect) this.selectedTickets.add(id);
      else this.selectedTickets.delete(id);
      
      const rowEl = document.querySelector(`tr[data-ticket-id="${id}"]`);
      if (rowEl) rowEl.classList.toggle('ticket-selected', shouldSelect);
      const cb = document.querySelector(`.ticket-checkbox[data-id="${id}"]`);
      if (cb) cb.checked = shouldSelect;
    });
    
    this._lastClickedId = targetId;
    this.updateBulkBar();
  }

  async executeBulkAction(newStatus) {
    const ids = [...this.selectedTickets];
    if (!ids.length) return;
    const bar = document.getElementById('bulk-bar');
    const btns = bar?.querySelectorAll('.bulk-action-btn, .bulk-clear-btn') || [];
    btns.forEach(b => { b.disabled = true; });
    const result = await updateMultipleTicketStatus(ids, newStatus);
    if (result.success || result.updated > 0) {
      showToast(`${result.updated} tickets actualizados`, 'success');
      ids.forEach(id => {
        const ticket = this.allTickets.find(t => t.id === id);
        if (ticket) ticket.estado = newStatus;
        const badge = document.getElementById(`badge-${id}`);
        if (badge) {
          badge.textContent = newStatus;
          badge.className   = `badge ${badgeClass(newStatus)}`;
        }
      });
      this.clearSelection();
      if (this.currentFilter !== 'all') this.applyFilters(document.getElementById('tickets-grid'));
    } else {
      showToast(result.error || 'Error', 'error');
    }
    btns.forEach(b => { b.disabled = false; });
  }
}
