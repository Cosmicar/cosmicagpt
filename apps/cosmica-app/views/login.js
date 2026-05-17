import { BaseView } from '../core/base-view.js';
import { loginWithEmail } from '../services/auth.js';

export class LoginView extends BaseView {
  render() {
    return `
      <div style="display:flex; align-items:center; justify-content:center; min-height:80vh;">
        <div class="card glass-card" style="width:100%; max-width:400px; padding: var(--space-xl); box-shadow: var(--shadow-lg);">
          <div style="text-align:center; margin-bottom: var(--space-xl);">
            <div style="margin-bottom: var(--space-md);">
              <img src="assets/icon.svg" alt="Cósmica Logo" style="height: 72px; width: 72px; object-fit: contain;">
            </div>
            <h2 style="font-size: 28px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.05em; margin: 0;">Cósmica App</h2>
            <p style="color: var(--text-muted); font-size: var(--font-sm); margin-top: 6px; font-weight: 500;">Sistema de Gestión de Taller</p>
          </div>

          <div class="form-group">
            <label class="form-label" for="loginEmail">Email Corporativo</label>
            <input
              id="loginEmail"
              type="email"
              class="input"
              placeholder="usuario@cosmica.ar"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="loginPassword">Contraseña</label>
            <input
              id="loginPassword"
              type="password"
              class="input"
              placeholder="••••••••"
            />
          </div>

          <button id="btnLogin" class="btn btn-primary" style="width:100%; margin-top: var(--space-md);">Ingresar al Sistema</button>

          <div id="loginError" class="alert alert-danger" style="display:none; margin-top: var(--space-lg); padding: var(--space-sm); justify-content: center;"></div>
          
          <div style="margin-top: var(--space-xl); padding-top: var(--space-md); border-top: 1px solid var(--border); text-align: center;">
            <p style="font-size: 11px; color: var(--text-muted); opacity: 0.7;">
              ¿Problemas para ingresar? Contactá al administrador del taller para blanquear tu clave de operador.
            </p>
          </div>
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
