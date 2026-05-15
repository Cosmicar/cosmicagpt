import { BaseView } from '../core/base-view.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';
import { renderFormField } from '../components/form-field.js';
import { renderFormActions } from '../components/form-actions.js';
import { createCliente, getCliente, updateCliente } from '../services/clientes.js';
import { showToast } from '../components/toast.js';
import { 
  guardBtn, setDirty, initUnsavedChangesGuard, 
  saveDraft, loadDraft, clearDraft 
} from '../core/chaos-guard.js';

/**
 * Vista de Formulario de Cliente (Creación y Edición)
 */
export class ClienteFormView extends BaseView {
  constructor(params) {
    super(params);
    this.clienteId = this.params.get('id');
    this.isEdit = !!this.clienteId;
  }

  render() {
    const provinces = [
      { value: 'buenos_aires', label: 'Buenos Aires' },
      { value: 'caba', label: 'CABA' },
      { value: 'cordoba', label: 'Córdoba' },
      { value: 'santa_fe', label: 'Santa Fe' },
      { value: 'mendoza', label: 'Mendoza' }
    ];

    const breadcrumbHtml = renderBreadcrumb([
      { label: 'Administración', href: '#dashboard', icon: '📁' },
      { label: 'Clientes', href: '#clientes', icon: '👥' },
      { label: this.isEdit ? 'Editar Cliente' : 'Nuevo Cliente', href: this.isEdit ? `#cliente-edit?id=${this.clienteId}` : '#cliente-nuevo', icon: '👤' }
    ]);

    const headerHtml = renderSectionHeader(
      this.isEdit ? 'Editar Cliente' : 'Nuevo Cliente', 
      this.isEdit ? 'Modifique los datos del cliente seleccionado.' : 'Complete los datos para registrar un nuevo cliente en la plataforma.', 
      this.isEdit ? '📝 Edición' : '👤 Registro'
    );

    return `
      <div id="cliente-form-container" class="animate-fade-in">
        ${breadcrumbHtml}
        ${headerHtml}

        <div class="card glass-card" style="margin-top: var(--space-xl); max-width: 800px;">
          <div id="form-error-msg" class="badge badge-danger" style="display: none; width: 100%; margin-bottom: var(--space-md); padding: var(--space-md); text-align: center; background: rgba(255, 0, 127, 0.1); border: 1px solid var(--danger);"></div>
          
          <form id="cliente-form">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-lg);">
              
              ${renderFormField({
                label: 'Nombre Completo',
                id: 'nombre',
                placeholder: 'Ej: Juan Pérez',
                required: true
              })}

              ${renderFormField({
                label: 'DNI / CUIT',
                id: 'dni',
                placeholder: 'Ej: 20-12345678-9',
                required: true
              })}

              ${renderFormField({
                label: 'Teléfono de Contacto',
                id: 'telefono',
                placeholder: 'Ej: +54 9 11 1234-5678',
                required: true
              })}

              ${renderFormField({
                label: 'Provincia',
                id: 'provincia',
                type: 'select',
                options: provinces,
                required: true
              })}

            </div>

            <div style="margin-top: var(--space-lg);">
              ${renderFormField({
                label: 'Observaciones Internas',
                id: 'observaciones',
                placeholder: 'Notas adicionales sobre el cliente...',
                isTextArea: true
              })}
            </div>

            <div style="margin-top: var(--space-md); display: flex; align-items: center; gap: var(--space-sm); color: var(--text-muted); font-size: var(--font-xs);">
              <span style="color: var(--danger);">*</span> Campos obligatorios
            </div>

            <div id="form-actions-container">
              ${renderFormActions({
                saveLabel: this.isEdit ? 'Actualizar Cliente' : 'Registrar Cliente',
                onCancelHref: '#clientes'
              })}
            </div>

          </form>
        </div>
      </div>
    `;
  }

  async afterRender() {
    this.initFormHandlers();
    this._initAutoRecovery();
    initUnsavedChangesGuard();

    if (this.isEdit) {
      await this.loadClienteData();
    }
    const firstInput = document.getElementById('nombre');
    if (firstInput) firstInput.focus();
  }

  _initAutoRecovery() {
    const form = document.getElementById('cliente-form');
    if (!form) return;
    const draftKey = this.isEdit ? `cliente_${this.clienteId}` : 'new_cliente';
    
    const draft = loadDraft(draftKey);
    if (draft && confirm('Se encontró un borrador sin guardar. ¿Deseas restaurarlo?')) {
      Object.entries(draft).forEach(([key, val]) => {
        if (form.elements[key]) form.elements[key].value = val;
      });
      setDirty(true);
    }

    form.addEventListener('input', () => {
      setDirty(true);
      const data = Object.fromEntries(new FormData(form).entries());
      saveDraft(draftKey, data);
    });
  }

  async loadClienteData() {
    this.toggleFormLoading(true);
    try {
      const cliente = await getCliente(this.clienteId);
      const form = document.getElementById('cliente-form');
      if (form && cliente) {
        form.nombre.value = cliente.nombre || '';
        form.dni.value = cliente.dni || '';
        form.telefono.value = cliente.telefono || '';
        form.provincia.value = cliente.provincia || 'buenos_aires';
        form.observaciones.value = cliente.observaciones || '';
      }
    } catch (error) {
      this.showError("Error al cargar datos del cliente: " + error.message);
    } finally {
      this.toggleFormLoading(false);
    }
  }

  initFormHandlers() {
    const form = document.getElementById('cliente-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      
      await guardBtn(submitBtn, async () => {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        this.toggleFormLoading(true);
        this.hideError();

        const result = this.isEdit 
          ? await updateCliente(this.clienteId, data)
          : await createCliente(data);

        if (result.success) {
          clearDraft(this.isEdit ? `cliente_${this.clienteId}` : 'new_cliente');
          showToast(this.isEdit ? 'Cliente actualizado con éxito' : 'Cliente registrado con éxito', 'success');
          if (!this.isEdit) form.reset();
          
          setTimeout(() => {
            window.location.hash = '#clientes';
          }, 1000);
        } else {
          showToast(result.error || 'Error al procesar la solicitud', 'error');
          this.showError(result.error);
          this.toggleFormLoading(false);
        }
      });
    });
  }

  toggleFormLoading(isLoading) {
    const actionsContainer = document.getElementById('form-actions-container');
    if (actionsContainer) {
      actionsContainer.innerHTML = renderFormActions({
        saveLabel: this.isEdit ? 'Actualizar Cliente' : 'Registrar Cliente',
        onCancelHref: '#clientes',
        isSubmitting: isLoading
      });
    }
    
    const inputs = document.querySelectorAll('#cliente-form input, #cliente-form select, #cliente-form textarea');
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
