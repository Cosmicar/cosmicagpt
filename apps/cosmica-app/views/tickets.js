import { AsyncView } from '../core/async-view.js';
import { getTickets, updateTicketStatus, updateMultipleTicketStatus, isOverdue, isHighValue, hasBudgetApproved, reingresoTicket } from '../services/tickets.js';
import { ensureBudgetApprovedEvent, addTicketHistoryEvent, TICKET_EVENT_TYPES } from '../services/ticket-history.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { render as renderTicketCard } from '../components/ticket-card.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';
import { renderEmptyState, renderCardSkeletonList } from '../components/app-state.js';
import { WORK_STATUS, isAdmin } from '../../../js/domain.js';
import { showToast, showActionToast } from '../components/toast.js';
import { openWhatsApp, getDefaultWhatsAppAction, buildReadyMessage, buildReminderMessage } from '../core/message-templates.js';
import { canAccess, getCurrentSession } from '../core/session.js';
import { openTicketQuickView, badgeClass } from '../components/ticket-quick-view.js';
import { openTicketPrint } from '../components/ticket-print.js';
import { seedPaletteCache } from '../components/command-palette.js';
import { getReentryRisk } from '../core/intelligence.js';

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
  constructor(params) {
    super(params);
    this.containerId    = 'tickets-container';
    this.allTickets     = [];
    this.currentFilter  = 'all';
    this.currentTerm    = '';
    this.selectedTickets = new Set();  // ids of currently selected tickets
    this._onEsc          = null;       // stored for cleanup in destroy()

    // ── Pagination & scalability state ──────────────────────────────────────
    this._page            = 1;
    this._pageSize        = 50;
    this._hasMoreFirestore = false; // hay tickets más antiguos en Firestore
    this._clientMap        = {};   // clienteId → cliente, reutilizado en load-more

    // Stale data detection: trigger "⟳ Actualizar datos" button after 5 min
    this._staleTimerMs = 5 * 60 * 1000;

    // Load persisted state
    const persisted = JSON.parse(sessionStorage.getItem('ticketsViewState') || '{}');
    const session = getCurrentSession();
    const isTecnico = session?.profile?.rol === 'tecnico';
    const isOperador = session?.profile?.rol === 'operador';

    // Deep-link filter via URL hash (e.g. #tickets?filter=pendiente from KPI shortcuts).
    // Takes precedence over sessionStorage so dashboard navigation always honours intent.
    const VALID_FILTERS = new Set(['all', 'activos', 'mis-tickets', 'sin-asignar',
                                    'finalizado', 'pendiente', 'proceso',
                                    'listo', 'entregado-hoy', 'demorado']);
    const paramFilter = params?.get?.('filter');
    const linkFilter = paramFilter && VALID_FILTERS.has(paramFilter) ? paramFilter : null;

    this.currentFilter = linkFilter || persisted.filter || (isTecnico ? 'mis-tickets' : (isOperador ? 'activos' : 'all'));
    this.currentTipoFilter = persisted.tipoFilter || 'all';
    this.currentTerm = persisted.term || '';
    this.savedScroll = persisted.scroll || 0;
    this.viewMode = persisted.viewMode || localStorage.getItem(VM_STORAGE_KEY) || 'comfortable';
    // Reset page to 1 when arriving via deep-link filter; otherwise honour persisted page
    this._page = linkFilter ? 1 : (persisted.page || 1);
    // Flag for in-view banner indicating a deep-link is active (cleared by clicking any filter button)
    this._deepLinkFilter = linkFilter;

    const isMobile = window.innerWidth < 768;
    if (this.viewMode === 'table' && isMobile) this.viewMode = 'comfortable';
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async loadData() {
    const { getClientes } = await import('../services/clientes.js');
    const { getFacturasMapByTicket } = await import('../services/facturacion.js');
    const [tickets, clients, facturasMap] = await Promise.all([
      getTickets(),
      getClientes(),
      getFacturasMapByTicket().catch(() => new Map()),
    ]);

    // Join client data for smart search (Phone, DNI)
    const clientMap = clients.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});
    this._clientMap = clientMap; // guardado para reutilizar en load-more
    this._facturasMap = facturasMap;

    // Technician Load calculation
    const techLoad = {};
    const activeTickets = tickets.filter(t => [WORK_STATUS.ingresado, WORK_STATUS.enReparacion, WORK_STATUS.esperandoRepuesto, WORK_STATUS.listo].includes(t.estado));
    activeTickets.forEach(t => {
      if (t.tecnicoAsignadoId) {
        techLoad[t.tecnicoAsignadoId] = (techLoad[t.tecnicoAsignadoId] || 0) + 1;
      }
    });

    // Pre-agrupa tickets por clienteId — O(n) en vez de O(n²) por ticket
    const clientTicketMap = new Map();
    tickets.forEach(t => {
      if (!clientTicketMap.has(t.clienteId)) clientTicketMap.set(t.clienteId, []);
      clientTicketMap.get(t.clienteId).push(t);
    });

    this.allTickets = tickets.map(t => {
      const nombre   = t.nombre   || clientMap[t.clienteId]?.nombre   || '';
      const apellido = t.apellido || clientMap[t.clienteId]?.apellido || '';
      const telefono = t.telefono || clientMap[t.clienteId]?.telefono || '';
      const dni      = t.dni      || clientMap[t.clienteId]?.dni      || '';

      const facturasDelTicket = facturasMap.get(t.id) || [];
      const enriched = {
        ...t, nombre, apellido, telefono, dni,
        isOverloaded: t.tecnicoAsignadoId && techLoad[t.tecnicoAsignadoId] > 15,
        facturada:     facturasDelTicket.length > 0,
        facturasCount: facturasDelTicket.length,
      };

      // Reentry Risk — lookup O(1) con mapa pre-construido
      enriched.reentryRisk = getReentryRisk(clientTicketMap.get(enriched.clienteId) || []);

      // ── Pre-index para búsqueda: calculado UNA vez, no en cada keystroke ──
      enriched._searchIndex = [
        String(t.numeroOrden || ''),
        nombre, apellido, telefono, dni,
        t.equipo || '', t.marca || '', t.modelo || '', t.problema || ''
      ].join(' ').toLowerCase();

      return enriched;
    });

    // ¿Hay más tickets en Firestore más allá del límite de 500?
    const { hasMoreTickets } = await import('../services/tickets.js');
    this._hasMoreFirestore = hasMoreTickets();

    seedPaletteCache({ tickets: this.allTickets });
    return this.allTickets;
  }

  destroy() {
    this.saveState();
    clearTimeout(this._staleTimerId);
    this._multitabCleanup?.();
    if (this._onEsc) {
      document.removeEventListener('keydown', this._onEsc);
      this._onEsc = null;
    }
    if (this._scrollListener) {
      window.removeEventListener('scroll', this._scrollListener);
      this._scrollListener = null;
    }
    if (this._searchDebounce) {
      clearTimeout(this._searchDebounce);
      this._searchDebounce = null;
    }
    this.selectedTickets.clear();
    if (this._opsBarRO) { this._opsBarRO.disconnect(); this._opsBarRO = null; }
    document.documentElement.style.removeProperty('--ops-bar-height');
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
    const session = getCurrentSession();
    const admin = isAdmin(session?.profile);

    let tipoFilteredTickets = tickets;
    if (admin && this.currentTipoFilter && this.currentTipoFilter !== 'all') {
      tipoFilteredTickets = tickets.filter(t => (t.tipo || 'taller').toLowerCase() === this.currentTipoFilter);
    }

    // Apply current filter (deep-link or persisted) for the initial paint.
    // Previously the grid rendered unfiltered until a button click — bug fixed.
    const filteredTickets = this.getFilteredTickets();
    const pagedTickets    = this.getPagedTickets(filteredTickets);

    // Deep-link filter chip (visible when arrived from a KPI shortcut on dashboard).
    // None of the standard filter buttons (Activos/Mis tickets/...) match these custom
    // filters, so the chip is what tells the user WHY they see what they see.
    const DEEP_LINK_LABELS = {
      'pendiente':     { label: 'Pendientes',     icon: '⏳' },
      'proceso':       { label: 'En Reparación', icon: '🔧' },
      'listo':         { label: 'Listos',          icon: '✅' },
      'entregado-hoy': { label: 'Entregados Hoy', icon: '📦' },
      'demorado':      { label: 'Demorados',       icon: '⚠️' },
    };
    const deepLinkInfo = this._deepLinkFilter ? DEEP_LINK_LABELS[this._deepLinkFilter] : null;

    let html = renderBreadcrumb([
      { label: 'Operaciones', href: '#dashboard', icon: '⚙️' },
      { label: 'Trabajos', href: '#tickets', icon: '🛠️' }
    ]);

    html += renderSectionHeader('Tickets / Trabajos', 'Listado de órdenes de servicio en el sistema.', '🛠️ Módulo');

    html += `
      <div style="margin-top: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-md);" class="animate-fade-in">

        ${deepLinkInfo ? `
          <div class="deeplink-filter-chip" role="status" aria-live="polite">
            <span class="deeplink-prefix">Filtrando por:</span>
            <span class="deeplink-label"><span class="deeplink-icon">${deepLinkInfo.icon}</span>${deepLinkInfo.label}</span>
            <span class="deeplink-count">${filteredTickets.length} ${filteredTickets.length === 1 ? 'ticket' : 'tickets'}</span>
            <a href="#tickets" class="deeplink-clear" title="Limpiar filtro" aria-label="Limpiar filtro de ${deepLinkInfo.label}">✕</a>
          </div>
        ` : ''}

        <div class="flex-between" style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: var(--radius-lg); border: 1px solid var(--border); backdrop-filter: blur(8px);">
          <div style="position: relative; flex: 1; min-width: 250px; max-width: 500px;">
            <input type="text" id="ticket-search" class="input" placeholder="Buscar por cliente, orden o problema..." style="padding-left: 40px; margin-bottom: 0; background: rgba(0,0,0,0.2); border-color: rgba(255,255,255,0.1);">
            <span style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); opacity: 0.5; pointer-events: none;">🔍</span>
          </div>

          <div style="display: flex; gap: var(--space-md); align-items: center; flex-wrap: wrap;">
            <div style="display: flex; gap: 4px; background: rgba(0,0,0,0.2); padding: 4px; border-radius: var(--radius-md); border: 1px solid var(--border); flex-wrap: wrap;">
              <button class="btn btn-sm btn-filter ${this.currentFilter === 'activos' ? 'active' : ''}" data-filter="activos">Activos</button>
              <button class="btn btn-sm btn-filter ${this.currentFilter === 'mis-tickets' ? 'active' : ''}" data-filter="mis-tickets">Mis tickets</button>
              <button class="btn btn-sm btn-filter ${this.currentFilter === 'sin-asignar' ? 'active' : ''}" data-filter="sin-asignar">Sin asignar</button>
              <button class="btn btn-sm btn-filter ${this.currentFilter === 'finalizado' ? 'active' : ''}" data-filter="finalizado">Finalizado</button>
              <button class="btn btn-sm btn-filter ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">Todos</button>
            </div>

            ${admin ? `
            <div class="tipo-filter-wrapper" style="display: flex; gap: 4px; background: rgba(0,0,0,0.2); padding: 4px; border-radius: var(--radius-md); border: 1px solid var(--border); flex-wrap: wrap;">
              <button class="btn btn-sm btn-tipo-filter ${this.currentTipoFilter === 'all' ? 'active' : ''}" data-tipo="all">📊 Todos</button>
              <button class="btn btn-sm btn-tipo-filter ${this.currentTipoFilter === 'taller' ? 'active' : ''}" data-tipo="taller">🏭 Taller</button>
              <button class="btn btn-sm btn-tipo-filter ${this.currentTipoFilter === 'remoto' ? 'active' : ''}" data-tipo="remoto">🌐 Remoto</button>
            </div>
            ` : ''}

            ${this.renderViewModeSelector()}

            <a href="#ticket-nuevo" class="btn btn-primary btn-sm" style="box-shadow: var(--shadow-glow);">
              <i>➕</i> Nuevo Trabajo
            </a>
          </div>
        </div>

      </div>

      <div class="sticky-ops-bar" style="position: sticky; top: var(--navbar-h); z-index: 100; background: rgba(8, 15, 28, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); padding: 8px var(--space-lg); border-bottom: 1px solid var(--border); display: flex; gap: var(--space-lg); margin: 10px calc(-1 * var(--space-md)) 0; overflow-x: auto; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">
        <div style="display:flex; align-items:center; gap:6px; color:var(--text-primary);"><span style="color:var(--accent-cyan); text-shadow: 0 0 8px var(--accent-cyan-glow);">●</span> Activos: ${filteredTickets.filter(t => t.estado !== WORK_STATUS.entregado).length}</div>
        <div style="display:flex; align-items:center; gap:6px; color:var(--text-primary);"><span style="color:var(--accent-orange); text-shadow: 0 0 8px var(--accent-orange-glow);">●</span> Repuesto: ${filteredTickets.filter(t => t.estado === WORK_STATUS.esperandoRepuesto).length}</div>
        <div style="display:flex; align-items:center; gap:6px; color:var(--text-primary);"><span style="color:var(--accent-green); text-shadow: 0 0 8px rgba(16,185,129,0.4);">●</span> Listos: ${filteredTickets.filter(t => t.estado === WORK_STATUS.listo).length}</div>
        <div style="display:flex; align-items:center; gap:6px; color:var(--text-primary);"><span style="color:var(--danger); text-shadow: 0 0 8px rgba(255,0,127,0.4);">●</span> Críticos: ${filteredTickets.filter(t => t.criticalAlert || t.planServicio === 'platinum' || isOverdue(t)).length}</div>
      </div>

      <div id="tickets-grid" class="grid-stack vm-${window.innerWidth < 768 ? 'comfortable' : this.viewMode}" style="margin-top: var(--space-lg); ${window.innerWidth >= 768 && this.viewMode !== 'table' ? 'grid-template-columns: 1fr;' : ''}">
        ${(this.viewMode === 'table' && window.innerWidth >= 768)
          ? this.renderTable(pagedTickets)
          : this.renderCards(pagedTickets)}
      </div>

      <div id="pagination-bar"></div>

      ${this.renderBulkBar()}
    `;
    return html;
  }

  renderCards(tickets) {
    if (tickets.length === 0) {
      const cta = this.currentFilter !== 'all' || this.currentTerm 
        ? '<button class="btn btn-sm btn-secondary" onclick="document.getElementById(\'ticket-search\').value=\'\'; document.querySelector(\'[data-filter=\\\'all\\\']\').click()">Limpiar filtros</button>'
        : '<a href="#ticket-nuevo" class="btn btn-sm btn-primary">➕ Crear primer trabajo</a>';
      return `
        <div style="grid-column: 1 / -1;">
          ${renderEmptyState('No se encontraron trabajos que coincidan con los filtros.', '🛠️', cta)}
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
              <th style="width:100px; white-space:nowrap;">Orden</th>
              <th style="white-space:nowrap;">Cliente</th>
              <th style="width:130px; white-space:nowrap;">Estado</th>
              <th class="tt-equipo" style="min-width:110px; white-space:nowrap;">Equipo</th>
              <th style="width:100px; white-space:nowrap;">Fecha</th>
              <th style="width:90px; white-space:nowrap;">Plan</th>
              <th style="width:170px; white-space:nowrap;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${tickets.map(t => this.renderTableRow(t, statusOptions)).join('')}
          </tbody>
        </table>
      </div>`;
  }

  /**
   * Pequeño badge "Taller"/"Remoto" — solo para admin/tester (los operadores
   * solo ven taller de todas formas, sería redundante).
   */
  _renderTipoBadge(ticket) {
    const session = getCurrentSession();
    const role = session?.profile?.rol;
    if (role !== 'admin' && role !== 'tester') return '';
    const tipo = (ticket.tipo || 'taller').toLowerCase();
    if (tipo === 'remoto') {
      return '<span class="badge badge-violet" style="font-size:9px; padding:2px 6px;" title="Servicio remoto">🌐 REMOTO</span>';
    }
    return '<span class="badge badge-cyan" style="font-size:9px; padding:2px 6px;" title="Servicio en taller">🏭 TALLER</span>';
  }

  renderTableRow(ticket, statusOptions) {
    const estado     = ticket.estado || WORK_STATUS.ingresado;
    const bc         = badgeClass(estado);
    const isSelected = this.selectedTickets.has(ticket.id);
    const fecha      = ticket.fechaIngreso ? new Date(ticket.fechaIngreso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
    const equipo     = [ticket.equipo, ticket.marca].filter(Boolean).join(' ') || '—';
    const cliente    = [ticket.nombre, ticket.apellido].filter(Boolean).join(' ') || 'Sin nombre';
    const plan       = ticket.planServicio
      ? ticket.planServicio.charAt(0).toUpperCase() + ticket.planServicio.slice(1)
      : '—';
    const canEdit    = canAccess('edit-ticket');
    const overdue    = isOverdue(ticket);
    const highValue  = isHighValue(ticket);
    const showCTA    = hasBudgetApproved(ticket) && canEdit;

    // Compact indicators inline to avoid vertical stacking
    let indicators = '';
    if (ticket.tecnicoAsignadoId) indicators += `<span title="Técnico: ${ticket.tecnicoAsignadoNombre}" style="font-size:12px;">👨‍🔧</span>`;
    if (ticket.isOverloaded) indicators += `<span title="Sobrecargado" style="font-size:12px;">🔥</span>`;
    if (ticket.reentryRisk) indicators += `<span title="${ticket.reentryRisk.label}" style="font-size:12px;">♻️</span>`;
    if (overdue) indicators += `<span title="Demorado" style="font-size:12px;">⚠</span>`;
    if (highValue) indicators += `<span title="Alto Valor" style="font-size:12px;">💎</span>`;

    return `
      <tr data-ticket-id="${ticket.id}" class="${isSelected ? 'ticket-selected' : ''}">
        <td class="tt-check" style="width:40px; text-align:center; padding:0 8px;">
          <input type="checkbox" class="ticket-checkbox" data-id="${ticket.id}" ${isSelected ? 'checked' : ''}>
        </td>
        <td class="tt-orden" style="width:100px;">#${ticket.numeroOrden || '—'}</td>
        <td class="tt-cliente" title="${cliente}">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span>${cliente}</span>
            ${this._renderTipoBadge(ticket)}
            ${ticket.facturada ? `<span class="badge badge-success" style="font-size:9px; padding:2px 6px;" title="Factura AFIP emitida">🧾 Facturado</span>` : ''}
            ${indicators ? `<div style="display:flex; gap:2px; opacity:0.85;">${indicators}</div>` : ''}
          </div>
        </td>
        <td style="width:130px;">
          <span class="badge ${bc}" id="badge-${ticket.id}" style="white-space:nowrap; padding:4px 8px; font-size:10px; font-weight:700; border-radius:4px; letter-spacing:0.02em;">${estado}</span>
        </td>
        <td class="tt-equipo" style="min-width:110px; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${equipo}</td>
        <td class="tt-fecha" style="width:100px;">${fecha}</td>
        <td class="tt-plan" style="width:90px;">${plan}</td>
        <td class="tt-acciones tt-cta" data-id="${ticket.id}" style="width:170px;">
          <div style="display:flex; align-items:center; gap:6px;">
            ${showCTA ? `
              <button class="btn btn-sm btn-primary quick-repair-btn" data-id="${ticket.id}" style="white-space:nowrap; font-size:11px; padding:4px 10px; border-radius:4px; min-height:28px;">🔧 Reparar</button>
            ` : canEdit ? `
              <select class="status-selector" data-id="${ticket.id}" style="white-space:nowrap;">
                ${statusOptions.map(opt => `<option value="${opt}" ${estado === opt ? 'selected' : ''}>${opt}</option>`).join('')}
              </select>
              <a href="#ticket-edit?id=${ticket.id}" class="btn btn-sm btn-secondary" style="padding:4px 8px; border-radius:4px; min-height:28px; display:flex; align-items:center; justify-content:center;" title="Editar">📝</a>
            ` : ''}
            <button class="btn btn-sm btn-secondary ticket-print-btn" data-id="${ticket.id}" style="padding:4px 8px; border-radius:4px; min-height:28px; display:flex; align-items:center; justify-content:center;" title="Imprimir orden">🖨</button>
          </div>
        </td>
      </tr>`;
  }

  // ── Event wiring ──────────────────────────────────────────────────────────

  onContentReady() {
    // ── Dynamic sticky stacking: measure ops bar real height ─────────────────
    // Must run before any scroll so the CSS calc is accurate on first paint.
    const opsBar = document.querySelector('.sticky-ops-bar');
    const _syncOpsBarHeight = () => {
      const h = opsBar ? opsBar.offsetHeight : 0;
      document.documentElement.style.setProperty('--ops-bar-height', `${h}px`);
    };
    _syncOpsBarHeight();
    if (opsBar && typeof ResizeObserver !== 'undefined') {
      this._opsBarRO = new ResizeObserver(_syncOpsBarHeight);
      this._opsBarRO.observe(opsBar);
    }
    // ─────────────────────────────────────────────────────────────────────────

    const searchInput   = document.getElementById('ticket-search');
    const filterButtons = document.querySelectorAll('.btn-filter');
    const grid          = document.getElementById('tickets-grid');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(this._searchDebounce);
        this._searchDebounce = setTimeout(() => {
          this._searchDebounce = null;
          this.currentTerm = e.target.value.toLowerCase().trim();
          this.saveState();
          const g = document.getElementById('tickets-grid');
          if (g) this.applyFilters(g, true); // true = resetPage (nueva búsqueda → página 1)
        }, 200); // 200ms debounce
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
        // Switching to a standard filter clears the deep-link chip.
        if (this._deepLinkFilter) {
          this._deepLinkFilter = null;
          const chip = document.querySelector('.deeplink-filter-chip');
          if (chip) chip.remove();
        }
        this.saveState();
        this.applyFilters(grid, true); // resetPage: nuevo filtro → página 1
      });
    });

    const tipoFilterButtons = document.querySelectorAll('.btn-tipo-filter');
    tipoFilterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tipoFilterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTipoFilter = btn.dataset.tipo;
        this.saveState();
        this.applyFilters(grid, true); // resetPage: nuevo filtro → página 1
      });
    });

    document.querySelectorAll('.vm-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (mode === this.viewMode) return;

        this.viewMode = mode;
        localStorage.setItem(VM_STORAGE_KEY, mode);
        this.saveState();

        grid.classList.remove('vm-compact', 'vm-comfortable', 'vm-expanded', 'vm-table');
        grid.classList.add(`vm-${mode}`);

        document.querySelectorAll('.vm-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // ALWAYS re-render grid on view mode change to ensure structural changes apply
        const filtered = this.getFilteredTickets();
        const paged    = this.getPagedTickets(filtered);
        const shouldRenderTable = mode === 'table' && window.innerWidth >= 768;
        grid.innerHTML = shouldRenderTable ? this.renderTable(paged) : this.renderCards(paged);
        this.initStatusSelectors();
        this.updatePagination(filtered.length);
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
      const qtBtn = e.target.closest('.quick-tomar-btn');
      if (qtBtn) {
        e.stopPropagation();
        this.handleTomarTicket(qtBtn.dataset.id, qtBtn);
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
      const waBtn = e.target.closest('.ticket-whatsapp-btn');
      if (waBtn) {
        e.stopPropagation();
        const ticket = this.allTickets.find(t => t.id === waBtn.dataset.id);
        if (!ticket) return;
        const action = getDefaultWhatsAppAction(ticket);
        const message = action ? action.build(ticket) : buildReminderMessage(ticket);
        openWhatsApp(ticket.telefono, message);
        return;
      }
      if (e.target.closest('select, .btn, a, button, .ticket-actions-col, .ticket-dropdown-content')) return;
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

    // Render inicial de la barra de paginación
    this.updatePagination(this.getFilteredTickets().length);
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
    if (btn.disabled) return;
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = '⏳...';

    try {
      await ensureBudgetApprovedEvent(id);
      const ticket = this.allTickets.find(t => t.id === id);
      const previousStatus = ticket?.estado;
      const result = await updateTicketStatus(id, WORK_STATUS.enReparacion);

      if (result.success) {
        showToast('Pasado a Reparación', 'success');
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

        const gridQR = document.getElementById('tickets-grid');
        if (gridQR) this.applyFilters(gridQR);
        this._showUndoToast(id, WORK_STATUS.enReparacion, previousStatus);
      } else {
        showToast(result.error || 'Error', 'error');
      }
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  async handleTomarTicket(id, btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = '⏳...';

    try {
      const { assignTechnician } = await import('../services/tickets.js');
      const session = getCurrentSession();
      const result = await assignTechnician(id, {
        id: session.user.uid,
        nombre: session.profile?.nombre || session.user.email
      });

      if (result.success) {
        showToast('Ticket asignado a ti', 'success');
        const ticket = this.allTickets.find(t => t.id === id);
        if (ticket) {
          ticket.tecnicoAsignadoId = session.user.uid;
          ticket.tecnicoAsignadoNombre = session.profile?.nombre || session.user.email;
        }
        const grid = document.getElementById('tickets-grid');
        if (grid) this.applyFilters(grid);
      } else {
        showToast(result.error || 'Error', 'error');
      }
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  async handleReingreso(id, btn) {
    if (btn.disabled) return;
    if (!confirm('¿Generar un reingreso para este equipo?')) return;
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = '⏳...';
    try {
      const ticket = this.allTickets.find(t => t.id === id);
      if (!ticket) return;
      const res = await reingresoTicket(ticket);
      if (res.success) {
        showToast('Reingreso generado', 'success');
        window.location.hash = `#ticket-edit?id=${res.id}`;
      } else {
        showToast(res.error || 'Error', 'error');
      }
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
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

    // Capture previousStatus BEFORE the update so the undo can revert it
    const ticket = this.allTickets.find(t => t.id === id);
    const previousStatus = ticket?.estado;

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
      if (ticket) ticket.estado = newStatus;
      const ctaCell = document.querySelector(`td.tt-cta[data-id="${id}"]`);
      if (ctaCell && newStatus === WORK_STATUS.enReparacion) ctaCell.innerHTML = '';

      // Offer undo only when there is a meaningful previous state to return to
      if (previousStatus && previousStatus !== newStatus) {
        this._showUndoToast(id, newStatus, previousStatus);
      }
    } else {
      showToast(result.error || 'Error', 'error');
      if (selectElement && selectElement.tagName === 'SELECT') {
        if (ticket) selectElement.value = ticket.estado;
      }
    }
    if (selectElement) selectElement.disabled = false;
  }

  /**
   * Muestra un toast con botón "Deshacer" que revierte el cambio de estado.
   * Valida que el estado actual coincida antes de revertir para evitar sobreescribir
   * cambios que ocurrieron mientras el toast estaba visible (undo token pattern).
   */
  async _showUndoToast(id, currentStatus, previousStatus) {
    if (!previousStatus || previousStatus === currentStatus) return;

    showActionToast(
      `Estado → "${currentStatus}"`,
      'Deshacer',
      async () => {
        // Guard: verify state hasn't changed since we showed the toast
        const ticket = this.allTickets.find(t => t.id === id);
        if (!ticket || ticket.estado !== currentStatus) {
          showToast('El ticket ya fue actualizado. No se puede deshacer.', 'warning');
          // Log rejected undo to history (fire-and-forget)
          addTicketHistoryEvent(id, TICKET_EVENT_TYPES.undoRejected, {
            attemptedRevert: previousStatus,
            currentState: ticket?.estado ?? 'unknown',
          }).catch(() => {});
          return;
        }

        const result = await updateTicketStatus(id, previousStatus);
        if (result.success) {
          ticket.estado = previousStatus;
          const badge = document.getElementById(`badge-${id}`);
          if (badge) {
            badge.textContent = previousStatus;
            badge.className   = `badge ${badgeClass(previousStatus)}`;
          }
          showToast('Cambio revertido', 'info');
          addTicketHistoryEvent(id, TICKET_EVENT_TYPES.undoSuccess, {
            revertedFrom: currentStatus,
            revertedTo:   previousStatus,
          }).catch(() => {});
        } else {
          showToast(result.error || 'Error al deshacer', 'error');
        }
      },
      5000, // 5 s window to undo
    );
  }

  saveState() {
    this.savedScroll = window.scrollY;
    sessionStorage.setItem('ticketsViewState', JSON.stringify({
      filter:     this.currentFilter,
      tipoFilter: this.currentTipoFilter,
      term:       this.currentTerm,
      viewMode:   this.viewMode,
      scroll:     this.savedScroll,
      page:       this._page,
    }));
  }

  getFilteredTickets() {
    let filtered = this.allTickets;

    // Filter by Service Type (Taller vs Remoto) for admin
    const session = getCurrentSession();
    const admin = isAdmin(session?.profile);
    if (admin && this.currentTipoFilter && this.currentTipoFilter !== 'all') {
      filtered = filtered.filter(t => (t.tipo || 'taller').toLowerCase() === this.currentTipoFilter);
    }

    if (this.currentFilter !== 'all') {
      filtered = filtered.filter(t => {
        const estado = t.estado;
        const session = getCurrentSession();
        if (this.currentFilter === 'mis-tickets') return t.tecnicoAsignadoId === session?.user?.uid && estado !== WORK_STATUS.entregado;
        if (this.currentFilter === 'activos') return estado !== WORK_STATUS.entregado;
        if (this.currentFilter === 'sin-asignar') return !t.tecnicoAsignadoId && estado !== WORK_STATUS.entregado;
        if (this.currentFilter === 'pendiente')  return estado === WORK_STATUS.ingresado;
        if (this.currentFilter === 'proceso')    return estado === WORK_STATUS.enReparacion;
        if (this.currentFilter === 'listo')      return estado === WORK_STATUS.listo;
        if (this.currentFilter === 'finalizado') return [WORK_STATUS.listo, WORK_STATUS.entregado].includes(estado);
        if (this.currentFilter === 'entregado-hoy') {
          if (estado !== WORK_STATUS.entregado) return false;
          const todayStr = new Date().toISOString().split('T')[0];
          return t.fechaEntregado?.split('T')[0] === todayStr;
        }
        if (this.currentFilter === 'demorado')   return isOverdue(t);
        return true;
      });
    }
    if (this.currentTerm) {
      const q = this.currentTerm.toLowerCase();
      // Usa el pre-index calculado en loadData() — O(1) por ticket vs. O(M) antes
      filtered = filtered.filter(t => t._searchIndex ? t._searchIndex.includes(q) : false);
    }

    // Orden:
    // - Vista "Todos" o "Finalizado": puramente cronológico descendente (último ingresado arriba)
    // - Resto (activos, mis-tickets, sin-asignar, etc.): prioridad por estado + fecha desc dentro del grupo
    const pureChronological = this.currentFilter === 'all' || this.currentFilter === 'finalizado';

    filtered.sort((a, b) => {
      const dateA = new Date(a.fechaIngreso || a.createdAt || 0).getTime();
      const dateB = new Date(b.fechaIngreso || b.createdAt || 0).getTime();

      if (pureChronological) return dateB - dateA;

      const getPriority = (t) => {
        if (t.criticalAlert || t.planServicio === 'platinum' || isOverdue(t)) return 0;
        if (t.estado === WORK_STATUS.esperandoRepuesto) return 1;
        if (t.estado === WORK_STATUS.listo) return 2;
        if (t.estado === WORK_STATUS.enReparacion) return 3;
        if (t.estado === WORK_STATUS.ingresado) return 4;
        return 5;
      };
      const pA = getPriority(a);
      const pB = getPriority(b);
      if (pA !== pB) return pA - pB;
      return dateB - dateA;  // más reciente primero dentro del grupo
    });

    return filtered;
  }

  /** Retorna el slice de `filtered` correspondiente a la página actual. */
  getPagedTickets(filtered) {
    const start = (this._page - 1) * this._pageSize;
    return filtered.slice(start, start + this._pageSize);
  }

  /**
   * Re-renderiza el grid aplicando filtros + paginación.
   * @param {HTMLElement} grid
   * @param {boolean}     resetPage  Si true, vuelve a la página 1 (nuevo filtro o búsqueda).
   */
  applyFilters(grid, resetPage = false) {
    if (!grid) return; // Guard: vista puede haber sido desmontada
    if (resetPage) this._page = 1;
    const filtered = this.getFilteredTickets();
    const paged    = this.getPagedTickets(filtered);
    grid.innerHTML  = this.viewMode === 'table' ? this.renderTable(paged) : this.renderCards(paged);
    this.initStatusSelectors();
    this.updatePagination(filtered.length);
  }

  /** Actualiza (o limpia) la barra de paginación bajo el grid. */
  updatePagination(totalFiltered) {
    const bar = document.getElementById('pagination-bar');
    if (!bar) return;

    const totalPages = Math.ceil(totalFiltered / this._pageSize);
    const hasPrev    = this._page > 1;
    const hasNext    = this._page < totalPages;
    const start      = Math.min((this._page - 1) * this._pageSize + 1, totalFiltered || 1);
    const end        = Math.min(this._page * this._pageSize, totalFiltered);

    if (totalPages <= 1 && !this._hasMoreFirestore) {
      bar.innerHTML = '';
      return;
    }

    bar.innerHTML = `
      <div style="
        display:flex;align-items:center;gap:var(--space-md);flex-wrap:wrap;
        justify-content:center;padding:var(--space-md) var(--space-lg);
        border-top:1px solid var(--border);margin-top:var(--space-md);
      ">
        <button class="btn btn-sm btn-secondary" id="pg-prev" ${hasPrev ? '' : 'disabled'}>← Anterior</button>
        <span style="font-size:var(--font-sm);color:var(--text-muted);">
          <strong style="color:var(--text-primary);">${start}–${end}</strong> de
          <strong style="color:var(--text-primary);">${totalFiltered}</strong>
          ${this._hasMoreFirestore
            ? `<span style="color:var(--accent-orange);margin-left:4px;" title="Hay tickets más antiguos sin cargar">· +500 en BD</span>`
            : ''}
        </span>
        <button class="btn btn-sm btn-secondary" id="pg-next" ${hasNext ? '' : 'disabled'}>Siguiente →</button>
        ${this._hasMoreFirestore ? `
          <button class="btn btn-sm" id="pg-load-more"
            style="margin-left:var(--space-sm);color:var(--accent-cyan);border-color:rgba(0,229,255,0.3);">
            ⬇ Cargar más desde la BD
          </button>` : ''}
      </div>`;

    const prevBtn = document.getElementById('pg-prev');
    const nextBtn = document.getElementById('pg-next');

    if (prevBtn) prevBtn.addEventListener('click', () => {
      this._page--;
      this.saveState();
      const g = document.getElementById('tickets-grid');
      if (g) this.applyFilters(g);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    if (nextBtn) nextBtn.addEventListener('click', () => {
      this._page++;
      this.saveState();
      const g = document.getElementById('tickets-grid');
      if (g) this.applyFilters(g);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const loadMoreBtn = document.getElementById('pg-load-more');
    if (loadMoreBtn) loadMoreBtn.addEventListener('click', () => this.handleLoadMoreFirestore(loadMoreBtn));
  }

  /** Carga la siguiente página desde Firestore y agrega los tickets al dataset. */
  async handleLoadMoreFirestore(btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Cargando...';
    try {
      const { getTicketsNextPage, hasMoreTickets } = await import('../services/tickets.js');
      const newDocs = await getTicketsNextPage();

      if (!newDocs.length) {
        this._hasMoreFirestore = false;
        showToast('No hay tickets adicionales en la base de datos', 'info');
        const g = document.getElementById('tickets-grid');
        if (g) this.applyFilters(g);
        return;
      }

      // Enriquecer nuevos tickets con el mismo pipeline que loadData()
      const existingIds = new Set(this.allTickets.map(t => t.id));
      const fresh = newDocs
        .filter(t => !existingIds.has(t.id))
        .map(t => {
          const nombre   = t.nombre   || this._clientMap[t.clienteId]?.nombre   || '';
          const apellido = t.apellido || this._clientMap[t.clienteId]?.apellido || '';
          const telefono = t.telefono || this._clientMap[t.clienteId]?.telefono || '';
          const dni      = t.dni      || this._clientMap[t.clienteId]?.dni      || '';
          return {
            ...t, nombre, apellido, telefono, dni,
            _searchIndex: [
              String(t.numeroOrden || ''), nombre, apellido, telefono, dni,
              t.equipo || '', t.marca || '', t.modelo || '', t.problema || ''
            ].join(' ').toLowerCase(),
          };
        });

      this.allTickets = [...this.allTickets, ...fresh];
      this._hasMoreFirestore = hasMoreTickets();
      showToast(`${fresh.length} tickets adicionales cargados`, 'success');

      const g = document.getElementById('tickets-grid');
      if (g) this.applyFilters(g);
    } catch (err) {
      console.error('[TicketsView] load-more failed:', err);
      showToast('Error al cargar más tickets', 'error');
      btn.disabled = false;
      btn.textContent = '⬇ Cargar más desde la BD';
    }
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
      if (this.currentFilter !== 'all') {
        const gridBulk = document.getElementById('tickets-grid');
        if (gridBulk) this.applyFilters(gridBulk);
      }
    } else {
      showToast(result.error || 'Error', 'error');
    }
    btns.forEach(b => { b.disabled = false; });
  }
}
