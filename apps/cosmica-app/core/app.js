import { Router } from './router.js';
import { initializeSession, logout } from './session.js';
import { LoginView } from '../views/login.js';
import { renderLoadingState, renderErrorState } from '../components/app-state.js';
import { cleanupExpiredDrafts } from './chaos-guard.js';
import { suscribirseAlInbox, marcarLeida } from '../services/notificaciones.js';
import {
  setNavRole,
  initNavbarClock,
  updateCajaStatusIndicator,
  invalidateCajaStatusCache,
} from './navbar.js';

// Re-export para que router.js y consumidores externos sigan funcionando sin tocar imports.
export { updateCajaStatusIndicator, invalidateCajaStatusCache };

/* ╔══════════════════════════════════════════════════════════════╗
   ║  SPACE PHOTO AVATARS                                         ║
   ║  14 real space photographs (NASA/ESA, Wikimedia Commons,     ║
   ║  public domain). Deterministically picked per user seed.     ║
   ║  Zero network cost after first load — browser caches them.   ║
   ╚══════════════════════════════════════════════════════════════╝ */
const SPACE_PHOTOS = [
  { name: 'Pilares de la Creación',  url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Pillars_of_creation_2014_HST_WFC3-UVIS_full-res_denoised.jpg/120px-Pillars_of_creation_2014_HST_WFC3-UVIS_full-res_denoised.jpg' },
  { name: 'Nebulosa del Cangrejo',   url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Crab_Nebula.jpg/120px-Crab_Nebula.jpg' },
  { name: 'Galaxia de Andrómeda',    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Andromeda_Galaxy_%28with_h-alpha%29.jpg/120px-Andromeda_Galaxy_%28with_h-alpha%29.jpg' },
  { name: 'Nebulosa de Orión',       url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg/120px-Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg' },
  { name: 'Nebulosa de la Hélice',   url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/NGC7293_%282004%29.jpg/120px-NGC7293_%282004%29.jpg' },
  { name: 'Galaxia del Remolino',    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Messier51_sRGB.jpg/120px-Messier51_sRGB.jpg' },
  { name: 'Saturno',                 url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Saturn_during_Equinox.jpg/120px-Saturn_during_Equinox.jpg' },
  { name: 'Júpiter',                 url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Jupiter_and_its_shrunken_Great_Red_Spot.jpg/120px-Jupiter_and_its_shrunken_Great_Red_Spot.jpg' },
  { name: 'Marte',                   url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/OSIRIS_Mars_true_color.jpg/120px-OSIRIS_Mars_true_color.jpg' },
  { name: 'Nebulosa Cabeza de Caballo', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Barnard_33.jpg/120px-Barnard_33.jpg' },
  { name: 'Nebulosa de la Tarántula', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Tarantula_Nebula_in_the_LMC_%28captured_by_the_NASA%2FESA_Hubble_Space_Telescope%29.jpg/120px-Tarantula_Nebula_in_the_LMC_%28captured_by_the_NASA%2FESA_Hubble_Space_Telescope%29.jpg' },
  { name: 'Hubble Ultra Deep Field', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Hubble_ultra_deep_field.jpg/120px-Hubble_ultra_deep_field.jpg' },
  { name: 'Nebulosa del Anillo',     url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Ring_Nebula.jpg/120px-Ring_Nebula.jpg' },
  { name: 'Vía Láctea',              url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/ESO-VLT-Laser-phot-0a-99.jpg/120px-ESO-VLT-Laser-phot-0a-99.jpg' },
];

/**
 * Pick a space photo avatar — random per session.
 * Uses a salt stored in sessionStorage so the avatar stays consistent within
 * a session (sidebar + dropdown + button match), but changes on the next login.
 * The salt is cleared on logout (see btnLogout handler below).
 */
function getCosmicAvatar(seed) {
  let sessionSalt = '';
  try {
    sessionSalt = sessionStorage.getItem('cosmica_avatar_salt') || '';
    if (!sessionSalt) {
      sessionSalt = String(Math.random()).slice(2, 12) + Date.now().toString(36);
      sessionStorage.setItem('cosmica_avatar_salt', sessionSalt);
    }
  } catch (_) { /* sessionStorage unavailable — fallback to deterministic */ }

  const s = (String(seed || 'cosmica') + sessionSalt).toLowerCase();
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return SPACE_PHOTOS[Math.abs(hash) % SPACE_PHOTOS.length];
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
    setNavRole(session.profile?.rol || null);
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
      userEmailEl.innerHTML = `<span>${displayName}</span><span id="navbar-puntos-badge" style="flex-shrink:0;font-size:10px;font-weight:700;color:${color};background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:12px;border:1px solid ${border};">⭐ ${esPositivo ? '+' : ''}${puntos} pts</span>`;
    } else {
      userEmailEl.textContent = displayName;
    }
  }

  const perfilEmailEl = document.getElementById('perfilEmail');
  if (perfilEmailEl) perfilEmailEl.textContent = displayName;

  const btnPerfil = document.getElementById('btnPerfil');
  const dropdown = document.getElementById('perfilDropdown');

  if (btnPerfil) {
    const avatarSeed = session.profile?.uid || session.user?.uid || email;
    const avatar = getCosmicAvatar(avatarSeed);
    btnPerfil.innerHTML = `<img src="${avatar.url}" alt="${avatar.name}"
      style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"
      onerror="this.style.display='none';this.parentElement.style.background='linear-gradient(135deg,#1e1b4b,#020617)'">`;
    // Force circular avatar styling regardless of btn-primary defaults (desktop + mobile)
    btnPerfil.style.cssText = `
      width: 36px; height: 36px; min-height: 36px; min-width: 36px;
      padding: 0; border-radius: 50%; background: #020617;
      overflow: hidden;
      border: 1.5px solid rgba(0,229,255,0.5);
      box-shadow: 0 0 12px rgba(0,229,255,0.25), inset 0 0 0 1px rgba(255,255,255,0.08);
      display: inline-flex; align-items: center; justify-content: center;
      flex-shrink: 0; cursor: pointer; transition: transform 0.18s ease, box-shadow 0.18s ease;
    `;
    btnPerfil.onmouseenter = () => {
      btnPerfil.style.transform = 'scale(1.08)';
      btnPerfil.style.boxShadow = '0 0 18px rgba(0,229,255,0.5), inset 0 0 0 1px rgba(255,255,255,0.15)';
    };
    btnPerfil.onmouseleave = () => {
      btnPerfil.style.transform = '';
      btnPerfil.style.boxShadow = '0 0 12px rgba(0,229,255,0.25), inset 0 0 0 1px rgba(255,255,255,0.08)';
    };
    btnPerfil.setAttribute('aria-label', `Perfil de ${displayName} (${avatar.name})`);
    btnPerfil.setAttribute('title', `${displayName} — ${avatar.name}`);

    // ── Inject large avatar header at the top of the dropdown ──────────
    if (dropdown && !dropdown.querySelector('.perfil-avatar-header')) {
      // Hide the legacy small name display — replaced by the new header
      const perfilEmailLegacy = document.getElementById('perfilEmail');
      if (perfilEmailLegacy) perfilEmailLegacy.style.display = 'none';

      const rolLabel = session.profile?.rol
        ? `<span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:rgba(0,229,255,0.1);color:var(--accent-cyan);border:1px solid rgba(0,229,255,0.25);margin-top:4px;">${session.profile.rol}</span>`
        : '';

      const headerDiv = document.createElement('div');
      headerDiv.className = 'perfil-avatar-header';
      headerDiv.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:8px 0 14px;margin-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.06);">
          <div style="position:relative;width:96px;height:96px;border-radius:50%;overflow:hidden;background:#020617;border:2px solid rgba(0,229,255,0.5);box-shadow:0 0 28px rgba(0,229,255,0.25),inset 0 0 0 1px rgba(255,255,255,0.08);">
            <img src="${avatar.url}" alt="${avatar.name}"
              style="width:100%;height:100%;object-fit:cover;display:block;"
              onerror="this.style.display='none';this.parentElement.style.background='linear-gradient(135deg,#1e1b4b,#020617)'">
          </div>
          <div style="text-align:center;line-height:1.25;">
            <div style="font-weight:700;font-size:14px;color:var(--text-primary);letter-spacing:-.005em;">${displayName}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:3px;opacity:.7;letter-spacing:.04em;">${avatar.name}</div>
            ${rolLabel}
          </div>
        </div>
      `;
      dropdown.insertBefore(headerDiv, dropdown.firstChild);
    }
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
      // Clear avatar salt so next login picks a fresh random space photo
      try { sessionStorage.removeItem('cosmica_avatar_salt'); } catch (_) {}
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
    drift:         '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v3l2 2"/></svg>',
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
    { id: 'usuarios',      label: 'Operadores',     roles: ['admin', 'tester'] },
    { id: 'configuracion', label: 'Configuración', roles: ['admin', 'tester'] }
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
      <a href="#dashboard" class="sidebar-avatar" style="--avatar-bg:#020617;overflow:hidden;transition:transform 0.18s ease,filter 0.18s ease;" aria-label="Avatar: ${avatar.name}" title="Ir al Dashboard">
        <img src="${avatar.url}" alt="${avatar.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" onerror="this.style.display='none'">
      </a>
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

// ── Navbar (reloj + indicadores de caja) extraído a core/navbar.js en V1.1
//    Estas funciones quedaron como re-exports al inicio del archivo.
//    El código original (initNavbarClock, _renderCajaIndicator, updateCajaStatusIndicator,
//    _onCajaClick) fue eliminado de aquí para bajar app.js de 944 a <500 LOC.


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

  // 2. Capacidad de instalación — capturamos el evento por si más adelante
  //    activamos el banner. El banner UI fue removido por requerimiento.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    // deferredPrompt podría guardarse aquí si se decide re-habilitar el banner.
  });
}
