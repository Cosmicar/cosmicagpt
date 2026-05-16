import { AsyncView } from '../core/async-view.js';
import { getInventario, filterInventario, stockBadgeClass, stockBadgeLabel } from '../services/inventario.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';
import { renderEmptyState, renderCardSkeletonList } from '../components/app-state.js';
import { canAccess } from '../core/session.js';

const VM_STORAGE_KEY = 'inventarioViewMode';
const VIEW_MODES = [
  { key: 'compact',     label: '⊟', title: 'Compacto'  },
  { key: 'comfortable', label: '⊞', title: 'Normal'    },
  { key: 'expanded',    label: '▦', title: 'Expandido' },
];

export class InventarioView extends AsyncView {
  constructor(params) {
    super(params);
    this.containerId = 'inventario-container';
    this.allItems    = [];
    this.viewMode    = localStorage.getItem(VM_STORAGE_KEY) || 'comfortable';
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async loadData() {
    this.allItems = await getInventario();
    return { items: this.allItems }; // object so empty array doesn't hit renderEmpty()
  }

  renderLoading() {
    return `
      <div style="margin-top: var(--space-xl);">
        <div class="skeleton" style="width: 220px; height: 32px; margin-bottom: var(--space-lg);"></div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-lg);">
          ${renderCardSkeletonList(6)}
        </div>
      </div>`;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  renderContent({ items }) {
    const canCreate = canAccess('admin') || false; // only admin via catch-all
    const canAdmin  = canCreate;

    const breadcrumb = renderBreadcrumb([
      { label: 'Operaciones', href: '#dashboard', icon: '⚙️' },
      { label: 'Inventario',  href: '#inventario', icon: '📦' },
    ]);
    const header = renderSectionHeader(
      'Inventario',
      'Repuestos y materiales disponibles en el taller.',
      '📦 Módulo'
    );

    return `
      ${breadcrumb}
      ${header}

      <div class="operational-controls flex-between animate-fade-in" style="margin-top: var(--space-md); flex-wrap: wrap; gap: var(--space-md); background: rgba(255,255,255,0.02); padding: 12px; border-radius: var(--radius-lg); border: 1px solid var(--border);">
        <div class="search-wrapper">
          <input type="text" id="inv-search" class="input"
            placeholder="Buscar por nombre, SKU o categoría...">
          <span class="search-icon">🔍</span>
        </div>

        <div style="display: flex; gap: var(--space-md); align-items: center; flex-wrap: wrap;">
          ${this.renderViewModeSelector()}
          ${canAdmin ? `<a href="#inventario-nuevo" class="btn btn-primary btn-sm" style="box-shadow: var(--shadow-glow);">➕ Nuevo Repuesto</a>` : ''}
        </div>
      </div>

      ${this.renderStockSummary(items)}

      <div id="inv-grid" class="grid-stack vm-${this.viewMode}" style="margin-top: var(--space-lg);">
        ${this.renderCards(items)}
      </div>
    `;
  }

  renderStockSummary(items) {
    const total  = items.length;
    const sinStock = items.filter(i => Number(i.stock || 0) === 0).length;
    const bajo   = items.filter(i => {
      const s = Number(i.stock || 0), m = Number(i.stockMinimo || 0);
      return s > 0 && s <= m;
    }).length;

    if (total === 0) return '';

    return `
      <div style="display:flex;gap:var(--space-md);margin-top:var(--space-lg);flex-wrap:wrap;">
        <div class="badge" style="font-size:var(--font-xs);padding:4px 10px;background:rgba(255,255,255,0.05);">
          📦 ${total} ítem${total !== 1 ? 's' : ''}
        </div>
        ${sinStock > 0 ? `<div class="badge badge-danger" style="font-size:var(--font-xs);padding:4px 10px;">⛔ ${sinStock} sin stock</div>` : ''}
        ${bajo > 0    ? `<div class="badge badge-orange" style="font-size:var(--font-xs);padding:4px 10px;">⚠️ ${bajo} stock bajo</div>` : ''}
      </div>`;
  }

  renderViewModeSelector() {
    return `
      <div class="vm-selector" style="display:flex;gap:3px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:var(--radius-md);padding:4px;">
        ${VIEW_MODES.map(m => `
          <button class="btn btn-sm vm-btn ${this.viewMode === m.key ? 'active' : ''}"
            data-mode="${m.key}" title="${m.title}"
            style="min-width:32px;font-size:14px;padding:4px 8px;">${m.label}</button>
        `).join('')}
      </div>`;
  }

  renderCards(items) {
    if (items.length === 0) {
      const cta = '<a href="#inventario-nuevo" class="btn btn-sm btn-primary">➕ Agregar repuesto</a>';
      return `<div style="grid-column:1/-1;">${renderEmptyState('No se encontraron repuestos que coincidan con la búsqueda.', '📦', cta)}</div>`;
    }
    return items.map(item => this.renderCard(item)).join('');
  }

  renderCard(item) {
    const badgeClass = stockBadgeClass(item);
    const badgeLabel = stockBadgeLabel(item);
    const costo      = Number(item.costo || 0).toLocaleString('es-AR');
    const canAdmin   = canAccess('admin') || false;

    return `
      <div class="card glass-card" style="display:flex;flex-direction:column;gap:var(--space-sm);">
        <div class="flex-between" style="align-items:flex-start;">
          <div style="flex:1;min-width:0;">
            <h3 class="card-title text-truncate" title="${item.nombre || ''}"
              style="font-size:var(--font-md);margin:0;">${item.nombre || '—'}</h3>
            <div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:2px;">
              ${item.sku ? `SKU: <strong>${item.sku}</strong>` : 'Sin SKU'}
            </div>
          </div>
          <div class="badge ${badgeClass}" style="white-space:nowrap;flex-shrink:0;">${badgeLabel}</div>
        </div>

        <div style="font-size:var(--font-sm);color:var(--text-muted);display:flex;flex-direction:column;gap:3px;">
          <div><span style="color:var(--text-primary);font-weight:600;">Categoría:</span> ${item.categoria || '—'}</div>
          <div><span style="color:var(--text-primary);font-weight:600;">Costo unit.:</span>
            <span style="color:var(--accent-cyan);font-weight:700;">$${costo}</span>
          </div>
          ${item.proveedor ? `<div><span style="color:var(--text-primary);font-weight:600;">Proveedor:</span> ${item.proveedor}</div>` : ''}
          <div><span style="color:var(--text-primary);font-weight:600;">Stock mín.:</span> ${item.stockMinimo || 0}</div>
        </div>

        ${canAdmin ? `
          <div style="border-top:1px solid var(--border);padding-top:var(--space-sm);display:flex;gap:var(--space-sm);">
            <a href="#inventario-edit?id=${item.id}" class="btn btn-sm btn-secondary" style="flex:1;text-align:center;">
              📝 Editar
            </a>
          </div>` : ''}
      </div>`;
  }

  // ── Events ────────────────────────────────────────────────────────────────

  onContentReady() {
    const searchInput = document.getElementById('inv-search');
    const grid        = document.getElementById('inv-grid');

    if (searchInput && grid) {
      searchInput.addEventListener('input', (e) => {
        const filtered = filterInventario(this.allItems, e.target.value.trim());
        grid.innerHTML  = this.renderCards(filtered);
      });
      searchInput.focus();
    }

    document.querySelectorAll('.vm-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (mode === this.viewMode) return;
        this.viewMode = mode;
        localStorage.setItem(VM_STORAGE_KEY, mode);
        grid?.classList.remove('vm-compact', 'vm-comfortable', 'vm-expanded');
        grid?.classList.add(`vm-${mode}`);
        document.querySelectorAll('.vm-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }
}
