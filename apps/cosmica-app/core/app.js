import { Router } from './router.js';
import { initializeSession, logout } from './session.js';
import { LoginView } from '../views/login.js';
import { renderLoadingState, renderErrorState } from '../components/app-state.js';
import { cleanupExpiredDrafts } from './chaos-guard.js';
import { suscribirseAlInbox, marcarLeida } from '../services/notificaciones.js';

/* ╔══════════════════════════════════════════════════════════════╗
   ║  COSMIC AVATAR GALLERY                                       ║
   ║  10 cosmic-themed SVG avatars, deterministically picked      ║
   ║  per user seed (uid/email). No initials, no photos.          ║
   ╚══════════════════════════════════════════════════════════════╝ */
const COSMIC_AVATARS = [
  {
    name: 'Saturno',
    bg: 'linear-gradient(135deg, #fb923c, #b45309)',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="7" fill="#fef3c7"/><ellipse cx="18" cy="18" rx="13" ry="2.8" stroke="#fef3c7" stroke-width="1.8" opacity="0.92"/></svg>'
  },
  {
    name: 'Luna',
    bg: 'linear-gradient(135deg, #475569, #1e293b)',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="11" fill="#f1f5f9"/><circle cx="14" cy="15" r="2" fill="#cbd5e1" opacity="0.55"/><circle cx="22" cy="20" r="1.5" fill="#cbd5e1" opacity="0.55"/><circle cx="20" cy="13" r="1" fill="#cbd5e1" opacity="0.55"/></svg>'
  },
  {
    name: 'Sol',
    bg: 'linear-gradient(135deg, #fbbf24, #c2410c)',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none" stroke="#fef9c3" stroke-width="1.8" stroke-linecap="round"><circle cx="18" cy="18" r="5.5" fill="#fef3c7" stroke="none"/><line x1="18" y1="4" x2="18" y2="8"/><line x1="18" y1="28" x2="18" y2="32"/><line x1="4" y1="18" x2="8" y2="18"/><line x1="28" y1="18" x2="32" y2="18"/><line x1="8" y1="8" x2="11" y2="11"/><line x1="25" y1="25" x2="28" y2="28"/><line x1="28" y1="8" x2="25" y2="11"/><line x1="8" y1="28" x2="11" y2="25"/></svg>'
  },
  {
    name: 'Estrella',
    bg: 'radial-gradient(circle at 30% 30%, #1e293b, #020617)',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none"><path d="M18 6 L20 16 L30 18 L20 20 L18 30 L16 20 L6 18 L16 16 Z" fill="#fde047"/></svg>'
  },
  {
    name: 'Galaxia',
    bg: 'linear-gradient(135deg, #6d28d9, #1e1b4b)',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="2" fill="#fef3c7"/><path d="M18 18 C 23 11, 30 17, 25 22" stroke="#e9d5ff" stroke-width="1.6" stroke-linecap="round" opacity="0.9"/><path d="M18 18 C 13 25, 6 19, 11 14" stroke="#e9d5ff" stroke-width="1.6" stroke-linecap="round" opacity="0.9"/></svg>'
  },
  {
    name: 'Planeta',
    bg: 'linear-gradient(135deg, #020617, #000)',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none"><defs><linearGradient id="ca-pl" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ec4899"/><stop offset="100%" stop-color="#3b82f6"/></linearGradient></defs><circle cx="18" cy="18" r="11" fill="url(#ca-pl)"/></svg>'
  },
  {
    name: 'Cometa',
    bg: 'linear-gradient(135deg, #1e3a8a, #020617)',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none"><line x1="6" y1="28" x2="20" y2="14" stroke="#67e8f9" stroke-width="2.5" stroke-linecap="round" opacity="0.45"/><line x1="10" y1="26" x2="22" y2="14" stroke="#a5f3fc" stroke-width="1.4" stroke-linecap="round" opacity="0.85"/><circle cx="24" cy="12" r="4" fill="#ffffff"/></svg>'
  },
  {
    name: 'OVNI',
    bg: 'linear-gradient(135deg, #065f46, #022c22)',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none"><ellipse cx="18" cy="22" rx="12" ry="3" fill="#cbd5e1"/><path d="M10 20 Q 18 10 26 20 Z" fill="#67e8f9" opacity="0.88"/><circle cx="18" cy="15" r="1.5" fill="#ffffff" opacity="0.85"/></svg>'
  },
  {
    name: 'Astronauta',
    bg: 'linear-gradient(135deg, #64748b, #0f172a)',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="11" fill="#e2e8f0"/><circle cx="18" cy="18" r="8" fill="#0c4a6e"/><ellipse cx="14" cy="15" rx="3" ry="2" fill="#67e8f9" opacity="0.78"/></svg>'
  },
  {
    name: 'Constelación',
    bg: 'linear-gradient(135deg, #1e1b4b, #020617)',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none" stroke="#fef9c3" stroke-width="0.8"><line x1="8" y1="14" x2="14" y2="20" opacity="0.5"/><line x1="14" y1="20" x2="20" y2="12" opacity="0.5"/><line x1="20" y1="12" x2="26" y2="22" opacity="0.5"/><line x1="26" y1="22" x2="30" y2="14" opacity="0.5"/><circle cx="8" cy="14" r="1.6" fill="#fef9c3" stroke="none"/><circle cx="14" cy="20" r="2" fill="#fef3c7" stroke="none"/><circle cx="20" cy="12" r="1.6" fill="#fef9c3" stroke="none"/><circle cx="26" cy="22" r="2.2" fill="#fef3c7" stroke="none"/><circle cx="30" cy="14" r="1.4" fill="#fef9c3" stroke="none"/></svg>'
  }
];

/** Pick a cosmic avatar deterministically from a user seed (uid/email). */
function getCosmicAvatar(seed) {
  const s = String(seed || 'cosmica').toLowerCase();
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return COSMIC_AVATARS[Math.abs(hash) % COSMIC_AVATARS.length];
}

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
    _navRole = session.profile?.rol || null;
    renderSidebar(session.profile);
    initPerfilButton(session, mainContent);
    initSidebarMobile();
    initNavbarClock();
    updateCajaStatusIndicator();
    initGlobalShortcuts();
    initPWAFeatures();
    initNotificacionesInbox(session);

    const router = new Router();

  } catch (error) {
    console.error('Fallo en el bootstrap de la aplicación:', error);
    if (mainContent) {
      mainContent.innerHTML = renderErrorState('No se pudo conectar con los servicios de autenticación. Intentá recargar la página.');
    }
  }
});

/**
 * Suscribe al inbox Firestore del usuario y muestra toasts cuando llegan
 * notificaciones nuevas (puntos, penalidades, etc.).
 */
function initNotificacionesInbox(session) {
  const uid = session?.user?.uid;
  if (!uid) return;

  let toastCount = 0;
  suscribirseAlInbox(uid, async (docSnap) => {
    const data = docSnap.data();
    const tipo = data.tipo || 'info';

    // Marcar como leída de inmediato (best-effort) para que no se quede pendiente en Firestore
    marcarLeida(uid, docSnap.id).catch(() => {});

    // Importación dinámica para no aumentar el bundle inicial
    const { showToast } = await import('../components/toast.js');

    // Color y emoji según tipo
    const esPositivo = tipo === 'puntos';
    const esNegativo = tipo === 'penalidad';
    const toastTipo  = esPositivo ? 'success' : (esNegativo ? 'error' : 'info');

    // Limitar la cantidad de toasts simultáneos a 3 para no saturar al operador
    if (toastCount < 3) {
      showToast(`${data.titulo}\n${data.cuerpo}`, toastTipo, 6000);
      toastCount++;
      setTimeout(() => {
        toastCount = Math.max(0, toastCount - 1);
      }, 6000);
    }

    // Actualizar el badge de puntos en sidebar si es el propio usuario
    if (esPositivo || esNegativo) {
      await refreshPuntosEnSidebar(uid);
    }
  });
}


/**
 * Lee el campo `puntos` del perfil del usuario desde Firestore y actualiza
 * el badge del sidebar en tiempo real, sin recargar la vista.
 */
async function refreshPuntosEnSidebar(uid) {
  try {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');
    const { db } = await import('../../../js/firebase.js');
    const { COLLECTIONS } = await import('../../../js/domain.js');

    const snap = await getDoc(doc(db, COLLECTIONS.usuarios, uid));
    if (!snap.exists()) return;
    const puntos = snap.data()?.puntos ?? 0;

    const badge = document.getElementById('sidebar-puntos-badge');
    const navBadge = document.getElementById('navbar-puntos-badge');

    const esPositivo = puntos >= 0;
    const text = `⭐ ${esPositivo ? '+' : ''}${puntos} pts`;
    const bg = esPositivo ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';
    const color = esPositivo ? '#10B981' : '#EF4444';
    const border = esPositivo ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)';

    if (badge) {
      badge.textContent = text;
      badge.style.background = bg;
      badge.style.color = color;
      badge.style.borderColor = border;
    }
    if (navBadge) {
      navBadge.textContent = text;
      navBadge.style.color = color;
      navBadge.style.borderColor = border;
    }
  } catch (err) {
    console.warn('[app] refreshPuntosEnSidebar failed:', err.message);
  }
}


function initPerfilButton(session, mainContent) {
  const email = session.user?.email || '';
  const displayName = session.profile?.nombre || email;
  const puntos = session.profile?.puntos ?? 0;
  const rol = session.profile?.rol || '';

  const userEmailEl = document.getElementById('userEmail');
  if (userEmailEl) {
    if (rol !== 'admin' && rol !== 'tester') {
      const esPositivo = puntos >= 0;
      const color = esPositivo ? '#10B981' : '#EF4444';
      const border = esPositivo ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)';
      userEmailEl.innerHTML = `${displayName} <span id="navbar-puntos-badge" style="margin-left: 6px; font-size: 10px; font-weight: 700; color: ${color}; background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 12px; border: 1px solid ${border};">⭐ ${esPositivo ? '+' : ''}${puntos} pts</span>`;
    } else {
      userEmailEl.textContent = displayName;
    }
  }

  const perfilEmailEl = document.getElementById('perfilEmail');
  if (perfilEmailEl) perfilEmailEl.textContent = displayName;

  const btnPerfil = document.getElementById('btnPerfil');
  const dropdown = document.getElementById('perfilDropdown');

  if (btnPerfil) {
    // Same deterministic cosmic avatar as the sidebar (uid-seeded → stable)
    const avatarSeed = session.profile?.uid || session.user?.uid || email;
    const avatar = getCosmicAvatar(avatarSeed);
    btnPerfil.innerHTML = avatar.svg;
    btnPerfil.style.setProperty('--perfil-bg', avatar.bg);
    btnPerfil.setAttribute('aria-label', `Perfil de ${displayName} (${avatar.name})`);
    btnPerfil.setAttribute('title', `${displayName} — ${avatar.name}`);
  }

  const btnEditProfile = document.getElementById('btnEditProfile');
  if (btnEditProfile) {
    btnEditProfile.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dropdown) dropdown.classList.remove('open');
      
      // Route to profile configuration tab
      window.location.hash = '#configuracion?tab=perfil';
    });
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
    usuarios:      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><line x1="19" y1="8" x2="23" y2="8"/><line x1="21" y1="6" x2="21" y2="10"/></svg>',
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
    { id: 'usuarios',      label: 'Operadores',      roles: ['admin', 'tester'] },
    { id: 'configuracion', label: 'Configuración',  roles: ['admin', 'tester'] }
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(role));
  const currentHash = window.location.hash || '#dashboard';
  const displayName = profile?.nombre || 'Operador';
  const isCompact = document.body.classList.contains('sidebar-compact');

  // Pick deterministic cosmic avatar based on uid (stable across sessions)
  const avatarSeed = profile?.uid || profile?.email || displayName;
  const avatar = getCosmicAvatar(avatarSeed);

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <a href="#dashboard" class="sidebar-avatar" style="--avatar-bg:${avatar.bg}; transition: transform 0.18s ease, filter 0.18s ease;" aria-label="Avatar: ${avatar.name}" title="Ir al Dashboard">${avatar.svg}</a>
      <div class="sidebar-header-info">
        <span class="sidebar-user-name">${displayName}</span>
        <span class="sidebar-user-role" style="display:flex;align-items:center;gap:6px;">
          ${role}
          ${(role !== 'admin' && role !== 'tester') ? (() => {
            const puntos = profile?.puntos ?? 0;
            const esPos  = puntos >= 0;
            return `<span id="sidebar-puntos-badge" style="
              display:inline-flex;align-items:center;gap:3px;
              background:${esPos ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};
              color:${esPos ? '#10B981' : '#EF4444'};
              border:1px solid ${esPos ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'};
              border-radius:20px;padding:1px 7px;font-size:10px;font-weight:700;
              letter-spacing:.04em;white-space:nowrap;
            ">⭐ ${esPos ? '+' : ''}${puntos} pts</span>`;
          })() : ''}
        </span>
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
              title="${isCompact ? 'Expandir menú' : 'Colapsar menú'}">
        <span class="sidebar-toggle-icon">${TOGGLE_ICON}</span>
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

// Rol del usuario activo (se setea al iniciar sesión)
let _navRole = null;

// Throttle: máximo 1 lectura Firestore de caja cada 30 s para no consumir lecturas
// innecesarias en navegaciones rápidas entre vistas.
let _lastCajaCheck = 0;
let _lastCajaResult = null;

/**
 * Reloj en tiempo real — Buenos Aires (America/Argentina/Buenos_Aires, GMT-3).
 * Se actualiza cada segundo y se muestra en #navbar-clock.
 */
function initNavbarClock() {
  const el = document.getElementById('navbar-clock');
  if (!el) return;

  const tick = () => {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour:     '2-digit',
      minute:   '2-digit',
      second:   '2-digit',
      hour12:   false
    });
  };

  tick();
  setInterval(tick, 1000);
}

/** Llama esto tras abrir o cerrar la caja para forzar refresco inmediato del indicador. */
export function invalidateCajaStatusCache() {
  _lastCajaCheck = 0;
  _lastCajaResult = null;
}

/**
 * Actualiza un indicador de caja individual (taller o remoto) en el navbar.
 * @param {HTMLElement} el  - el div indicador
 * @param {object|null} session - sesión abierta o null
 * @param {'taller'|'remoto'} tipo
 */
function _renderCajaIndicator(el, session, tipo) {
  const label = tipo === 'remoto' ? 'Remoto' : 'Taller';
  const color = tipo === 'remoto' ? 'rgba(99,179,237,0.85)' : 'var(--accent-cyan)';

  if (session) {
    el.innerHTML = `<span style="color:var(--accent-green);">●</span> <span style="opacity:.6;font-size:9px;">${label}</span> Abierta`;
    el.style.display = 'flex';
    el.style.borderColor = 'rgba(16,185,129,0.25)';
    el.title = `Caja ${label} abierta por ${session.openedByName || 'alguien'}. Clic para cerrar.`;
    el.dataset.cajaStatus = 'open';
    el.dataset.sesionId = session.id;
  } else {
    el.innerHTML = `<span style="color:var(--danger);">●</span> <span style="opacity:.6;font-size:9px;">${label}</span> Cerrada`;
    el.style.display = 'flex';
    el.style.borderColor = 'rgba(255,255,255,0.06)';
    el.title = `Caja ${label} cerrada. Clic para abrir.`;
    el.dataset.cajaStatus = 'closed';
    el.dataset.sesionId = '';
  }
}

/**
 * Updates the persistent caja status indicators in the navbar.
 * Admin/tester: shows two separate indicators (Taller + Remoto).
 * Other roles: shows single unified indicator.
 */
export async function updateCajaStatusIndicator() {
  const isAdmin = _navRole === 'admin' || _navRole === 'tester';

  try {
    const { getCajaSession, getCajaSessionByTipo } = await import('../services/finanzas.js');
    const now = Date.now();

    if (isAdmin) {
      // ── Admin: dos indicadores separados ──────────────────────────────
      const elTaller = document.getElementById('caja-taller-indicator');
      const elRemoto = document.getElementById('caja-remoto-indicator');
      const elLegacy = document.getElementById('caja-status-indicator');
      if (elLegacy) elLegacy.style.display = 'none'; // ocultar el unificado

      const [tallerSession, remotoSession] = await Promise.all([
        getCajaSessionByTipo('taller'),
        getCajaSessionByTipo('remoto')
      ]);
      _lastCajaCheck  = now;
      _lastCajaResult = tallerSession; // backward compat para otras partes

      if (elTaller) {
        _renderCajaIndicator(elTaller, tallerSession, 'taller');
        if (!elTaller._hasClickListener) {
          elTaller._hasClickListener = true;
          elTaller.addEventListener('click', () => _onCajaClick(elTaller, 'taller'));
        }
      }
      if (elRemoto) {
        _renderCajaIndicator(elRemoto, remotoSession, 'remoto');
        if (!elRemoto._hasClickListener) {
          elRemoto._hasClickListener = true;
          elRemoto.addEventListener('click', () => _onCajaClick(elRemoto, 'remoto'));
        }
      }

    } else {
      // ── Otros roles: indicador único (taller) ──────────────────────────
      const el = document.getElementById('caja-status-indicator');
      const elTaller = document.getElementById('caja-taller-indicator');
      const elRemoto = document.getElementById('caja-remoto-indicator');
      if (elTaller) elTaller.style.display = 'none';
      if (elRemoto) elRemoto.style.display = 'none';
      if (!el) return;

      let session;
      if (now - _lastCajaCheck < 30_000) {
        session = _lastCajaResult;
      } else {
        session = await getCajaSession();
        _lastCajaCheck  = now;
        _lastCajaResult = session;
      }

      if (session) {
        el.innerHTML = `<span style="color:var(--accent-green);">●</span> Caja Abierta`;
        el.style.display = 'flex';
        el.title = `Abierta por ${session.openedByName || 'alguien'}.`;
        el.dataset.cajaStatus = 'open';
        el.dataset.sesionId   = session.id;
      } else {
        el.innerHTML = `<span style="color:var(--danger);">●</span> Caja Cerrada`;
        el.style.display = 'flex';
        el.title = 'No hay una sesión de caja activa.';
        el.dataset.cajaStatus = 'closed';
        el.dataset.sesionId   = '';
      }
    }
  } catch (err) {
    console.warn('[app] updateCajaStatusIndicator failed:', err);
  }
}

/**
 * Handler de click en un indicador de caja (abrir/cerrar).
 */
async function _onCajaClick(el, tipo) {
  const { canAccess } = await import('./session.js');
  if (!canAccess('finanzas-write')) {
    const { showToast } = await import('../components/toast.js');
    showToast('No tenés permisos para gestionar la caja', 'error');
    return;
  }

  const label = tipo === 'remoto' ? 'Remoto' : 'Taller';

  if (el.dataset.cajaStatus === 'closed') {
    const input = prompt(`¿Confirmás la apertura de Caja ${label}?\n\nIngresá el saldo inicial ($):`, '0');
    if (input === null) return;
    const saldo = Number(input.trim());
    if (isNaN(saldo) || saldo < 0) {
      const { showToast } = await import('../components/toast.js');
      showToast('Monto de saldo inicial inválido', 'error');
      return;
    }
    try {
      const { abrirCaja } = await import('../services/finanzas.js');
      const { showToast } = await import('../components/toast.js');
      const res = await abrirCaja(saldo, tipo);
      if (res.success) {
        showToast(`Caja ${label} abierta con $${saldo.toLocaleString('es-AR')}`, 'success');
        invalidateCajaStatusCache();
        await updateCajaStatusIndicator();
        if (window.location.hash === '#finanzas') {
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }
      }
    } catch (err) {
      const { showToast } = await import('../components/toast.js');
      showToast(err.message || 'Error al abrir caja', 'error');
    }

  } else if (el.dataset.cajaStatus === 'open') {
    const sesionId = el.dataset.sesionId;
    const input = prompt(`Cierre de Caja ${label}.\n\nIngresá el saldo final real (contado) ($):`, '0');
    if (input === null) return;
    const saldoFinal = Number(input.trim());
    if (isNaN(saldoFinal) || saldoFinal < 0) {
      const { showToast } = await import('../components/toast.js');
      showToast('Monto de saldo final inválido', 'error');
      return;
    }
    try {
      const { cerrarCaja } = await import('../services/finanzas.js');
      const { showToast } = await import('../components/toast.js');
      const res = await cerrarCaja(sesionId, saldoFinal);
      if (res.success) {
        showToast(`Caja ${label} cerrada correctamente`, 'success');
        invalidateCajaStatusCache();
        await updateCajaStatusIndicator();
        if (window.location.hash === '#finanzas') {
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }
      }
    } catch (err) {
      const { showToast } = await import('../components/toast.js');
      showToast(err.message || 'Error al cerrar caja', 'error');
    }
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

    // Auto-update silencioso: cuando sw.js cambia y se instala, recarga la pestaña para aplicar
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  // 2. Escucha de capacidad de instalación (UI Agradable tipo Legacy)
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // showInstallBanner(); // Ocultada según requerimiento
  });

  function showInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.style.cssText = `
      position: fixed; bottom: env(safe-area-inset-bottom, 20px); left: 50%; transform: translateX(-50%);
      background: rgba(17, 24, 39, 0.95); border: 1px solid var(--accent-cyan);
      backdrop-filter: blur(10px); padding: 14px 20px; border-radius: var(--radius-lg);
      z-index: 9999; display: flex; align-items: center; gap: 16px; 
      box-shadow: 0 10px 30px rgba(0,0,0,0.6); width: calc(100% - 32px); max-width: 400px;
      animation: slideUpPwa 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      margin-bottom: 20px;
    `;
    banner.innerHTML = `
      <div style="font-size:24px;">📲</div>
      <div style="flex:1;">
        <div style="font-weight:700; color:#fff; font-size:14px; margin-bottom:2px;">Instalá Cósmica App</div>
        <div style="font-size:12px; color:var(--text-muted);">Acceso rápido y offline</div>
      </div>
      <button id="pwa-install-btn" style="background:var(--accent-cyan); color:#000; border:none; padding:8px 16px; border-radius:var(--radius-md); font-weight:700; font-size:13px; cursor:pointer;">Instalar</button>
      <button id="pwa-dismiss-btn" style="background:transparent; border:none; color:var(--text-muted); font-size:20px; cursor:pointer; padding:4px;">×</button>
    `;
    document.body.appendChild(banner);

    if (!document.getElementById('pwa-keyframes')) {
      const style = document.createElement('style');
      style.id = 'pwa-keyframes';
      style.textContent = '@keyframes slideUpPwa { from { bottom: -100px; opacity: 0; } to { bottom: env(safe-area-inset-bottom, 20px); opacity: 1; } }';
      document.head.appendChild(style);
    }

    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      banner.style.display = 'none';
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    });

    document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
      banner.style.display = 'none';
    });
  }
}
