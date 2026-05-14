import { DashboardView } from '../views/dashboard.js';
import { ClientesView } from '../views/clientes.js';
import { TicketsView } from '../views/tickets.js';
import { ClienteFormView } from '../views/cliente-form.js';
import { renderEmptyState } from '../components/app-state.js';
import { BaseView } from './base-view.js';
import { getCurrentSession } from './session.js';

/**
 * Router minimalista para el sistema SaaS Cosmica
 */
export class Router {
  constructor() {
    this.currentView = null;
    this.routeTitles = {
      'dashboard': 'Dashboard | Cosmica SaaS',
      'clientes': 'Clientes | Cosmica SaaS',
      'tickets': 'Trabajos | Cosmica SaaS',
      'cliente-nuevo': 'Nuevo Cliente | Cosmica SaaS',
      'inventario': 'Inventario | Cosmica SaaS',
      'configuracion': 'Configuración | Cosmica SaaS'
    };

    // Mapeo de rutas a Clases de Vista
    this.routes = {
      'dashboard': DashboardView,
      'clientes': ClientesView,
      'tickets': TicketsView,
      'cliente-nuevo': ClienteFormView,
      'cliente-edit': ClienteFormView,
      // Fallback para módulos no implementados (pueden ser funciones que retornen HTML o clases simples)
      'inventario': class extends BaseView { render() { return renderEmptyState('El módulo de inventario aún no está implementado.'); } },
      'configuracion': class extends BaseView { render() { return renderEmptyState('El módulo de configuración aún no está implementado.'); } }
    };
    
    // Escuchar cambios de ruta
    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('load', () => this.handleRoute());

    // Ejecución inicial para manejar el hash actual (útil en refresh)
    this.handleRoute();
  }
  
  handleRoute() {
    if (!getCurrentSession().user) return;

    const fullHash = window.location.hash.slice(1) || 'dashboard';
    // Extraer path y parámetros (ej: #cliente-edit?id=123)
    const [path, queryString] = fullHash.split('?');
    const params = new URLSearchParams(queryString);
    
    const ViewClass = this.routes[path];
    
    if (ViewClass) {
      this.loadRoute(new ViewClass(params), path);
    } else {
      console.warn(`Ruta no encontrada: ${path}`);
      this.loadRoute(new DashboardView(), 'dashboard'); // Fallback
    }
  }
  
  loadRoute(viewInstance, routeName) {
    // 1. Ejecutar destroy en la vista anterior si existe
    if (this.currentView && typeof this.currentView.destroy === 'function') {
      this.currentView.destroy();
    }

    this.currentView = viewInstance;

    const mainContent = document.querySelector('.main-content');
    if (mainContent && viewInstance) {
      // 2. Renderizar HTML
      mainContent.innerHTML = viewInstance.render();
      
      // 3. Ejecutar lifecycle afterRender (Bindeo de eventos)
      if (typeof viewInstance.afterRender === 'function') {
        viewInstance.afterRender();
      }

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
