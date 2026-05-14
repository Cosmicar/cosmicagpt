import { AsyncView } from '../core/async-view.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';
import { renderFormField } from '../components/form-field.js';
import { renderFormActions } from '../components/form-actions.js';
import { getClientes } from '../services/clientes.js';
import { createTicket, getTicket, updateTicket, updateTicketBudget, updateTicketRepuestos } from '../services/tickets.js';
import { getInventario, filterInventario, batchAdjustStock } from '../services/inventario.js';
import { canAccess } from '../core/session.js';
import { showToast } from '../components/toast.js';
import { renderTicketTimeline, mountTicketTimeline } from '../components/ticket-timeline.js';
import { renderFormSkeleton } from '../components/app-state.js';
import { openTicketPrint } from '../components/ticket-print.js';

// ─── Budget section helpers ───────────────────────────────────────────────────

function renderApprovalBadge(aprobado) {
  if (aprobado) {
    return `<span class="badge badge-success" style="font-size: var(--font-xs); padding: var(--space-xs) var(--space-sm);">✓ Aprobado por el cliente</span>`;
  }
  return `<span class="badge" style="font-size: var(--font-xs); padding: var(--space-xs) var(--space-sm); background: rgba(255,255,255,0.05); color: var(--text-muted);">Pendiente de aprobación</span>`;
}

function renderBudgetSection(ticket) {
  const aprobado = ticket?.aprobadoCliente ?? false;
  return `
    <div class="card glass-card" style="margin-top: var(--space-lg); max-width: 900px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-lg); flex-wrap: wrap; gap: var(--space-sm);">
        <div>
          <h3 style="font-size: var(--font-md); font-weight: 600; margin: 0;">Diagnóstico y Presupuesto</h3>
          <p style="font-size: var(--font-xs); color: var(--text-muted); margin-top: 4px;">Visible para el cliente en el seguimiento público.</p>
        </div>
        ${renderApprovalBadge(aprobado)}
      </div>

      <div id="budget-error-msg" class="badge badge-danger" style="display: none; width: 100%; margin-bottom: var(--space-md); padding: var(--space-md); text-align: center; background: rgba(255, 0, 127, 0.1); border: 1px solid var(--danger);"></div>

      <form id="budget-form">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-lg);">
          ${renderFormField({
            label: 'Presupuesto al Cliente ($)',
            id: 'presupuesto',
            type: 'number',
            placeholder: 'Ej: 8500',
            value: ticket?.presupuesto || '',
          })}
        </div>

        <div style="margin-top: var(--space-lg);">
          ${renderFormField({
            label: 'Diagnóstico Técnico',
            id: 'diagnosticoTecnico',
            placeholder: 'Describe el diagnóstico realizado al equipo...',
            isTextArea: true,
            value: ticket?.diagnosticoTecnico || '',
          })}
        </div>

        <div style="margin-top: var(--space-md);">
          <div id="budget-actions-container">
            <button type="submit" id="budget-submit-btn" class="btn btn-primary" style="min-width: 200px;">
              Guardar diagnóstico y presupuesto
            </button>
          </div>
        </div>
      </form>
    </div>`;
}

// ─── Repuestos section HTML ───────────────────────────────────────────────────

function renderRepuestosSection(ticket) {
  const canConsume = canAccess('inventario-write') || canAccess('edit-ticket');
  const repuestos  = ticket?.repuestos || [];
  const total      = repuestos.reduce((s, r) => s + Number(r.subtotal || 0), 0);

  return `
    <div class="card glass-card" style="margin-top: var(--space-lg); max-width: 900px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-lg);flex-wrap:wrap;gap:var(--space-sm);">
        <div>
          <h3 style="font-size:var(--font-md);font-weight:600;margin:0;">Repuestos utilizados</h3>
          <p style="font-size:var(--font-xs);color:var(--text-muted);margin-top:4px;">
            Asociá repuestos del inventario. El stock se ajusta al guardar.
          </p>
        </div>
        ${total > 0 ? `
          <div style="text-align:right;">
            <div style="font-size:var(--font-xs);color:var(--text-muted);">Costo en repuestos</div>
            <div style="font-size:var(--font-lg);font-weight:800;color:var(--accent-cyan);">
              $${total.toLocaleString('es-AR')}
            </div>
          </div>` : ''}
      </div>

      <div id="repuestos-error" class="badge badge-danger"
        style="display:none;width:100%;margin-bottom:var(--space-md);padding:var(--space-md);
               text-align:center;background:rgba(255,0,127,0.1);border:1px solid var(--danger);">
      </div>

      ${canConsume ? `
        <!-- Search box -->
        <div style="position:relative;margin-bottom:var(--space-md);" id="repuesto-search-wrap">
          <div id="repuesto-search-skeleton" style="display:none;">
            <div class="skeleton" style="width:100%;height:42px;border-radius:8px;"></div>
          </div>
          <div id="repuesto-search-ready" style="display:none;position:relative;">
            <input type="text" id="repuesto-search-input" class="input"
              placeholder="Buscar repuesto por nombre, SKU o categoría..."
              style="padding-left:40px;margin-bottom:0;" autocomplete="off">
            <span style="position:absolute;left:15px;top:50%;transform:translateY(-50%);opacity:0.5;pointer-events:none;">🔍</span>
            <div id="repuesto-suggestions"
              style="position:absolute;z-index:200;top:calc(100% + 4px);left:0;right:0;
                     background:var(--surface, #1a1a2e);border:1px solid var(--border);
                     border-radius:var(--radius-md);max-height:240px;overflow-y:auto;display:none;">
            </div>
          </div>
        </div>` : ''}

      <!-- Items list -->
      <div id="repuestos-list"></div>

      <!-- Summary + Save -->
      <div id="repuestos-summary"></div>

      ${canConsume ? `
        <div style="margin-top:var(--space-md);">
          <button id="repuestos-save-btn" class="btn btn-primary" style="min-width:200px;">
            💾 Guardar repuestos
          </button>
        </div>` : ''}
    </div>`;
}

/**
 * Vista de Formulario de Ticket (Creación y Edición)
 */
export class TicketFormView extends AsyncView {
  constructor(params) {
    super(params);
    this.containerId = 'ticket-form-container';
    this.ticketId = this.params?.get('id');
    this.isEdit = !!this.ticketId;
  }

  /**
   * Override para usar skeleton de formulario
   */
  renderLoading() {
    return `
      <div style="margin-top: var(--space-xl);">
        <div class="skeleton" style="width: 250px; height: 32px; margin-bottom: var(--space-lg);"></div>
        ${renderFormSkeleton()}
      </div>
    `;
  }

  async loadData() {
    // Carga paralela de clientes y ticket (si es edición)
    const [clientes, ticket] = await Promise.all([
      getClientes(),
      this.isEdit ? getTicket(this.ticketId) : Promise.resolve(null)
    ]);

    if (this.isEdit && !ticket) {
      throw new Error("No se pudo encontrar el trabajo solicitado.");
    }

    this._ticket         = ticket;
    this._repuestosState = ticket ? [...(ticket.repuestos || [])] : [];
    return { clientes, ticket };
  }

  renderContent({ clientes, ticket }) {
    const clientOptions = clientes
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
      .map(c => ({
        value: c.id,
        label: `${c.nombre || 'Sin Nombre'} ${c.apellido || ''} (${c.dni || 'S/D'})`
      }));

    const typeOptions = [
      { value: 'taller', label: 'Taller (Presencial)' },
      { value: 'remoto', label: 'Remoto (A distancia)' }
    ];

    const planOptions = [
      { value: 'estandar', label: 'Estándar' },
      { value: 'oro', label: 'Oro (Prioridad)' },
      { value: 'platinum', label: 'Platinum (Urgente)' }
    ];

    const breadcrumbHtml = renderBreadcrumb([
      { label: 'Operaciones', href: '#dashboard', icon: '⚙️' },
      { label: 'Trabajos', href: '#tickets', icon: '🛠️' },
      { 
        label: this.isEdit ? `Editar Orden ${ticket?.numeroOrden}` : 'Nuevo Trabajo', 
        href: this.isEdit ? `#ticket-edit?id=${this.ticketId}` : '#ticket-nuevo', 
        icon: this.isEdit ? '📝' : '➕' 
      }
    ]);

    const headerHtml = renderSectionHeader(
      this.isEdit ? `Editar Orden: ${ticket?.numeroOrden}` : 'Nueva Orden de Trabajo', 
      this.isEdit ? 'Modifique los detalles técnicos de la orden.' : 'Registre un nuevo servicio técnico en el sistema.', 
      this.isEdit ? '📝 Edición' : '🛠️ Registro'
    );

    return `
      <div id="ticket-form-wrapper" class="animate-fade-in stack-lg">
        ${breadcrumbHtml}
        <div class="flex-between" style="align-items:flex-end;">
          <div style="flex:1;">${headerHtml}</div>
          ${this.isEdit ? `
            <button class="btn btn-secondary form-print-btn" style="margin-left:var(--space-md);white-space:nowrap;font-size:var(--font-sm);" title="Imprimir orden">
              🖨 Imprimir Orden
            </button>
          ` : ''}
        </div>

        <div class="card glass-card" style="max-width: 900px;">
          <div id="form-error-msg" class="badge badge-danger" style="display: none; width: 100%; margin-bottom: var(--space-md); padding: var(--space-md); text-align: center; background: rgba(255, 0, 127, 0.1); border: 1px solid var(--danger);"></div>
          
          <form id="ticket-form" class="stack-lg">
            <div class="grid-stack" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
              
              ${renderFormField({
                label: 'Cliente',
                id: 'clienteId',
                type: 'select',
                options: [{ value: '', label: '-- Seleccione un cliente --' }, ...clientOptions],
                value: ticket?.clienteId || '',
                required: true
              })}

              ${renderFormField({
                label: 'Tipo de Servicio',
                id: 'tipo',
                type: 'select',
                options: typeOptions,
                value: ticket?.tipo || 'taller',
                required: true
              })}

              ${renderFormField({
                label: 'Equipo / Dispositivo',
                id: 'equipo',
                placeholder: 'Ej: Notebook HP Pavilion',
                value: ticket?.equipo || '',
                required: true
              })}

              ${renderFormField({
                label: 'Marca / Modelo',
                id: 'marca_modelo',
                placeholder: 'Ej: Asus ROG - GL553',
                value: ticket?.marca || ticket?.modelo ? `${ticket.marca} ${ticket.modelo}`.trim() : ''
              })}

              ${renderFormField({
                label: 'Plan de Servicio',
                id: 'planServicio',
                type: 'select',
                options: planOptions,
                value: ticket?.planServicio || 'estandar',
                required: true
              })}

              ${renderFormField({
                label: 'Presupuesto Final ($)',
                id: 'precio',
                type: 'number',
                placeholder: 'Ej: 5000',
                value: ticket?.precio || ''
              })}

            </div>

            <div>
              ${renderFormField({
                label: 'Problema Reportado',
                id: 'problema',
                placeholder: 'Describí el fallo o inconveniente...',
                isTextArea: true,
                value: ticket?.problema || '',
                required: true
              })}
            </div>

            <div style="display: flex; align-items: center; gap: var(--space-sm); color: var(--text-muted); font-size: var(--font-xs);">
              <span style="color: var(--danger);">*</span> Campos obligatorios
            </div>

            <div id="form-actions-container">
              ${renderFormActions({
                saveLabel: this.isEdit ? 'Guardar Cambios' : 'Crear Orden de Trabajo',
                onCancelHref: '#tickets'
              })}
            </div>

          </form>
        </div>

        ${this.isEdit ? renderBudgetSection(ticket) : ''}

        ${this.isEdit ? renderRepuestosSection(ticket) : ''}

        ${this.isEdit ? renderTicketTimeline() : ''}
      </div>
    `;
  }

  onContentReady() {
    this.initFormHandlers();
    if (this.isEdit) {
      this.initBudgetHandlers();
      this.initRepuestosHandlers();
      mountTicketTimeline(this.ticketId);

      const printBtn = document.querySelector('.form-print-btn');
      if (printBtn && this._ticket) {
        printBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openTicketPrint(this._ticket);
        });
      }
    }
  }

  // ─── Repuestos section ──────────────────────────────────────────────────────

  initRepuestosHandlers() {
    this._inventarioCache = null;
    this._renderRepuestosList();

    const canConsume = canAccess('inventario-write') || canAccess('edit-ticket');
    if (!canConsume) return;

    // Load inventory lazily
    const skeleton = document.getElementById('repuesto-search-skeleton');
    const ready    = document.getElementById('repuesto-search-ready');
    if (skeleton) skeleton.style.display = 'block';

    getInventario().then(items => {
      this._inventarioCache = items;
      if (skeleton) skeleton.style.display = 'none';
      if (ready)    ready.style.display    = 'block';
      this._bindSearchInput();
    }).catch(() => {
      if (skeleton) skeleton.style.display = 'none';
    });

    // Save button
    const saveBtn = document.getElementById('repuestos-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this._saveRepuestos(saveBtn));
    }
  }

  _bindSearchInput() {
    const input       = document.getElementById('repuesto-search-input');
    const suggestions = document.getElementById('repuesto-suggestions');
    if (!input || !suggestions) return;

    input.addEventListener('input', () => {
      const term = input.value.trim();
      if (!term) { suggestions.style.display = 'none'; return; }
      const matches = filterInventario(this._inventarioCache || [], term).slice(0, 8);
      if (!matches.length) { suggestions.style.display = 'none'; return; }
      suggestions.innerHTML = matches.map(item => {
        const stock = Number(item.stock || 0);
        const stockColor = stock === 0 ? 'var(--danger)' : stock <= (item.stockMinimo || 0) ? 'var(--accent-orange)' : 'var(--accent-green)';
        return `
          <div class="repuesto-suggestion-item" data-id="${item.id}" style="
            padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);
            display:flex;justify-content:space-between;align-items:center;
            transition:background 0.15s;">
            <div>
              <div style="font-size:var(--font-sm);font-weight:600;color:var(--text-primary);">${item.nombre}</div>
              <div style="font-size:var(--font-xs);color:var(--text-muted);">${item.sku || ''} · ${item.categoria || ''}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;margin-left:12px;">
              <div style="font-size:var(--font-sm);font-weight:700;color:var(--accent-cyan);">$${Number(item.costo || 0).toLocaleString('es-AR')}</div>
              <div style="font-size:var(--font-xs);color:${stockColor};">stock: ${stock}</div>
            </div>
          </div>`;
      }).join('');
      suggestions.style.display = 'block';

      suggestions.querySelectorAll('.repuesto-suggestion-item').forEach(el => {
        el.addEventListener('mouseenter', () => { el.style.background = 'rgba(255,255,255,0.06)'; });
        el.addEventListener('mouseleave', () => { el.style.background = ''; });
        el.addEventListener('click', () => {
          const id   = el.dataset.id;
          const item = (this._inventarioCache || []).find(i => i.id === id);
          if (item) this._addRepuesto(item);
          input.value = '';
          suggestions.style.display = 'none';
        });
      });
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#repuesto-search-wrap')) suggestions.style.display = 'none';
    }, { capture: true });
  }

  _addRepuesto(item) {
    const existing = this._repuestosState.find(r => r.inventarioId === item.id);
    if (existing) {
      existing.cantidad++;
      existing.subtotal = existing.cantidad * existing.costoUnitario;
    } else {
      this._repuestosState.push({
        inventarioId:  item.id,
        nombre:        item.nombre,
        sku:           item.sku || '',
        cantidad:      1,
        costoUnitario: Number(item.costo || 0),
        subtotal:      Number(item.costo || 0),
      });
    }
    this._renderRepuestosList();
  }

  _removeRepuesto(inventarioId) {
    this._repuestosState = this._repuestosState.filter(r => r.inventarioId !== inventarioId);
    this._renderRepuestosList();
  }

  _updateQty(inventarioId, qty) {
    const r = this._repuestosState.find(r => r.inventarioId === inventarioId);
    if (!r) return;
    r.cantidad = Math.max(1, Number(qty) || 1);
    r.subtotal = r.cantidad * r.costoUnitario;
    this._renderRepuestosList();
  }

  _renderRepuestosList() {
    const listEl    = document.getElementById('repuestos-list');
    const summaryEl = document.getElementById('repuestos-summary');
    if (!listEl) return;

    const items = this._repuestosState;
    const total = items.reduce((s, r) => s + r.subtotal, 0);

    if (items.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:var(--space-lg);color:var(--text-muted);
                    font-size:var(--font-sm);border:1px dashed var(--border);
                    border-radius:var(--radius-md);margin-bottom:var(--space-md);">
          🔩 No hay repuestos asociados a esta orden todavía.
        </div>`;
      if (summaryEl) summaryEl.innerHTML = '';
      return;
    }

    listEl.innerHTML = `
      <div style="overflow-x:auto;margin-bottom:var(--space-md);">
        <table style="width:100%;border-collapse:collapse;font-size:var(--font-sm);">
          <thead>
            <tr style="border-bottom:1px solid var(--border);color:var(--text-muted);">
              <th style="text-align:left;padding:8px 6px;font-weight:600;">Repuesto</th>
              <th style="text-align:left;padding:8px 6px;font-weight:600;">SKU</th>
              <th style="text-align:center;padding:8px 6px;font-weight:600;width:80px;">Cant.</th>
              <th style="text-align:right;padding:8px 6px;font-weight:600;">Costo unit.</th>
              <th style="text-align:right;padding:8px 6px;font-weight:600;">Subtotal</th>
              <th style="padding:8px 6px;width:36px;"></th>
            </tr>
          </thead>
          <tbody>
            ${items.map(r => `
              <tr style="border-bottom:1px solid var(--border);" data-id="${r.inventarioId}">
                <td style="padding:8px 6px;color:var(--text-primary);font-weight:500;">${r.nombre}</td>
                <td style="padding:8px 6px;color:var(--text-muted);font-size:var(--font-xs);">${r.sku || '—'}</td>
                <td style="padding:8px 6px;text-align:center;">
                  <input type="number" class="repuesto-qty" data-id="${r.inventarioId}"
                    value="${r.cantidad}" min="1"
                    style="width:60px;text-align:center;background:rgba(255,255,255,0.05);
                           border:1px solid var(--border);border-radius:var(--radius-sm);
                           color:var(--text-primary);padding:4px 6px;font-size:var(--font-sm);">
                </td>
                <td style="padding:8px 6px;text-align:right;color:var(--text-muted);">$${r.costoUnitario.toLocaleString('es-AR')}</td>
                <td style="padding:8px 6px;text-align:right;color:var(--accent-cyan);font-weight:700;">$${r.subtotal.toLocaleString('es-AR')}</td>
                <td style="padding:8px 6px;">
                  <button class="repuesto-remove" data-id="${r.inventarioId}"
                    style="background:none;border:none;cursor:pointer;color:var(--danger);
                           font-size:16px;line-height:1;padding:2px 4px;" title="Quitar">✕</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    // Wire qty + remove
    listEl.querySelectorAll('.repuesto-qty').forEach(input => {
      input.addEventListener('change', () => this._updateQty(input.dataset.id, input.value));
    });
    listEl.querySelectorAll('.repuesto-remove').forEach(btn => {
      btn.addEventListener('click', () => this._removeRepuesto(btn.dataset.id));
    });

    if (summaryEl) {
      summaryEl.innerHTML = `
        <div style="display:flex;justify-content:flex-end;padding:var(--space-sm) 0;
                    border-top:1px solid var(--border);gap:var(--space-xl);">
          <div style="text-align:right;">
            <div style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:2px;">
              Total repuestos (${items.length} ítem${items.length !== 1 ? 's' : ''})
            </div>
            <div style="font-size:var(--font-xl);font-weight:800;color:var(--accent-cyan);">
              $${total.toLocaleString('es-AR')}
            </div>
          </div>
        </div>`;
    }
  }

  async _saveRepuestos(btn) {
    btn.disabled    = true;
    btn.textContent = '⏳ Guardando...';

    const errorEl = document.getElementById('repuestos-error');
    if (errorEl) errorEl.style.display = 'none';

    try {
      const prevRepuestos = this._ticket?.repuestos || [];
      const newRepuestos  = this._repuestosState;

      // 1. Prepare batch adjustments
      const adjustments = [];
      
      // Restore previous
      for (const prev of prevRepuestos) {
        adjustments.push({ id: prev.inventarioId, delta: +Number(prev.cantidad) });
      }
      
      // Consume new
      for (const next of newRepuestos) {
        adjustments.push({ id: next.inventarioId, delta: -Number(next.cantidad) });
      }

      // 2. Execute batch
      if (adjustments.length > 0) {
        const batchRes = await batchAdjustStock(adjustments);
        if (!batchRes.success) throw new Error(batchRes.error || 'Error al ajustar stock');
      }

      // 3. Save repuestos array to ticket
      const total = newRepuestos.reduce((s, r) => s + r.subtotal, 0);
      const result = await updateTicketRepuestos(this.ticketId, newRepuestos, total);

      if (!result.success) throw new Error(result.error || 'Error al actualizar ticket');

      // 4. Sync local ticket reference
      this._ticket.repuestos      = [...newRepuestos];
      this._ticket.totalRepuestos = total;

      showToast('Repuestos guardados correctamente', 'success');
    } catch (err) {
      console.error('[repuestos] save failed:', err);
      if (errorEl) {
        errorEl.textContent  = err.message || 'Error al guardar los repuestos';
        errorEl.style.display = 'block';
      }
      showToast(err.message || 'Error al guardar repuestos', 'error');
    }

    btn.disabled    = false;
    btn.textContent = '💾 Guardar repuestos';
  }

  initFormHandlers() {
    const form = document.getElementById('ticket-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(form);
      const rawData = Object.fromEntries(formData.entries());
      
      const data = {
        ...rawData,
        marca: rawData.marca_modelo || '',
        modelo: ''
      };

      this.toggleFormLoading(true);
      this.hideError();

      const result = this.isEdit
        ? await updateTicket(this.ticketId, data)
        : await createTicket(data);

      if (result.success) {
        showToast(
          this.isEdit ? 'Orden actualizada correctamente' : `Orden ${result.numeroOrden} creada con éxito`, 
          'success'
        );
        
        setTimeout(() => {
          window.location.hash = '#tickets';
        }, 1200);
      } else {
        showToast(result.error || 'Error al procesar la orden', 'error');
        this.showError(result.error);
        this.toggleFormLoading(false);
      }
    });
  }

  initBudgetHandlers() {
    const form = document.getElementById('budget-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const btn = document.getElementById('budget-submit-btn');
      const errorEl = document.getElementById('budget-error-msg');
      const originalText = btn?.textContent;

      if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
      if (errorEl) errorEl.style.display = 'none';

      const fd = new FormData(form);
      const result = await updateTicketBudget(this.ticketId, {
        diagnosticoTecnico: fd.get('diagnosticoTecnico') || '',
        presupuesto:        fd.get('presupuesto')        || 0,
      });

      if (result.success) {
        showToast('Diagnóstico y presupuesto guardados', 'success');
      } else {
        if (errorEl) {
          errorEl.textContent = result.error || 'Error al guardar';
          errorEl.style.display = 'block';
        }
        showToast(result.error || 'Error al guardar', 'error');
      }

      if (btn) { btn.disabled = false; btn.textContent = originalText; }
    });
  }

  toggleFormLoading(isLoading) {
    const actionsContainer = document.getElementById('form-actions-container');
    if (actionsContainer) {
      actionsContainer.innerHTML = renderFormActions({
        saveLabel: this.isEdit ? 'Guardar Cambios' : 'Crear Orden de Trabajo',
        onCancelHref: '#tickets',
        isSubmitting: isLoading
      });
    }
    
    const inputs = document.querySelectorAll('#ticket-form input, #ticket-form select, #ticket-form textarea');
    inputs.forEach(input => input.disabled = isLoading);
  }

  showError(message) {
    const errorMsg = document.getElementById('form-error-msg');
    if (errorMsg) {
      errorMsg.textContent = message;
      errorMsg.style.display = 'block';
      errorMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  hideError() {
    const errorMsg = document.getElementById('form-error-msg');
    if (errorMsg) {
      errorMsg.style.display = 'none';
    }
  }
}
