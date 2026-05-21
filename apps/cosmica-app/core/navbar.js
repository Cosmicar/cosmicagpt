/**
 * Navbar — Cósmica App
 *
 * Extraído de core/app.js (V1.1) para bajar ese archivo de 944 LOC a <500.
 * Maneja:
 *   - Reloj Buenos Aires (GMT-3) en pill cosmos
 *   - Indicadores duales de caja (taller / remoto) para admin/tester
 *   - Indicador único de caja para resto de roles
 *   - Click handlers para abrir/cerrar caja por tipo
 *   - Cache local de estado de caja con throttle 30s
 */

// Rol del usuario activo — setear vía setNavRole() desde el bootstrap
let _navRole = null;

// Throttle: máximo 1 lectura Firestore de caja cada 30s para no quemar lecturas
// en navegaciones rápidas entre vistas.
let _lastCajaCheck = 0;
let _lastCajaResult = null;

/**
 * Setea el rol del usuario actual. Llamar una sola vez en el bootstrap.
 */
export function setNavRole(rol) {
  _navRole = rol || null;
}

/** Invalida el cache local para forzar re-lectura de caja en el próximo render. */
export function invalidateCajaStatusCache() {
  _lastCajaCheck = 0;
  _lastCajaResult = null;
}

/**
 * Reloj + fecha Buenos Aires (GMT-3) — pill cosmos con pulse dot.
 * Cero requests de red — usa el reloj local del browser.
 */
export function initNavbarClock() {
  const el = document.getElementById('navbar-clock');
  if (!el) return;

  if (!document.getElementById('cosmos-clock-style')) {
    const s = document.createElement('style');
    s.id = 'cosmos-clock-style';
    s.textContent = `
      #navbar-clock {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 6px 14px;
        border-radius: 999px;
        background: linear-gradient(135deg, rgba(0,229,255,0.05), rgba(99,102,241,0.04));
        border: 1px solid rgba(0,229,255,0.12);
        line-height: 1;
        white-space: nowrap;
        position: relative;
        box-shadow: 0 0 0 1px rgba(255,255,255,0.02) inset;
      }
      #navbar-clock::before {
        content: '';
        width: 5px; height: 5px;
        border-radius: 50%;
        background: var(--accent-cyan);
        box-shadow: 0 0 6px var(--accent-cyan);
        animation: clockPulse 2s ease-in-out infinite;
        flex-shrink: 0;
      }
      @keyframes clockPulse {
        0%, 100% { opacity: 0.85; }
        50%      { opacity: 0.35; }
      }
      .clock-date {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-muted);
        opacity: 0.85;
      }
      .clock-sep {
        color: rgba(0,229,255,0.35);
        font-weight: 700;
      }
      .clock-time {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.05em;
        font-variant-numeric: tabular-nums;
        color: var(--text-primary);
        font-family: ui-monospace, 'SF Mono', Menlo, monospace;
      }
      @media (max-width: 768px) {
        #navbar-clock { display: none !important; }
      }
    `;
    document.head.appendChild(s);
  }

  const DIAS  = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
  const MESES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

  const tick = () => {
    const now   = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    const dia   = DIAS[now.getDay()];
    const fecha = `${String(now.getDate()).padStart(2,'0')} ${MESES[now.getMonth()]}`;
    const hora  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    el.innerHTML = `
      <span class="clock-date">${dia} ${fecha}</span>
      <span class="clock-sep">·</span>
      <span class="clock-time">${hora}</span>
    `;
  };

  tick();
  setInterval(tick, 1000);
}

/**
 * Renderiza un indicador individual de caja (taller o remoto) en el navbar.
 */
function _renderCajaIndicator(el, session, tipo) {
  const label = tipo === 'remoto' ? 'Remoto' : 'Taller';

  if (session) {
    el.innerHTML =
      `<span class="caja-dot caja-dot--open">●</span>` +
      `<span class="caja-text">${label} · Abierta</span>`;
    el.classList.add('caja-pill--open');
    el.classList.remove('caja-pill--closed');
    el.style.display = 'flex';
    el.title = `Caja ${label} abierta por ${session.openedByName || 'alguien'}. Clic para cerrar.`;
    el.dataset.cajaStatus = 'open';
    el.dataset.sesionId = session.id;
  } else {
    el.innerHTML =
      `<span class="caja-dot caja-dot--closed">●</span>` +
      `<span class="caja-text">${label} · Cerrada</span>`;
    el.classList.add('caja-pill--closed');
    el.classList.remove('caja-pill--open');
    el.style.display = 'flex';
    el.title = `Caja ${label} cerrada. Clic para abrir.`;
    el.dataset.cajaStatus = 'closed';
    el.dataset.sesionId = '';
  }
}

/**
 * Actualiza los indicadores de caja en el navbar.
 * Admin/tester: dos indicadores separados (taller + remoto).
 * Resto: indicador único unificado.
 */
export async function updateCajaStatusIndicator() {
  const isAdmin = _navRole === 'admin' || _navRole === 'tester';

  try {
    const { getCajaSession, getCajaSessionByTipo } = await import('../services/finanzas.js');
    const now = Date.now();

    if (isAdmin) {
      const elTaller = document.getElementById('caja-taller-indicator');
      const elRemoto = document.getElementById('caja-remoto-indicator');
      const elLegacy = document.getElementById('caja-status-indicator');
      if (elLegacy) elLegacy.style.display = 'none';

      const [tallerSession, remotoSession] = await Promise.all([
        getCajaSessionByTipo('taller'),
        getCajaSessionByTipo('remoto')
      ]);
      _lastCajaCheck  = now;
      _lastCajaResult = tallerSession; // backward compat para otros consumidores

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
        el.innerHTML =
          `<span class="caja-dot caja-dot--open">●</span>` +
          `<span class="caja-text">Caja Abierta</span>`;
        el.classList.add('caja-pill--open');
        el.style.display = 'flex';
        el.title = `Abierta por ${session.openedByName || 'alguien'}.`;
        el.dataset.cajaStatus = 'open';
        el.dataset.sesionId   = session.id;
      } else {
        el.innerHTML =
          `<span class="caja-dot caja-dot--closed">●</span>` +
          `<span class="caja-text">Caja Cerrada</span>`;
        el.classList.remove('caja-pill--open');
        el.style.display = 'flex';
        el.title = 'No hay una sesión de caja activa.';
        el.dataset.cajaStatus = 'closed';
        el.dataset.sesionId   = '';
      }
    }
  } catch (err) {
    console.warn('[navbar] updateCajaStatusIndicator failed:', err);
  }
}

/**
 * Handler de click en un indicador de caja: abre (closed→open) o cierra (open→closed).
 */
async function _onCajaClick(el, tipo) {
  const { canAccess } = await import('./session.js');
  if (!canAccess('finanzas-write')) {
    const { showToast } = await import('../components/toast.js');
    showToast('No tenés permisos para gestionar la caja', 'error');
    return;
  }

  const label = tipo === 'remoto' ? 'Remoto' : 'Taller';

  const { logEvent } = await import('./logger.js');

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
        logEvent('caja.opened', { tipo, saldoInicial: saldo, sesionId: res.id });
        showToast(`Caja ${label} abierta con $${saldo.toLocaleString('es-AR')}`, 'success');
        invalidateCajaStatusCache();
        await updateCajaStatusIndicator();
        if (window.location.hash === '#finanzas') {
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }
      }
    } catch (err) {
      logEvent('caja.open_failed', { tipo, saldoInicial: saldo, error: err.message }, 'error');
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
        logEvent('caja.closed', {
          tipo, sesionId, saldoFinal,
          diferencia: res.diferencia,
          totalIngresos: res.totalIngresos,
          totalEgresos: res.totalEgresos,
        }, Math.abs(res.diferencia || 0) >= 1000 ? 'warn' : 'info');
        showToast(`Caja ${label} cerrada correctamente`, 'success');
        invalidateCajaStatusCache();
        await updateCajaStatusIndicator();
        if (window.location.hash === '#finanzas') {
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }
      }
    } catch (err) {
      logEvent('caja.close_failed', { tipo, sesionId, saldoFinal, error: err.message }, 'error');
      const { showToast } = await import('../components/toast.js');
      showToast(err.message || 'Error al cerrar caja', 'error');
    }
  }
}
