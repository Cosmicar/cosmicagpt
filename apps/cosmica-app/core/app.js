import { Router } from './router.js';
import { initializeSession } from './session.js';
import { renderLoadingState, renderErrorState } from '../components/app-state.js';

/**
 * Inicialización de la aplicación SaaS Cosmica
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Cosmica SaaS App Iniciada');
  
  const mainContent = document.querySelector('.main-content');
  
  // 1. Mostrar Loading inicial
  if (mainContent) {
    mainContent.innerHTML = renderLoadingState();
  }
  
  try {
    // 2. Inicializar Sesión (Verifica Firebase Auth)
    await initializeSession();
    
    // 3. Inicializar Router (Navegación)
    const router = new Router();
    
    // 4. Inicializar Layout Base y Sidebar
    initSidebarMobile();
  } catch (error) {
    console.error('Fallo en el bootstrap de la aplicación:', error);
    if (mainContent) {
      mainContent.innerHTML = renderErrorState('No se pudo conectar con los servicios de autenticación. Intenta recargar la página.');
    }
  }
});

/**
 * Control del Sidebar en dispositivos móviles
 */
function initSidebarMobile() {
  const menuToggle = document.querySelector('.menu-toggle');
  const sidebar = document.getElementById('sidebar');
  
  if (menuToggle && sidebar) {
    // Alternar sidebar al hacer click en el botón de hamburguesa
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('active');
    });
    
    // Cerrar sidebar al hacer click en cualquier enlace (útil en móviles)
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    sidebarLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('active');
        }
      });
    });
  }
}
