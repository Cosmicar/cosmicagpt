import { Router } from './router.js';
import { initializeSession, logout } from './session.js';
import { LoginView } from '../views/login.js';
import { renderLoadingState, renderErrorState } from '../components/app-state.js';

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

    // Sesión confirmada: mostrar shell completo
    document.body.classList.add('session-ready');
    initPerfilButton(session, mainContent);
    initSidebarMobile();

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

    // Cerrar dropdown al hacer click fuera
    document.addEventListener('click', () => {
      dropdown.classList.remove('open');
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

    document.querySelectorAll('.sidebar-link').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('active');
        }
      });
    });
  }
}
