import { render as renderDashboard } from '../views/dashboard.js';
import { render as renderClientes } from '../views/clientes.js';
import { render as renderTickets } from '../views/tickets.js';

/**
 * Router minimalista para el sistema SaaS Cosmica
 */
export class Router {
  constructor() {
    this.routes = {
      'dashboard': () => this.loadRoute(renderDashboard(), 'dashboard'),
      'clientes': () => this.loadRoute(renderClientes(), 'clientes'),
      'tickets': () => this.loadRoute(renderTickets(), 'tickets')
    };
    
    // Escuchar cambios de ruta
    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('load', () => this.handleRoute());
  }
  
  handleRoute() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    const route = this.routes[hash];
    
    if (route) {
      route();
    } else {
      console.warn(`Ruta no encontrada: ${hash}`);
      this.routes['dashboard'](); // Fallback
    }
  }
  
  loadRoute(htmlContent, routeName) {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.innerHTML = htmlContent;
    }
    this.updateActiveLink(routeName);
  }
  
  updateActiveLink(route) {
    document.querySelectorAll('.sidebar-link').forEach(link => {
      link.classList.remove('active');
      const href = link.getAttribute('href');
      if (href === `#${route}` || (route === 'dashboard' && href === '#')) {
        link.classList.add('active');
      }
    });
  }
}
