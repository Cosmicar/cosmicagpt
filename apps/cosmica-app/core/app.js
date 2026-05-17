import { Router } from './router.js';
import { initializeSession, logout } from './session.js';
import { LoginView } from '../views/login.js';
import { renderLoadingState, renderErrorState } from '../components/app-state.js';
import { initCommandPalette } from '../components/command-palette.js';
import { cleanupExpiredDrafts } from './chaos-guard.js';

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
 * Renderiza el sidebar de forma dinámica según el rol
 * @param {Object} profile 
 */
function renderSidebar(profile) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const role = profile?.rol || 'operador';
  
  const menuItems = [
    { id: 'dashboard',     label: 'Dashboard',     icon: '📊', roles: ['admin', 'tecnico', 'recepcion', 'operador', 'tester'] },
    { id: 'tickets',       label: 'Trabajos',       icon: '🛠️', roles: ['admin', 'tecnico', 'recepcion', 'operador', 'tester'] },
    { id: 'clientes',      label: 'Clientes',       icon: '👥', roles: ['admin', 'recepcion', 'operador', 'tester'] },
    { id: 'inventario',    label: 'Inventario',     icon: '📦', roles: ['admin', 'tecnico', 'recepcion', 'operador', 'tester'] },
    { id: 'finanzas',      label: 'Finanzas',       icon: '💰', roles: ['admin', 'recepcion', 'tecnico', 'operador', 'tester'] },
    { id: 'configuracion', label: 'Configuración',  icon: '⚙️', roles: ['admin', 'tester'] }
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(role));

  const currentHash = window.location.hash || '#dashboard';

  sidebar.innerHTML = `
    <div class="sidebar-header" style="display:flex; align-items:center; gap:12px; padding:8px 12px 16px 12px; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.06);">
      <div style="width:38px; height:38px; border-radius:50%; background:linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-blue) 100%); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:16px; flex-shrink:0; box-shadow: 0 4px 12px rgba(0,229,255,0.3);">
        ${profile?.nombre ? profile.nombre.charAt(0).toUpperCase() : 'U'}
      </div>
      <div style="display:flex; flex-direction:column; overflow:hidden;">
        <span style="font-size:14px; font-weight:700; color:var(--text-primary); white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${profile?.nombre || 'Operador'}</span>
        <span style="font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; font-weight:700;">${role}</span>
      </div>
    </div>
    <div class="sidebar-nav" style="display:flex; flex-direction:column; gap:4px;">
      ${filteredItems.map(item => `
        <a href="#${item.id}" class="sidebar-link ${(currentHash === '#' + item.id) ? 'active' : ''}">
          <span class="sidebar-icon" style="font-size:18px; filter:grayscale(0.2);">${item.icon}</span>
          <span class="sidebar-label" style="font-weight:500; font-size:13.5px; letter-spacing:-0.01em;">${item.label}</span>
        </a>
      `).join('')}
    </div>
  `;
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

  const items = [];
  if (allowed('dashboard')) items.push({ id: 'dashboard', label: 'Dashboard', icon: '📊' });
  if (allowed('tickets')) items.push({ id: 'tickets', label: 'Trabajos', icon: '🛠️' });
  if (allowed('clientes')) items.push({ id: 'clientes', label: 'Clientes', icon: '👥' });
  if (allowed('finanzas')) items.push({ id: 'finanzas', label: 'Finanzas', icon: '💰' });

  // Siempre agregamos el trigger "Más" al final para abrir el sidebar overlay
  items.push({ id: 'more', label: 'Más', icon: '☰', isMore: true });

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
