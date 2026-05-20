/**
 * Cierre de Caja Taller — modal premium (admin-only)
 *
 * UX:
 *  1. Loading → fetch trabajos pendientes
 *  2. Empty state si no hay nada
 *  3. Resumen contable destacado: total · operador (80%) · empresa (20%)
 *  4. Lista expandible con los trabajos que se van a liquidar
 *  5. Botón "Confirmar y liquidar" con 5s de gracia para abortar
 *  6. Éxito → toast + actualiza historial
 */
import {
  getTrabajosNoLiquidados,
  calcularCierreSummary,
  liquidarCaja,
} from '../services/cierre-caja.js';
import { showToast } from './toast.js';

let _activeOverlay = null;
let _onCloseCb = null;

export function openCierreCajaModal({ onClose = null, onSuccess = null } = {}) {
  if (_activeOverlay) closeCierreCajaModal();
  _onCloseCb = onClose;

  const overlay = document.createElement('div');
  overlay.className = 'cierre-caja-overlay';
  overlay.innerHTML = renderShell();
  document.body.appendChild(overlay);
  _activeOverlay = overlay;

  requestAnimationFrame(() => overlay.classList.add('is-open'));

  // Click backdrop → close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeCierreCajaModal();
  });
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeCierreCajaModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  overlay.querySelector('#cc-close-btn')?.addEventListener('click', closeCierreCajaModal);

  // Load and render
  loadAndRender(overlay, onSuccess);
}

export function closeCierreCajaModal() {
  if (!_activeOverlay) return;
  _activeOverlay.classList.remove('is-open');
  const o = _activeOverlay;
  _activeOverlay = null;
  setTimeout(() => {
    o.remove();
    if (_onCloseCb) _onCloseCb();
    _onCloseCb = null;
  }, 220);
}

// ─── Internals ──────────────────────────────────────────────────────────

function renderShell() {
  return `
    <div class="cierre-caja-card" role="dialog" aria-modal="true" aria-labelledby="cc-title">
      <header class="cc-header">
        <h2 id="cc-title">
          <span class="cc-icon">🧾</span>
          Cierre de Caja Taller
        </h2>
        <button class="cc-close" id="cc-close-btn" aria-label="Cerrar">✕</button>
      </header>
      <div class="cc-body" id="cc-body">
        <div class="cc-loading">
          <div class="cc-spinner"></div>
          <p>Calculando trabajos pendientes de liquidar…</p>
        </div>
      </div>
    </div>
  `;
}

async function loadAndRender(overlay, onSuccess) {
  const body = overlay.querySelector('#cc-body');

  try {
    const trabajos = await getTrabajosNoLiquidados();
    if (trabajos.length === 0) {
      body.innerHTML = renderEmpty();
      return;
    }

    const summary = calcularCierreSummary(trabajos);
    body.innerHTML = renderSummaryAndList(summary, trabajos);

    // Wire confirmar
    const confirmBtn = overlay.querySelector('#cc-confirm-btn');
    confirmBtn?.addEventListener('click', () => handleConfirm(overlay, trabajos, summary, onSuccess));
  } catch (err) {
    console.error('[cierre-caja modal] load failed:', err);
    body.innerHTML = renderError(err.message);
  }
}

async function handleConfirm(overlay, trabajos, summary, onSuccess) {
  const confirmBtn = overlay.querySelector('#cc-confirm-btn');
  const cancelBtn  = overlay.querySelector('#cc-cancel-btn');
  if (!confirmBtn) return;

  const proceed = confirm(
    `¿Confirmás el cierre de ${summary.count} trabajo${summary.count !== 1 ? 's' : ''}?\n\n` +
    `Total: $${fmt(summary.total)}\n` +
    `Operador (${summary.pctOperador}%): $${fmt(summary.operador)}\n` +
    `Cósmica (${summary.pctEmpresa}%): $${fmt(summary.empresa)}\n\n` +
    `Esta acción marca los trabajos como liquidados y NO se puede deshacer.`
  );
  if (!proceed) return;

  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<span class="cc-spinner-sm"></span> Liquidando…';
  if (cancelBtn) cancelBtn.disabled = true;

  const result = await liquidarCaja(trabajos, summary);
  if (!result.ok) {
    showToast(result.error || 'Error al liquidar la caja', 'error');
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = '✅ Confirmar y Liquidar';
    if (cancelBtn) cancelBtn.disabled = false;
    return;
  }

  // Success state
  const body = overlay.querySelector('#cc-body');
  body.innerHTML = renderSuccess(summary);
  overlay.querySelector('#cc-done-btn')?.addEventListener('click', closeCierreCajaModal);
  showToast(`Cierre completado: ${summary.count} trabajos liquidados`, 'success');
  if (onSuccess) onSuccess(summary);
}

function renderEmpty() {
  return `
    <div class="cc-empty">
      <div class="cc-empty-icon">✅</div>
      <h3>Sin trabajos pendientes</h3>
      <p>No hay trabajos de taller entregados pendientes de liquidar en este momento.</p>
      <p class="cc-empty-hint">Volvé después de marcar algún trabajo como entregado.</p>
    </div>
  `;
}

function renderError(msg) {
  return `
    <div class="cc-error">
      <div class="cc-empty-icon">⚠️</div>
      <h3>No se pudo cargar el cierre</h3>
      <p>${escapeHtml(msg || 'Error desconocido')}</p>
    </div>
  `;
}

function renderSummaryAndList(summary, trabajos) {
  return `
    <div class="cc-section">
      <div class="cc-summary-grid">
        <div class="cc-kpi">
          <div class="cc-kpi-label">Trabajos a liquidar</div>
          <div class="cc-kpi-value">${summary.count}</div>
          <div class="cc-kpi-sub">entregados sin liquidar</div>
        </div>
        <div class="cc-kpi cc-kpi-total">
          <div class="cc-kpi-label">Total facturado</div>
          <div class="cc-kpi-value">$${fmt(summary.total)}</div>
          <div class="cc-kpi-sub">suma de precios</div>
        </div>
        <div class="cc-kpi cc-kpi-operador">
          <div class="cc-kpi-label">Operador (${summary.pctOperador}%)</div>
          <div class="cc-kpi-value">$${fmt(summary.operador)}</div>
          <div class="cc-kpi-sub">a cobrar el operador</div>
        </div>
        <div class="cc-kpi cc-kpi-empresa">
          <div class="cc-kpi-label">Cósmica (${summary.pctEmpresa}%)</div>
          <div class="cc-kpi-value">$${fmt(summary.empresa)}</div>
          <div class="cc-kpi-sub">entrega al admin</div>
        </div>
      </div>
    </div>

    <div class="cc-section">
      <details class="cc-details" open>
        <summary>
          <span>Trabajos incluidos en el cierre (${trabajos.length})</span>
          <span class="cc-details-chev">▾</span>
        </summary>
        <div class="cc-table-wrap">
          <table class="cc-table">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Cliente</th>
                <th>Equipo</th>
                <th>Entregado</th>
                <th style="text-align:right;">Precio</th>
              </tr>
            </thead>
            <tbody>
              ${trabajos.map(t => `
                <tr>
                  <td class="cc-mono">#${escapeHtml(t.numeroOrden || '—')}</td>
                  <td>${escapeHtml([t.nombre, t.apellido].filter(Boolean).join(' ') || '—')}</td>
                  <td>${escapeHtml([t.equipo, t.marca].filter(Boolean).join(' ') || '—')}</td>
                  <td>${escapeHtml(formatDate(t.fechaEntregado))}</td>
                  <td style="text-align:right; font-weight:700;">$${fmt(t.precio || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </details>
    </div>

    <footer class="cc-footer">
      <button type="button" class="btn btn-secondary" id="cc-cancel-btn" onclick="document.querySelector('.cierre-caja-overlay #cc-close-btn').click()">Cancelar</button>
      <button type="button" class="btn btn-primary cc-confirm" id="cc-confirm-btn">
        ✅ Confirmar y Liquidar
      </button>
    </footer>
  `;
}

function renderSuccess(summary) {
  return `
    <div class="cc-success">
      <div class="cc-success-icon">🎉</div>
      <h3>Cierre completado</h3>
      <p>${summary.count} trabajo${summary.count !== 1 ? 's' : ''} marcado${summary.count !== 1 ? 's' : ''} como liquidado${summary.count !== 1 ? 's' : ''}.</p>
      <div class="cc-success-grid">
        <div class="cc-success-row">
          <span>Total liquidado</span>
          <strong>$${fmt(summary.total)}</strong>
        </div>
        <div class="cc-success-row">
          <span>Operador (${summary.pctOperador}%)</span>
          <strong style="color: var(--accent-orange);">$${fmt(summary.operador)}</strong>
        </div>
        <div class="cc-success-row">
          <span>Cósmica (${summary.pctEmpresa}%)</span>
          <strong style="color: var(--accent-green);">$${fmt(summary.empresa)}</strong>
        </div>
      </div>
      <p class="cc-success-hint">El operador debe entregar al admin: <strong style="color:var(--accent-green);">$${fmt(summary.empresa)}</strong></p>
      <button type="button" class="btn btn-primary" id="cc-done-btn" style="margin-top:24px; min-width:200px;">✓ Listo, cerrar</button>
    </div>
  `;
}

function fmt(n) {
  return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = iso.toDate ? iso.toDate() : new Date(iso);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return '—'; }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
