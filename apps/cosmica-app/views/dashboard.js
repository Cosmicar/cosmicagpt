import { AsyncView } from '../core/async-view.js';
import { getTickets } from '../services/tickets.js';
import { getClientes } from '../services/clientes.js';
import { WORK_STATUS } from '../../../js/domain.js';
import { render as renderTicketCard } from '../components/ticket-card.js';
import { render as renderClientCard } from '../components/client-card.js';

/**
 * Vista de Dashboard Operacional
 * Muestra KPIs reales, actividad reciente y clientes nuevos.
 */
export class DashboardView extends AsyncView {
  constructor() {
    super();
    this.containerId = 'dashboard-container';
  }

  /**
   * Carga los datos necesarios para el dashboard
   */
  async loadData() {
    const [tickets, clientes] = await Promise.all([
      getTickets(),
      getClientes()
    ]);

    return { tickets, clientes };
  }

  /**
   * Renderiza el contenido del dashboard con los datos reales
   */
  renderContent(data) {
    const { tickets, clientes } = data;
    const kpis = this.calculateKPIs(tickets);
    
    // Tomamos los últimos 4 tickets y clientes para las listas de actividad
    const recentTickets = tickets.slice(0, 5);
    const recentClients = [...clientes]
      .sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
      })
      .slice(0, 5);

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
          ${this.renderKPI('PENDIENTES', kpis.pending, 'var(--accent-orange)', '⏳', 'badge-orange')}
          ${this.renderKPI('EN REPARACIÓN', kpis.inRepair, 'var(--accent-cyan)', '🔧', 'badge-cyan')}
          ${this.renderKPI('LISTOS', kpis.ready, 'var(--accent-green)', '✅', 'badge-green')}
          ${this.renderKPI('ENTREGADOS HOY', kpis.deliveredToday, 'var(--text-muted)', '📦', 'badge-gray')}
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
   * Calcula las métricas clave desde el array de tickets
   */
  calculateKPIs(tickets) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return tickets.reduce((acc, t) => {
      if (t.estado === WORK_STATUS.ingresado) acc.pending++;
      if (t.estado === WORK_STATUS.enReparacion) acc.inRepair++;
      if (t.estado === WORK_STATUS.listo) acc.ready++;
      
      // Chequear si fue entregado hoy
      if (t.estado === WORK_STATUS.entregado && t.fechaEntregado) {
        const deliveredDate = t.fechaEntregado.split('T')[0];
        if (deliveredDate === todayStr) {
          acc.deliveredToday++;
        }
      }
      
      return acc;
    }, { pending: 0, inRepair: 0, ready: 0, deliveredToday: 0 });
  }

  /**
   * Renderiza una card de KPI individual
   */
  renderKPI(label, value, color, icon, badgeClass) {
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

    // Re-vincular eventos si las cards los necesitan (como los selects de estado)
    const selectors = document.querySelectorAll('.status-selector');
    selectors.forEach(select => {
      select.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        const newStatus = e.target.value;
        try {
          const { updateTicketStatus } = await import('../services/tickets.js');
          await updateTicketStatus(id, newStatus);
          // Refrescamos el dashboard para actualizar KPIs
          this.fetchAndRender();
        } catch (err) {
          console.error(err);
          alert('Error al actualizar estado: ' + err.message);
        }
      });
    });
  }
}
