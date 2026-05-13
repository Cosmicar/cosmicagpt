/**
 * Router minimalista para el sistema SaaS Cosmica
 */
export class Router {
  constructor() {
    this.routes = {
      'dashboard': () => this.loadDashboard(),
      'clientes': () => this.loadClientes(),
      'tickets': () => this.loadTickets()
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
      this.loadDashboard(); // Fallback
    }
  }
  
  loadDashboard() {
    this.updateContentView('Dashboard', 'Vista del panel principal del SaaS.', '📊');
    this.updateActiveLink('dashboard');
  }
  
  loadClientes() {
    this.updateContentView('Clientes', 'Gestión y listado de clientes.', '👥');
    this.updateActiveLink('clientes');
  }
  
  loadTickets() {
    this.updateContentView('Tickets / Trabajos', 'Gestión de órdenes de servicio y soporte.', '🛠️');
    this.updateActiveLink('tickets');
  }
  
  updateContentView(title, description, icon) {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.innerHTML = `
        <div class="card glass-card">
          <div class="badge badge-cyan">${icon} Módulo</div>
          <h2 class="card-title" style="margin-top: var(--space-md);">${title}</h2>
          <p class="card-content" style="color: var(--text-muted); margin-top: var(--space-sm);">
            ${description}
          </p>
          <div style="margin-top: var(--space-lg);">
            <button class="btn btn-primary">Acción de ${title}</button>
          </div>
        </div>
      `;
    }
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
