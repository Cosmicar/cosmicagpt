import { getTickets } from '../services/tickets.js';
import { renderLoadingState, renderErrorState, renderEmptyState } from '../components/app-state.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { render as renderTicketCard } from '../components/ticket-card.js';

/**
 * Vista de Tickets / Trabajos
 */
export function render() {
  setTimeout(() => loadTicketsData(), 0);
  
  return `
    <div id="tickets-container">
      ${renderLoadingState()}
    </div>
  `;
}

async function loadTicketsData() {
  const container = document.getElementById('tickets-container');
  if (!container) return;
  
  try {
    const tickets = await getTickets();
    
    if (tickets.length === 0) {
      container.innerHTML = renderEmptyState('No hay tickets o órdenes de trabajo registradas.');
      return;
    }
    
    let html = renderSectionHeader('Tickets / Trabajos', 'Listado de órdenes de servicio en el sistema.', '🛠️ Módulo');
    
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
