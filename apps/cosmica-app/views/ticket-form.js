import { AsyncView } from '../core/async-view.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';
import { renderFormField } from '../components/form-field.js';
import { renderFormActions } from '../components/form-actions.js';
import { getClientes } from '../services/clientes.js';
import { createTicket, getTicket, updateTicket, updateTicketBudget } from '../services/tickets.js';
import { showToast } from '../components/toast.js';
import { renderTicketTimeline, mountTicketTimeline } from '../components/ticket-timeline.js';

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

  async loadData() {
    // Carga paralela de clientes y ticket (si es edición)
    const [clientes, ticket] = await Promise.all([
      getClientes(),
      this.isEdit ? getTicket(this.ticketId) : Promise.resolve(null)
    ]);

    if (this.isEdit && !ticket) {
      throw new Error("No se pudo encontrar el trabajo solicitado.");
    }

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
      <div id="ticket-form-wrapper" class="animate-fade-in">
        ${breadcrumbHtml}
        ${headerHtml}

        <div class="card glass-card" style="margin-top: var(--space-xl); max-width: 900px;">
          <div id="form-error-msg" class="badge badge-danger" style="display: none; width: 100%; margin-bottom: var(--space-md); padding: var(--space-md); text-align: center; background: rgba(255, 0, 127, 0.1); border: 1px solid var(--danger);"></div>
          
          <form id="ticket-form">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-lg);">
              
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

            <div style="margin-top: var(--space-lg);">
              ${renderFormField({
                label: 'Problema Reportado',
                id: 'problema',
                placeholder: 'Describa el fallo o inconveniente...',
                isTextArea: true,
                value: ticket?.problema || '',
                required: true
              })}
            </div>

            <div style="margin-top: var(--space-md); display: flex; align-items: center; gap: var(--space-sm); color: var(--text-muted); font-size: var(--font-xs);">
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
      </div>

      ${this.isEdit ? renderBudgetSection(ticket) : ''}

      ${this.isEdit ? renderTicketTimeline() : ''}
    `;
  }

  onContentReady() {
    this.initFormHandlers();
    if (this.isEdit) {
      this.initBudgetHandlers();
      mountTicketTimeline(this.ticketId);
    }
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
