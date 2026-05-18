import { DashboardView } from '../views/dashboard.js';
import { ClientesView } from '../views/clientes.js';
import { TicketsView } from '../views/tickets.js';
import { ClienteFormView } from '../views/cliente-form.js';
import { TicketFormView } from '../views/ticket-form.js';
import { InventarioView } from '../views/inventario.js';
import { InventarioFormView } from '../views/inventario-form.js';
import { FinanzasView } from '../views/finanzas.js';
import { ConfiguracionView } from '../views/configuracion.js';
import { renderEmptyState } from '../components/app-state.js';
import { BaseView } from './base-view.js';
import { getCurrentSession, canAccess } from './session.js';
import { updateCajaStatusIndicator } from './app.js';

/**
 * Router minimalista para el sistema SaaS Cosmica
 */
export class Router {
  constructor() {
    this.currentView = null;
    this._navId = 0;          // Increments on every navigation; guards stale async renders
    this.routeTitles = {
      'dashboard': 'Dashboard | Cósmica App',
      'clientes': 'Clientes | Cósmica App',
      'tickets': 'Trabajos | Cósmica App',
      'cliente-nuevo': 'Nuevo Cliente | Cósmica App',
      'cliente-edit': 'Editar Cliente | Cósmica App',
      'ticket-nuevo': 'Nuevo Trabajo | Cósmica App',
      'ticket-edit': 'Editar Trabajo | Cósmica App',
      'inventario':       'Inventario | Cósmica App',
      'finanzas':         'Finanzas | Cósmica App',
      'inventario-nuevo': 'Nuevo Repuesto | Cósmica App',
      'inventario-edit':  'Editar Repuesto | Cósmica App',
      'configuracion':    'Configuración | Cósmica App'
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
      'configuracion':    ConfiguracionView
    };
    
    // Escuchar cambios de ruta
    window.addEventListener('hashchange', () => this.handleRoute());

    // Ejecución inicial para manejar el hash actual.
    // El listener 'load' fue removido: el router se instancia desde DOMContentLoaded
    // (después de que initializeSession resuelve), por lo que el hash ya es accesible.
    // Agregar 'load' causaba un segundo handleRoute() innecesario.
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
      'finanzas':        'finanzas-read'
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
    updateCajaStatusIndicator();
  }

  updateDocumentTitle(route) {
    const title = this.routeTitles[route] || 'Cósmica App';
    document.title = title;
  }
  
  updateActiveLink(route) {
    document.querySelectorAll('.sidebar-link, .mobile-nav-link').forEach(link => {
      link.classList.remove('active');
      const href = link.getAttribute('href');
      const linkRoute = href ? href.slice(1) : '';

      // Match exact route or sub-routes (e.g. #inventario-nuevo highlights #inventario)
      const isExactMatch = href === `#${route}`;
      const isSubRoute   = linkRoute && route.startsWith(linkRoute) && linkRoute !== 'dashboard';
      const isDashboard  = route === 'dashboard' && (href === '#' || href === '#dashboard');

      if (isExactMatch || isSubRoute || isDashboard) {
        link.classList.add('active');
      }
    });
  }
}
