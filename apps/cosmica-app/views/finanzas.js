import { AsyncView } from '../core/async-view.js';
import {
  getFinanzasData, createCajaEntry,
  openCajaSession, closeCajaSession,
  getCajaSessionHistory, getSessionTotals,
} from '../services/finanzas.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';
import { renderKPISkeletons, renderCardSkeletonList } from '../components/app-state.js';
import { showToast } from '../components/toast.js';
import { canAccess } from '../core/session.js';

// ── Format helpers ────────────────────────────────────────────────────────────

const ars = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-AR');
const pct = n => (Number(n || 0)).toFixed(1) + '%';

function fmtTs(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
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

// ── View ──────────────────────────────────────────────────────────────────────

export class FinanzasView extends AsyncView {
  constructor() {
    super();
    this.containerId  = 'finanzas-container';
    this._data        = null;
    this._cajaPeriod  = 'session';
    this._cierre      = null; // estado temporal del flujo de cierre
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async loadData() {
    const [data, historial] = await Promise.all([
      getFinanzasData(),
      getCajaSessionHistory(10),
    ]);
    this._data = { ...data, historial };
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
      cajaHoy, cajaSemana, cajaSession, cajaDia, cajaSem, cajaActual,
      entregadosHoy, activeSession, historial,
    } = data;
    const canWrite = canAccess('finanzas-write');

    // Si no hay sesión activa y el período era 'session', resetear a 'today'
    if (!activeSession && this._cajaPeriod === 'session') this._cajaPeriod = 'today';

    const breadcrumb = renderBreadcrumb([
      { label: 'Operaciones', href: '#dashboard', icon: '⚙️' },
      { label: 'Finanzas',   href: '#finanzas',  icon: '💰' },
    ]);
    const header = renderSectionHeader(
      'Centro Financiero',
      `Resumen operacional al ${new Date().toLocaleDateString('es-AR')}`,
      '💰 Finanzas'
    );

    return `
      <div class="animate-fade-in" style="display:flex;flex-direction:column;gap:var(--space-xl);">
        ${breadcrumb}

        <!-- Barra de estado de caja -->
        ${this.renderCajaStatusBar(activeSession, canWrite)}

        <!-- Header -->
        <div class="flex-between" style="align-items:flex-end;flex-wrap:wrap;gap:var(--space-md);">
          <div style="flex:1;">${header}</div>
          <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap;">
            ${kpis.margenPct !== null ? this.renderMargenBadge(kpis.margenPct) : ''}
            <button class="btn btn-secondary btn-sm" id="fin-refresh">🔄 Actualizar</button>
          </div>
        </div>

        <!-- KPIs -->
        <section>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--space-md);">
            ${this.renderKPI('FACTURADO', ars(kpis.facturacionConcretada), 'var(--accent-cyan)',   '💰', `${kpis.totalConPrecio} ticket${kpis.totalConPrecio !== 1 ? 's' : ''} cobrado${kpis.totalConPrecio !== 1 ? 's' : ''}`)}
            ${this.renderKPI('POTENCIAL', ars(kpis.facturacionPotencial),  'var(--accent-green)',  '📈', 'presupuestos aprobados')}
            ${this.renderKPI('REPUESTOS', ars(kpis.costoRepuestos),        'var(--accent-orange)', '🔩', 'costo en partes')}
            ${this.renderKPI('GANANCIA',  ars(kpis.gananciaEstimada),
              kpis.gananciaEstimada >= 0 ? 'var(--accent-green)' : 'var(--danger)',
              kpis.gananciaEstimada >= 0 ? '✨' : '⚠️', 'facturado − repuestos')}
            ${this.renderKPI('X COBRAR',  String(kpis.ticketsPendientesCobro), 'var(--accent-orange)', '⏳',
              `ticket${kpis.ticketsPendientesCobro !== 1 ? 's' : ''} listo${kpis.ticketsPendientesCobro !== 1 ? 's' : ''}`)}
            ${this.renderKPI('PROMEDIO',  ars(kpis.ticketPromedio),         'var(--text-muted)',   '📊', `de ${kpis.totalConPrecio} cobros`)}
          </div>
        </section>

        <!-- Top tickets + Últimos cobrados -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:var(--space-xl);">
          ${this.renderTopTickets(ticketsMasRentables)}
          ${this.renderUltimosCobrados(ultimosCobrados)}
        </div>

        <!-- Plan distribution + Resumen diario -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:var(--space-xl);">
          ${this.renderPlanDistribucion(distribucionPlanes, kpis.totalTickets)}
          ${this.renderResumenDiario(cajaDia, cajaSem, entregadosHoy)}
        </div>

        <!-- Caja operacional -->
        ${this.renderCajaSection(activeSession, cajaHoy, cajaSemana, cajaSession, cajaDia, cajaSem, cajaActual, canWrite)}

        <!-- Historial de cierres -->
        ${this.renderHistorialCierres(historial)}
      </div>`;
  }

  // ── Barra de estado de caja ───────────────────────────────────────────────

  renderCajaStatusBar(activeSession, canWrite) {
    if (activeSession) {
      const desde = fmtTime(activeSession.openedAt);
      const op    = activeSession.openedByName || '—';
      return `
        <div id="caja-status-bar" style="
          display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-sm);
          padding:var(--space-md) var(--space-lg);
          background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);
          border-radius:var(--radius-md);">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;
                         background:var(--accent-green);box-shadow:0 0 8px var(--accent-green);
                         animation:pulse 2s infinite;flex-shrink:0;"></span>
            <div>
              <span style="font-size:var(--font-sm);font-weight:700;color:var(--accent-green);">CAJA ABIERTA</span>
              <span style="font-size:var(--font-xs);color:var(--text-muted);margin-left:10px;">
                desde ${desde} · ${op} · saldo inicial ${ars(activeSession.saldoInicial)}
              </span>
            </div>
          </div>
          ${canWrite ? `<button class="btn btn-sm" id="btn-cerrar-caja"
            style="border:1px solid rgba(249,115,22,0.5);color:var(--accent-orange);background:rgba(249,115,22,0.08);">
            Cerrar caja
          </button>` : ''}
        </div>`;
    }

    return `
      <div id="caja-status-bar" style="
        display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-sm);
        padding:var(--space-md) var(--space-lg);
        background:rgba(255,0,0,0.06);border:1px solid rgba(255,0,0,0.2);
        border-radius:var(--radius-md);">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;
                       background:var(--danger);flex-shrink:0;"></span>
          <span style="font-size:var(--font-sm);font-weight:700;color:var(--danger);">CAJA CERRADA</span>
          <span style="font-size:var(--font-xs);color:var(--text-muted);">No hay caja activa</span>
        </div>
        ${canWrite ? `<button class="btn btn-sm btn-primary" id="btn-abrir-caja">
          + Abrir caja
        </button>` : ''}
      </div>`;
  }

  // ── KPI card ──────────────────────────────────────────────────────────────

  renderKPI(label, value, color, icon, sub = '') {
    return `
      <div class="card glass-card" style="display:flex;flex-direction:column;gap:var(--space-xs);
                  border-left:4px solid ${color};padding:var(--space-lg);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <span style="font-size:9px;color:var(--text-muted);font-weight:800;letter-spacing:0.8px;">${label}</span>
          <span style="font-size:18px;opacity:0.85;">${icon}</span>
        </div>
        <div style="font-size:clamp(20px,4vw,28px);font-weight:800;color:${color};line-height:1.1;margin-top:4px;
                    word-break:break-all;">${value}</div>
        ${sub ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${sub}</div>` : ''}
      </div>`;
  }

  renderMargenBadge(pctVal) {
    let cls = 'badge-green', label = '🟢 Alta rentabilidad';
    if (pctVal < 0)  { cls = 'badge-danger'; label = '🔴 Pérdida'; }
    else if (pctVal < 40) { cls = 'badge-orange'; label = '🟡 Margen bajo'; }
    return `<div class="badge ${cls}" style="align-self:center;white-space:nowrap;">
      ${label} · ${pctVal}%
    </div>`;
  }

  // ── Top tickets ───────────────────────────────────────────────────────────

  renderTopTickets(tickets) {
    const prices   = tickets.map(t => Number(t.precio || 0));
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
                  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;gap:8px;">
                    <div style="min-width:0;">
                      <span style="font-size:var(--font-xs);color:var(--accent-cyan);font-weight:700;white-space:nowrap;">#${t.numeroOrden || '—'}</span>
                      <span style="font-size:var(--font-sm);color:var(--text-primary);font-weight:500;margin-left:8px;
                                   overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${cliente}</span>
                    </div>
                    <span style="font-size:var(--font-md);font-weight:800;color:var(--accent-cyan);white-space:nowrap;flex-shrink:0;">${ars(precio)}</span>
                  </div>
                  <div style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:5px;">${t.equipo || '—'} ${t.marca || ''}</div>
                  <div style="background:rgba(255,255,255,0.05);border-radius:4px;height:5px;overflow:hidden;">
                    <div style="width:${barW}%;height:100%;background:var(--accent-cyan);border-radius:4px;transition:width 0.6s ease;"></div>
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
                            padding:var(--space-sm) 0;border-bottom:1px solid var(--border);gap:8px;">
                  <div style="min-width:0;flex:1;">
                    <div style="font-size:var(--font-sm);font-weight:600;color:var(--text-primary);
                                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cliente}</div>
                    <div style="font-size:var(--font-xs);color:var(--text-muted);">${t.equipo || '—'} · ${fecha}</div>
                  </div>
                  <div style="text-align:right;flex-shrink:0;">
                    <div style="font-size:var(--font-md);font-weight:700;color:var(--accent-green);white-space:nowrap;">${ars(t.precio)}</div>
                    ${t.totalRepuestos ? `<div style="font-size:var(--font-xs);color:var(--text-muted);white-space:nowrap;">−${ars(t.totalRepuestos)} rep.</div>` : ''}
                  </div>
                </div>`;
            }).join('')}
      </section>`;
  }

  // ── Plan distribution ──────────────────────────────────────────────────────

  renderPlanDistribucion(dist, total) {
    const plans = [
      { key: 'estandar', label: 'Estándar', color: 'var(--accent-cyan)'   },
      { key: 'oro',      label: 'Oro',      color: '#fbbf24'              },
      { key: 'platinum', label: 'Platinum', color: '#a855f7'              },
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
                    <div style="width:${barW}%;height:100%;background:${color};border-radius:6px;transition:width 0.7s ease;"></div>
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

  // ── Resumen diario ─────────────────────────────────────────────────────────

  renderResumenDiario(cajaDia, cajaSem, entregadosHoy) {
    const balanceColor = cajaDia.balance >= 0 ? 'var(--accent-green)' : 'var(--danger)';
    return `
      <section class="card glass-card" style="padding:var(--space-lg);">
        <div class="section-divider" style="margin-bottom:var(--space-lg);">
          <h3 style="font-size:var(--font-md);font-weight:700;display:flex;align-items:center;gap:8px;">
            <span style="opacity:0.8;">📅</span> Resumen de hoy
          </h3>
        </div>

        <div style="display:flex;flex-direction:column;gap:var(--space-md);">
          <div style="text-align:center;padding:var(--space-lg);background:rgba(255,255,255,0.03);
                      border-radius:var(--radius-md);border:1px solid var(--border);">
            <div style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:4px;">BALANCE DEL DÍA</div>
            <div style="font-size:clamp(24px,6vw,36px);font-weight:900;color:${balanceColor};line-height:1;">
              ${ars(cajaDia.balance)}
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-sm);">
            <div style="padding:var(--space-md);background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.2);
                        border-radius:var(--radius-md);text-align:center;">
              <div style="font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;">INGRESOS</div>
              <div style="font-size:var(--font-lg);font-weight:800;color:var(--accent-green);word-break:break-all;">${ars(cajaDia.ingresos)}</div>
            </div>
            <div style="padding:var(--space-md);background:rgba(249,115,22,0.07);border:1px solid rgba(249,115,22,0.2);
                        border-radius:var(--radius-md);text-align:center;">
              <div style="font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;">EGRESOS</div>
              <div style="font-size:var(--font-lg);font-weight:800;color:var(--accent-orange);word-break:break-all;">${ars(cajaDia.egresos)}</div>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-sm) 0;
                      border-top:1px solid var(--border);">
            <span style="font-size:var(--font-sm);color:var(--text-muted);">📦 Entregas hoy</span>
            <span style="font-size:var(--font-md);font-weight:700;color:var(--text-primary);">${entregadosHoy.length}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border);padding-top:var(--space-sm);">
            <span style="font-size:var(--font-sm);color:var(--text-muted);">Balance semana</span>
            <span style="font-size:var(--font-md);font-weight:700;color:${cajaSem.balance >= 0 ? 'var(--accent-green)' : 'var(--danger)'};">
              ${ars(cajaSem.balance)}
            </span>
          </div>
        </div>
      </section>`;
  }

  // ── Sección caja operacional ───────────────────────────────────────────────

  renderCajaSection(activeSession, cajaHoy, cajaSemana, cajaSession, cajaDia, cajaSem, cajaActual, canWrite) {
    const periodo = this._cajaPeriod;
    let activeEntries;
    if (periodo === 'session') activeEntries = cajaSession;
    else if (periodo === 'today') activeEntries = cajaHoy;
    else activeEntries = cajaSemana;

    const summaryData = periodo === 'session' ? cajaActual
      : periodo === 'today' ? cajaDia : cajaSem;

    return `
      <section class="card glass-card" style="padding:var(--space-lg);">
        <div class="flex-between" style="margin-bottom:var(--space-lg);flex-wrap:wrap;gap:var(--space-md);">
          <h3 style="font-size:var(--font-md);font-weight:700;display:flex;align-items:center;gap:8px;margin:0;">
            <span style="opacity:0.8;">🏦</span> Caja
            ${activeSession
              ? `<span class="badge badge-green" style="font-size:9px;white-space:nowrap;">ABIERTA</span>`
              : `<span class="badge badge-danger" style="font-size:9px;white-space:nowrap;">CERRADA</span>`}
          </h3>
          <div style="display:flex;gap:4px;background:rgba(255,255,255,0.04);border:1px solid var(--border);
                      border-radius:var(--radius-md);padding:4px;flex-wrap:wrap;">
            ${activeSession ? `<button class="btn btn-sm caja-period-btn ${periodo === 'session' ? 'active' : ''}" data-period="session">Sesión</button>` : ''}
            <button class="btn btn-sm caja-period-btn ${periodo === 'today' ? 'active' : ''}" data-period="today">Hoy</button>
            <button class="btn btn-sm caja-period-btn ${periodo === 'week' ? 'active' : ''}" data-period="week">Semana</button>
          </div>
        </div>

        <!-- Summary cards de la sesión/período -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-sm);margin-bottom:var(--space-lg);">
          ${this.renderCajaSummaryCard('Ingresos', ars(summaryData.ingresos), 'var(--accent-green)', 'rgba(34,197,94,0.07)', 'rgba(34,197,94,0.2)')}
          ${this.renderCajaSummaryCard('Egresos', ars(summaryData.egresos), 'var(--accent-orange)', 'rgba(249,115,22,0.07)', 'rgba(249,115,22,0.2)')}
          ${this.renderCajaSummaryCard('Balance', ars(summaryData.balance),
            summaryData.balance >= 0 ? 'var(--accent-green)' : 'var(--danger)',
            summaryData.balance >= 0 ? 'rgba(34,197,94,0.07)' : 'rgba(255,0,0,0.07)',
            summaryData.balance >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(255,0,0,0.2)')}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:var(--space-xl);">
          <!-- Formulario (solo si hay caja abierta y tiene permiso) -->
          ${canWrite
            ? (activeSession ? this.renderCajaForm() : this.renderCajaCerradaMsg())
            : `<div style="display:flex;align-items:center;justify-content:center;padding:var(--space-xl);
                         color:var(--text-muted);font-size:var(--font-sm);border:1px dashed var(--border);
                         border-radius:var(--radius-md);">
                 🔒 Solo recepción y admin pueden registrar movimientos.
               </div>`}

          <!-- Lista de movimientos -->
          <div>
            <div style="font-size:var(--font-xs);color:var(--text-muted);font-weight:700;letter-spacing:0.5px;
                        margin-bottom:var(--space-md);">MOVIMIENTOS</div>
            <div id="caja-entries-list" style="max-height:340px;overflow-y:auto;">
              ${this.renderCajaEntries(activeEntries)}
            </div>
          </div>
        </div>
      </section>`;
  }

  renderCajaSummaryCard(label, value, color, bg, border) {
    return `
      <div style="padding:var(--space-md);background:${bg};border:1px solid ${border};
                  border-radius:var(--radius-md);text-align:center;min-width:0;">
        <div style="font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;margin-bottom:4px;">${label}</div>
        <div style="font-size:var(--font-md);font-weight:800;color:${color};word-break:break-all;">${value}</div>
      </div>`;
  }

  renderCajaCerradaMsg() {
    return `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-md);
                  padding:var(--space-xl);border:1px dashed var(--border);border-radius:var(--radius-md);">
        <div style="font-size:32px;">🔒</div>
        <div style="font-size:var(--font-sm);color:var(--text-muted);text-align:center;">
          La caja está cerrada.<br>Abrila para registrar movimientos.
        </div>
        <button class="btn btn-primary btn-sm" id="btn-abrir-caja-2">+ Abrir caja</button>
      </div>`;
  }

  renderCajaForm() {
    return `
      <div>
        <div style="font-size:var(--font-xs);color:var(--text-muted);font-weight:700;letter-spacing:0.5px;
                    margin-bottom:var(--space-md);">REGISTRAR MOVIMIENTO</div>
        <div id="caja-form-error" class="badge badge-danger"
          style="display:none;margin-bottom:var(--space-md);padding:var(--space-sm);width:100%;text-align:center;
                 background:rgba(255,0,127,0.1);border:1px solid var(--danger);border-radius:var(--radius-sm);">
        </div>
        <form id="caja-form" style="display:flex;flex-direction:column;gap:var(--space-md);">
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
              <option value="tarjeta">💳 Tarjeta</option>
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

    const metodoLabel = { efectivo: '💵', transferencia: '🏦', tarjeta: '💳' };

    return entries.map(e => {
      const isIngreso = e.tipo === 'ingreso';
      const color     = isIngreso ? 'var(--accent-green)' : 'var(--accent-orange)';
      const icon      = isIngreso ? '▲' : '▼';
      const hora      = fmtTime(e.createdAt);
      const origenTag = e.origen === 'ticket'
        ? `<span style="font-size:8px;background:rgba(34,211,238,0.15);color:var(--accent-cyan);
                        padding:1px 5px;border-radius:3px;margin-left:4px;white-space:nowrap;">TICKET</span>`
        : '';
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:var(--space-sm) 0;border-bottom:1px solid var(--border);gap:8px;">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">
            <span style="font-size:10px;font-weight:900;color:${color};flex-shrink:0;">${icon}</span>
            <div style="min-width:0;">
              <div style="font-size:var(--font-sm);color:var(--text-primary);font-weight:500;
                          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${e.descripcion}${origenTag}
              </div>
              <div style="font-size:var(--font-xs);color:var(--text-muted);">
                ${metodoLabel[e.metodoPago] || '—'} ${e.metodoPago || ''} · ${hora}
              </div>
            </div>
          </div>
          <div style="font-size:var(--font-md);font-weight:700;color:${color};flex-shrink:0;white-space:nowrap;">
            ${isIngreso ? '+' : '−'}${ars(e.monto)}
          </div>
        </div>`;
    }).join('');
  }

  // ── Flujo apertura de caja (inline) ───────────────────────────────────────

  renderAperturaCajaModal() {
    return `
      <div id="apertura-overlay" style="
        position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;
        display:flex;align-items:center;justify-content:center;padding:var(--space-md);">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);
                    padding:var(--space-xl);width:100%;max-width:400px;box-shadow:0 24px 64px rgba(0,0,0,0.5);">
          <h3 style="margin:0 0 var(--space-md);font-size:var(--font-lg);font-weight:700;">
            🏦 Apertura de caja
          </h3>
          <p style="font-size:var(--font-sm);color:var(--text-muted);margin-bottom:var(--space-lg);">
            Ingresá el saldo inicial en efectivo que hay en la caja al momento de la apertura.
          </p>
          <div id="apertura-error" style="display:none;margin-bottom:var(--space-md);padding:var(--space-sm);
               background:rgba(255,0,0,0.1);border:1px solid var(--danger);border-radius:var(--radius-sm);
               font-size:var(--font-sm);color:var(--danger);"></div>
          <div style="margin-bottom:var(--space-md);">
            <label style="font-size:var(--font-xs);color:var(--text-muted);font-weight:700;letter-spacing:0.5px;
                          display:block;margin-bottom:6px;">SALDO INICIAL ($)</label>
            <input id="apertura-saldo" type="number" class="input" min="0" value="0"
              placeholder="0" style="margin:0;width:100%;box-sizing:border-box;">
          </div>
          <div style="display:flex;gap:var(--space-sm);">
            <button class="btn btn-secondary" id="apertura-cancel" style="flex:1;">Cancelar</button>
            <button class="btn btn-primary" id="apertura-confirm" style="flex:1;">Abrir caja</button>
          </div>
        </div>
      </div>`;
  }

  // ── Flujo cierre de caja ───────────────────────────────────────────────────

  renderCierreCajaModal(activeSession, sessionTotals) {
    const { ingresos, egresos } = sessionTotals;
    const saldoSistema = (activeSession.saldoInicial || 0) + ingresos - egresos;
    return `
      <div id="cierre-overlay" style="
        position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;
        display:flex;align-items:center;justify-content:center;padding:var(--space-md);">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);
                    padding:var(--space-xl);width:100%;max-width:440px;box-shadow:0 24px 64px rgba(0,0,0,0.5);">
          <h3 style="margin:0 0 var(--space-md);font-size:var(--font-lg);font-weight:700;">
            🔒 Cierre de caja
          </h3>

          <!-- Resumen de la sesión -->
          <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);
                      border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-lg);">
            <div style="font-size:var(--font-xs);color:var(--text-muted);font-weight:700;letter-spacing:0.5px;
                        margin-bottom:var(--space-sm);">RESUMEN DE SESIÓN</div>
            ${this.renderCierreRow('Saldo inicial',  ars(activeSession.saldoInicial || 0), 'var(--text-primary)')}
            ${this.renderCierreRow('Ingresos sesión', '+' + ars(ingresos), 'var(--accent-green)')}
            ${this.renderCierreRow('Egresos sesión',  '−' + ars(egresos),  'var(--accent-orange)')}
            <div style="border-top:1px solid var(--border);margin:var(--space-sm) 0;"></div>
            ${this.renderCierreRow('Saldo esperado', ars(saldoSistema), 'var(--accent-cyan)', true)}
          </div>

          <!-- Monto real contado -->
          <div style="margin-bottom:var(--space-md);">
            <label style="font-size:var(--font-xs);color:var(--text-muted);font-weight:700;letter-spacing:0.5px;
                          display:block;margin-bottom:6px;">MONTO CONTADO REAL ($)</label>
            <input id="cierre-declarado" type="number" class="input" min="0"
              placeholder="Ingresá el monto físico contado"
              style="margin:0;width:100%;box-sizing:border-box;">
          </div>

          <!-- Diferencia calculada en vivo -->
          <div id="cierre-diferencia-display" style="
            padding:var(--space-sm) var(--space-md);border-radius:var(--radius-sm);
            background:rgba(255,255,255,0.04);border:1px solid var(--border);
            margin-bottom:var(--space-lg);font-size:var(--font-sm);text-align:center;">
            Ingresá el monto para ver la diferencia
          </div>

          <div id="cierre-error" style="display:none;margin-bottom:var(--space-md);padding:var(--space-sm);
               background:rgba(255,0,0,0.1);border:1px solid var(--danger);border-radius:var(--radius-sm);
               font-size:var(--font-sm);color:var(--danger);"></div>

          <div style="display:flex;gap:var(--space-sm);">
            <button class="btn btn-secondary" id="cierre-cancel" style="flex:1;">Cancelar</button>
            <button class="btn btn-primary" id="cierre-confirm" style="flex:1;"
              style="background:var(--accent-orange);">Confirmar cierre</button>
          </div>
          <input type="hidden" id="cierre-session-id" value="${activeSession.id}">
          <input type="hidden" id="cierre-saldo-sistema" value="${saldoSistema}">
        </div>
      </div>`;
  }

  renderCierreRow(label, value, color, bold = false) {
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;">
        <span style="font-size:var(--font-sm);color:var(--text-muted);">${label}</span>
        <span style="font-size:var(--font-sm);font-weight:${bold ? '800' : '600'};color:${color};">${value}</span>
      </div>`;
  }

  // ── Historial de cierres ──────────────────────────────────────────────────

  renderHistorialCierres(historial) {
    if (!historial || historial.length === 0) {
      return `
        <section class="card glass-card" style="padding:var(--space-lg);">
          <h3 style="font-size:var(--font-md);font-weight:700;margin:0 0 var(--space-lg);">
            📜 Historial de cierres
          </h3>
          <div style="text-align:center;padding:var(--space-xl);color:var(--text-muted);font-size:var(--font-sm);">
            No hay cierres registrados aún.
          </div>
        </section>`;
    }

    return `
      <section class="card glass-card" style="padding:var(--space-lg);">
        <h3 style="font-size:var(--font-md);font-weight:700;margin:0 0 var(--space-lg);">
          📜 Historial de cierres
        </h3>
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
          <table style="width:100%;border-collapse:collapse;min-width:600px;">
            <thead>
              <tr style="border-bottom:1px solid var(--border);">
                ${['Fecha cierre','Operador','Saldo inicial','Ingresos','Egresos','Saldo sistema','Declarado','Diferencia'].map(h =>
                  `<th style="padding:8px 12px;text-align:left;font-size:9px;color:var(--text-muted);
                              font-weight:700;letter-spacing:0.5px;white-space:nowrap;">${h}</th>`
                ).join('')}
              </tr>
            </thead>
            <tbody>
              ${historial.map(s => this.renderHistorialRow(s)).join('')}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  renderHistorialRow(s) {
    const dif     = Number(s.diferencia || 0);
    const absDif  = Math.abs(dif);
    let difBadge;
    if (absDif === 0) {
      difBadge = `<span class="badge badge-green" style="white-space:nowrap;">✓ Cuadra</span>`;
    } else if (absDif <= 500) {
      difBadge = `<span class="badge badge-orange" style="white-space:nowrap;">${dif > 0 ? '+' : ''}${ars(dif)}</span>`;
    } else {
      difBadge = `<span class="badge badge-danger" style="white-space:nowrap;">${dif > 0 ? '+' : ''}${ars(dif)}</span>`;
    }

    const tdStyle = 'padding:10px 12px;font-size:var(--font-sm);border-bottom:1px solid var(--border);white-space:nowrap;';

    return `
      <tr>
        <td style="${tdStyle}color:var(--text-muted);">${fmtDate(s.closedAt)}</td>
        <td style="${tdStyle}color:var(--text-primary);font-weight:500;">${s.closedByName || '—'}</td>
        <td style="${tdStyle}color:var(--text-primary);">${ars(s.saldoInicial)}</td>
        <td style="${tdStyle}color:var(--accent-green);">+${ars(s.ingresosSistema)}</td>
        <td style="${tdStyle}color:var(--accent-orange);">−${ars(s.egresosSistema)}</td>
        <td style="${tdStyle}color:var(--accent-cyan);font-weight:700;">${ars(s.saldoFinalSistema)}</td>
        <td style="${tdStyle}color:var(--text-primary);">${ars(s.saldoFinalDeclarado)}</td>
        <td style="${tdStyle}">${difBadge}</td>
      </tr>`;
  }

  // ── Events ────────────────────────────────────────────────────────────────

  onContentReady(data) {
    const refreshBtn = document.getElementById('fin-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this.fetchAndRender());

    // Period toggle
    document.querySelectorAll('.caja-period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._cajaPeriod = btn.dataset.period;
        document.querySelectorAll('.caja-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const listEl = document.getElementById('caja-entries-list');
        if (listEl && this._data) {
          let entries;
          if (this._cajaPeriod === 'session') entries = this._data.cajaSession;
          else if (this._cajaPeriod === 'today') entries = this._data.cajaHoy;
          else entries = this._data.cajaSemana;
          listEl.innerHTML = this.renderCajaEntries(entries);
        }
      });
    });

    // Caja form
    if (canAccess('finanzas-write')) {
      this.initCajaForm();
      this.initAperturaCaja();
      this.initCierreCaja();
    }
  }

  initCajaForm() {
    const form = document.getElementById('caja-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd    = new FormData(form);
      const data  = Object.fromEntries(fd.entries());
      const btn   = document.getElementById('caja-submit-btn');
      const errEl = document.getElementById('caja-form-error');

      if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }
      if (errEl) errEl.style.display = 'none';

      const result = await createCajaEntry(data);

      if (result.success) {
        showToast('Movimiento registrado', 'success');
        form.reset();
        await this.fetchAndRender();
      } else {
        showToast(result.error || 'Error al registrar', 'error');
        if (errEl) { errEl.textContent = result.error || 'Error al registrar'; errEl.style.display = 'block'; }
        if (btn) { btn.disabled = false; btn.textContent = '＋ Registrar'; }
      }
    });
  }

  initAperturaCaja() {
    const bindOpen = (btnId) => {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.addEventListener('click', () => {
        document.body.insertAdjacentHTML('beforeend', this.renderAperturaCajaModal());
        this._bindAperturaModal();
      });
    };
    bindOpen('btn-abrir-caja');
    bindOpen('btn-abrir-caja-2');
  }

  _bindAperturaModal() {
    const overlay  = document.getElementById('apertura-overlay');
    const cancelBtn = document.getElementById('apertura-cancel');
    const confirmBtn = document.getElementById('apertura-confirm');
    const errEl    = document.getElementById('apertura-error');
    const saldoEl  = document.getElementById('apertura-saldo');

    const close = () => overlay?.remove();

    cancelBtn?.addEventListener('click', close);
    overlay?.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    confirmBtn?.addEventListener('click', async () => {
      if (errEl) errEl.style.display = 'none';
      confirmBtn.disabled = true;
      confirmBtn.textContent = '⏳ Abriendo...';

      try {
        const saldoInicial = Number(saldoEl?.value || 0);
        await openCajaSession({ saldoInicial });
        showToast('Caja abierta correctamente', 'success');
        close();
        await this.fetchAndRender();
      } catch (err) {
        if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Abrir caja';
      }
    });
  }

  initCierreCaja() {
    const btn = document.getElementById('btn-cerrar-caja');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const activeSession = this._data?.activeSession;
      if (!activeSession) return;

      btn.disabled = true;
      btn.textContent = '⏳ Calculando...';

      try {
        const totales = await getSessionTotals(activeSession.id);
        document.body.insertAdjacentHTML('beforeend', this.renderCierreCajaModal(activeSession, totales));
        this._bindCierreModal();
      } catch (err) {
        showToast('Error al calcular totales: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Cerrar caja';
      }
    });
  }

  _bindCierreModal() {
    const overlay    = document.getElementById('cierre-overlay');
    const cancelBtn  = document.getElementById('cierre-cancel');
    const confirmBtn = document.getElementById('cierre-confirm');
    const errEl      = document.getElementById('cierre-error');
    const declaradoEl = document.getElementById('cierre-declarado');
    const difDisplay  = document.getElementById('cierre-diferencia-display');
    const sessionIdEl = document.getElementById('cierre-session-id');
    const saldoSisEl  = document.getElementById('cierre-saldo-sistema');

    const saldoSistema = Number(saldoSisEl?.value || 0);
    const close = () => overlay?.remove();

    cancelBtn?.addEventListener('click', close);
    overlay?.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // Diferencia en vivo
    declaradoEl?.addEventListener('input', () => {
      if (!difDisplay) return;
      const declarado = Number(declaradoEl.value);
      if (isNaN(declarado) || declaradoEl.value === '') {
        difDisplay.textContent = 'Ingresá el monto para ver la diferencia';
        difDisplay.style.color = 'var(--text-muted)';
        return;
      }
      const dif = declarado - saldoSistema;
      const absD = Math.abs(dif);
      let color = 'var(--accent-green)', badge = '✓ Cuadra exacto';
      if (absD > 500) { color = 'var(--danger)'; badge = `Diferencia importante: ${dif > 0 ? '+' : ''}${ars(dif)}`; }
      else if (absD > 0) { color = 'var(--accent-orange)'; badge = `Diferencia leve: ${dif > 0 ? '+' : ''}${ars(dif)}`; }
      difDisplay.textContent = badge;
      difDisplay.style.color = color;
    });

    confirmBtn?.addEventListener('click', async () => {
      if (errEl) errEl.style.display = 'none';
      const declarado = Number(declaradoEl?.value);
      if (isNaN(declarado) || declaradoEl?.value === '') {
        if (errEl) { errEl.textContent = 'Ingresá el monto contado.'; errEl.style.display = 'block'; }
        return;
      }

      confirmBtn.disabled = true;
      confirmBtn.textContent = '⏳ Cerrando...';

      try {
        await closeCajaSession(sessionIdEl.value, declarado);
        showToast('Caja cerrada correctamente', 'success');
        close();
        await this.fetchAndRender();
      } catch (err) {
        if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirmar cierre';
      }
    });
  }
}
