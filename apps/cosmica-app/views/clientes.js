import { getClientes } from '../services/clientes.js';
import { renderLoadingState, renderErrorState, renderEmptyState } from '../components/app-state.js';

/**
 * Vista de Clientes
 */
export function render() {
  // Disparamos la carga asíncrona después de retornar el contenedor inicial
  setTimeout(() => loadClientesData(), 0);
  
  return `
    <div id="clientes-container">
      ${renderLoadingState()}
    </div>
  `;
}

/**
 * Carga los datos de los clientes y actualiza el DOM
 */
async function loadClientesData() {
  const container = document.getElementById('clientes-container');
  if (!container) return;
  
  try {
    const clientes = await getClientes();
    
    if (clientes.length === 0) {
      container.innerHTML = renderEmptyState('No hay clientes registrados en el sistema.');
      return;
    }
    
    let html = `
      <div class="card glass-card">
        <div class="badge badge-cyan">👥 Módulo</div>
        <h2 class="card-title" style="margin-top: var(--space-md);">Clientes</h2>
        <p style="color: var(--text-muted); margin-top: var(--space-sm);">Listado de clientes registrados en el sistema Cosmica.</p>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-lg); margin-top: var(--space-xl);">
    `;
    
    clientes.forEach(cliente => {
      html += `
        <div class="card glass-card">
          <h3 class="card-title" style="font-size: var(--font-md);">${cliente.nombre || 'Sin Nombre'} ${cliente.apellido || ''}</h3>
          <p style="color: var(--text-muted); font-size: var(--font-sm); margin-top: var(--space-sm);">
            <strong>DNI:</strong> ${cliente.dni || 'N/A'}<br>
            <strong>Tel:</strong> ${cliente.telefono || 'N/A'}<br>
            <strong>Provincia:</strong> ${cliente.provincia || 'N/A'}
          </p>
        </div>
      `;
    });
    
    html += `</div>`;
    container.innerHTML = html;
    
  } catch (error) {
    console.error("Error al cargar datos de clientes en la vista:", error);
    container.innerHTML = renderErrorState('No se pudo cargar el listado de clientes. Verifica tu conexión.');
  }
}
