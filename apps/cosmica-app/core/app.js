import { Router } from './router.js';
import { initializeSession, logout } from './session.js';
import { LoginView } from '../views/login.js';
import { renderLoadingState, renderErrorState } from '../components/app-state.js';
import { initCommandPalette } from '../components/command-palette.js';
import { cleanupExpiredDrafts } from './chaos-guard.js';

document.addEventListener('DOMContentLoaded', async () => {
  const mainContent = document.querySelector('.main-content');

  // Restore sidebar compact-mode preference (desktop/tablet UX).
  // Applied before render to avoid layout flash. Mobile media query overrides.
  try {
    if (localStorage.getItem('cosmica_sidebar_compact') === '1') {
      document.body.classList.add('sidebar-compact');
    }
  } catch (_) { /* localStorage unavailable — ignore */ }

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
    cleanupExpiredDrafts(); // Sweep stale cosmica_draft_* keys before the session starts
    document.body.classList.add('session-ready');
    renderSidebar(session.profile);
    renderBottomNav(session.profile);
    initPerfilButton(session, mainContent);
    initSidebarMobile();
    initCommandPalette();
    updateCajaStatusIndicator();
    initGlobalShortcuts();
    initPWAFeatures();

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

  if (btnPerfil) {
    const initial = (email.charAt(0) || '?').toUpperCase();
    btnPerfil.textContent = initial;
    btnPerfil.setAttribute('aria-label', `Perfil de ${email}`);
  }

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
      if (!confirm('¿Estás seguro que deseas cerrar sesión?')) return;
      
      btnLogout.disabled = true;
      btnLogout.textContent = 'Saliendo...';
      await logout();
    });
  }
}

function initSidebarMobile() {
  const menuToggle = document.querySelector('.menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('active');
      if (overlay) overlay.classList.toggle('active');
    });

    sidebar.addEventListener('click', (e) => {
      if (e.target.closest('.sidebar-link')) {
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('active');
          if (overlay) overlay.classList.remove('active');
        }
      }
    });

    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
      });
    }
  }
}

/**
 * Renderiza el sidebar de forma dinámica según el rol.
 * Incluye Compact Mode (toggle persistente vía localStorage).
 * @param {Object} profile
 */
function renderSidebar(profile) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const role = profile?.rol || 'operador';

  // Lucide-style thin-stroke SVG icons (consistent 20px viewBox, currentColor)
  const ICONS = {
    dashboard:     '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>',
    tickets:       '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    clientes:      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    inventario:    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
    finanzas:      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>',
    configuracion: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>'
  };

  // Chevron-left — rotated 180° via CSS when sidebar-compact is active
  const TOGGLE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';

  const menuItems = [
    { id: 'dashboard',     label: 'Dashboard',     roles: ['admin', 'tecnico', 'recepcion', 'operador', 'tester'] },
    { id: 'tickets',       label: 'Trabajos',       roles: ['admin', 'tecnico', 'recepcion', 'operador', 'tester'] },
    { id: 'clientes',      label: 'Clientes',       roles: ['admin', 'recepcion', 'operador', 'tester'] },
    { id: 'inventario',    label: 'Inventario',     roles: ['admin', 'tecnico', 'recepcion', 'operador', 'tester'] },
    { id: 'finanzas',      label: 'Finanzas',       roles: ['admin', 'recepcion', 'tecnico', 'operador', 'tester'] },
    { id: 'configuracion', label: 'Configuración',  roles: ['admin', 'tester'] }
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(role));
  const currentHash = window.location.hash || '#dashboard';
  const initial = profile?.nombre ? profile.nombre.charAt(0).toUpperCase() : 'U';
  const displayName = profile?.nombre || 'Operador';
  const isCompact = document.body.classList.contains('sidebar-compact');

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-avatar" aria-hidden="true">${initial}</div>
      <div class="sidebar-header-info">
        <span class="sidebar-user-name">${displayName}</span>
        <span class="sidebar-user-role">${role}</span>
      </div>
    </div>
    <div class="sidebar-nav">
      ${filteredItems.map(item => `
        <a href="#${item.id}"
           class="sidebar-link ${currentHash === '#' + item.id ? 'active' : ''}"
           data-tooltip="${item.label}"
           title="${item.label}"
           aria-label="${item.label}">
          <span class="sidebar-icon">${ICONS[item.id] || ''}</span>
          <span class="sidebar-label">${item.label}</span>
        </a>
      `).join('')}
    </div>
    <div class="sidebar-footer">
      <button class="sidebar-toggle" id="sidebarToggle" type="button"
              aria-label="${isCompact ? 'Expandir menú lateral' : 'Colapsar menú lateral'}"
              title="${isCompact ? 'Expandir' : 'Colapsar'}">
        <span class="sidebar-toggle-icon">${TOGGLE_ICON}</span>
        <span class="sidebar-toggle-label">Colapsar</span>
      </button>
    </div>
  `;

  // Wire up sidebar toggle — persists state in localStorage
  const toggleBtn = document.getElementById('sidebarToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const nowCompact = document.body.classList.toggle('sidebar-compact');
      try {
        localStorage.setItem('cosmica_sidebar_compact', nowCompact ? '1' : '0');
      } catch (_) { /* storage unavailable — state is in-memory only */ }
      toggleBtn.setAttribute('aria-label', nowCompact ? 'Expandir menú lateral' : 'Colapsar menú lateral');
      toggleBtn.setAttribute('title', nowCompact ? 'Expandir' : 'Colapsar');
    });
  }

  // Sync active link with route changes (avoid stale active state on hash navigation)
  const updateActiveLink = () => {
    const hash = window.location.hash || '#dashboard';
    sidebar.querySelectorAll('.sidebar-link').forEach((link) => {
      const isActive = link.getAttribute('href') === hash;
      link.classList.toggle('active', isActive);
    });
  };
  window.addEventListener('hashchange', updateActiveLink);
}

/**
 * Renderiza la navegación inferior de forma dinámica según el rol
 * @param {Object} profile 
 */
function renderBottomNav(profile) {
  const bottomNav = document.getElementById('bottom-nav');
  if (!bottomNav) return;

  const role = profile?.rol || 'operador';

  const allowed = (id) => {
    const roles = {
      'dashboard': ['admin', 'tecnico', 'recepcion', 'operador', 'tester'],
      'tickets': ['admin', 'tecnico', 'recepcion', 'operador', 'tester'],
      'clientes': ['admin', 'recepcion', 'operador', 'tester'],
      'finanzas': ['admin', 'recepcion', 'tecnico', 'operador', 'tester'],
    };
    return roles[id] ? roles[id].includes(role) : false;
  };

  // Lucide-style SVG icons — same family as sidebar for visual consistency
  const NAV_ICONS = {
    dashboard: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>',
    tickets:   '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    clientes:  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    finanzas:  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>',
    more:      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/></svg>'
  };

  const items = [];
  if (allowed('dashboard')) items.push({ id: 'dashboard', label: 'Dashboard', icon: NAV_ICONS.dashboard });
  if (allowed('tickets'))   items.push({ id: 'tickets',   label: 'Trabajos',  icon: NAV_ICONS.tickets });
  if (allowed('clientes'))  items.push({ id: 'clientes',  label: 'Clientes',  icon: NAV_ICONS.clientes });
  if (allowed('finanzas'))  items.push({ id: 'finanzas',  label: 'Finanzas',  icon: NAV_ICONS.finanzas });

  // Siempre agregamos el trigger "Más" al final para abrir el sidebar overlay
  items.push({ id: 'more', label: 'Más', icon: NAV_ICONS.more, isMore: true });

  bottomNav.innerHTML = items.map(item => {
    if (item.isMore) {
      return `
        <button class="mobile-nav-link" id="mobile-more-trigger" aria-label="Abrir menú completo">
          <i class="mobile-nav-icon">${item.icon}</i>
          <span class="mobile-nav-label">${item.label}</span>
        </button>
      `;
    }
    return `
      <a href="#${item.id}" class="mobile-nav-link ${window.location.hash === '#' + item.id || (item.id === 'dashboard' && !window.location.hash) ? 'active' : ''}">
        <i class="mobile-nav-icon">${item.icon}</i>
        <span class="mobile-nav-label">${item.label}</span>
      </a>
    `;
  }).join('');

  // Vincular click del botón "Más"
  const moreTrigger = document.getElementById('mobile-more-trigger');
  if (moreTrigger) {
    moreTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebar-overlay');
      if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
      }
    });
  }
}

// Throttle: máximo 1 lectura Firestore de caja cada 30 s para no consumir lecturas
// innecesarias en navegaciones rápidas entre vistas.
let _lastCajaCheck = 0;
let _lastCajaResult = null;

/** Llama esto tras abrir o cerrar la caja para forzar refresco inmediato del indicador. */
export function invalidateCajaStatusCache() {
  _lastCajaCheck = 0;
  _lastCajaResult = null;
}

/**
 * Updates the persistent caja status indicator in the navbar.
 */
export async function updateCajaStatusIndicator() {
  const el = document.getElementById('caja-status-indicator');
  if (!el) return;

  try {
    const { getCajaSession } = await import('../services/finanzas.js');
    const now = Date.now();
    let session;
    if (now - _lastCajaCheck < 30_000) {
      session = _lastCajaResult; // Usa resultado cacheado en módulo
    } else {
      session = await getCajaSession();
      _lastCajaCheck = now;
      _lastCajaResult = session;
    }

    if (session) {
      el.innerHTML = `<span style="color:var(--accent-green);">●</span> Caja Abierta`;
      el.style.display = 'flex';
      el.title = `Abierta por ${session.openedByName || 'alguien'}`;
    } else {
      el.innerHTML = `<span style="color:var(--danger);">●</span> Caja Cerrada`;
      el.style.display = 'flex';
      el.title = 'No hay una sesión de caja activa';
    }
  } catch (err) {
    console.warn('[app] updateCajaStatusIndicator failed:', err);
  }
}

/**
 * Initializes global operational keyboard shortcuts.
 */
function initGlobalShortcuts() {
  document.addEventListener('keydown', (e) => {
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable;
    const key = e.key.toLowerCase();
    const ctrlOrMeta = e.ctrlKey || e.metaKey;
    
    // Global Navigation (only if not in input)
    if (!isInput) {
      if (key === 'n') { e.preventDefault(); window.location.hash = '#ticket-nuevo'; }
      if (key === 'c') { e.preventDefault(); window.location.hash = '#cliente-nuevo'; }
      if (key === 'i') { e.preventDefault(); window.location.hash = '#inventario'; }
      if (key === 'f') { e.preventDefault(); window.location.hash = '#finanzas'; }
      if (key === '/') { 
        e.preventDefault(); 
        const searchInput = document.querySelector('#ticket-search, #cliente-search, #inv-search, input[type="text"]:not([readonly])');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    }

    // Global ESC — cada componente (drawer, command-palette) ya registra su propio
    // listener de ESC cuando está abierto; no necesitamos duplicarlo aquí.

    // Ctrl + Enter (Save forms)
    if (e.key === 'Enter' && ctrlOrMeta) {
      const submitBtn = document.querySelector('form button[type="submit"], .btn-primary[id*="save"], .btn-primary[id*="submit"]');
      if (submitBtn && !submitBtn.disabled) {
        e.preventDefault();
        submitBtn.click();
      }
    }

    // Ctrl + P (Print ticket)
    if (key === 'p' && ctrlOrMeta) {
      const printBtn = document.querySelector('.ticket-print-btn, .qv-print-btn, .form-print-btn');
      if (printBtn) {
        e.preventDefault();
        printBtn.click();
      }
    }
  });
}

/**
 * Inicializa las características PWA del SaaS (registro de SW y gestor de instalación)
 */
function initPWAFeatures() {
  // 1. Registro del Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registrado exitosamente en el scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Error al registrar el Service Worker del SaaS:', err);
      });
  }

  // 2. Escucha de capacidad de instalación (Capturar antes del trigger)
  let deferredPrompt = null;
  const btnInstall = document.getElementById('btnInstallPWA');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (btnInstall) {
      btnInstall.style.display = 'block'; // Mostrar botón de instalación sutil en perfil
    }
  });

  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      btnInstall.disabled = true;
      btnInstall.textContent = 'Instalando...';
      
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA] Elección del prompt de instalación: ${outcome}`);
      
      deferredPrompt = null;
      btnInstall.style.display = 'none';
      btnInstall.disabled = false;
      btnInstall.textContent = '📲 Instalar App';
    });
  }
}
