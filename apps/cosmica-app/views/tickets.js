import { AsyncView } from '../core/async-view.js';
import { getTickets } from '../services/tickets.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { render as renderTicketCard } from '../components/ticket-card.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';

/**
 * Vista de Tickets / Trabajos
 */
export class TicketsView extends AsyncView {
  constructor() {
    super();
    this.containerId = 'tickets-container';
  }

  async loadData() {
    return await getTickets();
  }

  renderContent(tickets) {
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
    return html;
  }

  renderEmpty() {
    return super.renderEmpty('No hay tickets o órdenes de trabajo registradas.');
  }
}
