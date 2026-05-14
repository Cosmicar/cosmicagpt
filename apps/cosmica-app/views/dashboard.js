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
  renderContent(data) {
    const { metrics, recentTickets, recentClients } = data;
    this._recentTickets = recentTickets;
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
          <div style="display: flex; gap: var(--space-sm);">
             <button class="btn btn-secondary btn-sm" id="btn-refresh">🔄 Actualizar</button>
             ${canCreateTicket ? '<a href="#ticket-nuevo" class="btn btn-primary btn-sm">➕ Nuevo Trabajo</a>' : ''}
          </div>
        </header>

        <!-- KPIs Principales -->
        <section class="grid-stack" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
          ${this.renderKPI('PENDIENTES', metrics.pending, 'var(--accent-orange)', '⏳')}
          ${this.renderKPI('EN REPARACIÓN', metrics.inRepair, 'var(--accent-cyan)', '🔧')}
          ${this.renderKPI('LISTOS', metrics.ready, 'var(--accent-green)', '✅')}
          ${this.renderKPI('ENTREGADOS HOY', metrics.deliveredToday, 'var(--text-muted)', '📦')}
          ${this.renderKPI('DEMORADOS', metrics.overdue, 'var(--danger, #ff4757)', '⚠️')}
        </section>

        <div class="grid-stack" style="grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: var(--space-xl);">
          
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
      <div class="card glass-card" style="display: flex; flex-direction: column; gap: var(--space-xs); border-left: 4px solid ${color}; transition: transform 0.2s;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <span style="font-size: 10px; color: var(--text-muted); font-weight: 700; letter-spacing: 0.5px;">${label}</span>
          <span style="font-size: 16px; opacity: 0.8;">${icon}</span>
        </div>
        <div style="font-size: 36px; font-weight: 800; color: ${color}; line-height: 1.1; margin-top: 5px;">
          ${value}
        </div>
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
        const ticket = (this._recentTickets || []).find(t => t.id === btn.dataset.id);
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
  }
}
