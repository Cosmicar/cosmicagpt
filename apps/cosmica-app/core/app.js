import { Router } from './router.js';

/**
 * Inicialización de la aplicación SaaS Cosmica
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('Cosmica SaaS App Iniciada');
  
  // 1. Inicializar Router (Navegación)
  const router = new Router();
  
  // 2. Inicializar Layout Base y Sidebar
  initSidebarMobile();
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
