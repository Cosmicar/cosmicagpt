import { AsyncView } from '../core/async-view.js';
import { getDashboardData } from '../services/dashboard.js';
import { render as renderTicketCard } from '../components/ticket-card.js';
import { render as renderClientCard } from '../components/client-card.js';

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
   * Renderiza el contenido del dashboard con los datos procesados
   */
  renderContent(data) {
    const { metrics, recentTickets, recentClients } = data;

    return `
      <div class="dashboard-grid" style="display: flex; flex-direction: column; gap: var(--space-xl); animation: fadeIn 0.4s ease-out;">
        
        <!-- Header del Dashboard -->
        <header style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: var(--space-md);">
          <div>
            <div class="badge badge-cyan" style="margin-bottom: var(--space-xs);">Vista General</div>
            <h1 style="font-size: var(--font-xl); font-weight: 800; letter-spacing: -0.5px;">Panel Operacional</h1>
            <p style="color: var(--text-muted); font-size: var(--font-sm);">Resumen del estado actual del taller al ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
          </div>
          <div style="display: flex; gap: var(--space-sm);">
             <button class="btn btn-secondary btn-sm" id="btn-refresh">🔄 Actualizar</button>
             <a href="#ticket-nuevo" class="btn btn-primary btn-sm">➕ Nuevo Trabajo</a>
          </div>
        </header>

        <!-- KPIs Principales -->
        <section style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md);">
          ${this.renderKPI('PENDIENTES', metrics.pending, 'var(--accent-orange)', '⏳')}
          ${this.renderKPI('EN REPARACIÓN', metrics.inRepair, 'var(--accent-cyan)', '🔧')}
          ${this.renderKPI('LISTOS', metrics.ready, 'var(--accent-green)', '✅')}
          ${this.renderKPI('ENTREGADOS HOY', metrics.deliveredToday, 'var(--text-muted)', '📦')}
        </section>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: var(--space-xl);">
          
          <!-- Actividad Reciente -->
          <section>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-lg); border-bottom: 1px solid var(--border); padding-bottom: var(--space-xs);">
              <h3 style="font-size: var(--font-md); font-weight: 700; display: flex; align-items: center; gap: 8px;">
                <span style="opacity: 0.7;">🛠️</span> Últimos Movimientos
              </h3>
              <a href="#tickets" style="font-size: var(--font-xs); color: var(--accent-cyan); text-decoration: none; font-weight: 600;">Ver Todos →</a>
            </div>
            <div style="display: grid; grid-template-columns: 1fr; gap: var(--space-md);">
              ${recentTickets.length > 0 
                ? recentTickets.map(t => renderTicketCard(t)).join('') 
                : '<div class="card glass-card" style="text-align:center; padding: var(--space-xl); color: var(--text-muted);">No hay actividad reciente.</div>'}
            </div>
          </section>

          <!-- Clientes Recientes -->
          <section>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-lg); border-bottom: 1px solid var(--border); padding-bottom: var(--space-xs);">
              <h3 style="font-size: var(--font-md); font-weight: 700; display: flex; align-items: center; gap: 8px;">
                <span style="opacity: 0.7;">👥</span> Nuevos Clientes
              </h3>
              <a href="#clientes" style="font-size: var(--font-xs); color: var(--accent-cyan); text-decoration: none; font-weight: 600;">Ver Todos →</a>
            </div>
            <div style="display: grid; grid-template-columns: 1fr; gap: var(--space-md);">
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
    const selectors = document.querySelectorAll('.status-selector');
    selectors.forEach(select => {
      select.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        const newStatus = e.target.value;
        try {
          const { updateTicketStatus } = await import('../services/tickets.js');
          await updateTicketStatus(id, newStatus);
          this.fetchAndRender();
        } catch (err) {
          console.error(err);
          alert('Error al actualizar estado: ' + err.message);
        }
      });
    });
  }
}
