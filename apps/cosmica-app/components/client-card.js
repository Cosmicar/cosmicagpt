import { canAccess } from '../core/session.js';

export function render(cliente) {
  const canEdit = canAccess('create-client'); // Usamos create-client como permiso para recepcion/admin

  return `
    <div class="card glass-card" style="display: flex; flex-direction: column;">
      <div class="flex-between" style="align-items: flex-start; margin-bottom: var(--space-sm);">
        <div style="flex: 1; min-width: 0;">
          <h3 class="card-title text-truncate" title="${cliente.nombre || ''} ${cliente.apellido || ''}" style="font-size: var(--font-md); margin: 0;">
            ${cliente.nombre || 'Sin Nombre'} ${cliente.apellido || ''}
          </h3>
          <div class="vm-meta" style="font-size: var(--font-xs); color: var(--text-muted); margin-top: 2px;">DNI: ${cliente.dni || 'N/A'}</div>
        </div>
        <div class="badge badge-gray vm-meta">Cliente</div>
      </div>
      
      <div style="flex: 1;">
        <p style="color: var(--text-muted); font-size: var(--font-sm); margin-bottom: var(--space-md);">
          <strong style="color: var(--text-primary);">Tel:</strong> ${cliente.telefono || 'N/A'}<br>
          <strong style="color: var(--text-primary);">Provincia:</strong> ${cliente.provincia || 'N/A'}<br>
          <span class="vm-details">
            <strong style="color: var(--text-primary);">Email:</strong> <span class="text-truncate" style="display: inline-block; max-width: 150px; vertical-align: bottom;">${cliente.email || 'N/A'}</span>
          </span>
        </p>
      </div>
      
      ${canEdit ? `
      <div class="vm-details" style="margin-top: var(--space-md); border-top: 1px solid var(--border); padding-top: var(--space-sm); display: flex; justify-content: flex-end;">
        <a href="#cliente-edit?id=${cliente.id}" class="btn btn-sm btn-secondary" style="width: 100%;">
          <i>📝</i> Editar Perfil
        </a>
      </div>
      ` : ''}
    </div>
  `;
}
