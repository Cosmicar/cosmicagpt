import { render as renderSectionHeader } from '../components/section-header.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';
import { renderFormField } from '../components/form-field.js';
import { renderFormActions } from '../components/form-actions.js';
import { createCliente } from '../services/clientes.js';

/**
 * Vista de Formulario de Cliente (Persistencia Real)
 */
export function render() {
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
    { label: 'Nuevo Cliente', href: '#cliente-nuevo', icon: '👤' }
  ]);

  const headerHtml = renderSectionHeader(
    'Nuevo Cliente', 
    'Complete los datos para registrar un nuevo cliente en la plataforma.', 
    '👤 Registro'
  );

  // Inicializar manejadores después de que el DOM se actualice
  setTimeout(() => initFormHandlers(), 0);

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
              saveLabel: 'Registrar Cliente',
              onCancelHref: '#clientes'
            })}
          </div>

        </form>
      </div>
    </div>
  `;
}

/**
 * Inicializa los eventos del formulario
 */
function initFormHandlers() {
  const form = document.getElementById('cliente-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // Cambiar estado a loading
    toggleFormLoading(true);
    hideError();

    const result = await createCliente(data);

    if (result.success) {
      form.reset();
      // Pequeño retraso para que el usuario vea el éxito (opcional, aquí redirigimos directo)
      window.location.hash = '#clientes';
    } else {
      showError(result.error);
      toggleFormLoading(false);
    }
  });
}

/**
 * Controla el estado visual de carga del formulario
 */
function toggleFormLoading(isLoading) {
  const actionsContainer = document.getElementById('form-actions-container');
  if (actionsContainer) {
    actionsContainer.innerHTML = renderFormActions({
      saveLabel: 'Registrar Cliente',
      onCancelHref: '#clientes',
      isSubmitting: isLoading
    });
  }
  
  const inputs = document.querySelectorAll('#cliente-form input, #cliente-form select, #cliente-form textarea');
  inputs.forEach(input => input.disabled = isLoading);
}

/**
 * Muestra mensaje de error
 */
function showError(message) {
  const errorMsg = document.getElementById('form-error-msg');
  if (errorMsg) {
    errorMsg.textContent = message;
    errorMsg.style.display = 'block';
    errorMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * Oculta mensaje de error
 */
function hideError() {
  const errorMsg = document.getElementById('form-error-msg');
  if (errorMsg) {
    errorMsg.style.display = 'none';
  }
}
