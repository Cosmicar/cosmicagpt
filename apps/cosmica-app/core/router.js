import { DashboardView } from '../views/dashboard.js';
import { ClientesView } from '../views/clientes.js';
import { TicketsView } from '../views/tickets.js';
import { ClienteFormView } from '../views/cliente-form.js';
import { TicketFormView } from '../views/ticket-form.js';
import { InventarioView } from '../views/inventario.js';
import { InventarioFormView } from '../views/inventario-form.js';
import { FinanzasView } from '../views/finanzas.js';
import { renderEmptyState } from '../components/app-state.js';
import { BaseView } from './base-view.js';
import { getCurrentSession } from './session.js';

/**
 * Router minimalista para el sistema SaaS Cosmica
 */
export class Router {
  constructor() {
    this.currentView = null;
    this._navId = 0;          // Increments on every navigation; guards stale async renders
    this.routeTitles = {
      'dashboard': 'Dashboard | Cosmica SaaS',
      'clientes': 'Clientes | Cosmica SaaS',
      'tickets': 'Trabajos | Cosmica SaaS',
      'cliente-nuevo': 'Nuevo Cliente | Cosmica SaaS',
      'cliente-edit': 'Editar Cliente | Cosmica SaaS',
      'ticket-nuevo': 'Nuevo Trabajo | Cosmica SaaS',
      'ticket-edit': 'Editar Trabajo | Cosmica SaaS',
      'inventario':       'Inventario | Cosmica SaaS',
      'finanzas':         'Finanzas | Cosmica SaaS',
      'inventario-nuevo': 'Nuevo Repuesto | Cosmica SaaS',
      'inventario-edit':  'Editar Repuesto | Cosmica SaaS',
      'configuracion':    'Configuración | Cosmica SaaS'
    };

    // Mapeo de rutas a Clases de Vista
    this.routes = {
      'dashboard': DashboardView,
      'clientes': ClientesView,
      'tickets': TicketsView,
      'cliente-nuevo': ClienteFormView,
      'cliente-edit': ClienteFormView,
      'ticket-nuevo': TicketFormView,
      'ticket-edit': TicketFormView,
      'inventario':      InventarioView,
      'inventario-nuevo': InventarioFormView,
      'inventario-edit':  InventarioFormView,
      'finanzas':        FinanzasView,
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
    
    // ── RBAC Guard ──────────────────────────────────────────────────────────
    const routePermissions = {
      'inventario':      'inventario-read',
      'inventario-nuevo': 'inventario-write',
      'inventario-edit':  'inventario-write',
      'finanzas':        'finanzas-read',
      'configuracion':    'config'
    };

    const requiredAction = routePermissions[path];
    if (requiredAction && !canAccess(requiredAction)) {
      console.warn(`Acceso denegado a ruta: ${path}. Redirigiendo a dashboard.`);
      window.location.hash = '#dashboard';
      return;
    }
    // ────────────────────────────────────────────────────────────────────────

    const ViewClass = this.routes[path];
    
    if (ViewClass) {
      this.loadRoute(new ViewClass(params), path);
    } else {
      console.warn(`Ruta no encontrada: ${path}`);
      this.loadRoute(new DashboardView(), 'dashboard'); // Fallback
    }
  }
  
  async loadRoute(viewInstance, routeName) {
    const navId = ++this._navId;

    // 1. Ejecutar destroy en la vista anterior si existe
    if (this.currentView && typeof this.currentView.destroy === 'function') {
      this.currentView.destroy();
    }

    this.currentView = viewInstance;

    const mainContent = document.querySelector('.main-content');
    if (!mainContent || !viewInstance) return;

    // 2. Renderizar HTML (estado de carga sincrónico)
    mainContent.innerHTML = viewInstance.render();
    window.scrollTo(0, 0);

    // 3. Ejecutar lifecycle afterRender (async — puede tardar por fetch de datos)
    if (typeof viewInstance.afterRender === 'function') {
      await viewInstance.afterRender();
    }

    // Si otra navegación ocurrió mientras cargábamos, no actualizar la UI de navegación
    if (this._navId !== navId) return;

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
