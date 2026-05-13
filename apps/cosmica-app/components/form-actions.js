/**
 * Componente de acciones de formulario
 * Renderiza los botones de Guardar y Cancelar con estilos consistentes.
 * 
 * @param {Object} options - Opciones de las acciones
 * @returns {string} HTML de las acciones de formulario
 */
export function renderFormActions({ 
  saveLabel = 'Guardar Cambios', 
  cancelLabel = 'Cancelar', 
  onCancelHref = '#',
  isSubmitting = false 
}) {
  return `
    <div class="form-actions" style="display: flex; gap: var(--space-md); margin-top: var(--space-xl); padding-top: var(--space-lg); border-top: 1px solid var(--border);">
      <a href="${onCancelHref}" class="btn btn-secondary" style="flex: 1; text-decoration: none;">
        ${cancelLabel}
      </a>
      <button type="submit" class="btn btn-primary" style="flex: 2;" ${isSubmitting ? 'disabled' : ''}>
        ${isSubmitting ? 'Procesando...' : saveLabel}
      </button>
    </div>
  `;
}
