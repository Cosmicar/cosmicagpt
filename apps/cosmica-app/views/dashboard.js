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
  constructor() {
    super();
    this.containerId = 'dashboard-container';
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
      <div class="dashboard-wrapper animate-fade-in" style="display: flex; flex-direction: column; gap: var(--space-xl);">
        
        <!-- Header del Dashboard -->
        <header class="flex-between">
          <div>
            <div class="badge badge-cyan" style="margin-bottom: var(--space-xs);">Vista General</div>
            <h1 style="font-size: var(--font-xl); font-weight: 800; letter-spacing: -0.5px;">Panel Operacional</h1>
            <p style="color: var(--text-muted); font-size: var(--font-sm);">Estado del taller al ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
          </div>
          <div style="display: flex; gap: var(--space-sm); align-items: center; flex-wrap: wrap; justify-content: flex-end;">
             <div style="display: flex; gap: 4px; background: rgba(255,255,255,0.03); padding: 4px; border-radius: var(--radius-md); border: 1px solid var(--border);">
               <button id="export-tickets-btn" class="btn btn-sm btn-secondary" title="Exportar tickets visibles a CSV" style="font-size: 10px; padding: 4px 8px;">📥 Tickets</button>
               <button id="export-caja-btn" class="btn btn-sm btn-secondary" title="Exportar caja diaria a CSV" style="font-size: 10px; padding: 4px 8px;">📊 Caja</button>
             </div>
             <button class="btn btn-secondary btn-sm" id="btn-refresh">🔄 Actualizar</button>
             ${canCreateTicket ? '<a href="#ticket-nuevo" class="btn btn-primary btn-sm">➕ Nuevo Trabajo</a>' : ''}
          </div>
        </header>

        <!-- KPIs Principales -->
        <section class="kpi-grid">
          ${this.renderKPI('PENDIENTES', metrics.pending, 'var(--accent-orange)', '⏳')}
          ${this.renderKPI('EN REPARACIÓN', metrics.inRepair, 'var(--accent-cyan)', '🔧')}
          ${this.renderKPI('LISTOS', metrics.ready, 'var(--accent-green)', '✅')}
          ${this.renderKPI('ENTREGADOS HOY', metrics.deliveredToday, 'var(--text-muted)', '📦')}
          ${this.renderKPI('DEMORADOS', metrics.overdue, 'var(--danger, #ff4757)', '⚠️')}
        </section>
        
        <!-- Atención Requerida -->
        ${attentionRequired && attentionRequired.length > 0 ? `
        <section style="background: rgba(255, 71, 87, 0.05); padding: var(--space-lg); border-radius: var(--radius-lg); border: 1px solid rgba(255, 71, 87, 0.1);">
          <div class="section-divider flex-between">
            <h3 style="font-size: var(--font-md); font-weight: 700; color: #ff4757; display: flex; align-items: center; gap: 8px;">
              <span>⚠️</span> Atención Requerida
            </h3>
            <span style="font-size: var(--font-xs); color: var(--text-muted);">Tickets demorados o estancados</span>
          </div>
          <div class="grid-stack" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-md);">
            ${attentionRequired.map(t => renderTicketCard(t)).join('')}
          </div>
        </section>
        ` : ''}

        <!-- Follow-up Alerts -->
        ${this._followUpItems.length > 0 ? `
        <section style="background:rgba(37,211,102,0.04);padding:var(--space-lg);border-radius:var(--radius-lg);border:1px solid rgba(37,211,102,0.15);">
          <div class="section-divider flex-between" style="margin-bottom:var(--space-md);">
            <h3 style="font-size:var(--font-md);font-weight:700;color:#25D366;display:flex;align-items:center;gap:8px;">
              <span>📲</span> Seguimientos pendientes
            </h3>
            <span style="font-size:var(--font-xs);color:var(--text-muted);">${this._followUpItems.length} ticket${this._followUpItems.length !== 1 ? 's' : ''} requieren contacto</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${this._followUpItems.slice(0, 10).map(({ ticket: t, reason, days }) => `
              <div class="glass-card" style="padding:10px 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;" data-followup-id="${t.id}">
                <div style="flex:1;min-width:0;">
                  <div style="font-size:var(--font-sm);font-weight:600;color:var(--text-primary);">${[t.nombre, t.apellido].filter(Boolean).join(' ') || 'Sin nombre'} · #${t.numeroOrden || '—'}</div>
                  <div style="font-size:var(--font-xs);color:var(--text-muted);">${[t.equipo, t.marca].filter(Boolean).join(' ') || '—'} · <span style="color:var(--accent-orange);">${reason}</span> · ${days}d</div>
                </div>
                ${getAgingBadge(t)}
                ${t.telefono ? `
                  <button class="btn btn-sm followup-wa-btn" data-id="${t.id}" data-reason="${reason}" style="padding:4px 10px;background:rgba(37,211,102,0.15);color:#25D366;border:1px solid rgba(37,211,102,0.3);font-size:10px;white-space:nowrap;">
                    📲 WhatsApp
                  </button>
                ` : '<span style="font-size:10px;color:var(--text-muted);">Sin teléfono</span>'}
                <a href="#ticket-edit?id=${t.id}" class="btn btn-sm btn-secondary" style="padding:4px 8px;font-size:10px;">📝</a>
              </div>
            `).join('')}
          </div>
        </section>
        ` : ''}

        <div class="kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: var(--space-xl);">

          <!-- Satélite de Actividad Global -->
          <section>
            <div class="section-divider flex-between">
              <h3 style="font-size: var(--font-md); font-weight: 700; color: var(--accent-cyan); display: flex; align-items: center; gap: 8px;">
                <span>🛰️</span> Actividad Global
              </h3>
              <span class="badge badge-cyan" style="font-size: 10px;">Audit Pass</span>
            </div>
            <div class="glass-card" style="padding: 0; max-height: 480px; overflow-y: auto; border-radius: var(--radius-lg);">
              ${activityFeed && activityFeed.length > 0 ? activityFeed.map(ev => `
                <div style="padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; gap: 12px; align-items: flex-start; background: ${ev.source === 'finance' ? 'rgba(16, 185, 129, 0.02)' : 'transparent'};">
                  <span style="font-size: 1.2rem; min-width: 24px; text-align: center; opacity: 0.8;">
                    ${ev.source === 'finance' ? '💰' : (TICKET_EVENT_ICONS[ev.type] || '⚪')}
                  </span>
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: var(--font-sm); font-weight: 500; color: var(--text-primary); line-height: 1.4;">${ev.message}</div>
                    <div style="font-size: var(--font-xs); color: var(--text-muted); margin-top: 4px; display: flex; justify-content: space-between;">
                      <span>👤 ${ev.user || 'sistema'}</span>
                      <span>${formatRelativeTs(ev.createdAt)}</span>
                    </div>
                  </div>
                </div>
              `).join('') : '<div style="text-align:center; padding: 40px; color: var(--text-muted); opacity: 0.5;">Sin actividad reciente para auditar.</div>'}
            </div>
          </section>

          <!-- Actividad Reciente -->
          <section>
            <div class="section-divider flex-between">
              <h3 style="font-size: var(--font-md); font-weight: 700; display: flex; align-items: center; gap: 8px;">
                <span style="opacity: 0.7;">🛠️</span> Últimos Movimientos
              </h3>
              <a href="#tickets" style="font-size: var(--font-xs); color: var(--accent-cyan); text-decoration: none; font-weight: 600;">Ver Todos →</a>
            </div>
            <div class="grid-stack" style="grid-template-columns: 1fr;">
              ${recentTickets.length > 0 
                ? recentTickets.map(t => renderTicketCard(t)).join('') 
                : '<div class="card glass-card" style="text-align:center; padding: var(--space-xl); color: var(--text-muted);">No hay actividad reciente.</div>'}
            </div>
          </section>

          <!-- Clientes Recientes -->
          <section>
            <div class="section-divider flex-between">
              <h3 style="font-size: var(--font-md); font-weight: 700; display: flex; align-items: center; gap: 8px;">
                <span style="opacity: 0.7;">👥</span> Nuevos Clientes
              </h3>
              <a href="#clientes" style="font-size: var(--font-xs); color: var(--accent-cyan); text-decoration: none; font-weight: 600;">Ver Todos →</a>
            </div>
            <div class="grid-stack" style="grid-template-columns: 1fr;">
              ${recentClients.length > 0 
                ? recentClients.map(c => renderClientCard(c)).join('') 
                : '<div class="card glass-card" style="text-align:center; padding: var(--space-xl); color: var(--text-muted);">No hay clientes registrados.</div>'}
            </div>
          </section>

        </div>
      </div>
    `;
  }

  /**
   * Renderiza una card de KPI individual
   */
  renderKPI(label, value, color, icon) {
    return `
      <div class="card glass-card kpi-card" style="display: flex; flex-direction: column; gap: var(--space-xs); border-left: 4px solid ${color}; transition: all var(--transition-normal); position: relative; overflow: hidden;">
        <div style="position: absolute; top: -10px; right: -10px; font-size: 64px; opacity: 0.03; pointer-events: none;">${icon}</div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1;">
          <span style="font-size: 11px; color: var(--text-muted); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">${label}</span>
          <span style="font-size: 18px; opacity: 0.8;">${icon}</span>
        </div>
        <div style="font-size: 42px; font-weight: 800; color: var(--text-primary); line-height: 1; margin-top: 8px; letter-spacing: -0.04em;">
          ${value}
        </div>
        <div style="width: 40px; height: 2px; background: ${color}; margin-top: var(--space-xs); opacity: 0.6; border-radius: 2px;"></div>
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

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => {
      return Object.values(obj).map(val => {
        const str = String(val).replace(/,/g, ' ');
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
}
