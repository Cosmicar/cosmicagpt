import { AsyncView } from '../core/async-view.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';
import { renderFormField } from '../components/form-field.js';
import { renderFormActions } from '../components/form-actions.js';
import { getClientes } from '../services/clientes.js';
import { createTicket } from '../services/tickets.js';
import { showToast } from '../components/toast.js';

/**
 * Vista de Formulario para Nuevo Trabajo/Ticket
 */
export class TicketFormView extends AsyncView {
  constructor() {
    super();
    this.containerId = 'ticket-form-container';
  }

  async loadData() {
    // Necesitamos la lista de clientes para el selector
    return await getClientes();
  }

  renderContent(clientes) {
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
      { label: 'Nuevo Trabajo', href: '#ticket-nuevo', icon: '➕' }
    ]);

    const headerHtml = renderSectionHeader(
      'Nuevo Orden de Trabajo', 
      'Registre un nuevo servicio técnico en el sistema.', 
      '🛠️ Registro'
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
                required: true
              })}

              ${renderFormField({
                label: 'Tipo de Servicio',
                id: 'tipo',
                type: 'select',
                options: typeOptions,
                required: true
              })}

              ${renderFormField({
                label: 'Equipo / Dispositivo',
                id: 'equipo',
                placeholder: 'Ej: Notebook HP Pavilion',
                required: true
              })}

              ${renderFormField({
                label: 'Marca / Modelo',
                id: 'marca_modelo',
                placeholder: 'Ej: Asus ROG - GL553'
              })}

              ${renderFormField({
                label: 'Plan de Servicio',
                id: 'planServicio',
                type: 'select',
                options: planOptions,
                required: true
              })}

              ${renderFormField({
                label: 'Presupuesto Inicial ($)',
                id: 'precio',
                type: 'number',
                placeholder: 'Ej: 5000'
              })}

            </div>

            <div style="margin-top: var(--space-lg);">
              ${renderFormField({
                label: 'Problema Reportado',
                id: 'problema',
                placeholder: 'Describa el fallo o inconveniente...',
                isTextArea: true,
                required: true
              })}
            </div>

            <div style="margin-top: var(--space-md); display: flex; align-items: center; gap: var(--space-sm); color: var(--text-muted); font-size: var(--font-xs);">
              <span style="color: var(--danger);">*</span> Campos obligatorios
            </div>

            <div id="form-actions-container">
              ${renderFormActions({
                saveLabel: 'Crear Orden de Trabajo',
                onCancelHref: '#tickets'
              })}
            </div>

          </form>
        </div>
      </div>
    `;
  }

  onContentReady() {
    this.initFormHandlers();
  }

  initFormHandlers() {
    const form = document.getElementById('ticket-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(form);
      const rawData = Object.fromEntries(formData.entries());
      
      // Separar marca y modelo si se ingresaron juntos (opcional, simplificado)
      const data = {
        ...rawData,
        marca: rawData.marca_modelo || '',
        modelo: ''
      };

      this.toggleFormLoading(true);
      this.hideError();

      const result = await createTicket(data);

      if (result.success) {
        showToast(`Orden ${result.numeroOrden} creada con éxito`, 'success');
        
        setTimeout(() => {
          window.location.hash = '#tickets';
        }, 1200);
      } else {
        showToast(result.error || 'Error al crear la orden', 'error');
        this.showError(result.error);
        this.toggleFormLoading(false);
      }
    });
  }

  toggleFormLoading(isLoading) {
    const actionsContainer = document.getElementById('form-actions-container');
    if (actionsContainer) {
      actionsContainer.innerHTML = renderFormActions({
        saveLabel: 'Crear Orden de Trabajo',
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
