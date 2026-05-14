import { AsyncView } from '../core/async-view.js';
import { getFinanzasData, createCajaEntry } from '../services/finanzas.js';
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

// ── View ──────────────────────────────────────────────────────────────────────

export class FinanzasView extends AsyncView {
  constructor() {
    super();
    this.containerId  = 'finanzas-container';
    this._data        = null;
    this._cajaPeriod  = 'today';
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async loadData() {
    this._data = await getFinanzasData();
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
    const { kpis, ticketsMasRentables, ultimosCobrados, distribucionPlanes,
            cajaHoy, cajaSemana, cajaDia, cajaSem, entregadosHoy } = data;
    const canWrite = canAccess('finanzas-write');

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

        <!-- Header -->
        <div class="flex-between" style="align-items:flex-end;flex-wrap:wrap;gap:var(--space-md);">
          <div style="flex:1;">${header}</div>
          <div style="display:flex;gap:var(--space-sm);">
            ${kpis.margenPct !== null ? this.renderMargenBadge(kpis.margenPct) : ''}
            <button class="btn btn-secondary btn-sm" id="fin-refresh">🔄 Actualizar</button>
          </div>
        </div>

        <!-- KPIs -->
        <section>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:var(--space-md);">
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
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:var(--space-xl);">
          ${this.renderTopTickets(ticketsMasRentables)}
          ${this.renderUltimosCobrados(ultimosCobrados)}
        </div>

        <!-- Plan distribution + Resumen diario -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:var(--space-xl);">
          ${this.renderPlanDistribucion(distribucionPlanes, kpis.totalTickets)}
          ${this.renderResumenDiario(cajaDia, cajaSem, entregadosHoy)}
        </div>

        <!-- Caja -->
        ${this.renderCajaSection(cajaHoy, cajaSemana, cajaDia, cajaSem, canWrite)}
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
        <div style="font-size:28px;font-weight:800;color:${color};line-height:1.1;margin-top:4px;
                    word-break:break-all;">${value}</div>
        ${sub ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${sub}</div>` : ''}
      </div>`;
  }

  renderMargenBadge(pctVal) {
    let cls = 'badge-green', label = '🟢 Alta rentabilidad';
    if (pctVal < 0)  { cls = 'badge-danger'; label = '🔴 Pérdida'; }
    else if (pctVal < 40) { cls = 'badge-orange'; label = '🟡 Margen bajo'; }
    return `<div class="badge ${cls}" style="align-self:center;">
      ${label} · ${pctVal}%
    </div>`;
  }

  // ── Top tickets ───────────────────────────────────────────────────────────

  renderTopTickets(tickets) {
    const prices = tickets.map(t => Number(t.precio || 0));
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
              const precio   = Number(t.precio || 0);
              const barW     = maxPrecio > 0 ? Math.round((precio / maxPrecio) * 100) : 0;
              const cliente  = [t.nombre, t.apellido].filter(Boolean).join(' ') || t.clienteId || '—';
              return `
                <div style="margin-bottom:var(--space-md);">
                  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
                    <div>
                      <span style="font-size:var(--font-xs);color:var(--accent-cyan);font-weight:700;">#${t.numeroOrden || '—'}</span>
                      <span style="font-size:var(--font-sm);color:var(--text-primary);font-weight:500;margin-left:8px;">${cliente}</span>
                    </div>
                    <span style="font-size:var(--font-md);font-weight:800;color:var(--accent-cyan);">${ars(precio)}</span>
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
                  <div style="min-width:0;">
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

  // ── Plan distribution CSS chart ────────────────────────────────────────────

  renderPlanDistribucion(dist, total) {
    const plans = [
      { key: 'estandar',  label: 'Estándar',  color: 'var(--accent-cyan)'   },
      { key: 'oro',       label: 'Oro',        color: '#fbbf24'              },
      { key: 'platinum',  label: 'Platinum',   color: '#a855f7'              },
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
          <!-- Balance -->
          <div style="text-align:center;padding:var(--space-lg);background:rgba(255,255,255,0.03);
                      border-radius:var(--radius-md);border:1px solid var(--border);">
            <div style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:4px;">BALANCE DEL DÍA</div>
            <div style="font-size:36px;font-weight:900;color:${balanceColor};line-height:1;">
              ${ars(cajaDia.balance)}
            </div>
          </div>

          <!-- Ingresos / Egresos -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-sm);">
            <div style="padding:var(--space-md);background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.2);
                        border-radius:var(--radius-md);text-align:center;">
              <div style="font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;">INGRESOS</div>
              <div style="font-size:var(--font-lg);font-weight:800;color:var(--accent-green);">${ars(cajaDia.ingresos)}</div>
            </div>
            <div style="padding:var(--space-md);background:rgba(249,115,22,0.07);border:1px solid rgba(249,115,22,0.2);
                        border-radius:var(--radius-md);text-align:center;">
              <div style="font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;">EGRESOS</div>
              <div style="font-size:var(--font-lg);font-weight:800;color:var(--accent-orange);">${ars(cajaDia.egresos)}</div>
            </div>
          </div>

          <!-- Entregas hoy -->
          <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-sm) 0;
                      border-top:1px solid var(--border);">
            <span style="font-size:var(--font-sm);color:var(--text-muted);">📦 Entregas hoy</span>
            <span style="font-size:var(--font-md);font-weight:700;color:var(--text-primary);">${entregadosHoy.length}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;
                      border-top:1px solid var(--border);padding-top:var(--space-sm);">
            <span style="font-size:var(--font-sm);color:var(--text-muted);">Balance semana</span>
            <span style="font-size:var(--font-md);font-weight:700;color:${cajaSem.balance >= 0 ? 'var(--accent-green)' : 'var(--danger)'};">
              ${ars(cajaSem.balance)}
            </span>
          </div>
        </div>
      </section>`;
  }

  // ── Caja section ───────────────────────────────────────────────────────────

  renderCajaSection(cajaHoy, cajaSemana, cajaDia, cajaSem, canWrite) {
    const activeEntries = this._cajaPeriod === 'today' ? cajaHoy : cajaSemana;

    return `
      <section class="card glass-card" style="padding:var(--space-lg);">
        <div class="flex-between" style="margin-bottom:var(--space-lg);flex-wrap:wrap;gap:var(--space-md);">
          <h3 style="font-size:var(--font-md);font-weight:700;display:flex;align-items:center;gap:8px;margin:0;">
            <span style="opacity:0.8;">🏦</span> Caja
          </h3>
          <!-- Period toggle -->
          <div style="display:flex;gap:4px;background:rgba(255,255,255,0.04);border:1px solid var(--border);
                      border-radius:var(--radius-md);padding:4px;">
            <button class="btn btn-sm caja-period-btn ${this._cajaPeriod === 'today' ? 'active' : ''}"
              data-period="today">Hoy</button>
            <button class="btn btn-sm caja-period-btn ${this._cajaPeriod === 'week' ? 'active' : ''}"
              data-period="week">Esta semana</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:var(--space-xl);">
          <!-- Formulario (admin / recepcion) -->
          ${canWrite ? this.renderCajaForm() : `
            <div style="display:flex;align-items:center;justify-content:center;padding:var(--space-xl);
                        color:var(--text-muted);font-size:var(--font-sm);border:1px dashed var(--border);
                        border-radius:var(--radius-md);">
              🔒 Solo recepción y admin pueden registrar movimientos.
            </div>`}

          <!-- Lista de entradas -->
          <div>
            <div style="font-size:var(--font-xs);color:var(--text-muted);font-weight:700;letter-spacing:0.5px;
                        margin-bottom:var(--space-md);">MOVIMIENTOS</div>
            <div id="caja-entries-list">
              ${this.renderCajaEntries(activeEntries)}
            </div>
          </div>
        </div>
      </section>`;
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
          <!-- Tipo -->
          <div style="display:flex;gap:var(--space-sm);">
            <label style="flex:1;display:flex;align-items:center;gap:8px;cursor:pointer;
                           padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius-md);
                           background:rgba(34,197,94,0.07);">
              <input type="radio" name="tipo" value="ingreso" checked
                style="accent-color:var(--accent-green);">
              <span style="font-size:var(--font-sm);font-weight:600;color:var(--accent-green);">💚 Ingreso</span>
            </label>
            <label style="flex:1;display:flex;align-items:center;gap:8px;cursor:pointer;
                           padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius-md);
                           background:rgba(249,115,22,0.07);">
              <input type="radio" name="tipo" value="egreso"
                style="accent-color:var(--accent-orange);">
              <span style="font-size:var(--font-sm);font-weight:600;color:var(--accent-orange);">🔴 Egreso</span>
            </label>
          </div>
          <!-- Descripción -->
          <input type="text" name="descripcion" class="input" placeholder="Descripción del movimiento..."
            style="margin:0;" required>
          <!-- Monto + Método -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-sm);">
            <input type="number" name="monto" class="input" placeholder="Monto $" min="1" style="margin:0;" required>
            <select name="metodoPago" class="input" style="margin:0;background:rgba(255,255,255,0.05);
                      border:1px solid var(--border);color:var(--text-primary);">
              <option value="efectivo">💵 Efectivo</option>
              <option value="transferencia">🏦 Transferencia</option>
              <option value="tarjeta">💳 Tarjeta</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary" id="caja-submit-btn">
            ＋ Registrar
          </button>
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
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:var(--space-sm) 0;border-bottom:1px solid var(--border);">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;">
            <span style="font-size:10px;font-weight:900;color:${color};flex-shrink:0;">${icon}</span>
            <div style="min-width:0;">
              <div style="font-size:var(--font-sm);color:var(--text-primary);font-weight:500;
                          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.descripcion}</div>
              <div style="font-size:var(--font-xs);color:var(--text-muted);">
                ${metodoLabel[e.metodoPago] || '—'} ${e.metodoPago || ''} · ${hora}
              </div>
            </div>
          </div>
          <div style="font-size:var(--font-md);font-weight:700;color:${color};flex-shrink:0;margin-left:12px;">
            ${isIngreso ? '+' : '−'}${ars(e.monto)}
          </div>
        </div>`;
    }).join('');
  }

  // ── Events ────────────────────────────────────────────────────────────────

  onContentReady(data) {
    // Refresh
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
          const entries = this._cajaPeriod === 'today'
            ? this._data.cajaHoy : this._data.cajaSemana;
          listEl.innerHTML = this.renderCajaEntries(entries);
        }
      });
    });

    // Caja form
    if (canAccess('finanzas-write')) this.initCajaForm();
  }

  initCajaForm() {
    const form = document.getElementById('caja-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd     = new FormData(form);
      const data   = Object.fromEntries(fd.entries());
      const btn    = document.getElementById('caja-submit-btn');
      const errEl  = document.getElementById('caja-form-error');

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
}
