/**
 * Componente para renderizar una card de cliente
 * 
 * @param {Object} cliente 
 * @returns {string} HTML
 */
export function render(cliente) {
  return `
    <div class="card glass-card">
      <h3 class="card-title" style="font-size: var(--font-md);">${cliente.nombre || 'Sin Nombre'} ${cliente.apellido || ''}</h3>
      <p style="color: var(--text-muted); font-size: var(--font-sm); margin-top: var(--space-sm);">
        <strong>DNI:</strong> ${cliente.dni || 'N/A'}<br>
        <strong>Tel:</strong> ${cliente.telefono || 'N/A'}<br>
        <strong>Provincia:</strong> ${cliente.provincia || 'N/A'}
      </p>
      <div style="margin-top: var(--space-md); border-top: 1px solid var(--border); padding-top: var(--space-sm); display: flex; justify-content: flex-end;">
        <a href="#cliente-edit?id=${cliente.id}" class="btn btn-sm btn-secondary" style="font-size: var(--font-xs);">
          <i>📝</i> Editar
        </a>
      </div>
    </div>
  `;
}
