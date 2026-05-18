import { AsyncView } from '../core/async-view.js';
import { getDashboardData } from '../services/dashboard.js';
import { updateTicketStatus } from '../services/tickets.js';
import { ensureBudgetApprovedEvent } from '../services/ticket-history.js';
import { render as renderTicketCard } from '../components/ticket-card.js';
import { render as renderClientCard } from '../components/client-card.js';
import { canAccess } from '../core/session.js';
import { renderKPISkeletons, renderCardSkeletonList } from '../components/app-state.js';
import { openTicketPrint } from '../components/ticket-print.js';
import { showToast } from '../components/toast.js';
import { formatRelativeTs, TICKET_EVENT_ICONS } from '../core/utils.js';
import { getDaysInStatus, isAbandoned, getAgingBadge } from '../core/intelligence.js';
import { openWhatsApp, buildReadyMessage, buildApprovalMessage, buildReminderMessage, buildLastWarningMessage } from '../core/message-templates.js';

/**
 * Vista de Dashboard Operacional
 * Delegación de lógica a dashboard service.
 */
export class DashboardView extends AsyncView {
  constructor(params) {
    super(params);
    this.containerId = 'dashboard-container';
    this.stats       = null;
  }

  /**
   * Carga los datos necesarios para el dashboard desde el servicio
   */
  async loadData() {
    return await getDashboardData();
  }

  /**
   * Override para usar skeletons específicos del dashboard
   */
  renderLoading() {
    return `
      <div class="dashboard-grid" style="display: flex; flex-direction: column; gap: var(--space-xl);">
        <!-- Header Skeleton -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <div class="skeleton" style="width: 80px; height: 16px; margin-bottom: 8px;"></div>
            <div class="skeleton" style="width: 200px; height: 32px; margin-bottom: 8px;"></div>
            <div class="skeleton" style="width: 300px; height: 14px;"></div>
          </div>
        </div>
        
        <!-- KPIs Skeletons -->
        ${renderKPISkeletons()}

        <!-- Lists Skeletons -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: var(--space-xl);">
          <section>
            <div class="skeleton" style="width: 150px; height: 20px; margin-bottom: var(--space-lg);"></div>
            ${renderCardSkeletonList(2)}
          </section>
          <section>
            <div class="skeleton" style="width: 150px; height: 20px; margin-bottom: var(--space-lg);"></div>
            ${renderCardSkeletonList(2)}
          </section>
        </div>
      </div>
    `;
  }

  /**
   * Renderiza el contenido del dashboard con los datos procesados
   */
  /**
   * Computes the follow-up pending list from the full ticket dataset.
   * Returns items sorted by criticality (abandoned → listo largo → approval → repuesto).
   */
  _buildFollowUpList(allTickets) {
    const now = Date.now();
    const msDay = 1000 * 60 * 60 * 24;
    const followUp = [];

    for (const t of allTickets) {
      if (t.estado === 'Entregado') continue;
      const daysInStatus = getDaysInStatus(t);
      const ref = t.updatedAt?.toDate ? t.updatedAt.toDate() : new Date(t.updatedAt || t.fechaIngreso);
      const daysSince = Math.floor((now - ref.getTime()) / msDay);

      // Abandoned > 30 days
      if (isAbandoned(t)) {
        followUp.push({ ticket: t, reason: '🔴 Abandonado', days: daysSince, priority: 0 });
        continue;
      }
      // Listo > 5 days
      if (t.estado === 'Listo' && daysInStatus >= 5) {
        followUp.push({ ticket: t, reason: '📲 Listo sin retirar', days: daysInStatus, priority: 1 });
        continue;
      }
      // Waiting approval > 3 days
      if (t.presupuesto > 0 && !t.aprobadoCliente && daysInStatus >= 3) {
        followUp.push({ ticket: t, reason: '🛠 Sin aprobación', days: daysInStatus, priority: 2 });
        continue;
      }
      // Waiting parts > 7 days
      if (t.estado === 'Esperando repuesto' && daysInStatus >= 7) {
        followUp.push({ ticket: t, reason: '📦 Repuesto > 7d', days: daysInStatus, priority: 3 });
        continue;
      }
    }

    return followUp.sort((a, b) => a.priority - b.priority || b.days - a.days);
  }

  renderContent(data) {
    const { metrics, intelligence, recentTickets, recentClients, attentionRequired, activityFeed } = data;
    this._recentTickets = recentTickets;
    this._attentionTickets = attentionRequired;
    this._allTicketsForExport = recentTickets; // Simplification for now, could fetch more
    this._followUpItems = this._buildFollowUpList([...(recentTickets || []), ...(attentionRequired || [])]);
    const canCreateTicket = canAccess('create-ticket');
    const showIntelligence = canAccess('admin-stats') && intelligence;

    return `
      <div class="dashboard-wrapper animate-fade-in" style="display: flex; flex-direction: column; gap: var(--space-lg);">
        
        <!-- Header del Dashboard -->
        <header class="flex-between" style="margin-bottom: var(--space-md);">
          <div>
            <div class="badge badge-cyan" style="margin-bottom: var(--space-sm); opacity: 0.8;">Operativo</div>
            <h1 style="font-size: var(--font-3xl); font-weight: 800; letter-spacing: -0.03em;">Panel de Control</h1>
            <p style="color: var(--text-muted); font-size: var(--font-sm); font-weight: 500;">Monitor de actividad en tiempo real · ${new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <div style="display: flex; gap: var(--space-md); align-items: center; flex-wrap: wrap; justify-content: flex-end;">
             <div style="display: flex; gap: 6px; background: rgba(255,255,255,0.03); padding: 6px; border-radius: var(--radius-md); border: 1px solid var(--border);">
               <button id="export-tickets-btn" class="btn btn-sm btn-secondary" title="Exportar tickets visibles a CSV" style="font-size: 11px; padding: 6px 12px;">📥 Tickets</button>
               <button id="export-caja-btn" class="btn btn-sm btn-secondary" title="Exportar caja diaria a CSV" style="font-size: 11px; padding: 6px 12px;">📊 Caja</button>
             </div>
             <button class="btn btn-secondary btn-sm" id="btn-refresh">🔄 Actualizar</button>
             ${canCreateTicket ? '<a href="#ticket-nuevo" class="btn btn-primary btn-sm">➕ Nuevo Trabajo</a>' : ''}
          </div>
        </header>

        <!-- KPIs Principales (atajos clickeables al listado filtrado de Trabajos) -->
        <section class="kpi-grid" style="margin-bottom: var(--space-lg);">
          ${this.renderKPI('PENDIENTES',     metrics.pending,        'var(--accent-orange)', '⏳', 'pendiente')}
          ${this.renderKPI('EN REPARACIÓN',  metrics.inRepair,       'var(--accent-cyan)',   '🔧', 'proceso')}
          ${this.renderKPI('LISTOS',         metrics.ready,          'var(--accent-green)',  '✅', 'listo')}
          ${this.renderKPI('ENTREGADOS HOY', metrics.deliveredToday, 'var(--text-muted)',    '📦', 'entregado-hoy')}
          ${this.renderKPI('DEMORADOS',      metrics.overdue,        'var(--danger)',        '⚠️', 'demorado')}
        </section>
        
        <!-- Atención Requerida -->
        ${attentionRequired && attentionRequired.length > 0 ? `
        <section style="background: rgba(255, 71, 87, 0.03); padding: var(--space-lg); border-radius: var(--radius-xl); border: 1px solid rgba(255, 71, 87, 0.08); margin-bottom: var(--space-xl);">
          <div class="section-divider flex-between" style="margin-bottom: var(--space-md);">
            <h3 style="font-size: var(--font-lg); font-weight: 800; color: var(--danger); display: flex; align-items: center; gap: 10px; letter-spacing: -0.02em;">
              <span>⚠️</span> Atención Requerida
            </h3>
            <span style="font-size: var(--font-xs); color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.8;">Tickets Críticos</span>
          </div>
          <div class="grid-stack" style="grid-template-columns: 1fr; gap: 8px;">
            ${attentionRequired.map(t => renderTicketCard(t)).join('')}
          </div>
        </section>
        ` : ''}

        <!-- Follow-up Alerts -->
        ${this._followUpItems.length > 0 ? `
        <section style="background:rgba(37,211,102,0.03);padding:var(--space-lg);border-radius:var(--radius-xl);border:1px solid rgba(37,211,102,0.1); margin-bottom: var(--space-xl);">
          <div class="section-divider flex-between" style="margin-bottom:var(--space-md);">
            <h3 style="font-size:var(--font-lg);font-weight:800;color:#25D366;display:flex;align-items:center;gap:10px; letter-spacing: -0.02em;">
              <span>📲</span> Seguimientos Pendientes
            </h3>
            <span style="font-size:var(--font-xs);color:var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.8;">${this._followUpItems.length} por contactar</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${this._followUpItems.slice(0, 10).map(({ ticket: t, reason, days }) => `
              <div class="glass-card" style="padding:12px 16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap; border: 1px solid rgba(255,255,255,0.02);" data-followup-id="${t.id}">
                <div style="flex:1;min-width:0;">
                  <div style="font-size:var(--font-sm);font-weight:700;color:var(--text-primary); letter-spacing: -0.01em;">${[t.nombre, t.apellido].filter(Boolean).join(' ') || 'Sin nombre'} · <span style="color: var(--accent-cyan); opacity: 0.8;">#${t.numeroOrden || '—'}</span></div>
                  <div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:2px; font-weight: 500;">${[t.equipo, t.marca].filter(Boolean).join(' ') || '—'} · <span style="color:var(--accent-orange); opacity: 0.9;">${reason}</span> · <span style="opacity: 0.7;">hace ${days}d</span></div>
                </div>
                ${getAgingBadge(t)}
                ${t.telefono ? `
                  <button class="btn btn-sm followup-wa-btn" data-id="${t.id}" data-reason="${reason}" style="padding:6px 12px;background:rgba(37,211,102,0.1);color:#25D366;border:1px solid rgba(37,211,102,0.2);font-size:11px; font-weight: 700; white-space:nowrap;">
                    📲 WhatsApp
                  </button>
                ` : '<span style="font-size:11px;color:var(--text-muted); font-weight: 600; opacity: 0.5;">Sin teléfono</span>'}
                <a href="#ticket-edit?id=${t.id}" class="btn btn-sm btn-secondary" style="padding:6px 10px;font-size:11px; font-weight: 700;">📝</a>
              </div>
            `).join('')}
          </div>
        </section>
        ` : ''}

        ${showIntelligence ? this.renderIntelligence(intelligence) : ''}

        <!-- ╔══ MAIN OPS AREA — Movements (primary) + Activity feed (side panel) ══╗ -->
        <div class="dashboard-main-grid">

          <!-- Primary column: Últimos Movimientos (wider, main attention) -->
          <section class="dashboard-section-primary">
            <div class="section-divider">
              <h3 style="font-size: var(--font-md); font-weight: 700; display: flex; align-items: center; gap: 8px;">
                <span style="opacity: 0.7;">🛠️</span> Últimos Movimientos
              </h3>
            </div>
            <div class="grid-stack" style="grid-template-columns: 1fr; gap: 12px;">
              ${recentTickets.length > 0
                ? recentTickets.slice(0, 3).map(t => renderTicketCard(t)).join('')
                : '<div class="card glass-card" style="text-align:center; padding: var(--space-xl); color: var(--text-muted);">No hay actividad reciente.</div>'}
            </div>
            ${recentTickets.length > 3 ? `
              <a href="#tickets" class="dashboard-see-more-btn">
                <span>Ver todos los movimientos</span>
                <span class="arrow">→</span>
              </a>
            ` : ''}
          </section>

          <!-- Secondary side panel: Actividad Global (audit log, scrollable) -->
          <aside class="dashboard-section-secondary">
            <div class="section-divider flex-between">
              <h3 style="font-size: var(--font-md); font-weight: 700; color: var(--accent-cyan); display: flex; align-items: center; gap: 8px;">
                <span>🛰️</span> Actividad Global
              </h3>
              <span class="badge badge-cyan" style="font-size: 10px;">Audit</span>
            </div>
            <div class="glass-card dashboard-activity-feed">
              ${activityFeed && activityFeed.length > 0 ? activityFeed.map(ev => `
                <div style="padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; gap: 12px; align-items: flex-start; transition: background var(--transition-fast); background: ${ev.source === 'finance' ? 'rgba(16, 185, 129, 0.03)' : 'rgba(255,255,255,0.01)'};">
                  <span style="font-size: 1.15rem; min-width: 24px; text-align: center; opacity: 0.9;">
                    ${ev.source === 'finance' ? '💰' : (TICKET_EVENT_ICONS[ev.type] || '⚪')}
                  </span>
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 12.5px; font-weight: 600; color: var(--text-primary); line-height: 1.45; letter-spacing: -0.01em;">${ev.message}</div>
                    <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 4px; display: flex; justify-content: space-between; font-weight: 500;">
                      <span style="display:flex; align-items:center; gap:4px; opacity:0.85;">👤 ${ev.user || 'sistema'}</span>
                      <span style="opacity:0.7;">${formatRelativeTs(ev.createdAt)}</span>
                    </div>
                  </div>
                </div>
              `).join('') : '<div class="dashboard-activity-empty">Sin actividad reciente para auditar.</div>'}
            </div>
          </aside>

        </div>

        <!-- ╔══ FULL-WIDTH ROW — Nuevos Clientes (horizontal grid) ══╗ -->
        <section class="dashboard-clients-row" style="margin-top: var(--space-lg);">
          <div class="section-divider">
            <h3 style="font-size: var(--font-md); font-weight: 700; display: flex; align-items: center; gap: 8px;">
              <span style="opacity: 0.7;">👥</span> Nuevos Clientes
            </h3>
          </div>
          <div class="grid-stack" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-md);">
            ${recentClients.length > 0
              ? recentClients.slice(0, 3).map(c => renderClientCard(c)).join('')
              : '<div class="card glass-card" style="text-align:center; padding: var(--space-xl); color: var(--text-muted);">No hay clientes registrados.</div>'}
          </div>
          ${recentClients.length > 3 ? `
            <a href="#clientes" class="dashboard-see-more-btn">
              <span>Ver todos los clientes</span>
              <span class="arrow">→</span>
            </a>
          ` : ''}
        </section>
      </div>
    `;
  }

  /**
   * Renderiza una card de KPI individual.
   * @param {string} label - Etiqueta UPPERCASE
   * @param {number} value - Valor a mostrar
   * @param {string} color - CSS color (var() or hex) para acento
   * @param {string} icon  - Emoji o glyph decorativo
   * @param {string|null} filterKey - Si se provee, la card se vuelve un atajo
   *        clickeable hacia #tickets?filter=<filterKey> (Pendientes, Demorados, etc.)
   */
  renderKPI(label, value, color, icon, filterKey = null) {
    const inner = `
      <div class="kpi-icon">${icon}</div>
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-accent-bar" style="width: 20px; height: 2px; background: ${color}; opacity: 0.5; border-radius: 2px;"></div>
    `;

    if (filterKey) {
      return `
        <a href="#tickets?filter=${filterKey}"
           class="card glass-card kpi-card kpi-card-link"
           style="border-left-color: ${color};"
           aria-label="Ver ${label.toLowerCase()}: ${value} tickets"
           title="Ver tickets en estado ${label.toLowerCase()}">
          ${inner}
          <span class="kpi-card-arrow" aria-hidden="true">→</span>
        </a>
      `;
    }
    return `
      <div class="card glass-card kpi-card" style="border-left-color: ${color};">
        ${inner}
      </div>
    `;
  }

  /**
   * Renderiza la sección de Inteligencia Operacional — KPIs ejecutivos +
   * performance + rankings compactos. Solo admin/tester.
   * Datos pre-computados en services/dashboard.js (single O(n) pass).
   */
  renderIntelligence(intel) {
    const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });
    const fmtNum = (n) => Number(n || 0).toLocaleString('es-AR');
    const escape = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // Distribución Taller / Remoto inline split bar (muted colours, no neon)
    const renderTipoSplit = () => {
      const total = intel.servicioTallerCount + intel.servicioRemotoCount;
      if (total === 0) return '<div class="ops-card-empty">Sin servicios registrados.</div>';
      const tallerPct = (intel.servicioTallerCount / total) * 100;
      const remotoPct = 100 - tallerPct;
      return `
        <div class="split-bar" role="img" aria-label="Distribución de servicios: Taller ${tallerPct.toFixed(0)}% / Remoto ${remotoPct.toFixed(0)}%">
          <div class="split-segment split-taller" style="width: ${tallerPct}%;"></div>
          <div class="split-segment split-remoto" style="width: ${remotoPct}%;"></div>
        </div>
        <div class="split-legend">
          <div class="split-item">
            <span class="split-dot dot-taller"></span>
            <span class="split-label">Taller</span>
            <strong>${tallerPct.toFixed(0)}%</strong>
            <span class="split-count">${fmtNum(intel.servicioTallerCount)}</span>
          </div>
          <div class="split-item">
            <span class="split-dot dot-remoto"></span>
            <span class="split-label">Remoto</span>
            <strong>${remotoPct.toFixed(0)}%</strong>
            <span class="split-count">${fmtNum(intel.servicioRemotoCount)}</span>
          </div>
        </div>
      `;
    };

    const renderRanking = (items, label, valueFmt) => {
      if (!items || items.length === 0) {
        return '<div class="ranking-empty">Sin datos.</div>';
      }
      return `
        <ol class="ranking-list">
          ${items.map((r, i) => `
            <li class="ranking-item">
              <span class="ranking-pos">${i + 1}</span>
              <span class="ranking-name" title="${escape(r.nombre)}">${escape(r.nombre)}</span>
              <span class="ranking-value">${valueFmt(r)}</span>
            </li>
          `).join('')}
        </ol>
      `;
    };

    return `
      <section class="dashboard-intelligence" aria-labelledby="intel-heading">
        <div class="section-divider flex-between" style="margin-bottom: var(--space-md);">
          <h3 id="intel-heading" style="font-size: var(--font-lg); font-weight: 800; letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px;">
            <span style="opacity:0.8;">📊</span> Inteligencia Operacional
          </h3>
          <span style="font-size: var(--font-xs); color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.65;">Histórico global · admin</span>
        </div>

        <!-- Executive KPI strip (4 columns) -->
        <div class="executive-kpi-grid">
          <div class="exec-kpi-card">
            <div class="exec-kpi-label">Total Servicios</div>
            <div class="exec-kpi-value">${fmtNum(intel.totalServicios)}</div>
            <div class="exec-kpi-sub">${fmtNum(intel.countEntregados)} entregados</div>
          </div>
          <div class="exec-kpi-card">
            <div class="exec-kpi-label">Facturación Global</div>
            <div class="exec-kpi-value exec-kpi-money">${fmtMoney(intel.facturacionGlobal)}</div>
            <div class="exec-kpi-sub">Bruto · entregados</div>
          </div>
          <div class="exec-kpi-card">
            <div class="exec-kpi-label">Ticket Promedio</div>
            <div class="exec-kpi-value exec-kpi-cyan">${fmtMoney(intel.ticketPromedio)}</div>
            <div class="exec-kpi-sub">${fmtNum(intel.clientesActivos)} clientes activos</div>
          </div>
          <div class="exec-kpi-card">
            <div class="exec-kpi-label">Retención Clientes</div>
            <div class="exec-kpi-value">${intel.tasaRetencion.toFixed(1)}<span class="exec-kpi-unit">%</span></div>
            <div class="exec-kpi-sub">Con &gt; 1 servicio</div>
          </div>
        </div>

        <!-- Performance + Distribution row -->
        <div class="ops-metrics-grid">
          <div class="ops-card">
            <div class="ops-card-label">Tiempo Promedio de Resolución</div>
            <div class="ops-card-main">
              <span class="ops-big-number">${intel.tiempoPromedioResolDias.toFixed(1)}</span>
              <span class="ops-unit">días</span>
            </div>
            <div class="ops-card-sub">Promedio · ingreso → entrega</div>
          </div>
          <div class="ops-card">
            <div class="ops-card-label">Distribución por Tipo</div>
            <div class="ops-card-split">${renderTipoSplit()}</div>
          </div>
        </div>

        <!-- ╔══ HERO ANALYTICS — Province distribution donut (single chart) ══╗ -->
        ${this.renderProvincesDonut(intel)}

        <!-- Rankings (2 compact columns — Provincias migrated to donut above) -->
        <div class="rankings-grid rankings-grid-2">
          <div class="ranking-card">
            <div class="ranking-header">
              <span class="ranking-icon">🛠️</span>
              <span>Top Técnicos</span>
            </div>
            ${renderRanking(intel.topTecnicos, 'técnicos', (r) => `<strong>${fmtNum(r.count)}</strong> <span class="ranking-pct">entregas</span>`)}
          </div>
          <div class="ranking-card">
            <div class="ranking-header">
              <span class="ranking-icon">💡</span>
              <span>Top Problemas</span>
            </div>
            ${renderRanking(intel.topProblemas, 'problemas', (r) => `<strong>${fmtNum(r.count)}</strong>`)}
          </div>
        </div>
      </section>
    `;
  }

  /**
   * Hero donut chart — single executive analytics centerpiece.
   * Pure SVG (no Chart.js, no dependencies). Stroke-dasharray technique.
   * Top 5 provinces explicit + "Otros" grouped. Muted, premium palette.
   */
  renderProvincesDonut(intel) {
    const data = intel.provinciasChart || [];
    const total = data.reduce((s, x) => s + x.count, 0);
    const fmtNum = (n) => Number(n || 0).toLocaleString('es-AR');
    const escape = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    if (total === 0 || data.length === 0) {
      return `
        <div class="donut-hero-card">
          <div class="donut-empty">Sin datos geográficos para visualizar.</div>
        </div>
      `;
    }

    // Premium muted palette — Stripe/Linear-inspired, low saturation
    const PALETTE = ['#00BFD8', '#5B8DEE', '#9384DB', '#4EBA90', '#E8A04F', '#6E7681'];

    // SVG donut geometry — thinner ring, larger hole per brief
    const size = 200;
    const stroke = 18;                          // thin ring (premium minimal)
    const r = (size - stroke) / 2 - 2;          // -2 for breathing room
    const cx = size / 2;
    const cy = size / 2;
    const circumference = 2 * Math.PI * r;

    // Generate ring segments using stroke-dasharray offsets
    let cumulative = 0;
    const segments = data.map((item, i) => {
      const fraction = item.count / total;
      const segLength = fraction * circumference;
      const gap = circumference - segLength;
      const color = PALETTE[i % PALETTE.length];
      const offset = cumulative;
      cumulative += segLength;
      return `
        <circle
          cx="${cx}" cy="${cy}" r="${r}"
          fill="none"
          stroke="${color}"
          stroke-width="${stroke}"
          stroke-dasharray="${segLength.toFixed(2)} ${gap.toFixed(2)}"
          stroke-dashoffset="${(-offset).toFixed(2)}"
          stroke-linecap="butt"
          transform="rotate(-90 ${cx} ${cy})"
          class="donut-segment"
          data-index="${i}"
          data-name="${escape(item.nombre)}"
          data-count="${item.count}"
          data-pct="${item.pct.toFixed(1)}"
        >
          <title>${escape(item.nombre)}: ${fmtNum(item.count)} servicios · ${item.pct.toFixed(1)}%</title>
        </circle>
      `;
    }).join('');

    // Legend with colour swatches matched to SVG segments
    const legendItems = data.map((item, i) => {
      const color = PALETTE[i % PALETTE.length];
      return `
        <li class="donut-legend-item"
            data-index="${i}"
            data-name="${escape(item.nombre)}"
            data-count="${item.count}"
            data-pct="${item.pct.toFixed(1)}">
          <span class="donut-legend-dot" style="background:${color};"></span>
          <span class="donut-legend-name" title="${escape(item.nombre)}">${escape(item.nombre)}</span>
          <span class="donut-legend-count">${fmtNum(item.count)}</span>
          <span class="donut-legend-pct">${item.pct.toFixed(0)}%</span>
        </li>
      `;
    }).join('');

    return `
      <section class="donut-hero-card" aria-labelledby="donut-heading">
        <div class="donut-hero-header">
          <h4 id="donut-heading">
            <span style="opacity:0.8;">🌍</span>
            Servicios por Provincia
          </h4>
          <span class="donut-hero-meta">${fmtNum(intel.distinctProvincias)} provincias · cobertura nacional</span>
        </div>
        <div class="donut-hero-inner">
          <div class="donut-svg-wrap">
            <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Donut: distribución de servicios por provincia">
              <!-- Faint track behind segments for visual depth -->
              <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="${stroke}"/>
              ${segments}
              <!-- Center text -->
              <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="donut-center-number" dominant-baseline="central">${fmtNum(total)}</text>
              <text x="${cx}" y="${cy + 20}" text-anchor="middle" class="donut-center-label" dominant-baseline="central">Servicios</text>
            </svg>
          </div>
          <ul class="donut-legend">
            ${legendItems}
          </ul>
        </div>
      </section>
    `;
  }

  /**
   * Manejo de eventos post-render
   */
  onContentReady() {
    // Botón de refresh
    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => this.fetchAndRender());
    }

    // Follow-up WhatsApp buttons
    document.querySelectorAll('.followup-wa-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const reason = btn.dataset.reason || '';
        const allTickets = [...(this._recentTickets || []), ...(this._attentionTickets || [])];
        const ticket = allTickets.find(t => t.id === id);
        if (!ticket) return;

        let message;
        if (reason.includes('Abandonado') || reason.includes('Último'))    message = buildLastWarningMessage(ticket);
        else if (reason.includes('Listo'))                                  message = buildReadyMessage(ticket);
        else if (reason.includes('aprobación'))                             message = buildApprovalMessage(ticket);
        else                                                                message = buildReminderMessage(ticket);
        openWhatsApp(ticket.telefono, message);
      });
    });

    // Re-vincular eventos para cambios de estado rápidos
    document.querySelectorAll('.status-selector').forEach(select => {
      select.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        const newStatus = e.target.value;
        e.target.disabled = true;
        const result = await updateTicketStatus(id, newStatus);
        if (result.success) {
          showToast('Estado actualizado', 'success');
          this.fetchAndRender();
        } else {
          showToast(result.error || 'Error al actualizar estado', 'error');
          e.target.disabled = false;
        }
      });
    });

    // Print buttons on dashboard ticket cards
    document.querySelectorAll('.ticket-print-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const allTickets = [...(this._recentTickets || []), ...(this._attentionTickets || [])];
        const ticket = allTickets.find(t => t.id === btn.dataset.id);
        if (ticket) openTicketPrint(ticket);
      });
    });

    // Quick Repair CTA — passes to En Reparación, records budget_approved if missing
    document.querySelectorAll('.quick-repair-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        btn.disabled = true;
        btn.textContent = '⏳ Procesando...';
        const id = btn.dataset.id;
        await ensureBudgetApprovedEvent(id);
        const result = await updateTicketStatus(id, 'En reparación');
        if (result.success) {
          this.fetchAndRender();
        } else {
          showToast(result.error || 'Error al actualizar', 'error');
          btn.disabled = false;
          btn.textContent = '🔧 Pasar a Reparación';
        }
      });
    });

    // Export Buttons
    const exportTicketsBtn = document.getElementById('export-tickets-btn');
    if (exportTicketsBtn) {
      exportTicketsBtn.addEventListener('click', () => this.exportToCSV('tickets', this._recentTickets));
    }

    const exportCajaBtn = document.getElementById('export-caja-btn');
    if (exportCajaBtn) {
      exportCajaBtn.addEventListener('click', async () => {
        const { getCajaEntries } = await import('../services/finanzas.js');
        const movs = await getCajaEntries();
        this.exportToCSV('caja', movs);
      });
    }

    // --- Interactive Donut Chart Synchronization & Premium Center Hover Feedback ---
    const donutSegments = document.querySelectorAll('.donut-segment');
    const donutLegendItems = document.querySelectorAll('.donut-legend-item');
    const donutCenterNum = document.querySelector('.donut-center-number');
    const donutCenterLbl = document.querySelector('.donut-center-label');

    if (donutCenterNum && donutCenterLbl) {
      const defaultNumber = donutCenterNum.textContent;
      const defaultLabel = donutCenterLbl.textContent;

      const setActiveItem = (index, name, count, pct) => {
        // Update center with gorgeous detailed stats
        donutCenterNum.textContent = count;
        donutCenterLbl.textContent = `${name} · ${pct}%`;
        donutCenterLbl.style.fill = 'var(--accent-cyan)';
        donutCenterLbl.style.opacity = '1';

        // Animate segments
        donutSegments.forEach((seg, i) => {
          if (i === index) {
            seg.classList.add('is-active');
            seg.classList.remove('is-inactive');
          } else {
            seg.classList.remove('is-active');
            seg.classList.add('is-inactive');
          }
        });

        // Highlight matching legend item
        donutLegendItems.forEach((item, i) => {
          if (i === index) {
            item.classList.add('is-active');
          } else {
            item.classList.remove('is-active');
          }
        });
      };

      const resetActiveState = () => {
        donutCenterNum.textContent = defaultNumber;
        donutCenterLbl.textContent = defaultLabel;
        donutCenterLbl.style.fill = 'var(--text-muted)';
        donutCenterLbl.style.opacity = '0.85';

        donutSegments.forEach(seg => {
          seg.classList.remove('is-active', 'is-inactive');
        });

        donutLegendItems.forEach(item => {
          item.classList.remove('is-active');
        });
      };

      donutSegments.forEach((seg, idx) => {
        const name  = seg.getAttribute('data-name');
        const count = seg.getAttribute('data-count');
        const pct   = seg.getAttribute('data-pct');

        seg.addEventListener('mouseenter', () => setActiveItem(idx, name, count, pct));
        seg.addEventListener('mouseleave', resetActiveState);
      });

      donutLegendItems.forEach((item, idx) => {
        const name  = item.getAttribute('data-name');
        const count = item.getAttribute('data-count');
        const pct   = item.getAttribute('data-pct');

        item.addEventListener('mouseenter', () => setActiveItem(idx, name, count, pct));
        item.addEventListener('mouseleave', resetActiveState);
      });
    }
  }

  exportToCSV(filename, data) {
    if (!data || !data.length) {
      showToast('No hay datos para exportar', 'error');
      return;
    }

    const excludeKeys = ['_searchIndex', 'reentryRisk', 'criticalAlert', 'badge', 'isOverloaded'];
    const sampleObj = data[0];
    const headers = Object.keys(sampleObj).filter(k => !excludeKeys.includes(k)).join(',');
    
    const rows = data.map(obj => {
      return Object.keys(obj)
        .filter(k => !excludeKeys.includes(k))
        .map(k => {
          const str = String(obj[k] || '').replace(/,/g, ' ').replace(/"/g, '""');
          return `"${str}"`;
        }).join(',');
    });

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Liberar blob URL después de que el navegador inicia la descarga
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Exportación iniciada', 'success');
  }

  destroy() {
    // Los eventos en .status-selector, .ticket-print-btn, etc son delegados al nodo principal por mainContent.innerHTML en el router (ya que se reemplaza el HTML, se limpian del DOM), pero para ser correctos:
    // Los listeners de document.getElementById si se hicieron, se limpian si el nodo se destruye, pero en finanzas se usa ID en el DOM global? No, main-content.
    // Dashboard no crea listeners en window ni document global.
  }
}
