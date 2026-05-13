import { render as renderDashboard } from '../views/dashboard.js';
import { render as renderClientes } from '../views/clientes.js';
import { render as renderTickets } from '../views/tickets.js';
import { render as renderClienteForm } from '../views/cliente-form.js';
import { renderEmptyState } from '../components/app-state.js';

/**
 * Router minimalista para el sistema SaaS Cosmica
 */
export class Router {
  constructor() {
    this.routeTitles = {
      'dashboard': 'Dashboard | Cosmica SaaS',
      'clientes': 'Clientes | Cosmica SaaS',
      'tickets': 'Trabajos | Cosmica SaaS',
      'cliente-nuevo': 'Nuevo Cliente | Cosmica SaaS',
      'inventario': 'Inventario | Cosmica SaaS',
      'configuracion': 'Configuración | Cosmica SaaS'
    };

    this.routes = {
      'dashboard': () => this.loadRoute(renderDashboard(), 'dashboard'),
      'clientes': () => this.loadRoute(renderClientes(), 'clientes'),
      'tickets': () => this.loadRoute(renderTickets(), 'tickets'),
      'cliente-nuevo': () => this.loadRoute(renderClienteForm(), 'cliente-nuevo'),
      'inventario': () => this.loadRoute(renderEmptyState('El módulo de inventario aún no está implementado.'), 'inventario'),
      'configuracion': () => this.loadRoute(renderEmptyState('El módulo de configuración aún no está implementado.'), 'configuracion')
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
      // Scroll al inicio al cambiar de ruta
      window.scrollTo(0, 0);
    }
    this.updateActiveLink(routeName);
    this.updateDocumentTitle(routeName);
  }

  updateDocumentTitle(route) {
    const title = this.routeTitles[route] || 'Cosmica SaaS';
    document.title = title;
  }
  
  updateActiveLink(route) {
    document.querySelectorAll('.sidebar-link').forEach(link => {
      link.classList.remove('active');
      const href = link.getAttribute('href');
      // Soporte para múltiples formas de referenciar la misma ruta
      if (href === `#${route}` || (route === 'dashboard' && (href === '#' || href === '#dashboard'))) {
        link.classList.add('active');
      }
    });
  }
}
