import { Router } from './router.js';
import { initializeSession, logout } from './session.js';
import { LoginView } from '../views/login.js';
import { renderLoadingState, renderErrorState } from '../components/app-state.js';
import { initCommandPalette } from '../components/command-palette.js';

document.addEventListener('DOMContentLoaded', async () => {
  const mainContent = document.querySelector('.main-content');

  if (mainContent) {
    mainContent.innerHTML = renderLoadingState();
  }

  try {
    const session = await initializeSession();

    if (!session.user) {
      // Sin sesión: mostrar login centrado, sin shell
      if (mainContent) {
        const loginView = new LoginView();
        mainContent.innerHTML = loginView.render();
        loginView.afterRender();
      }
      return;
    }

    if (!session.profile) {
      // Usuario autenticado pero sin perfil en Firestore
      // (documento faltante o error de lectura)
      if (mainContent) {
        mainContent.innerHTML = renderErrorState(
          `Tu cuenta (${session.user.email}) no tiene un perfil configurado en el sistema. Contactá al administrador.`
        );
      }
      return;
    }

    // Sesión confirmada con perfil válido: mostrar shell completo
    document.body.classList.add('session-ready');
    renderSidebar(session.profile);
    initPerfilButton(session, mainContent);
    initSidebarMobile();
    initCommandPalette();

    const router = new Router();

  } catch (error) {
    console.error('Fallo en el bootstrap de la aplicación:', error);
    if (mainContent) {
      mainContent.innerHTML = renderErrorState('No se pudo conectar con los servicios de autenticación. Intentá recargar la página.');
    }
  }
});

function initPerfilButton(session, mainContent) {
  const email = session.user?.email || '';

  const userEmailEl = document.getElementById('userEmail');
  if (userEmailEl) userEmailEl.textContent = email;

  const perfilEmailEl = document.getElementById('perfilEmail');
  if (perfilEmailEl) perfilEmailEl.textContent = email;

  const btnPerfil = document.getElementById('btnPerfil');
  const dropdown = document.getElementById('perfilDropdown');

  if (btnPerfil && dropdown) {
    btnPerfil.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });

    // Cerrar dropdown al hacer click fuera (no dentro del propio dropdown)
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== btnPerfil) {
        dropdown.classList.remove('open');
      }
    });
  }

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      btnLogout.disabled = true;
      btnLogout.textContent = 'Saliendo...';
      await logout();
    });
  }
}

function initSidebarMobile() {
  const menuToggle = document.querySelector('.menu-toggle');
  const sidebar = document.getElementById('sidebar');

  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('active');
    });

    // Delegación de eventos para links dinámicos
    sidebar.addEventListener('click', (e) => {
      if (e.target.closest('.sidebar-link')) {
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('active');
        }
      }
    });
  }
}

/**
 * Renderiza el sidebar de forma dinámica según el rol
 * @param {Object} profile 
 */
function renderSidebar(profile) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const role = profile?.rol || 'operador';
  
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', roles: ['admin', 'tecnico', 'recepcion'] },
    { id: 'tickets', label: 'Trabajos', icon: '🛠️', roles: ['admin', 'tecnico', 'recepcion'] },
    { id: 'clientes', label: 'Clientes', icon: '👥', roles: ['admin', 'recepcion'] },
    { id: 'inventario', label: 'Inventario', icon: '📦', roles: ['admin', 'tecnico', 'recepcion'] },
    { id: 'finanzas',   label: 'Finanzas',   icon: '💰', roles: ['admin', 'recepcion', 'tecnico'] },
    { id: 'configuracion', label: 'Configuración', icon: '⚙️', roles: ['admin'] }
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(role));

  sidebar.innerHTML = `
    <div class="sidebar-nav">
      ${filteredItems.map(item => `
        <a href="#${item.id}" class="sidebar-link ${window.location.hash === '#' + item.id || (item.id === 'dashboard' && !window.location.hash) ? 'active' : ''}" style="display: flex; align-items: center; gap: var(--space-md); padding: 12px 16px; border-radius: var(--radius-md); color: var(--text-muted); text-decoration: none; font-size: var(--font-sm); transition: var(--transition-fast);">
          <i style="width: 20px; display: inline-flex; justify-content: center;">${item.icon}</i> ${item.label}
        </a>
      `).join('')}
    </div>
  `;
}
