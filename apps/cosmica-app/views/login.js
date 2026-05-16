import { BaseView } from '../core/base-view.js';
import { loginWithEmail } from '../services/auth.js';

export class LoginView extends BaseView {
  render() {
    return `
      <div style="display:flex; align-items:center; justify-content:center; min-height:80vh;">
        <div class="card glass-card" style="width:100%; max-width:380px; padding: var(--space-xl); box-shadow: var(--shadow-lg);">
          <div style="text-align:center; margin-bottom: var(--space-lg);">
            <div style="margin-bottom: var(--space-md);">
              <img src="assets/icon-192.png" alt="Cósmica Logo" style="height: 64px; width: 64px; object-fit: contain;">
            </div>
            <h2 style="font-size: var(--font-2xl); font-weight: 800; color: var(--text-primary); letter-spacing: -0.04em;">Cósmica App</h2>
            <p style="color: var(--text-muted); font-size: var(--font-sm); margin-top: 4px; font-weight: 500;">Sistema de Gestión de Taller</p>
          </div>

          <div style="margin-bottom: var(--space-md);">
            <label style="display:block; font-size: var(--font-sm); margin-bottom: var(--space-xs); color: var(--text-muted);">Email</label>
            <input
              id="loginEmail"
              type="email"
              placeholder="usuario@cosmica.ar"
              style="width:100%; padding: var(--space-sm); background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-sm); color: var(--text-primary); font-size: var(--font-sm); box-sizing: border-box;"
            />
          </div>

          <div style="margin-bottom: var(--space-lg);">
            <label style="display:block; font-size: var(--font-sm); margin-bottom: var(--space-xs); color: var(--text-muted);">Contraseña</label>
            <input
              id="loginPassword"
              type="password"
              placeholder="••••••••"
              style="width:100%; padding: var(--space-sm); background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-sm); color: var(--text-primary); font-size: var(--font-sm); box-sizing: border-box;"
            />
          </div>

          <button id="btnLogin" class="btn btn-primary" style="width:100%;">Ingresar</button>

          <div id="loginError" style="display:none; margin-top: var(--space-md); color: #ff6b6b; font-size: var(--font-sm); text-align:center;"></div>
        </div>
      </div>
    `;
  }

  afterRender() {
    const btn = document.getElementById('btnLogin');
    const emailInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginPassword');
    const errorEl = document.getElementById('loginError');

    const doLogin = async () => {
      const email = emailInput.value.trim();
      const password = passInput.value;

      if (!email || !password) {
        this._showError(errorEl, 'Completá email y contraseña.');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Verificando...';
      this._hideError(errorEl);

      try {
        await loginWithEmail(email, password);
        window.location.reload();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Ingresar';
        const credentialErrors = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'];
        const msg = credentialErrors.includes(err?.code)
          ? 'Email o contraseña incorrectos.'
          : 'Error al ingresar. Intentá de nuevo.';
        this._showError(errorEl, msg);
      }
    };

    btn.addEventListener('click', doLogin);
    passInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doLogin();
    });
  }

  _showError(el, msg) {
    el.textContent = msg;
    el.style.display = 'block';
  }

  _hideError(el) {
    el.style.display = 'none';
    el.textContent = '';
  }
}
