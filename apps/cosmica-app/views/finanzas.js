import { AsyncView } from '../core/async-view.js';
import {
  getFinanzasData, createCajaEntry,
  abrirCaja, cerrarCaja,
} from '../services/finanzas.js';
import { getClientes } from '../services/clientes.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';
import { renderKPISkeletons, renderCardSkeletonList } from '../components/app-state.js';
import { showToast } from '../components/toast.js';
import { canAccess, getCurrentSession } from '../core/session.js';
import { guardBtn, initUnsavedChangesGuard, setDirty } from '../core/chaos-guard.js';

// ── Format helpers ────────────────────────────────────────────────────────────

const ars = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-AR');
const pct = n => Number(n || 0).toFixed(1) + '%';

function fmtTs(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtTime(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function difBadge(dif) {
  const abs = Math.abs(dif || 0);
  if (abs === 0)      return `<span class="badge badge-green"  style="font-size:10px;">✓ Cuadra</span>`;
  if (abs < 1000)     return `<span class="badge badge-orange" style="font-size:10px;">⚠ ${ars(dif)}</span>`;
  return               `<span class="badge badge-danger"  style="font-size:10px;">✕ ${ars(dif)}</span>`;
}

// ── View ──────────────────────────────────────────────────────────────────────

export class FinanzasView extends AsyncView {
  constructor(params) {
    super(params);
    this.containerId = 'finanzas-container';
    this._data       = null;
    this._cajaPeriod = 'session'; // 'session' | 'today' | 'week'
    this._showCierre = false;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async loadData() {
    const [finanzasData, clientes] = await Promise.all([
      getFinanzasData(),
      getClientes()
    ]);

    const clientMap = (clientes || []).reduce((acc, c) => {
      acc[c.id] = c.nombre || '';
      return acc;
    }, {});

    if (finanzasData?.ticketsMasRentables) {
      finanzasData.ticketsMasRentables = finanzasData.ticketsMasRentables.map(t => {
        const nombre = t.nombre || clientMap[t.clienteId] || '';
        return { ...t, nombre };
      });
    }

    if (finanzasData?.ultimosCobrados) {
      finanzasData.ultimosCobrados = finanzasData.ultimosCobrados.map(t => {
        const nombre = t.nombre || clientMap[t.clienteId] || '';
        return { ...t, nombre };
      });
    }

    this._data = finanzasData;
    return this._data;
  }

  renderLoading() {
    return `
      <div style="display:flex;flex-direction:column;gap:var(--space-xl);">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;">
          <div>
            <div class="skeleton" style="width:80px;height:16px;margin-bottom:8px;"></div>
            <div class="skeleton" style="width:220px;height:32px;margin-bottom:8px;"></div>
          </div>
        </div>
        ${renderKPISkeletons()}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:var(--space-xl);">
          <div>${renderCardSkeletonList(3)}</div>
          <div>${renderCardSkeletonList(3)}</div>
        </div>
      </div>`;
  }

  // ── Main render ───────────────────────────────────────────────────────────

  renderContent(data) {
    const {
      kpis, ticketsMasRentables, ultimosCobrados, distribucionPlanes,
      cajaHoy, cajaSemana, cajaDia, cajaSem, entregadosHoy,
      cajaSession, cajaSessionEntries, cajaSessionData, cajaHistorial,
      ajustes, comisiones,
    } = data;
    const canWrite   = canAccess('finanzas-write');
    const rol        = getCurrentSession()?.profile?.rol;
    const isOperador = rol === 'operador';

    const breadcrumb = renderBreadcrumb([
      { label: 'Operaciones', href: '#dashboard', icon: '⚙️' },
      { label: 'Finanzas',   href: '#finanzas',  icon: '💰' },
    ]);

    // ── Vista Operador (solo caja taller) ────────────────────────────────────
    if (isOperador) {
      const header = renderSectionHeader(
        'Caja Taller',
        `Movimientos del día · ${new Date().toLocaleDateString('es-AR')}`,
        '🏦 Caja'
      );
      return `
        <div class="animate-fade-in" style="display:flex;flex-direction:column;gap:var(--space-lg);">
          ${breadcrumb}

          <div class="flex-between" style="align-items:flex-end;flex-wrap:wrap;gap:var(--space-md);">
            <div style="flex:1;">${header}</div>
            <button class="btn btn-secondary btn-sm" id="fin-refresh">🔄 Actualizar</button>
          </div>

          <!-- ══ CAJA STATUS BAR ══ -->
          ${this.renderCajaStatusBar(cajaSession, cajaSessionData, canWrite)}

          <!-- KPIs operador -->
          <section>
            <div class="kpi-grid">
              ${this.renderKPI('X COBRAR', String(kpis.ticketsPendientesCobro), 'var(--accent-orange)', '⏳',
                `ticket${kpis.ticketsPendientesCobro !== 1 ? 's' : ''} listo${kpis.ticketsPendientesCobro !== 1 ? 's' : ''}`)}
              ${this.renderKPI('FACTURADO', ars(kpis.facturacionConcretada), 'var(--accent-cyan)', '💰',
                `${kpis.totalConPrecio} cobro${kpis.totalConPrecio !== 1 ? 's' : ''}`)}
              ${this.renderKPI('ENTREGAS HOY', String(entregadosHoy.length), 'var(--accent-green)', '📦',
                'equipos entregados')}
            </div>
          </section>

          <!-- Rendimiento Operador -->
          ${this.renderRendimientoOperador(kpis, comisiones)}

          <!-- Resumen operacional -->
          ${this.renderResumenDiario(cajaDia, cajaSem, entregadosHoy, cajaSessionEntries)}

          <!-- ══ CAJA SECTION ══ -->
          ${this.renderCajaSection(cajaSession, cajaSessionEntries, cajaSessionData, cajaHoy, cajaSemana, cajaDia, cajaSem, canWrite)}

          <!-- ══ HISTORIAL DE CIERRES ══ -->
          ${this.renderHistorialCierres(cajaHistorial)}
        </div>`;
    }

    // ── Vista Admin / Tester (completa) ──────────────────────────────────────
    const header = renderSectionHeader(
      'Centro Financiero',
      `Resumen operacional al ${new Date().toLocaleDateString('es-AR')}`,
      '💰 Finanzas'
    );

    return `
      <div class="animate-fade-in" style="display:flex;flex-direction:column;gap:var(--space-lg);">
        ${breadcrumb}

        <!-- Header -->
        <div class="flex-between" style="align-items:flex-end;flex-wrap:wrap;gap:var(--space-md);">
          <div style="flex:1;">${header}</div>
          <div style="display:flex;gap:var(--space-sm);align-items:center;flex-wrap:wrap;">
            ${kpis.margenPct !== null ? this.renderMargenBadge(kpis.margenPct) : ''}
            ${canAccess('cierre-caja-taller') ? `
              <button class="btn btn-sm" id="fin-cierre-taller-btn"
                      style="background:linear-gradient(135deg,#10b981,#0ea371);color:#052e16;
                             font-weight:800;letter-spacing:-0.005em;border:none;
                             padding:8px 16px;box-shadow:0 6px 18px rgba(16,185,129,0.28);"
                      title="Cierre semanal de caja taller (admin)">
                🧾 Cierre de Caja Taller
              </button>
            ` : ''}
            <button class="btn btn-secondary btn-sm" id="fin-refresh">🔄 Actualizar</button>
          </div>
        </div>

        <!-- ══ CAJA STATUS BAR ══ -->
        ${this.renderCajaStatusBar(cajaSession, cajaSessionData, canWrite)}

        <!-- KPIs -->
        <section>
          <div class="kpi-grid">
            ${this.renderKPI('FACTURADO', ars(kpis.facturacionConcretada), 'var(--accent-cyan)',   '💰', `${kpis.totalConPrecio} cobro${kpis.totalConPrecio !== 1 ? 's' : ''}`)}
            ${this.renderKPI('POTENCIAL', ars(kpis.facturacionPotencial),  'var(--accent-green)',  '📈', 'presupuestos aprobados')}
            ${this.renderKPI('REPUESTOS', ars(kpis.costoRepuestos),        'var(--accent-orange)', '🔩', 'costo en partes')}
            ${this.renderKPI('GANANCIA',  ars(kpis.gananciaEstimada),
              kpis.gananciaEstimada >= 0 ? 'var(--accent-green)' : 'var(--danger)',
              kpis.gananciaEstimada >= 0 ? '✨' : '⚠️', 'facturado − repuestos')}
            ${this.renderKPI('X COBRAR',  String(kpis.ticketsPendientesCobro), 'var(--accent-orange)', '⏳',
              `ticket${kpis.ticketsPendientesCobro !== 1 ? 's' : ''} listo${kpis.ticketsPendientesCobro !== 1 ? 's' : ''}`)}
            ${this.renderKPI('PROMEDIO',  ars(kpis.ticketPromedio), 'var(--text-muted)', '📊', `de ${kpis.totalConPrecio} cobros`)}
          </div>
        </section>

        <!-- Banner rendición semanal -->
        ${this.renderBannerRendicion(kpis)}

        <!-- Top tickets + Últimos cobrados -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:var(--space-xl);">
          ${this.renderTopTickets(ticketsMasRentables)}
          ${this.renderUltimosCobrados(ultimosCobrados)}
        </div>

        <!-- Plan distribution + Resumen diario -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:var(--space-xl);">
          ${this.renderPlanDistribucion(distribucionPlanes, kpis.totalTickets)}
          ${this.renderResumenDiario(cajaDia, cajaSem, entregadosHoy, data.cajaSessionEntries)}
        </div>

        <!-- ══ CAJA SECTION ══ -->
        ${this.renderCajaSection(cajaSession, cajaSessionEntries, cajaSessionData, cajaHoy, cajaSemana, cajaDia, cajaSem, canWrite)}

        <!-- ══ AJUSTES CONTABLES ══ -->
        ${ajustes?.movimientos?.length > 0 ? this.renderAjustesSection(ajustes) : ''}

        <!-- ══ COMISIONES DE OPERADORES ══ -->
        ${this.renderComisiones(ultimosCobrados, comisiones)}

        <!-- ══ HISTORIAL DE CIERRES ══ -->
        ${this.renderHistorialCierres(cajaHistorial)}
      </div>`;
  }

  // ── Caja Status Bar ───────────────────────────────────────────────────────

  renderCajaStatusBar(session, sessionData, canWrite) {
    if (session) {
      const desde = fmtTime(session.openedAt);
      const saldo = ars(session.saldoInicial);
      const bal   = sessionData?.ingresos - sessionData?.egresos;
      return `
        <div id="caja-status-bar" style="
          display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-md);
          padding:var(--space-md) var(--space-lg);
          background:rgba(34,197,94,0.08);
          border:1px solid rgba(34,197,94,0.25);
          border-radius:var(--radius-md);
        ">
          <div style="display:flex;align-items:center;gap:var(--space-md);flex-wrap:wrap;">
            <span style="display:flex;align-items:center;gap:6px;font-weight:700;color:var(--accent-green);">
              <span style="width:8px;height:8px;border-radius:50%;background:var(--accent-green);
                           box-shadow:0 0 6px var(--accent-green);display:inline-block;"></span>
              Caja Abierta
            </span>
            <span style="font-size:var(--font-sm);color:var(--text-muted);">
              Desde ${desde} · Saldo inicial ${saldo} · Balance sesión: <strong style="color:${bal >= 0 ? 'var(--accent-green)' : 'var(--danger)'};">${ars(bal)}</strong>
            </span>
            <span style="font-size:var(--font-xs);color:var(--text-muted);">
              Por: ${session.openedByName || '—'}
            </span>
          </div>
          ${canWrite ? `<button class="btn btn-sm" id="btn-toggle-cierre"
            style="background:rgba(249,115,22,0.1);border-color:rgba(249,115,22,0.4);color:var(--accent-orange);">
            🔒 Cerrar Caja
          </button>` : ''}
        </div>`;
    }

    return `
      <div id="caja-status-bar" style="
        display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-md);
        padding:var(--space-md) var(--space-lg);
        background:rgba(249,115,22,0.06);
        border:1px solid rgba(249,115,22,0.2);
        border-radius:var(--radius-md);
      ">
        <span style="display:flex;align-items:center;gap:6px;font-weight:700;color:var(--text-muted);">
          <span style="width:8px;height:8px;border-radius:50%;background:#555;display:inline-block;"></span>
          Caja Cerrada
        </span>
        ${canWrite ? `<button class="btn btn-sm btn-primary" id="btn-abrir-caja">
          🔓 Abrir Caja
        </button>` : `<span style="font-size:var(--font-sm);color:var(--text-muted);">
          Solo recepción o admin puede abrir la caja.
        </span>`}
      </div>

      <!-- Apertura form (hidden by default) -->
      ${canWrite ? `
      <div id="apertura-panel" style="display:none;">
        <div class="card glass-card" style="
          max-width:420px;padding:var(--space-lg);
          border:1px solid rgba(0,229,255,0.2);
        ">
          <h4 style="font-size:var(--font-md);font-weight:700;margin-bottom:var(--space-md);">
            🔓 Abrir Caja
          </h4>
          <div id="apertura-error" class="alert alert-danger" style="display:none;"></div>
          <form id="apertura-form" style="display:flex;flex-direction:column;gap:var(--space-md);">
            <div>
              <label style="font-size:var(--font-sm);color:var(--text-muted);display:block;margin-bottom:6px;">
                Saldo inicial en caja (efectivo físico)
              </label>
              <input type="number" name="saldoInicial" id="apertura-saldo" class="input"
                placeholder="Ej: 5000" min="0" step="1" style="margin:0;">
            </div>
            <div style="display:flex;gap:var(--space-sm);">
              <button type="submit" class="btn btn-primary" style="flex:1;">
                ✅ Confirmar Apertura
              </button>
              <button type="button" class="btn btn-secondary" id="btn-cancel-apertura">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>` : ''}`;
  }

  // ── Cierre Panel ──────────────────────────────────────────────────────────

  renderCierrePanel(session, sessionData, entries = []) {
    if (!session) return '';
    const saldoEsperado = Number(session.saldoInicial || 0) + sessionData.ingresos - sessionData.egresos;
    
    const calcTotalByMethod = (method) => entries
      .filter(e => e.metodoPago === method)
      .reduce((s, e) => {
        const m = Number(e.monto || 0);
        return s + (e.tipo === 'egreso' || (e.tipo === 'ajuste' && m < 0) ? -Math.abs(m) : Math.abs(m));
      }, 0);

    // Renderizamos un placeholder vacío — el modal se inyecta dinámicamente al hacer click
    // para evitar que el panel inline rompa el layout en móvil
    return `<div id="cierre-panel" data-saldo-esperado="${saldoEsperado}"
      data-efvo="${calcTotalByMethod('efectivo')}"
      data-tran="${calcTotalByMethod('transferencia')}"
      data-mp="${calcTotalByMethod('mercadopago')}"
      data-deb="${calcTotalByMethod('debito')}"
      data-cred="${calcTotalByMethod('credito')}"
      data-saldo-inicial="${session.saldoInicial || 0}"
      data-ingresos="${sessionData.ingresos}"
      data-egresos="${sessionData.egresos}"
      data-sesion-id="${session.id}"
      style="display:none;"></div>`;
  }

  _miniStat(label, value, color) {
    return `
      <div style="text-align:center;padding:var(--space-sm);
                  background:rgba(255,255,255,0.04);border-radius:var(--radius-sm);">
        <div style="font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;margin-bottom:4px;">
          ${label.toUpperCase()}
        </div>
        <div style="font-size:var(--font-md);font-weight:800;color:${color};">${value}</div>
      </div>`;
  }

  // ── KPI card ──────────────────────────────────────────────────────────────

  renderKPI(label, value, color, icon, sub = '') {
    return `
      <div class="card glass-card" style="display:flex;flex-direction:column;gap:var(--space-xs);
                  border-left:4px solid ${color};padding:var(--space-md);min-width:0;overflow:hidden;min-height:90px;justify-content:center;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <span style="font-size:9px;color:var(--text-muted);font-weight:800;letter-spacing:0.8px;">${label}</span>
          <span style="font-size:16px;opacity:0.85;">${icon}</span>
        </div>
        <div style="font-size:clamp(18px, 3.5vw, 24px);font-weight:800;color:${color};line-height:1.1;margin-top:4px;
                    word-break:break-all;">${value}</div>
        ${sub ? `<div style="font-size:9px;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sub}</div>` : ''}
      </div>`;
  }

  renderMargenBadge(pctVal) {
    let cls = 'badge-green', label = '🟢 Alta rentabilidad';
    if (pctVal < 0)   { cls = 'badge-danger';  label = '🔴 Pérdida'; }
    else if (pctVal < 40) { cls = 'badge-orange'; label = '🟡 Margen bajo'; }
    return `<div class="badge ${cls}" style="align-self:center;">${label} · ${pctVal}%</div>`;
  }

  // ── Top tickets ───────────────────────────────────────────────────────────

  renderTopTickets(tickets) {
    const prices    = tickets.map(t => Number(t.precio || 0));
    const maxPrecio = prices.length ? Math.max(...prices) : 0;
    return `
      <section class="card glass-card" style="padding:var(--space-lg);">
        <div class="section-divider" style="margin-bottom:var(--space-lg);">
          <h3 style="font-size:var(--font-md);font-weight:700;display:flex;align-items:center;gap:8px;">
            <span style="opacity:0.8;">🏆</span> Tickets más rentables
          </h3>
        </div>
        ${tickets.length === 0
          ? `<div style="text-align:center;padding:var(--space-xl);color:var(--text-muted);font-size:var(--font-sm);">Sin tickets cobrados aún.</div>`
          : tickets.map(t => {
              const precio  = Number(t.precio || 0);
              const barW    = maxPrecio > 0 ? Math.round((precio / maxPrecio) * 100) : 0;
              const cliente = [t.nombre, t.apellido].filter(Boolean).join(' ') || t.clienteId || '—';
              return `
                <div style="margin-bottom:var(--space-md);">
                  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
                    <div style="min-width:0;">
                      <span style="font-size:var(--font-xs);color:var(--accent-cyan);font-weight:700;">#${t.numeroOrden || '—'}</span>
                      <span style="font-size:var(--font-sm);color:var(--text-primary);font-weight:500;margin-left:8px;
                                   white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cliente}</span>
                    </div>
                    <span style="font-size:var(--font-md);font-weight:800;color:var(--accent-cyan);flex-shrink:0;margin-left:8px;">${ars(precio)}</span>
                  </div>
                  <div style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:5px;">${t.equipo || '—'} ${t.marca || ''}</div>
                  <div style="background:rgba(255,255,255,0.05);border-radius:4px;height:5px;overflow:hidden;">
                    <div style="width:${barW}%;height:100%;background:var(--accent-cyan);border-radius:4px;
                                transition:width 0.6s ease;"></div>
                  </div>
                </div>`;
            }).join('')}
      </section>`;
  }

  // ── Últimos cobrados ──────────────────────────────────────────────────────

  renderUltimosCobrados(tickets) {
    return `
      <section class="card glass-card" style="padding:var(--space-lg);">
        <div class="section-divider" style="margin-bottom:var(--space-lg);">
          <h3 style="font-size:var(--font-md);font-weight:700;display:flex;align-items:center;gap:8px;">
            <span style="opacity:0.8;">📋</span> Últimos cobros
          </h3>
        </div>
        ${tickets.length === 0
          ? `<div style="text-align:center;padding:var(--space-xl);color:var(--text-muted);font-size:var(--font-sm);">Sin cobros registrados aún.</div>`
          : tickets.map(t => {
              const cliente = [t.nombre, t.apellido].filter(Boolean).join(' ') || '—';
              const fecha   = t.fechaEntregado
                ? new Date(t.fechaEntregado).toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit' })
                : '—';
              return `
                <div style="display:flex;justify-content:space-between;align-items:center;
                            padding:var(--space-sm) 0;border-bottom:1px solid var(--border);">
                  <div style="min-width:0;overflow:hidden;">
                    <div style="font-size:var(--font-sm);font-weight:600;color:var(--text-primary);
                                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cliente}</div>
                    <div style="font-size:var(--font-xs);color:var(--text-muted);">${t.equipo || '—'} · ${fecha}</div>
                  </div>
                  <div style="text-align:right;flex-shrink:0;margin-left:12px;">
                    <div style="font-size:var(--font-md);font-weight:700;color:var(--accent-green);">${ars(t.precio)}</div>
                    ${t.totalRepuestos ? `<div style="font-size:var(--font-xs);color:var(--text-muted);">−${ars(t.totalRepuestos)} rep.</div>` : ''}
                  </div>
                </div>`;
            }).join('')}
      </section>`;
  }

  // ── Plan distribution ─────────────────────────────────────────────────────

  renderPlanDistribucion(dist, total) {
    const plans = [
      { key: 'estandar', label: 'Estándar', color: 'var(--accent-cyan)' },
      { key: 'oro',      label: 'Oro',       color: '#fbbf24'           },
      { key: 'platinum', label: 'Platinum',   color: '#a855f7'           },
    ];
    const max = total || 1;
    return `
      <section class="card glass-card" style="padding:var(--space-lg);">
        <div class="section-divider" style="margin-bottom:var(--space-lg);">
          <h3 style="font-size:var(--font-md);font-weight:700;display:flex;align-items:center;gap:8px;">
            <span style="opacity:0.8;">📊</span> Distribución por plan
          </h3>
        </div>
        ${total === 0
          ? `<div style="text-align:center;padding:var(--space-xl);color:var(--text-muted);font-size:var(--font-sm);">Sin datos disponibles.</div>`
          : plans.map(({ key, label, color }) => {
              const count = dist[key] || 0;
              const barW  = Math.round((count / max) * 100);
              const share = total > 0 ? Math.round((count / total) * 100) : 0;
              return `
                <div style="margin-bottom:var(--space-md);">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></div>
                      <span style="font-size:var(--font-sm);color:var(--text-primary);font-weight:500;">${label}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span style="font-size:var(--font-sm);font-weight:700;color:${color};">${count}</span>
                      <span style="font-size:var(--font-xs);color:var(--text-muted);">${share}%</span>
                    </div>
                  </div>
                  <div style="background:rgba(255,255,255,0.05);border-radius:6px;height:8px;overflow:hidden;">
                    <div style="width:${barW}%;height:100%;background:${color};border-radius:6px;
                                transition:width 0.7s ease;"></div>
                  </div>
                </div>`;
            }).join('')}
        <div style="border-top:1px solid var(--border);padding-top:var(--space-sm);margin-top:var(--space-sm);
                    display:flex;justify-content:space-between;">
          <span style="font-size:var(--font-xs);color:var(--text-muted);">Total tickets</span>
          <span style="font-size:var(--font-sm);font-weight:700;color:var(--text-primary);">${total}</span>
        </div>
      </section>`;
  }

  // ── Resumen diario ────────────────────────────────────────────────────────

  renderResumenDiario(cajaDia, cajaSem, entregadosHoy, entries = []) {
    const balColor = cajaDia.balance >= 0 ? 'var(--accent-green)' : 'var(--danger)';
    
    const calc = (m) => entries.filter(e => e.metodoPago === m).reduce((s, e) => {
      const v = Number(e.monto || 0);
      return s + (e.tipo === 'egreso' || (e.tipo === 'ajuste' && v < 0) ? -Math.abs(v) : Math.abs(v));
    }, 0);

    return `
      <section class="card glass-card" style="padding:var(--space-lg);min-width:0;overflow:hidden;">
        <div class="section-divider" style="margin-bottom:var(--space-lg);">
          <h3 style="font-size:var(--font-md);font-weight:700;display:flex;align-items:center;gap:8px;">
            <span style="opacity:0.8;">📅</span> Resumen Operacional
          </h3>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-md);">
          <div class="operational-controls flex-between animate-fade-in" style="margin-top: var(--space-md); background: rgba(255,255,255,0.02); padding: 12px; border-radius: var(--radius-lg); border: 1px solid var(--border);">
            <div style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:4px;">BALANCE SESIÓN</div>
            <div style="font-size:32px;font-weight:900;color:${balColor};line-height:1;">
              ${ars(cajaDia.balance)}
            </div>
          </div>
          
          <!-- Simple Breakdown -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <div style="padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:var(--radius-sm);border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:10px;color:var(--text-muted);">EFVO</span>
              <span style="font-size:11px;font-weight:700;color:var(--accent-green);">${ars(calc('efectivo'))}</span>
            </div>
            <div style="padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:var(--radius-sm);border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:10px;color:var(--text-muted);">TRANS</span>
              <span style="font-size:11px;font-weight:700;color:var(--accent-cyan);">${ars(calc('transferencia'))}</span>
            </div>
            <div style="padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:var(--radius-sm);border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:10px;color:var(--text-muted);">M.PAGO</span>
              <span style="font-size:11px;font-weight:700;color:var(--accent-cyan);">${ars(calc('mercadopago'))}</span>
            </div>
            <div style="padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:var(--radius-sm);border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:10px;color:var(--text-muted);">DEB/CRE</span>
              <span style="font-size:11px;font-weight:700;color:var(--accent-orange);">${ars(calc('debito') + calc('credito'))}</span>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;
                      padding:var(--space-sm) 0;border-top:1px solid var(--border);">
            <span style="font-size:var(--font-sm);color:var(--text-muted);">📦 Entregas hoy</span>
            <span style="font-size:var(--font-md);font-weight:700;color:var(--text-primary);">${entregadosHoy.length}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;
                      border-top:1px solid var(--border);padding-top:var(--space-sm);">
            <span style="font-size:var(--font-sm);color:var(--text-muted);">Acumulado semana</span>
            <span style="font-size:var(--font-md);font-weight:700;
                         color:${cajaSem.balance >= 0 ? 'var(--accent-green)' : 'var(--danger)'};">
              ${ars(cajaSem.balance)}
            </span>
          </div>
        </div>
      </section>`;
  }

  // ── Caja Section ──────────────────────────────────────────────────────────

  renderCajaSection(session, sessionEntries, sessionData, cajaHoy, cajaSemana, cajaDia, cajaSem, canWrite) {
    const periodEntries = this._cajaPeriod === 'session'
      ? sessionEntries
      : this._cajaPeriod === 'today'
        ? cajaHoy : cajaSemana;

    const noSession = !session;

    return `
      <section class="card glass-card" style="padding:var(--space-lg);">
        <div class="flex-between" style="margin-bottom:var(--space-lg);flex-wrap:wrap;gap:var(--space-md);">
          <h3 style="font-size:var(--font-md);font-weight:700;display:flex;align-items:center;gap:8px;margin:0;">
            <span style="opacity:0.8;">🏦</span> Caja
          </h3>
          <div style="display:flex;gap:4px;background:rgba(255,255,255,0.04);border:1px solid var(--border);
                      border-radius:var(--radius-md);padding:4px;">
            <button class="btn btn-sm caja-period-btn ${this._cajaPeriod === 'session' ? 'active' : ''}"
              data-period="session" ${noSession ? 'disabled' : ''}>Sesión actual</button>
            <button class="btn btn-sm caja-period-btn ${this._cajaPeriod === 'today' ? 'active' : ''}"
              data-period="today">Hoy</button>
            <button class="btn btn-sm caja-period-btn ${this._cajaPeriod === 'week' ? 'active' : ''}"
              data-period="week">Semana</button>
          </div>
        </div>

        <div class="kpi-grid">
          <!-- Formulario -->
          ${canWrite
            ? (session
                ? this.renderCajaForm(session.id)
                : `<div style="display:flex;align-items:center;justify-content:center;padding:var(--space-xl);
                               color:var(--text-muted);font-size:var(--font-sm);border:1px dashed var(--border);
                               border-radius:var(--radius-md);text-align:center;">
                     🔐 Abrí la caja para registrar movimientos.
                   </div>`)
            : `<div style="display:flex;align-items:center;justify-content:center;padding:var(--space-xl);
                            color:var(--text-muted);font-size:var(--font-sm);border:1px dashed var(--border);
                            border-radius:var(--radius-md);">
                 🔒 Solo recepción y admin pueden registrar movimientos.
               </div>`}

          <!-- Movimientos -->
          <div>
            <div style="font-size:var(--font-xs);color:var(--text-muted);font-weight:700;letter-spacing:0.5px;
                        margin-bottom:var(--space-md);">MOVIMIENTOS</div>
            <div id="caja-entries-list">
              ${this.renderCajaEntries(periodEntries)}
            </div>
          </div>
        </div>

        <!-- Cierre panel -->
        ${canWrite && session ? this.renderCierrePanel(session, sessionData, sessionEntries) : ''}
      </section>`;
  }

  renderCajaForm(sesionId) {
    return `
      <div>
        <div style="font-size:var(--font-xs);color:var(--text-muted);font-weight:700;letter-spacing:0.5px;
                    margin-bottom:var(--space-md);">REGISTRAR MOVIMIENTO</div>
        <div id="caja-form-error" class="alert alert-danger" style="display:none;"></div>
        <form id="caja-form" style="display:flex;flex-direction:column;gap:var(--space-md);">
          <input type="hidden" name="sesionId" value="${sesionId}">
          <div style="display:flex;gap:var(--space-sm);">
            <label style="flex:1;display:flex;align-items:center;gap:8px;cursor:pointer;
                           padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius-md);
                           background:rgba(34,197,94,0.07);">
              <input type="radio" name="tipo" value="ingreso" checked style="accent-color:var(--accent-green);">
              <span style="font-size:var(--font-sm);font-weight:600;color:var(--accent-green);">💚 Ingreso</span>
            </label>
            <label style="flex:1;display:flex;align-items:center;gap:8px;cursor:pointer;
                           padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius-md);
                           background:rgba(249,115,22,0.07);">
              <input type="radio" name="tipo" value="egreso" style="accent-color:var(--accent-orange);">
              <span style="font-size:var(--font-sm);font-weight:600;color:var(--accent-orange);">🔴 Egreso</span>
            </label>
          </div>
          <input type="text" name="descripcion" class="input" placeholder="Descripción del movimiento..."
            style="margin:0;" required>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-sm);">
            <input type="number" name="monto" class="input" placeholder="Monto $" min="1" style="margin:0;" required>
            <select name="metodoPago" class="input"
              style="margin:0;background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--text-primary);">
              <option value="efectivo">💵 Efectivo</option>
              <option value="transferencia">🏦 Transferencia</option>
              <option value="mercadopago">📱 Mercado Pago</option>
              <option value="debito">💳 Débito</option>
              <option value="credito">💳 Crédito</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary" id="caja-submit-btn">＋ Registrar</button>
        </form>
      </div>`;
  }

  renderCajaEntries(entries) {
    if (!entries || entries.length === 0) {
      return `<div style="text-align:center;padding:var(--space-xl);color:var(--text-muted);
                          font-size:var(--font-sm);border:1px dashed var(--border);
                          border-radius:var(--radius-md);">Sin movimientos en este período.</div>`;
    }
    const metodoLabel = { efectivo: '💵', transferencia: '🏦', mercadopago: '📱', debito: '💳', credito: '💳' };
    return entries.map(e => {
      const isIng = e.tipo === 'ingreso' || (e.tipo === 'ajuste' && Number(e.monto||0) > 0);
      const isEgr = e.tipo === 'egreso' || (e.tipo === 'ajuste' && Number(e.monto||0) < 0);
      const isAjuste = e.tipo === 'ajuste';
      const color = isIng ? 'var(--accent-green)' : 'var(--accent-orange)';
      const origenTag = e.origen === 'ticket'
        ? `<span style="font-size:9px;background:rgba(0,229,255,0.12);color:var(--accent-cyan);
                        border-radius:3px;padding:1px 4px;margin-left:4px;">AUTO</span>` : (isAjuste ? `<span style="font-size:9px;background:rgba(249,115,22,0.12);color:var(--accent-orange);border-radius:3px;padding:1px 4px;margin-left:4px;">AJUSTE</span>` : '');
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:var(--space-sm) 0;border-bottom:1px solid var(--border);">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;">
            <span style="font-size:10px;font-weight:900;color:${color};flex-shrink:0;">${isIng ? '▲' : '▼'}</span>
            <div style="min-width:0;">
              <div style="font-size:var(--font-sm);color:var(--text-primary);font-weight:500;
                          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${e.descripcion}${origenTag}
              </div>
              <div style="font-size:var(--font-xs);color:var(--text-muted);">
                ${metodoLabel[e.metodoPago] || '—'} ${e.metodoPago || ''} · ${fmtTime(e.createdAt)}
              </div>
            </div>
          </div>
          <div style="font-size:var(--font-md);font-weight:700;color:${color};flex-shrink:0;margin-left:12px;">
            ${isIng ? '+' : '−'}${ars(e.monto)}
          </div>
        </div>`;
    }).join('');
  }

  // ── Ajustes contables (admin overrides on delivered tickets) ─────────────

  renderAjustesSection(ajustes) {
    const { movimientos, positivos, negativos, neto, ticketsAfectados, pendientes } = ajustes;
    const hasPending = pendientes?.length > 0;
    const metodoLabel = { efectivo: '💵', transferencia: '🏦', mercadopago: '📱', debito: '💳', credito: '💳' };

    return `
      <section class="card glass-card" style="padding:var(--space-lg);
        border:1px solid rgba(249,115,22,0.2);">
        <div style="display:flex;align-items:center;justify-content:space-between;
                    margin-bottom:var(--space-lg);flex-wrap:wrap;gap:var(--space-sm);">
          <h3 style="font-size:var(--font-md);font-weight:700;display:flex;align-items:center;gap:8px;margin:0;">
            <span style="opacity:0.8;">⚖️</span> Ajustes Contables
            ${hasPending ? `<span class="badge badge-orange" style="font-size:10px;">
              ⚠ ${pendientes.length} pendiente${pendientes.length > 1 ? 's' : ''} de conciliación
            </span>` : ''}
          </h3>
          <span style="font-size:var(--font-xs);color:var(--text-muted);">
            ${movimientos.length} ajuste${movimientos.length !== 1 ? 's' : ''} · ${ticketsAfectados} ticket${ticketsAfectados !== 1 ? 's' : ''}
          </span>
        </div>

        <!-- KPIs de ajustes -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--space-md);margin-bottom:var(--space-lg);">
          <div style="padding:var(--space-md);background:rgba(34,197,94,0.07);
                      border:1px solid rgba(34,197,94,0.2);border-radius:var(--radius-md);text-align:center;">
            <div style="font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;margin-bottom:6px;">POSITIVOS</div>
            <div style="font-size:var(--font-lg);font-weight:800;color:var(--accent-green);">
              ${ars(positivos.reduce((s, e) => s + Number(e.monto || 0), 0))}
            </div>
            <div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:2px;">${positivos.length} mov.</div>
          </div>
          <div style="padding:var(--space-md);background:rgba(249,115,22,0.07);
                      border:1px solid rgba(249,115,22,0.2);border-radius:var(--radius-md);text-align:center;">
            <div style="font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;margin-bottom:6px;">NEGATIVOS</div>
            <div style="font-size:var(--font-lg);font-weight:800;color:var(--accent-orange);">
              ${ars(negativos.reduce((s, e) => s + Number(e.monto || 0), 0))}
            </div>
            <div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:2px;">${negativos.length} mov.</div>
          </div>
          <div style="padding:var(--space-md);background:rgba(255,255,255,0.04);
                      border:1px solid var(--border);border-radius:var(--radius-md);text-align:center;">
            <div style="font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;margin-bottom:6px;">NETO</div>
            <div style="font-size:var(--font-lg);font-weight:800;
                        color:${neto >= 0 ? 'var(--accent-cyan)' : 'var(--danger)'};">
              ${neto >= 0 ? '+' : ''}${ars(neto)}
            </div>
            <div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:2px;">${ticketsAfectados} ticket${ticketsAfectados !== 1 ? 's' : ''}</div>
          </div>
          ${hasPending ? `
          <div style="padding:var(--space-md);background:rgba(249,115,22,0.1);
                      border:1px solid rgba(249,115,22,0.3);border-radius:var(--radius-md);text-align:center;">
            <div style="font-size:9px;color:var(--accent-orange);font-weight:700;letter-spacing:0.5px;margin-bottom:6px;">⚠ PENDIENTES</div>
            <div style="font-size:var(--font-lg);font-weight:800;color:var(--accent-orange);">${pendientes.length}</div>
            <div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:2px;">sin sesión de caja</div>
          </div>` : ''}
        </div>

        <!-- Lista de movimientos -->
        <div style="font-size:var(--font-xs);color:var(--text-muted);font-weight:700;letter-spacing:0.5px;
                    margin-bottom:var(--space-md);">MOVIMIENTOS DE AJUSTE</div>
        <div style="max-height:320px;overflow-y:auto;">
          ${movimientos.slice(0, 50).map(e => {
            const isPos = Number(e.monto || 0) > 0;
            const color = isPos ? 'var(--accent-green)' : 'var(--accent-orange)';
            const pendTag = e.pendingReconciliation
              ? `<span style="font-size:9px;background:rgba(249,115,22,0.15);color:var(--accent-orange);
                              border-radius:3px;padding:1px 5px;margin-left:4px;">⚠ SIN SESIÓN</span>`
              : '';
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;
                          padding:var(--space-sm) 0;border-bottom:1px solid var(--border);">
                <div style="display:flex;align-items:center;gap:10px;min-width:0;">
                  <span style="font-size:10px;font-weight:900;color:${color};flex-shrink:0;">${isPos ? '▲' : '▼'}</span>
                  <div style="min-width:0;">
                    <div style="font-size:var(--font-sm);color:var(--text-primary);font-weight:500;
                                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                      ${e.descripcion}${pendTag}
                    </div>
                    <div style="font-size:var(--font-xs);color:var(--text-muted);">
                      ${metodoLabel[e.metodoPago] || '—'} ${e.metodoPago || ''} · ${fmtTs(e.createdAt)}
                    </div>
                  </div>
                </div>
                <div style="font-size:var(--font-md);font-weight:700;color:${color};flex-shrink:0;margin-left:12px;">
                  ${isPos ? '+' : ''}${ars(e.monto)}
                </div>
              </div>`;
          }).join('')}
        </div>
      </section>`;
  }

  // ── Historial de cierres ──────────────────────────────────────────────────

  renderHistorialCierres(historial) {
    if (!historial || historial.length === 0) {
      return `
        <section class="card glass-card" style="padding:var(--space-lg);">
          <h3 style="font-size:var(--font-md);font-weight:700;margin-bottom:var(--space-lg);
                     display:flex;align-items:center;gap:8px;">
            <span style="opacity:0.8;">📜</span> Historial de cierres
          </h3>
          <div style="text-align:center;padding:var(--space-xl);color:var(--text-muted);font-size:var(--font-sm);
                      border:1px dashed var(--border);border-radius:var(--radius-md);">
            Sin cierres registrados aún.
          </div>
        </section>`;
    }

    const rows = historial.map(s => {
      const dif = Number(s.diferencia || 0);
      return `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:10px 8px;white-space:nowrap;color:var(--text-muted);font-size:var(--font-xs);">
            ${fmtDate(s.closedAt)}<br>${fmtTime(s.closedAt)}
          </td>
          <td style="padding:10px 8px;font-size:var(--font-xs);color:var(--text-muted);">
            ${s.closedByName || '—'}
          </td>
          <td style="padding:10px 8px;text-align:right;color:var(--accent-cyan);font-weight:700;white-space:nowrap;">
            ${ars(s.saldoInicial || 0)}
          </td>
          <td style="padding:10px 8px;text-align:right;color:var(--accent-green);font-weight:600;white-space:nowrap;">
            ${ars(s.totalIngresos || 0)}
          </td>
          <td style="padding:10px 8px;text-align:right;color:var(--accent-orange);font-weight:600;white-space:nowrap;">
            ${ars(s.totalEgresos || 0)}
          </td>
          <td style="padding:10px 8px;text-align:right;font-weight:700;white-space:nowrap;
                     color:var(--accent-cyan);">
            ${ars(s.saldoFinalSistema || 0)}
          </td>
          <td style="padding:10px 8px;text-align:right;font-weight:700;white-space:nowrap;
                     color:var(--text-primary);">
            ${ars(s.saldoFinalDeclarado || 0)}
          </td>
          <td style="padding:10px 8px;text-align:right;">
            ${difBadge(dif)}
          </td>
          <td style="padding:10px 8px;font-size:var(--font-xs);color:var(--text-muted);">
            ${s.movimientosCount ?? '—'} mov.
          </td>
        </tr>`;
    }).join('');

    return `
      <section class="card glass-card" style="padding:var(--space-lg);">
        <h3 style="font-size:var(--font-md);font-weight:700;margin-bottom:var(--space-lg);
                   display:flex;align-items:center;gap:8px;">
          <span style="opacity:0.8;">📜</span> Bitácora de Sesiones
          <span class="badge" style="font-size:10px;background:rgba(255,255,255,0.06);">últimos ${historial.length}</span>
        </h3>
        <!-- overflow-x for mobile -->
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
          <table style="width:100%;border-collapse:collapse;min-width:680px;">
            <thead>
              <tr style="border-bottom:1px solid var(--border);">
                <th style="padding:8px;text-align:left;font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;">FECHA CIERRE</th>
                <th style="padding:8px;text-align:left;font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;">OPERADOR</th>
                <th style="padding:8px;text-align:right;font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;">INICIAL</th>
                <th style="padding:8px;text-align:right;font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;">INGRESOS</th>
                <th style="padding:8px;text-align:right;font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;">EGRESOS</th>
                <th style="padding:8px;text-align:right;font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;">ESPERADO</th>
                <th style="padding:8px;text-align:right;font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;">CONTADO</th>
                <th style="padding:8px;text-align:right;font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;">DIFERENCIA</th>
                <th style="padding:8px;font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;">MOV.</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>`;
  }

  // ── Comisiones por operador ───────────────────────────────────────────────

  renderComisiones(ultimosCobrados, comisionesConfig) {
    // Read percentages from app config
    let comisionTaller = Number(comisionesConfig?.taller ?? 30);
    let comisionRemoto = Number(comisionesConfig?.remoto ?? 20);

    if (!ultimosCobrados || ultimosCobrados.length === 0) {
      return `
        <section class="card glass-card" style="padding:var(--space-lg); border: 1px solid rgba(0,229,255,0.08);">
          <h3 style="font-size:var(--font-md);font-weight:700;margin-bottom:var(--space-lg);display:flex;align-items:center;gap:8px;">
            <span style="opacity:0.8;">👷</span> Comisiones de Operadores
            <span class="badge" style="font-size:10px;background:rgba(255,255,255,0.06);">Taller ${comisionTaller}% · Remoto ${comisionRemoto}%</span>
          </h3>
          <div style="text-align:center;padding:var(--space-xl);color:var(--text-muted);font-size:var(--font-sm);
                      border:1px dashed var(--border);border-radius:var(--radius-md);">
            Sin cobros registrados para calcular comisiones.
          </div>
        </section>`;
    }

    // Group by technician (tecnicoAsignadoId / tecnicoAsignadoNombre)
    const byTecnico = {};
    for (const t of ultimosCobrados) {
      const precio = Number(t.precio || 0);
      if (precio <= 0) continue;

      const tecId    = t.tecnicoAsignadoId || '__sin_asignar__';
      const tecNombre = t.tecnicoAsignadoNombre || 'Sin asignar';
      const esRemoto  = String(t.tipoServicio || t.planServicio || '').toLowerCase().includes('remot');
      const pct       = esRemoto ? comisionRemoto : comisionTaller;

      if (!byTecnico[tecId]) {
        byTecnico[tecId] = {
          nombre: tecNombre,
          totalCobrado: 0,
          totalComision: 0,
          count: 0,
          tickets: [],
        };
      }
      byTecnico[tecId].totalCobrado  += precio;
      byTecnico[tecId].totalComision += Math.round(precio * pct / 100);
      byTecnico[tecId].count++;
      byTecnico[tecId].tickets.push({ ...t, pct });
    }

    const operadores = Object.values(byTecnico).sort((a, b) => b.totalComision - a.totalComision);
    const totalComisionGlobal = operadores.reduce((s, o) => s + o.totalComision, 0);

    const rows = operadores.map(op => `
      <div style="display:flex;justify-content:space-between;align-items:center;
                  padding:var(--space-md);border-radius:var(--radius-md);
                  background:rgba(255,255,255,0.03);border:1px solid var(--border);
                  margin-bottom:var(--space-sm);">
        <div style="display:flex;align-items:center;gap:var(--space-md);min-width:0;">
          <div style="width:36px;height:36px;border-radius:50%;
                      background:linear-gradient(135deg,rgba(0,229,255,0.2),rgba(0,229,255,0.05));
                      border:1px solid rgba(0,229,255,0.2);
                      display:flex;align-items:center;justify-content:center;
                      font-size:16px;flex-shrink:0;">👷</div>
        <div style="min-width:0;">
          <div style="font-size:var(--font-sm);font-weight:700;color:var(--text-primary);
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${op.nombre}
          </div>
          <div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:2px;">
            ${op.count} cobro${op.count !== 1 ? 's' : ''} · Base: ${ars(op.totalCobrado)}
          </div>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:var(--font-sm);font-weight:800;color:var(--accent-green);">
          ${ars(op.totalComision)}
        </div>
        <div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:2px;">Comisión</div>
      </div>
    </div>
  `).join('');

    return `
      <section class="card glass-card" style="padding:var(--space-lg); border: 1px solid rgba(0,229,255,0.08);">
        <h3 style="font-size:var(--font-md);font-weight:700;margin-bottom:var(--space-lg);display:flex;align-items:center;gap:8px;">
          <span style="opacity:0.8;">👷</span> Comisiones de Operadores
          <span class="badge" style="font-size:10px;background:rgba(255,255,255,0.06);">Taller ${comisionTaller}% · Remoto ${comisionRemoto}%</span>
        </h3>
        <div style="display:flex;flex-direction:column;gap:4px;">
          ${rows}
        </div>
        <div style="border-top:1px solid var(--border);padding-top:var(--space-md);margin-top:var(--space-sm);
                    display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:var(--font-xs);color:var(--text-muted);font-weight:700;letter-spacing:0.5px;">TOTAL COMISIONES</span>
          <span style="font-size:var(--font-md);font-weight:800;color:var(--accent-green);">
            ${ars(totalComisionGlobal)}
          </span>
        </div>
      </section>`;
  }

  // ── Banner rendición semanal (admin) ─────────────────────────────────────
  renderBannerRendicion(kpis) {
    const facturado     = kpis.facturacionDesdeRendicion ?? 0;
    const tickets       = kpis.ticketsDesdeRendicion ?? 0;
    const diasRestantes = kpis.diasHastaRendicion ?? 0;

    const countdownText = diasRestantes === 0
      ? '🎉 ¡Hoy es día de rendición!'
      : diasRestantes === 1
        ? '⏰ Mañana es la rendición semanal'
        : `📅 Faltan <strong>${diasRestantes}</strong> días para la rendición del sábado`;

    const color  = diasRestantes === 0 ? 'var(--accent-green)'  : diasRestantes <= 2 ? 'var(--accent-orange)'  : 'var(--accent-cyan)';
    const bg     = diasRestantes === 0 ? 'rgba(34,197,94,0.07)' : diasRestantes <= 2 ? 'rgba(249,115,22,0.07)' : 'rgba(0,229,255,0.05)';
    const border = diasRestantes === 0 ? 'rgba(34,197,94,0.25)' : diasRestantes <= 2 ? 'rgba(249,115,22,0.25)' : 'rgba(0,229,255,0.15)';

    return `
      <div style="padding:var(--space-md) var(--space-lg);background:${bg};
                  border:1px solid ${border};border-radius:var(--radius-md);
                  display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-md);">
        <span style="font-size:var(--font-sm);font-weight:600;color:${color};">${countdownText}</span>
        <div style="display:flex;align-items:center;gap:var(--space-lg);">
          <div style="text-align:right;">
            <div style="font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;">DESDE ÚLT. SÁBADO</div>
            <div style="font-size:var(--font-md);font-weight:800;color:${color};">${ars(facturado)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;">COBROS</div>
            <div style="font-size:var(--font-md);font-weight:800;color:var(--text-primary);">${tickets}</div>
          </div>
        </div>
      </div>`;
  }

  // ── Rendimiento Operador ──────────────────────────────────────────────────
  renderRendimientoOperador(kpis, comisiones) {
    const pctOperador = Number(comisiones?.taller ?? 30);
    const pctNegocio  = 100 - pctOperador;

    // Usar ingresos DESDE la última rendición (último sábado), no toda la historia
    const facturado     = kpis.facturacionDesdeRendicion ?? kpis.facturacionConcretada ?? 0;
    const tickets       = kpis.ticketsDesdeRendicion ?? kpis.totalConPrecio ?? 0;
    const diasRestantes = kpis.diasHastaRendicion ?? 0;
    const miGanancia    = Math.round(facturado * (pctOperador / 100));
    const aporteNegocio = Math.round(facturado * (pctNegocio / 100));

    // Texto del countdown
    const countdownText = diasRestantes === 0
      ? '🎉 ¡Hoy es día de rendición!'
      : diasRestantes === 1
        ? '⏰ Mañana es la rendición'
        : `📅 Faltan <strong>${diasRestantes}</strong> días para la rendición del sábado`;

    // Color del countdown
    const countdownColor = diasRestantes === 0
      ? 'var(--accent-green)' : diasRestantes <= 2
        ? 'var(--accent-orange)' : 'var(--accent-cyan)';
    const countdownBg = diasRestantes === 0
      ? 'rgba(34,197,94,0.08)' : diasRestantes <= 2
        ? 'rgba(249,115,22,0.08)' : 'rgba(0,229,255,0.06)';
    const countdownBorder = diasRestantes === 0
      ? 'rgba(34,197,94,0.25)' : diasRestantes <= 2
        ? 'rgba(249,115,22,0.25)' : 'rgba(0,229,255,0.15)';

    return `
      <section class="card glass-card" style="padding:var(--space-lg); border: 1px solid rgba(0,229,255,0.08);">
        <h3 style="font-size:var(--font-md);font-weight:700;margin-bottom:var(--space-sm);display:flex;align-items:center;gap:8px;">
          <span style="opacity:0.8;">📊</span> Mi Rendimiento Semanal
        </h3>
        <p style="font-size:var(--font-xs);color:var(--text-muted);margin:0 0 var(--space-md);">
          Ingresos acumulados desde el último sábado · ${tickets} cobro${tickets !== 1 ? 's' : ''}
        </p>

        <!-- Countdown rendición -->
        <div style="padding:var(--space-sm) var(--space-md);background:${countdownBg};
                    border:1px solid ${countdownBorder};border-radius:var(--radius-md);
                    font-size:var(--font-sm);color:${countdownColor};font-weight:600;
                    margin-bottom:var(--space-md);display:flex;align-items:center;gap:8px;">
          <span>${countdownText}</span>
        </div>

        <!-- Cards de distribución -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-md);">
          <div style="padding:var(--space-lg);background:rgba(34,197,94,0.07);
                      border:1px solid rgba(34,197,94,0.2);border-radius:var(--radius-md);text-align:center;">
            <div style="font-size:10px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;margin-bottom:6px;">MI GANANCIA (${pctOperador}%)</div>
            <div style="font-size:var(--font-xl);font-weight:800;color:var(--accent-green);">
              ${ars(miGanancia)}
            </div>
            <div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:4px;">Lo que me quedo</div>
          </div>
          <div style="padding:var(--space-lg);background:rgba(249,115,22,0.07);
                      border:1px solid rgba(249,115,22,0.2);border-radius:var(--radius-md);text-align:center;">
            <div style="font-size:10px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;margin-bottom:6px;">APORTE AL NEGOCIO (${pctNegocio}%)</div>
            <div style="font-size:var(--font-xl);font-weight:800;color:var(--accent-orange);">
              ${ars(aporteNegocio)}
            </div>
            <div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:4px;">Lo que pongo en la empresa</div>
          </div>
          <div style="padding:var(--space-lg);background:rgba(255,255,255,0.04);
                      border:1px solid var(--border);border-radius:var(--radius-md);text-align:center;">
            <div style="font-size:10px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;margin-bottom:6px;">TOTAL FACTURADO</div>
            <div style="font-size:var(--font-xl);font-weight:800;color:var(--accent-cyan);">
              ${ars(facturado)}
            </div>
            <div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:4px;">Desde el último sábado</div>
          </div>
        </div>
      </section>
    `;
  }


  // ── Events ────────────────────────────────────────────────────────────────

  onContentReady(data) {
    // Chaos Guard
    initUnsavedChangesGuard();

    // Refresh
    document.getElementById('fin-refresh')?.addEventListener('click', () => this.fetchAndRender());

    // Cierre de Caja Taller (admin/tester only) — lazy-load del modal
    const cierreBtn = document.getElementById('fin-cierre-taller-btn');
    if (cierreBtn) {
      cierreBtn.addEventListener('click', async () => {
        const origText = cierreBtn.innerHTML;
        cierreBtn.disabled = true;
        cierreBtn.innerHTML = '⏳ Abriendo...';
        try {
          const { openCierreCajaModal } = await import('../components/cierre-caja-modal.js');
          openCierreCajaModal({
            onSuccess: () => this.fetchAndRender(), // refrescar KPIs después de liquidar
            onClose: () => {
              cierreBtn.innerHTML = origText;
              cierreBtn.disabled = false;
            },
          });
        } catch (err) {
          console.error('[finanzas] cierre modal failed to load:', err);
          cierreBtn.innerHTML = origText;
          cierreBtn.disabled = false;
        }
      });
    }

    // Period toggle
    document.querySelectorAll('.caja-period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        this._cajaPeriod = btn.dataset.period;
        document.querySelectorAll('.caja-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const listEl = document.getElementById('caja-entries-list');
        if (listEl && this._data) {
          const { cajaSessionEntries, cajaHoy, cajaSemana } = this._data;
          const entries = this._cajaPeriod === 'session'
            ? cajaSessionEntries
            : this._cajaPeriod === 'today'
              ? cajaHoy : cajaSemana;
          listEl.innerHTML = this.renderCajaEntries(entries);
        }
      });
    });

    // Apertura
    const btnAbrir = document.getElementById('btn-abrir-caja');
    const panelApertura = document.getElementById('apertura-panel');
    const btnCancelApertura = document.getElementById('btn-cancel-apertura');
    const formApertura = document.getElementById('apertura-form');

    if (btnAbrir && panelApertura) {
      btnAbrir.addEventListener('click', () => {
        panelApertura.style.display = 'block';
        btnAbrir.style.display = 'none';
        document.getElementById('apertura-saldo')?.focus();
      });
    }
    if (btnCancelApertura) {
      btnCancelApertura.addEventListener('click', () => {
        if (panelApertura) panelApertura.style.display = 'none';
        if (btnAbrir) btnAbrir.style.display = '';
      });
    }
    if (formApertura) this._initAperturaForm(formApertura);

    // Cierre — abre un modal overlay (no inline, para evitar layout roto en móvil)
    const btnToggleCierre = document.getElementById('btn-toggle-cierre');
    const cierreDataEl    = document.getElementById('cierre-panel');

    if (btnToggleCierre && cierreDataEl) {
      btnToggleCierre.addEventListener('click', () => {
        // Si ya existe un overlay abierto, cerrarlo
        const existing = document.getElementById('cierre-modal-overlay');
        if (existing) { existing.remove(); btnToggleCierre.innerHTML = '🔒 Cerrar Caja'; return; }

        const d = cierreDataEl.dataset;
        const saldoEsperado = Number(d.saldoEsperado || 0);
        const fmtArs = n => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);
        const miniSt = (lbl, val, color) => `<div style="text-align:center;padding:10px 8px;background:rgba(255,255,255,0.04);border-radius:8px;"><div style="font-size:9px;color:#888;font-weight:700;letter-spacing:.5px;margin-bottom:4px;">${lbl}</div><div style="font-size:15px;font-weight:800;color:${color};">${val}</div></div>`;

        const overlay = document.createElement('div');
        overlay.id = 'cierre-modal-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
        overlay.innerHTML = `
          <div style="background:#0f1117;border:1px solid rgba(249,115,22,0.35);border-radius:16px;padding:24px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.6);">
            <h4 style="font-size:16px;font-weight:700;margin:0 0 20px;display:flex;align-items:center;gap:8px;">🔒 Cierre de Caja</h4>

            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">
              ${miniSt('SALDO INICIAL', fmtArs(Number(d.saldoInicial||0)), '#888')}
              ${miniSt('INGRESOS', fmtArs(Number(d.ingresos||0)), 'var(--accent-green,#10b981)')}
              ${miniSt('EGRESOS', fmtArs(Number(d.egresos||0)), 'var(--accent-orange,#f97316)')}
            </div>
            <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:16px;">
              ${miniSt('EFVO', fmtArs(Number(d.efvo||0)), '#00e5ff')}
              ${miniSt('TRAN', fmtArs(Number(d.tran||0)), '#00e5ff')}
              ${miniSt('MP', fmtArs(Number(d.mp||0)), '#00e5ff')}
              ${miniSt('DEB', fmtArs(Number(d.deb||0)), '#00e5ff')}
              ${miniSt('CRED', fmtArs(Number(d.cred||0)), '#00e5ff')}
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;margin-bottom:16px;">
              <span style="font-size:13px;color:#888;">Saldo esperado</span>
              <span id="cierre-modal-esperado" style="font-size:20px;font-weight:800;color:#00e5ff;">${fmtArs(saldoEsperado)}</span>
            </div>

            <div id="cierre-modal-error" style="display:none;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px 14px;color:#ef4444;font-size:13px;margin-bottom:12px;"></div>

            <form id="cierre-modal-form" style="display:flex;flex-direction:column;gap:12px;">
              <input type="hidden" name="sesionId" value="${d.sesionId}">
              <input type="hidden" name="saldoEsperado" value="${saldoEsperado}">
              <div>
                <label style="font-size:13px;color:#888;display:block;margin-bottom:6px;">Monto contado en caja (efectivo real)</label>
                <input type="number" name="saldoDeclarado" id="cierre-modal-contado" class="input"
                  placeholder="Ej: 12500" min="0" step="1" style="margin:0;width:100%;box-sizing:border-box;" required>
              </div>
              <div id="cierre-modal-preview" style="padding:10px 14px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);font-size:13px;color:#888;">
                Ingresá el monto para ver la diferencia.
              </div>
              <div style="display:flex;gap:8px;">
                <button type="submit" id="cierre-modal-submit" class="btn" style="flex:1;background:rgba(249,115,22,0.15);border-color:rgba(249,115,22,0.4);color:#f97316;">🔒 Confirmar Cierre</button>
                <button type="button" id="cierre-modal-cancel" class="btn btn-secondary">Cancelar</button>
              </div>
            </form>
          </div>`;

        document.body.appendChild(overlay);
        btnToggleCierre.innerHTML = '✖ Cancelar cierre';

        const closeModal = () => {
          overlay.remove();
          btnToggleCierre.innerHTML = '🔒 Cerrar Caja';
        };
        overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
        overlay.querySelector('#cierre-modal-cancel').addEventListener('click', closeModal);
        document.addEventListener('keydown', function esc(e) {
          if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', esc); }
        });

        // Diferencia preview
        const inputContado = overlay.querySelector('#cierre-modal-contado');
        const previewEl    = overlay.querySelector('#cierre-modal-preview');
        inputContado.addEventListener('input', () => {
          const contado = Number(inputContado.value || 0);
          if (!inputContado.value) { previewEl.textContent = 'Ingresá el monto para ver la diferencia.'; previewEl.style.color = '#888'; return; }
          const diff = contado - saldoEsperado;
          const ok = Math.abs(diff) <= 1;
          previewEl.innerHTML = ok
            ? '<strong style="color:#10b981;">✓ Cuadra con el saldo esperado</strong>'
            : `Diferencia: <strong style="color:${diff >= 0 ? '#10b981' : '#ef4444'}">${diff >= 0 ? '+' : ''}${fmtArs(diff)}</strong>`;
          previewEl.style.color = ok ? '#10b981' : (diff >= 0 ? '#10b981' : '#ef4444');
        });
        setTimeout(() => inputContado.focus(), 100);

        // Form submit
        overlay.querySelector('#cierre-modal-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const submitBtn = overlay.querySelector('#cierre-modal-submit');
          const errEl = overlay.querySelector('#cierre-modal-error');
          errEl.style.display = 'none';
          const fd = new FormData(e.target);
          submitBtn.disabled = true; submitBtn.textContent = 'Cerrando…';
          try {
            const { cerrarCaja } = await import('../services/finanzas.js');
            const res = await cerrarCaja(fd.get('sesionId'), fd.get('saldoDeclarado'));
            if (res.success) {
              showToast('Caja cerrada correctamente', 'success');
              import('../core/app.js').then(m => { m.invalidateCajaStatusCache?.(); m.updateCajaStatusIndicator?.(); });
              closeModal();
              this.fetchAndRender();
            } else {
              errEl.textContent = res.error || 'Error al cerrar caja';
              errEl.style.display = 'block';
              submitBtn.disabled = false; submitBtn.textContent = '🔒 Confirmar Cierre';
            }
          } catch (err) {
            errEl.textContent = err.message || 'Error inesperado';
            errEl.style.display = 'block';
            submitBtn.disabled = false; submitBtn.textContent = '🔒 Confirmar Cierre';
          }
        });
      });
    }

    // Caja form (manual movement)
    if (canAccess('finanzas-write') && data?.cajaSession) this._initCajaForm();
  }

  _initAperturaForm(form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      
      await guardBtn(btn, async () => {
        const errorEl = document.getElementById('apertura-error');
        if (errorEl) errorEl.style.display = 'none';

        const fd = new FormData(form);
        const res = await abrirCaja(fd.get('saldoInicial'));

        if (res.success) {
          showToast('Caja abierta correctamente', 'success');
          // Forzar refresco inmediato del indicador de caja en el navbar
          import('../core/app.js').then(m => { m.invalidateCajaStatusCache(); m.updateCajaStatusIndicator(); });
          this.fetchAndRender();
        } else {
          if (errorEl) { errorEl.textContent = res.error; errorEl.style.display = 'block'; }
          showToast(res.error || 'Error al abrir caja', 'error');
        }
      });
    });
  }

  _initCierreForm(form) {
    const inputContado  = document.getElementById('cierre-contado');
    const previewEl     = document.getElementById('cierre-dif-preview');
    const esperadoEl    = document.getElementById('cierre-esperado');

    if (inputContado && previewEl) {
      inputContado.addEventListener('input', () => {
        const contado   = Number(inputContado.value || 0);
        const esperado  = Number(form.elements['saldoEsperado']?.value || 0);
        const dif       = contado - esperado;
        const abs       = Math.abs(dif);
        const color     = abs === 0 ? 'var(--accent-green)' : abs < 1000 ? 'var(--accent-orange)' : 'var(--danger)';
        previewEl.innerHTML = `
          Diferencia: <strong style="color:${color};">${dif >= 0 ? '+' : ''}${ars(dif)}</strong>
          ${abs === 0 ? '&nbsp;✓ La caja cuadra' : ''}`;
        previewEl.style.borderColor = color;
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('cierre-submit-btn');

      await guardBtn(btn, async () => {
        const errorEl = document.getElementById('cierre-error');
        if (errorEl) errorEl.style.display = 'none';

        const fd = new FormData(form);
        const res = await cerrarCaja(fd.get('sesionId'), fd.get('saldoDeclarado'));

        if (res.success) {
          showToast('Caja cerrada correctamente', 'success');
          this._showCierre = false;
          // Forzar refresco inmediato del indicador de caja en el navbar
          import('../core/app.js').then(m => { m.invalidateCajaStatusCache(); m.updateCajaStatusIndicator(); });
          this.fetchAndRender();
        } else {
          if (errorEl) { errorEl.textContent = res.error; errorEl.style.display = 'block'; }
          showToast(res.error || 'Error al cerrar caja', 'error');
        }
      });
    });
  }

  _initCajaForm() {
    const form = document.getElementById('caja-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('caja-submit-btn');

      await guardBtn(btn, async () => {
        const fd    = new FormData(form);
        const data  = Object.fromEntries(fd.entries());
        const errEl = document.getElementById('caja-form-error');

        if (errEl) errEl.style.display = 'none';

        const result = await createCajaEntry(data, data.sesionId || null);

        if (result.success) {
          showToast('Movimiento registrado', 'success');
          form.reset();
          if (form.elements['sesionId']) form.elements['sesionId'].value = data.sesionId;
          await this.fetchAndRender();
        } else {
          showToast(result.error || 'Error al registrar', 'error');
          if (errEl) { errEl.textContent = result.error || 'Error al registrar'; errEl.style.display = 'block'; }
        }
      });
    });
  }

  destroy() {
    // Limpieza al desmontar la vista
    this._data = null;
  }
}
