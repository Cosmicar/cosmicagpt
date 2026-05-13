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
  isTextArea = false
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
        style="min-height: 100px; resize: vertical;"
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
        style="appearance: none; background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E'); background-repeat: no-repeat; background-position: right 12px center; background-size: 16px;"
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
      >
    `;
  }

  return `
    <div class="form-group">
      <label for="${id}" class="form-label">${label} ${required ? '<span style="color: var(--danger);">*</span>' : ''}</label>
      ${inputHtml}
      <div class="field-validation-msg" id="msg-${id}" style="font-size: var(--font-xs); color: var(--danger); margin-top: 4px; display: none;"></div>
    </div>
  `;
}
