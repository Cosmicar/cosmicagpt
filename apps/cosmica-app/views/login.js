import { BaseView } from '../core/base-view.js';
import { loginWithEmail } from '../services/auth.js';

const LAST_EMAIL_KEY = 'cosmica_last_email';

export class LoginView extends BaseView {
  render() {
    // Pre-fill last successful email for friction-less return
    let lastEmail = '';
    try { lastEmail = localStorage.getItem(LAST_EMAIL_KEY) || ''; } catch (_) { /* private mode */ }

    return `
      <div class="login-shell">
        <div class="login-card card glass-card">
          <!-- Brand block -->
          <div class="login-brand">
            <img src="assets/icon.svg" alt="Cósmica" class="login-logo">
            <h1 class="login-title">Cósmica App</h1>
            <p class="login-subtitle">Sistema oficial de gestión</p>
          </div>

          <!-- Form -->
          <form id="loginForm" class="login-form" autocomplete="on" novalidate>
            <div class="form-group">
              <label class="form-label" for="loginEmail">Email</label>
              <input
                id="loginEmail"
                name="email"
                type="email"
                class="input"
                value="${lastEmail.replace(/"/g, '&quot;')}"
                placeholder="usuario@cosmica.ar"
                autocomplete="username"
                autocapitalize="off"
                spellcheck="false"
                required>
            </div>

            <div class="form-group">
              <label class="form-label" for="loginPassword">Contraseña</label>
              <input
                id="loginPassword"
                name="password"
                type="password"
                class="input"
                placeholder="••••••••"
                autocomplete="current-password"
                required>
            </div>

            <button id="btnLogin" type="submit" class="btn btn-primary login-submit">
              <span class="login-submit-label">Ingresar</span>
            </button>

            <div id="loginError" class="login-error" role="alert"></div>
          </form>

          <!-- Install PWA CTA (auto-hides when not installable) -->
          <button id="loginInstallBtn" class="login-install-btn" hidden>
            <span>📲</span> Instalar Cósmica en este dispositivo
          </button>

          <div class="login-footer">
            <p>¿Olvidaste tu contraseña? Contactá al administrador del taller.</p>
          </div>
        </div>
      </div>
    `;
  }

  afterRender() {
    const form     = document.getElementById('loginForm');
    const btn      = document.getElementById('btnLogin');
    const btnLabel = btn?.querySelector('.login-submit-label');
    const email    = document.getElementById('loginEmail');
    const pass     = document.getElementById('loginPassword');
    const errorEl  = document.getElementById('loginError');
    const installBtn = document.getElementById('loginInstallBtn');

    // ── Smart focus: skip filled email field, focus password ────────────
    setTimeout(() => {
      if (email && email.value && pass) pass.focus();
      else if (email) email.focus();
    }, 80);

    // ── Submit handler ──────────────────────────────────────────────────
    const doLogin = async (e) => {
      e?.preventDefault?.();
      const emailVal = email.value.trim();
      const passVal  = pass.value;

      if (!emailVal || !passVal) {
        this._showError(errorEl, 'Ingresá email y contraseña.');
        return;
      }

      btn.disabled = true;
      if (btnLabel) btnLabel.textContent = 'Verificando…';
      btn.classList.add('login-submit-loading');
      this._hideError(errorEl);

      try {
        await loginWithEmail(emailVal, passVal);
        // Persist last successful email for next return
        try { localStorage.setItem(LAST_EMAIL_KEY, emailVal); } catch (_) { /* ignore */ }
        if (btnLabel) btnLabel.textContent = 'Bienvenido';
        window.location.reload();
      } catch (err) {
        btn.disabled = false;
        btn.classList.remove('login-submit-loading');
        if (btnLabel) btnLabel.textContent = 'Ingresar';
        const credentialErrors = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'];
        const tooMany = err?.code === 'auth/too-many-requests';
        const msg = tooMany
          ? 'Demasiados intentos. Esperá un momento o reseteá tu clave.'
          : credentialErrors.includes(err?.code)
            ? 'Email o contraseña incorrectos.'
            : 'No pudimos conectar. Revisá tu red e intentá de nuevo.';
        this._showError(errorEl, msg);
        // Re-focus password so the user can retype immediately
        pass.select();
      }
    };

    form?.addEventListener('submit', doLogin);

    // Enter on email moves to password (mobile-friendly)
    email?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && email.value.trim() && !pass.value) {
        e.preventDefault();
        pass.focus();
      }
    });

    // ── PWA install CTA (premium UX) ────────────────────────────────────
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (installBtn) installBtn.hidden = false;
    });
    installBtn?.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      installBtn.disabled = true;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') installBtn.hidden = true;
      installBtn.disabled = false;
      deferredPrompt = null;
    });
  }

  _showError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-visible');
  }
  _hideError(el) {
    if (!el) return;
    el.classList.remove('is-visible');
    el.textContent = '';
  }
}
