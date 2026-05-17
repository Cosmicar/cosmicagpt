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
    const { metrics, recentTickets, recentClients, attentionRequired, activityFeed } = data;
    this._recentTickets = recentTickets;
    this._attentionTickets = attentionRequired;
    this._allTicketsForExport = recentTickets; // Simplification for now, could fetch more
    this._followUpItems = this._buildFollowUpList([...(recentTickets || []), ...(attentionRequired || [])]);
    const canCreateTicket = canAccess('create-ticket');

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

        <!-- KPIs Principales -->
        <section class="kpi-grid" style="margin-bottom: var(--space-lg);">
          ${this.renderKPI('PENDIENTES', metrics.pending, 'var(--accent-orange)', '⏳')}
          ${this.renderKPI('EN REPARACIÓN', metrics.inRepair, 'var(--accent-cyan)', '🔧')}
          ${this.renderKPI('LISTOS', metrics.ready, 'var(--accent-green)', '✅')}
          ${this.renderKPI('ENTREGADOS HOY', metrics.deliveredToday, 'var(--text-muted)', '📦')}
          ${this.renderKPI('DEMORADOS', metrics.overdue, 'var(--danger)', '⚠️')}
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
          <div class="grid-stack" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-lg);">
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

        <!-- ╔══ MAIN OPS AREA — Movements (primary) + Activity feed (side panel) ══╗ -->
        <div class="dashboard-main-grid">

          <!-- Primary column: Últimos Movimientos (wider, main attention) -->
          <section class="dashboard-section-primary">
            <div class="section-divider flex-between">
              <h3 style="font-size: var(--font-md); font-weight: 700; display: flex; align-items: center; gap: 8px;">
                <span style="opacity: 0.7;">🛠️</span> Últimos Movimientos
              </h3>
              <a href="#tickets" style="font-size: var(--font-xs); color: var(--accent-cyan); text-decoration: none; font-weight: 600;">Ver Todos →</a>
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
          <div class="section-divider flex-between">
            <h3 style="font-size: var(--font-md); font-weight: 700; display: flex; align-items: center; gap: 8px;">
              <span style="opacity: 0.7;">👥</span> Nuevos Clientes
            </h3>
            <a href="#clientes" style="font-size: var(--font-xs); color: var(--accent-cyan); text-decoration: none; font-weight: 600;">Ver Todos →</a>
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
   * Renderiza una card de KPI individual
   */
  renderKPI(label, value, color, icon) {
    return `
      <div class="card glass-card kpi-card" style="border-left-color: ${color};">
        <div class="kpi-icon">${icon}</div>
        <div class="kpi-label">${label}</div>
        <div class="kpi-value">${value}</div>
        <div style="width: 20px; height: 2px; background: ${color}; opacity: 0.5; border-radius: 2px;"></div>
      </div>
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
