import { BaseView } from '../core/base-view.js';
import { getTickets } from '../services/tickets.js';
import { renderLoadingState, renderErrorState, renderEmptyState } from '../components/app-state.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { render as renderTicketCard } from '../components/ticket-card.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';

/**
 * Vista de Tickets / Trabajos
 */
export class TicketsView extends BaseView {
  render() {
    return `
      <div id="tickets-container">
        ${renderLoadingState()}
      </div>
    `;
  }

  afterRender() {
    this.loadTicketsData();
  }

  async loadTicketsData() {
    const container = document.getElementById('tickets-container');
    if (!container) return;
    
    try {
      const tickets = await getTickets();
      
      if (tickets.length === 0) {
        container.innerHTML = renderEmptyState('No hay tickets o órdenes de trabajo registradas.');
        return;
      }
      
      let html = renderBreadcrumb([
        { label: 'Operaciones', href: '#dashboard', icon: '⚙️' },
        { label: 'Trabajos', href: '#tickets', icon: '🛠️' }
      ]);
      
      html += renderSectionHeader('Tickets / Trabajos', 'Listado de órdenes de servicio en el sistema.', '🛠️ Módulo');
      
      html += `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-lg); margin-top: var(--space-xl);">
      `;
      
      tickets.forEach(ticket => {
        html += renderTicketCard(ticket);
      });
      
      html += `</div>`;
      container.innerHTML = html;
      
    } catch (error) {
      console.error("Error al cargar datos de tickets en la vista:", error);
      container.innerHTML = renderErrorState('No se pudo cargar el listado de tickets. Verifica tu conexión.');
    }
  }
}
