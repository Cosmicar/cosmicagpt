/**
 * Drift Detection — vista admin para detectar inconsistencias entrega ↔ caja.
 *
 * Tres categorías:
 *   1. Tickets ENTREGADOS con precio > 0 que NO tienen asiento de caja tipo='ingreso'.
 *   2. Asientos de caja origen='ticket' cuyo ticketRef ya no existe (orphan).
 *   3. Tickets ENTREGADOS cuyo asiento de caja tiene monto distinto al precio del ticket.
 *
 * También muestra los últimos eventos relevantes de system_logs.
 *
 * Solo accesible para admin. Read-only: solo señala problemas, no los arregla
 * automáticamente — la corrección es manual desde la vista Finanzas (createCajaEntry
 * con pendingReconciliation: true).
 */

import { AsyncView } from '../core/async-view.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { getCurrentSession } from '../core/session.js';
import { getTickets } from '../services/tickets.js';
import { getCajaEntries } from '../services/finanzas.js';
import { WORK_STATUS } from '../../../js/domain.js';
import {
  collection, query, orderBy, limit, getDocs
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { db } from "../../../js/firebase.js";

const ars = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-AR');

function fmtTs(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export class DriftDetectionView extends AsyncView {
  constructor(params) {
    super(params);
    this.containerId = 'drift-detection-container';
  }

  async loadData() {
    const rol = getCurrentSession()?.profile?.rol;
    if (rol !== 'admin' && rol !== 'tester') {
      throw new Error('Acceso restringido a administradores.');
    }

    // Paralelizamos las tres lecturas. system_logs solo trae los últimos 50.
    const [tickets, cajaEntries, logsSnap] = await Promise.all([
      getTickets(),
      getCajaEntries(),
      getDocs(query(
        collection(db, 'system_logs'),
        orderBy('ts', 'desc'),
        limit(50)
      )).catch(err => {
        console.warn('[drift] no se pudieron leer system_logs:', err.message);
        return { docs: [] };
      }),
    ]);

    // ── Indexar caja por ticketRef para lookups O(1) ────────────────────────
    const cajaPorTicket = new Map();
    for (const entry of cajaEntries) {
      if (!entry.ticketRef) continue;
      if (!cajaPorTicket.has(entry.ticketRef)) cajaPorTicket.set(entry.ticketRef, []);
      cajaPorTicket.get(entry.ticketRef).push(entry);
    }

    const ticketIds = new Set(tickets.map(t => t.id));

    // ── Categoría 1: entregados con precio sin caja ─────────────────────────
    const entregadosSinCaja = [];
    for (const t of tickets) {
      if (t.estado !== WORK_STATUS.entregado) continue;
      const precio = Number(t.precio || 0);
      if (precio <= 0) continue;

      const asientos = cajaPorTicket.get(t.id) || [];
      const tieneIngreso = asientos.some(a => a.tipo === 'ingreso');
      if (!tieneIngreso) entregadosSinCaja.push(t);
    }

    // ── Categoría 2: caja huérfana (ticketRef no existe) ────────────────────
    const cajaHuerfana = cajaEntries.filter(e =>
      e.origen === 'ticket' && e.ticketRef && !ticketIds.has(e.ticketRef)
    );

    // ── Categoría 3: monto desalineado ──────────────────────────────────────
    const montoDesalineado = [];
    for (const t of tickets) {
      if (t.estado !== WORK_STATUS.entregado) continue;
      const precio = Number(t.precio || 0);
      if (precio <= 0) continue;

      const ingresos = (cajaPorTicket.get(t.id) || []).filter(a => a.tipo === 'ingreso');
      if (ingresos.length === 0) continue; // ya cubierto en categoría 1
      const totalCaja = ingresos.reduce((s, a) => s + Number(a.monto || 0), 0);
      if (Math.abs(totalCaja - precio) >= 1) {
        montoDesalineado.push({ ticket: t, totalCaja, precio, delta: totalCaja - precio });
      }
    }

    const logs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return { entregadosSinCaja, cajaHuerfana, montoDesalineado, logs };
  }

  renderContent(data) {
    const { entregadosSinCaja, cajaHuerfana, montoDesalineado, logs } = data;
    const total = entregadosSinCaja.length + cajaHuerfana.length + montoDesalineado.length;

    const breadcrumb = renderBreadcrumb([
      { label: 'Administración', href: '#dashboard', icon: '🛡️' },
      { label: 'Drift Detection', href: '#drift', icon: '🔍' }
    ]);

    return `
      ${breadcrumb}
      ${renderSectionHeader(
        'Drift Detection',
        'Inconsistencias entre tickets entregados y movimientos de caja. Read-only — corrección manual desde Finanzas.',
        '🛡️ Admin'
      )}

      <div style="margin-top:var(--space-lg);display:flex;flex-direction:column;gap:var(--space-xl);">

        <!-- Banner de resumen -->
        <div class="card glass-card" style="display:flex;align-items:center;gap:var(--space-lg);padding:var(--space-lg);
            border-left: 4px solid ${total === 0 ? 'var(--accent-green)' : 'var(--danger)'};">
          <div style="font-size:32px;">${total === 0 ? '✅' : '⚠️'}</div>
          <div style="flex:1;">
            <div style="font-size:var(--font-lg);font-weight:700;color:var(--text-primary);">
              ${total === 0 ? 'Sin drift detectado' : `${total} inconsistencia${total > 1 ? 's' : ''} detectada${total > 1 ? 's' : ''}`}
            </div>
            <div style="font-size:var(--font-sm);color:var(--text-muted);margin-top:4px;">
              ${total === 0
                ? 'Todos los tickets entregados tienen su asiento de caja correspondiente.'
                : 'Revisá cada sección y corregí manualmente desde Finanzas si corresponde.'}
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" id="drift-refresh">🔄 Re-escanear</button>
        </div>

        ${this._renderCategory(
          'Entregados sin caja',
          'Ticket marcado Entregado con precio > 0, pero sin asiento de caja tipo ingreso.',
          'var(--danger)',
          entregadosSinCaja,
          (t) => `
            <td style="padding:8px;font-family:var(--font-mono);">#${t.numeroOrden || '—'}</td>
            <td style="padding:8px;">${[t.nombre, t.apellido].filter(Boolean).join(' ') || '—'}</td>
            <td style="padding:8px;color:var(--text-muted);">${t.equipo || '—'}</td>
            <td style="padding:8px;text-align:right;font-weight:700;color:var(--danger);">${ars(t.precio)}</td>
            <td style="padding:8px;color:var(--text-muted);font-size:11px;">${fmtTs(t.fechaEntregado)}</td>
            <td style="padding:8px;"><a href="#ticket-edit?id=${t.id}" class="btn btn-sm btn-primary">Abrir</a></td>
          `,
          ['Orden', 'Cliente', 'Equipo', 'Precio', 'Entregado', '']
        )}

        ${this._renderCategory(
          'Caja huérfana',
          'Asiento de caja con origen ticket cuyo ticketRef ya no existe en la base.',
          'var(--accent-orange)',
          cajaHuerfana,
          (e) => `
            <td style="padding:8px;font-family:var(--font-mono);font-size:11px;">${e.id.slice(0, 8)}…</td>
            <td style="padding:8px;color:var(--text-muted);">${e.descripcion || '—'}</td>
            <td style="padding:8px;text-align:right;font-weight:700;">${ars(e.monto)}</td>
            <td style="padding:8px;color:var(--text-muted);">${e.metodoPago || '—'}</td>
            <td style="padding:8px;color:var(--text-muted);font-size:11px;">${fmtTs(e.createdAt)}</td>
            <td style="padding:8px;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">${(e.ticketRef || '').slice(0, 8)}…</td>
          `,
          ['Asiento', 'Descripción', 'Monto', 'Método', 'Creado', 'TicketRef']
        )}

        ${this._renderCategory(
          'Monto desalineado',
          'El total registrado en caja para el ticket difiere del precio del ticket.',
          'var(--accent-orange)',
          montoDesalineado,
          (row) => `
            <td style="padding:8px;font-family:var(--font-mono);">#${row.ticket.numeroOrden || '—'}</td>
            <td style="padding:8px;">${[row.ticket.nombre, row.ticket.apellido].filter(Boolean).join(' ') || '—'}</td>
            <td style="padding:8px;text-align:right;">${ars(row.precio)}</td>
            <td style="padding:8px;text-align:right;">${ars(row.totalCaja)}</td>
            <td style="padding:8px;text-align:right;font-weight:700;color:${row.delta > 0 ? 'var(--accent-green)' : 'var(--danger)'};">${row.delta > 0 ? '+' : ''}${ars(row.delta)}</td>
            <td style="padding:8px;"><a href="#ticket-edit?id=${row.ticket.id}" class="btn btn-sm btn-primary">Abrir</a></td>
          `,
          ['Orden', 'Cliente', 'Precio ticket', 'Total caja', 'Δ', '']
        )}

        <!-- System logs feed -->
        <div class="card glass-card" style="padding:var(--space-lg);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md);">
            <div>
              <h3 style="margin:0;font-size:var(--font-md);font-weight:700;">Últimos eventos del sistema</h3>
              <p style="margin:4px 0 0;font-size:var(--font-xs);color:var(--text-muted);">
                ${logs.length} eventos · más recientes primero
              </p>
            </div>
          </div>
          ${logs.length === 0 ? `
            <div style="padding:var(--space-lg);text-align:center;color:var(--text-muted);font-size:var(--font-sm);">
              No hay eventos registrados aún.
            </div>
          ` : `
            <div style="max-height:400px;overflow-y:auto;font-family:var(--font-mono);font-size:11px;line-height:1.6;">
              ${logs.map(l => `
                <div style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;gap:10px;align-items:flex-start;">
                  <span style="color:${this._levelColor(l.level)};font-weight:700;min-width:48px;">${(l.level || 'info').toUpperCase()}</span>
                  <span style="color:var(--text-muted);min-width:130px;flex-shrink:0;">${fmtTs(l.ts)}</span>
                  <span style="color:var(--accent-cyan);min-width:240px;flex-shrink:0;">${l.event}</span>
                  <span style="color:var(--text-muted);flex:1;word-break:break-all;">${this._stringifyData(l.data)}</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  }

  _renderCategory(title, desc, color, rows, rowFn, headers) {
    return `
      <div class="card glass-card" style="padding:var(--space-lg);border-left:3px solid ${color};">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md);">
          <div>
            <h3 style="margin:0;font-size:var(--font-md);font-weight:700;color:${color};">
              ${title}
              <span style="margin-left:8px;font-size:12px;color:var(--text-muted);font-weight:500;">(${rows.length})</span>
            </h3>
            <p style="margin:4px 0 0;font-size:var(--font-xs);color:var(--text-muted);">${desc}</p>
          </div>
        </div>
        ${rows.length === 0 ? `
          <div style="padding:var(--space-md);text-align:center;color:var(--text-muted);font-size:var(--font-sm);">
            ✓ Sin problemas en esta categoría.
          </div>
        ` : `
          <div style="overflow-x:auto;">
            <table style="width:100%;min-width:600px;border-collapse:collapse;font-size:13px;">
              <thead>
                <tr style="text-align:left;color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid var(--border);">
                  ${headers.map(h => `<th style="padding:8px;font-weight:600;">${h}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${rows.map(r => `<tr style="border-bottom:1px solid rgba(255,255,255,0.03);">${rowFn(r)}</tr>`).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }

  _levelColor(level) {
    if (level === 'error') return 'var(--danger)';
    if (level === 'warn')  return 'var(--accent-orange)';
    return 'var(--accent-cyan)';
  }

  _stringifyData(data) {
    if (data === null || data === undefined) return '—';
    try {
      const str = JSON.stringify(data);
      return str.length > 200 ? str.slice(0, 200) + '…' : str;
    } catch {
      return '[unsanitizable]';
    }
  }

  onContentReady() {
    const btn = document.getElementById('drift-refresh');
    if (btn) btn.addEventListener('click', () => this.fetchAndRender());
  }
}
