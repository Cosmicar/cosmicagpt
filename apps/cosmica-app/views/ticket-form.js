import { AsyncView } from '../core/async-view.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';
import { renderFormField } from '../components/form-field.js';
import { renderFormActions } from '../components/form-actions.js';
import { renderFormSkeleton } from '../components/app-state.js';
import { renderTicketTimeline, mountTicketTimeline } from '../components/ticket-timeline.js';
import { getClientes } from '../services/clientes.js';
import { createTicket, getTicket, getTickets, updateTicket, updateTicketBudget, updateTicketRepuestos } from '../services/tickets.js';
import { getInventario, filterInventario, batchAdjustStock } from '../services/inventario.js';
import { canAccess, getCurrentSession } from '../core/session.js';
import { WORK_STATUS, isAdmin } from '../../../js/domain.js';
import { showToast } from '../components/toast.js';
import { openTicketPrint } from '../components/ticket-print.js';
import { getTecnicos } from '../services/usuarios.js';
import { getClientBadge, suggestBudget } from '../core/intelligence.js';
import {
  guardBtn, setDirty, initUnsavedChangesGuard,
  saveDraft, loadDraft, clearDraft, initMultitabCheck
} from '../core/chaos-guard.js';
import { addTicketHistoryEvent, TICKET_EVENT_TYPES } from '../services/ticket-history.js';
import { openWhatsApp, buildReadyMessage, buildBudgetMessage, buildApprovalMessage, buildWaitingPartsMessage, buildReminderMessage, buildLastWarningMessage } from '../core/message-templates.js';

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

      <div id="budget-error-msg" class="alert alert-danger" style="display: none;"></div>

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
  const isEntregado = ticket?.estado === WORK_STATUS.entregado;
  const admin = isAdmin(getCurrentSession()?.profile);
  const freezeFinancials = isEntregado && !admin;
  const canConsume = (canAccess('inventario-write') || canAccess('edit-ticket')) && !freezeFinancials;
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

      <div id="repuestos-error-msg" class="alert alert-danger" style="display: none;"></div>

      ${canConsume ? `
        <!-- Search box -->
        <div style="position:relative;margin-bottom:var(--space-md);" id="repuesto-search-wrap">
          <div id="repuesto-search-skeleton" style="display:none;">
            <div class="skeleton" style="width:100%;height:42px;border-radius:8px;"></div>
          </div>
          <div id="repuesto-search-ready" style="display:none;" class="search-wrapper">
            <input type="text" id="repuesto-search-input" class="input"
              placeholder="Buscar repuesto por nombre, SKU o categoría..."
              autocomplete="off">
            <span class="search-icon">🔍</span>
          </div>
          <div id="repuesto-suggestions"
              style="position:absolute;z-index:200;top:calc(100% + 4px);left:0;right:0;
                     background:var(--surface, #1a1a2e);border:1px solid var(--border);
                     border-radius:var(--radius-md);max-height:240px;overflow-y:auto;display:none;">
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
    const [clientes, tecnicos, ticket] = await Promise.all([
      getClientes(),
      getTecnicos(),
      this.isEdit ? getTicket(this.ticketId) : Promise.resolve(null)
    ]);

    if (this.isEdit && !ticket) {
      throw new Error("No se pudo encontrar el trabajo solicitado.");
    }

    this._ticket         = ticket;
    this._repuestosState = ticket ? [...(ticket.repuestos || [])] : [];
    return { clientes, tecnicos, ticket };
  }

  renderContent({ clientes, tecnicos, ticket }) {
    const clientOptions = clientes
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
      .map(c => ({
        value: c.id,
        label: `${c.nombre || 'Sin Nombre'} ${c.apellido || ''} (${c.dni || 'S/D'})`
      }));

    const typeOptions = [
      { value: 'taller', label: 'Cósmica Lab (Taller)' },
      { value: 'remoto', label: 'Soporte Remoto' }
    ];

    const planOptions = [
      { value: 'estandar', label: 'Estándar' },
      { value: 'oro', label: 'Oro (Prioridad)' },
      { value: 'platinum', label: 'Platinum (Urgente)' }
    ];

    const isEntregado = ticket?.estado === WORK_STATUS.entregado;
    const session = getCurrentSession();
    const admin = isAdmin(session?.profile);
    const userRole = session?.profile?.rol;
    const userId = session?.user?.uid;
    const freezeFinancials = isEntregado && !admin;

    // Technician Options
    const tecnicoOptions = [
      { value: '', label: 'Sin asignar' },
      ...tecnicos.map(u => ({ value: u.id, label: u.displayName }))
    ];

    // Permission Logic for Technician Field
    let tecnicoDisabled = false;
    let tecnicoMessage = '';
    
    if (userRole === 'tecnico') {
      // Tecnico solo puede autoasignarse. Si ya está asignado a otro, no puede cambiarlo.
      if (ticket?.tecnicoAsignadoId && ticket.tecnicoAsignadoId !== userId) {
        tecnicoDisabled = true;
        tecnicoMessage = 'Solo el administrador o el técnico asignado pueden cambiar esta asignación.';
      }
    } else if (userRole === 'operador') {
      // Operador puede asignar cualquiera (como admin en este contexto, o restringir?)
      // Requisito dice: operador → puede asignarse o reasignar
    }

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
      this.isEdit ? 'Modifique los detalles técnicos de la orden en Cósmica App.' : 'Registre un nuevo servicio técnico en el sistema.', 
      this.isEdit ? '📝 Edición' : '🛠️ Registro'
    );

    return `
      <div id="ticket-form-wrapper" class="animate-fade-in stack-lg">
        ${breadcrumbHtml}
        <div class="flex-between" style="align-items:flex-end;">
          <div style="flex:1;">${headerHtml}</div>
          ${this.isEdit ? `
            <div style="display:flex;gap:var(--space-xs);margin-left:var(--space-md);">
              <button class="btn btn-secondary form-print-btn" data-mode="a4" style="white-space:nowrap;font-size:var(--font-sm);">🖨 A4</button>
              <button class="btn btn-secondary form-print-btn" data-mode="thermal" style="white-space:nowrap;font-size:var(--font-sm);">🧾 Ticket</button>
            </div>
          ` : ''}
        </div>

        ${this.isEdit && ticket?.telefono ? `
        <div style="display:flex;gap:6px;flex-wrap:wrap;padding:10px;background:rgba(37,211,102,0.05);border:1px solid rgba(37,211,102,0.2);border-radius:var(--radius-md);max-width:900px;">
          <span style="font-size:var(--font-xs);color:var(--text-muted);align-self:center;">📲 WhatsApp:</span>
          <button class="btn btn-sm form-wa-btn" data-action="listo"        style="font-size:10px;padding:4px 8px;background:rgba(37,211,102,0.15);color:#25D366;border:1px solid rgba(37,211,102,0.3);">📲 Avisar listo</button>
          <button class="btn btn-sm form-wa-btn" data-action="presupuesto"  style="font-size:10px;padding:4px 8px;background:rgba(37,211,102,0.15);color:#25D366;border:1px solid rgba(37,211,102,0.3);">💰 Enviar presupuesto</button>
          <button class="btn btn-sm form-wa-btn" data-action="aprobacion"   style="font-size:10px;padding:4px 8px;background:rgba(37,211,102,0.15);color:#25D366;border:1px solid rgba(37,211,102,0.3);">🛠 Solicitar aprobación</button>
          <button class="btn btn-sm form-wa-btn" data-action="repuesto"     style="font-size:10px;padding:4px 8px;background:rgba(37,211,102,0.15);color:#25D366;border:1px solid rgba(37,211,102,0.3);">📦 Esperando repuesto</button>
          <button class="btn btn-sm form-wa-btn" data-action="recordatorio" style="font-size:10px;padding:4px 8px;background:rgba(37,211,102,0.15);color:#25D366;border:1px solid rgba(37,211,102,0.3);">🔔 Recordatorio</button>
          <button class="btn btn-sm form-wa-btn" data-action="ultimoaviso"  style="font-size:10px;padding:4px 8px;background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3);">⚠ Último aviso</button>
        </div>
        ` : ''}

        <div class="card glass-card" style="max-width: 900px;">
          <div id="form-error-msg" class="alert alert-danger" style="display: none;"></div>
          
          <form id="ticket-form" class="stack-lg">
            <div class="grid-stack" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
              
              <div style="position:relative;" id="cliente-autocomplete-wrap">
                ${renderFormField({
                  label: 'Cliente (Buscar por nombre, DNI o Teléfono)',
                  id: 'cliente_search',
                  placeholder: 'Ej: Juan Pérez o 20-...',
                  value: ticket ? `${ticket.nombre} ${ticket.apellido}` : '',
                  required: !this.isEdit,
                  autocomplete: 'off'
                })}
                <input type="hidden" name="clienteId" id="clienteId" value="${ticket?.clienteId || ''}">
                <div id="cliente-suggestions" 
                     style="position:absolute;z-index:9999;top:calc(100% - 15px);left:0;right:0;
                            background:var(--surface);border:1px solid var(--border);
                            border-radius:var(--radius-md);max-height:240px;overflow-y:auto;display:none;
                            box-shadow: var(--shadow-lg);">
                </div>
              </div>

              <div id="equipo-suggestions-wrap" style="grid-column: 1 / -1; display: none;">
                <div style="font-size: var(--font-xs); color: var(--text-muted); margin-bottom: 8px;">Equipos usados anteriormente:</div>
                <div id="equipo-suggestions-list" style="display: flex; gap: 8px; flex-wrap: wrap;"></div>
              </div>

              ${renderFormField({
                label: 'Tipo de Servicio',
                id: 'tipo',
                type: 'select',
                options: typeOptions,
                value: ticket?.tipo || (admin ? 'remoto' : 'taller'),
                required: true,
                disabled: !admin
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

              ${isEntregado && Number(ticket?.precio || 0) > 0 ? `
              <div style="grid-column:1/-1;
                padding:var(--space-sm) var(--space-md);
                background:rgba(${admin ? '249,115,22' : '0,229,255'},0.07);
                border:1px solid rgba(${admin ? '249,115,22' : '0,229,255'},0.2);
                border-radius:var(--radius-md);
                display:flex;align-items:center;gap:var(--space-sm);">
                <span>🔒</span>
                <span style="font-size:var(--font-sm);font-weight:600;
                  color:${admin ? 'var(--accent-orange)' : 'var(--accent-cyan)'};">
                  ${admin
                    ? '⚠️ Impactado en caja — La edición generará un ajuste contable automático'
                    : 'Impactado en caja — Solo administrador puede modificar precio o método de pago'}
                </span>
              </div>` : ''}

              ${renderFormField({
                label: 'Presupuesto Final ($)',
                id: 'precio',
                type: 'number',
                placeholder: 'Ej: 5000',
                value: ticket?.precio || '',
                disabled: freezeFinancials
              })}

              ${renderFormField({
                label: 'Método de Pago',
                id: 'metodoPago',
                type: 'select',
                options: [
                  { value: 'efectivo', label: 'Efectivo' },
                  { value: 'transferencia', label: 'Transferencia' },
                  { value: 'mercadopago', label: 'Mercado Pago' },
                  { value: 'debito', label: 'Débito' },
                  { value: 'credito', label: 'Crédito' }
                ],
                value: ticket?.metodoPago || 'efectivo',
                disabled: freezeFinancials
              })}

              ${renderFormField({
                label: 'Garantía (días)',
                id: 'garantiaDias',
                type: 'number',
                placeholder: '90',
                value: ticket?.garantiaDias ?? 90
              })}

              <div style="grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-lg); border-top: 1px solid var(--border); padding-top: var(--space-lg); margin-top: var(--space-sm);">
                ${renderFormField({
                  label: '🛠️ Técnico Asignado',
                  id: 'tecnicoAsignadoId',
                  type: 'select',
                  options: tecnicoOptions,
                  value: ticket?.tecnicoAsignadoId || '',
                  disabled: tecnicoDisabled,
                  helpText: tecnicoMessage
                })}
              </div>

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
              <div id="budget-suggestion" style="grid-column: 1 / -1; display: none; margin-top: -10px; margin-bottom: var(--space-md);">
                <div style="display: flex; align-items: center; gap: 8px; font-size: var(--font-xs); color: var(--accent-cyan); background: rgba(0, 229, 255, 0.05); padding: 8px; border-radius: var(--radius-sm); border: 1px solid rgba(0, 229, 255, 0.1);">
                  <span>💡</span>
                  <span id="budget-suggestion-text"></span>
                </div>
              </div>
            </div>

            ${this.isEdit ? `<div>
              ${renderFormField({
                label: 'Servicio Realizado',
                id: 'servicioRealizado',
                placeholder: 'Describí el trabajo técnico ejecutado...',
                isTextArea: true,
                value: ticket?.servicioRealizado || '',
              })}
            </div>` : ''}

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

  async onContentReady({ clientes }) {
    this._clientesCache = clientes;
    this._allTicketsCache = await getTickets();
    this.initFormHandlers();
    this.initClienteAutocomplete();
    this.initFormShortcuts();
    
    // Budget Intelligence
    const probInput = document.getElementById('problema');
    const budgetSugg = document.getElementById('budget-suggestion');
    const budgetText = document.getElementById('budget-suggestion-text');
    if (probInput) {
      probInput.addEventListener('blur', () => {
        const val = probInput.value.trim();
        if (val.length > 10) {
          const suggestion = suggestBudget(val, this._allTicketsCache);
          if (suggestion) {
            budgetText.textContent = `Sugerencia basada en casos similares: $${suggestion}`;
            budgetSugg.style.display = 'block';
          }
        }
      });
    }

    if (this.isEdit) {
      this.initBudgetHandlers();
      this.initRepuestosHandlers();
      mountTicketTimeline(this.ticketId);
      document.querySelectorAll('.form-print-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          openTicketPrint(this._ticket, btn.dataset.mode || 'a4');
        });
      });
    }

    // WhatsApp quick actions (edit mode only)
    if (this.isEdit && this._ticket?.telefono) {
      const waBuilders = {
        listo:        () => buildReadyMessage(this._ticket),
        presupuesto:  () => buildBudgetMessage(this._ticket),
        aprobacion:   () => buildApprovalMessage(this._ticket),
        repuesto:     () => buildWaitingPartsMessage(this._ticket),
        recordatorio: () => buildReminderMessage(this._ticket),
        ultimoaviso:  () => buildLastWarningMessage(this._ticket),
      };
      document.querySelectorAll('.form-wa-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const build = waBuilders[btn.dataset.action];
          if (build) openWhatsApp(this._ticket.telefono, build());
        });
      });
    }

    // Chaos Guard: Unsaved Changes
    initUnsavedChangesGuard();
    
    // Chaos Guard: Multitab — store cleanup so destroy() can release the lock
    if (this.isEdit) {
      this._multitabCleanup = initMultitabCheck(this.ticketId, () => {
        showToast('Esta orden se está editando en otra pestaña', 'warning');
      });
    }

    // Chaos Guard: Auto Recovery
    this._initAutoRecovery();

    // Autofocus
    const firstInput = document.getElementById(this.isEdit ? 'precio' : 'cliente_search');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 150);
    }
  }

  initFormShortcuts() {
    const form = document.getElementById('ticket-form');
    if (!form) return;
    form.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn && !submitBtn.disabled) {
          submitBtn.click();
        }
      }
    });
  }

  // ─── Cliente Autocomplete ───────────────────────────────────────────────────

  initClienteAutocomplete() {
    const input = document.getElementById('cliente_search');
    const hidden = document.getElementById('clienteId');
    const suggestions = document.getElementById('cliente-suggestions');
    if (!input || !suggestions || !hidden) return;

    let _autocompleteDebounce = null;
    input.addEventListener('input', () => {
      clearTimeout(_autocompleteDebounce);
      _autocompleteDebounce = setTimeout(() => {
        const val = input.value.toLowerCase().trim();
        if (!val) { suggestions.style.display = 'none'; hidden.value = ''; return; }

        const filtered = this._clientesCache.filter(c => {
          const full = `${c.nombre} ${c.apellido} ${c.dni} ${c.telefono}`.toLowerCase();
          return full.includes(val);
        }).slice(0, 5);

        this._currentSuggestions = filtered;
        this._suggestionIndex = -1;

        if (filtered.length > 0) {
          suggestions.innerHTML = filtered.map((c, i) => {
            const ticketCount = this._allTicketsCache.filter(t => t.clienteId === c.id).length;
            const badge = getClientBadge(ticketCount);
            return `
            <div class="cliente-suggestion-item" data-id="${c.id}" data-name="${c.nombre} ${c.apellido}" data-index="${i}" 
                 style="padding:10px 15px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:var(--surface);">
              <div>
                <div style="font-weight:600;font-size:var(--font-sm);color:var(--text-primary);">${c.nombre} ${c.apellido}</div>
                <div style="font-size:var(--font-xs);color:var(--text-muted);">${c.telefono || ''} ${c.dni ? `• DNI: ${c.dni}` : ''}</div>
              </div>
              ${badge ? `<span class="badge ${badge.class}" style="font-size:10px;">${badge.label}</span>` : ''}
            </div>`;
          }).join('');
          suggestions.style.display = 'block';

          suggestions.querySelectorAll('.cliente-suggestion-item').forEach(el => {
            el.addEventListener('mouseenter', () => { 
              this._suggestionIndex = parseInt(el.dataset.index);
              this._updateSuggestionHighlight(suggestions, 'cliente-suggestion-item'); 
            });
            el.addEventListener('click', () => {
              this._selectCliente(el.dataset.id, el.dataset.name);
            });
          });
        } else {
          suggestions.innerHTML = `<div style="padding:10px;color:var(--text-muted);font-size:var(--font-sm);">No se encontraron clientes. <a href="#cliente-nuevo" style="color:var(--accent-cyan);">Crear nuevo?</a></div>`;
          suggestions.style.display = 'block';
        }
      }, 150);
    });

    input.addEventListener('keydown', (e) => {
      if (suggestions.style.display === 'none') return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._suggestionIndex = Math.min(this._suggestionIndex + 1, this._currentSuggestions.length - 1);
        this._updateSuggestionHighlight(suggestions, 'cliente-suggestion-item');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._suggestionIndex = Math.max(this._suggestionIndex - 1, -1);
        this._updateSuggestionHighlight(suggestions, 'cliente-suggestion-item');
      } else if (e.key === 'Enter' && this._suggestionIndex >= 0) {
        e.preventDefault();
        const item = this._currentSuggestions[this._suggestionIndex];
        this._selectCliente(item.id, `${item.nombre} ${item.apellido}`);
      } else if (e.key === 'Escape') {
        suggestions.style.display = 'none';
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#cliente-autocomplete-wrap')) suggestions.style.display = 'none';
    }, { capture: true });
  }

  _updateSuggestionHighlight(container, className) {
    container.querySelectorAll(`.${className}`).forEach((el, i) => {
      el.style.background = (i === this._suggestionIndex) ? 'rgba(255,255,255,0.1)' : '';
    });
  }

  async _selectCliente(id, name) {
    const input = document.getElementById('cliente_search');
    const hidden = document.getElementById('clienteId');
    const suggestions = document.getElementById('cliente-suggestions');
    if (input) input.value = name;
    if (hidden) hidden.value = id;
    if (suggestions) suggestions.style.display = 'none';

    // Fetch and show equipment suggestions
    this._loadEquipoSuggestions(id);
  }

  async _loadEquipoSuggestions(clienteId) {
    const wrap = document.getElementById('equipo-suggestions-wrap');
    const list = document.getElementById('equipo-suggestions-list');
    if (!wrap || !list) return;

    try {
      const tickets = await getTickets();
      const clientTickets = tickets.filter(t => t.clienteId === clienteId && t.equipo);
      
      // Get unique equipment combos
      const seen = new Set();
      const suggestions = [];
      
      for (const t of clientTickets) {
        const key = `${t.equipo}|${t.marca || ''}|${t.modelo || ''}`.toLowerCase().trim();
        if (!seen.has(key)) {
          seen.add(key);
          suggestions.push({
            equipo: t.equipo,
            marca: t.marca || '',
            modelo: t.modelo || ''
          });
        }
        if (suggestions.length >= 4) break;
      }

      if (suggestions.length > 0) {
        list.innerHTML = suggestions.map(s => `
          <button type="button" class="btn btn-sm btn-secondary equipo-suggest-btn" 
            data-equipo="${s.equipo}" data-marca="${s.marca}" data-modelo="${s.modelo}"
            style="font-size: var(--font-xs); background: rgba(0, 229, 255, 0.05); border-color: rgba(0, 229, 255, 0.1);">
            ${s.equipo} ${s.marca} ${s.modelo}
          </button>
        `).join('');
        wrap.style.display = 'block';

        list.querySelectorAll('.equipo-suggest-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const eqInput = document.getElementById('equipo');
            const mmInput = document.getElementById('marca_modelo');
            if (eqInput) eqInput.value = btn.dataset.equipo;
            if (mmInput) mmInput.value = `${btn.dataset.marca} ${btn.dataset.modelo}`.trim();
            wrap.style.display = 'none';
          });
        });
      } else {
        wrap.style.display = 'none';
      }
    } catch (err) {
      console.error('Error loading equipo suggestions:', err);
      wrap.style.display = 'none';
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
      
      this._currentRepSuggestions = matches;
      this._repSuggestionIndex = -1;

      if (!matches.length) { suggestions.style.display = 'none'; return; }
      suggestions.innerHTML = matches.map((item, i) => {
        const stock = Number(item.stock || 0);
        const stockColor = stock === 0 ? 'var(--danger)' : stock <= (item.stockMinimo || 0) ? 'var(--accent-orange)' : 'var(--accent-green)';
        return `
          <div class="repuesto-suggestion-item" data-id="${item.id}" data-index="${i}" style="
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
        el.addEventListener('mouseenter', () => { 
          this._repSuggestionIndex = parseInt(el.dataset.index);
          this._updateSuggestionHighlight(suggestions, 'repuesto-suggestion-item');
        });
        el.addEventListener('click', () => {
          const id   = el.dataset.id;
          const item = (this._inventarioCache || []).find(i => i.id === id);
          if (item) this._addRepuesto(item);
          input.value = '';
          suggestions.style.display = 'none';
        });
      });
    });

    input.addEventListener('keydown', (e) => {
      if (suggestions.style.display === 'none') return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._repSuggestionIndex = Math.min(this._repSuggestionIndex + 1, this._currentRepSuggestions.length - 1);
        this._updateSuggestionHighlight(suggestions, 'repuesto-suggestion-item');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._repSuggestionIndex = Math.max(this._repSuggestionIndex - 1, -1);
        this._updateSuggestionHighlight(suggestions, 'repuesto-suggestion-item');
      } else if (e.key === 'Enter' && this._repSuggestionIndex >= 0) {
        e.preventDefault();
        const item = this._currentRepSuggestions[this._repSuggestionIndex];
        this._addRepuesto(item);
        input.value = '';
        suggestions.style.display = 'none';
      } else if (e.key === 'Escape') {
        suggestions.style.display = 'none';
      }
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
    await guardBtn(btn, async () => {
      const errorEl = document.getElementById('repuestos-error-msg');
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
          if (!batchRes.success) {
            // Log the failure to the ticket's history audit trail (fire-and-forget)
            if (batchRes.code === 'INSUFFICIENT_STOCK') {
              addTicketHistoryEvent(this.ticketId, TICKET_EVENT_TYPES.inventoryAdjustFailed, {
                itemNombre: batchRes.itemNombre,
                error:      batchRes.error,
              }).catch(() => {});
            }
            throw new Error(batchRes.error || 'Error al ajustar stock');
          }
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
    });
  }

  initFormHandlers() {
    const form = document.getElementById('ticket-form');
    if (!form) return;

    // Budget suggestions listener
    const problemaInput = document.getElementById('problema');
    const budgetSug = document.getElementById('budget-suggestion');
    const budgetText = document.getElementById('budget-suggestion-text');

    if (problemaInput) {
      problemaInput.addEventListener('input', (e) => {
        const val = e.target.value;
        const suggestion = suggestBudget(val, this._allTicketsCache);
        if (suggestion) {
          budgetText.textContent = `Sugerencia por "${suggestion.keyword}": Último promedio $${suggestion.average.toLocaleString('es-AR')} (basado en ${suggestion.count} servicios)`;
          budgetSug.style.display = 'block';
        } else {
          budgetSug.style.display = 'none';
        }
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = form.querySelector('button[type="submit"]');
      await guardBtn(submitBtn, async () => {
        const formData = new FormData(form);
        const rawData = Object.fromEntries(formData.entries());
        
        const selectTecnico = document.getElementById('tecnicoAsignadoId');
        const tecnicoFieldDisabled = selectTecnico?.disabled ?? false;

        const selectTipo = document.getElementById('tipo');
        const tipoFieldDisabled = selectTipo?.disabled ?? false;

        const inputPrecio = document.getElementById('precio');
        const precioFieldDisabled = inputPrecio?.disabled ?? false;

        const selectMetodo = document.getElementById('metodoPago');
        const metodoFieldDisabled = selectMetodo?.disabled ?? false;

        const session = getCurrentSession();
        const admin = isAdmin(session?.profile);
        const defaultTipo = admin ? 'remoto' : 'taller';

        const data = {
          ...rawData,
          tipo: tipoFieldDisabled
            ? (this._ticket?.tipo || defaultTipo)
            : (rawData.tipo || defaultTipo),
          precio: precioFieldDisabled
            ? (this._ticket?.precio || '')
            : (rawData.precio || ''),
          metodoPago: metodoFieldDisabled
            ? (this._ticket?.metodoPago || 'efectivo')
            : (rawData.metodoPago || 'efectivo'),
          marca: rawData.marca_modelo || '',
          modelo: '',
          tecnicoAsignadoId: tecnicoFieldDisabled
            ? (this._ticket?.tecnicoAsignadoId ?? null)
            : (rawData.tecnicoAsignadoId || null),
          tecnicoAsignadoNombre: tecnicoFieldDisabled
            ? (this._ticket?.tecnicoAsignadoNombre ?? null)
            : (selectTecnico?.options[selectTecnico.selectedIndex]?.text || null),
        };
        
        // Si seleccionó "Sin asignar", limpiar campos
        if (!data.tecnicoAsignadoId) {
          data.tecnicoAsignadoId = null;
          data.tecnicoAsignadoNombre = null;
        }

        this.toggleFormLoading(true);
        this.hideError();

        const result = this.isEdit
          ? await updateTicket(this.ticketId, data)
          : await createTicket(data);

        if (result.success) {
          clearDraft(this.isEdit ? `ticket_${this.ticketId}` : 'new_ticket');
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
    });
  }

  initBudgetHandlers() {
    const form = document.getElementById('budget-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const btn = document.getElementById('budget-submit-btn');
      await guardBtn(btn, async () => {
        const errorEl = document.getElementById('budget-error-msg');
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
      });
    });
  }

  _initAutoRecovery() {
    const form = document.getElementById('ticket-form');
    if (!form) return;

    const draftKey = this.isEdit ? `ticket_${this.ticketId}` : 'new_ticket';

    // Snapshot ticket.updatedAt as a string — used to detect stale drafts
    // (if the ticket was saved by another user/tab while this draft sat around)
    const ticketUpdatedAt = this._ticket?.updatedAt
      ? String(this._ticket.updatedAt?.toMillis?.() ?? this._ticket.updatedAt)
      : null;

    // Load draft — skip silently if ticket was modified after draft was saved
    const draft = loadDraft(draftKey, ticketUpdatedAt);
    if (draft) {
      if (confirm('Se encontró un borrador sin guardar. ¿Deseas restaurarlo?')) {
        Object.entries(draft).forEach(([key, val]) => {
          const input = form.elements[key];
          if (input) input.value = val;
        });
        setDirty(true);
      } else {
        clearDraft(draftKey);
      }
    }

    // Save draft on change — include updatedAt snapshot for future staleness checks
    form.addEventListener('input', () => {
      setDirty(true);
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      saveDraft(draftKey, data, ticketUpdatedAt);
    });
  }

  destroy() {
    // Release multitab edit-lock so other tabs can take over
    this._multitabCleanup?.();
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
