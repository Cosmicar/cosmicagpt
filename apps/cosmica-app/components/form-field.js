/**
 * Componente de campo de formulario
 * Genera un grupo de formulario consistente con label e input.
 * 
 * @param {Object} options - Opciones del campo
 * @returns {string} HTML del campo de formulario
 */
export function renderFormField({ 
  label, 
  id, 
  type = 'text', 
  placeholder = '', 
  value = '', 
  required = false,
  disabled = false,
  options = [], // Para selects
  isTextArea = false,
  helpText = '',
  autocomplete = 'on'
}) {
  let inputHtml = '';

  if (isTextArea) {
    inputHtml = `
      <textarea 
        id="${id}" 
        name="${id}" 
        class="input" 
        placeholder="${placeholder}" 
        ${required ? 'required' : ''} 
        ${disabled ? 'disabled' : ''}
        style="min-height: 100px;"
      >${value}</textarea>
    `;
  } else if (type === 'select') {
    const optionsHtml = options.map(opt => `
      <option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>
    `).join('');

    inputHtml = `
      <select 
        id="${id}" 
        name="${id}" 
        class="input" 
        ${required ? 'required' : ''} 
        ${disabled ? 'disabled' : ''}
      >
        <option value="" disabled ${!value ? 'selected' : ''}>Seleccionar ${label.toLowerCase()}...</option>
        ${optionsHtml}
      </select>
    `;
  } else {
    inputHtml = `
      <input 
        type="${type}" 
        id="${id}" 
        name="${id}" 
        class="input" 
        placeholder="${placeholder}" 
        value="${value}" 
        ${required ? 'required' : ''} 
        ${disabled ? 'disabled' : ''}
        autocomplete="${autocomplete}"
      >
    `;
  }

  return `
    <div class="form-group">
      <label for="${id}" class="form-label">${label} ${required ? '<span style="color: var(--danger);">*</span>' : ''}</label>
      ${inputHtml}
      ${helpText ? `<div class="form-helper">${helpText}</div>` : ''}
      <div class="field-validation-msg" id="msg-${id}" style="font-size: 11px; color: var(--danger); margin-top: 4px; display: none; font-weight: 600;"></div>
    </div>
  `;
}
