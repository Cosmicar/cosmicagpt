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
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
          <div class="badge badge-gray vm-meta">Cliente</div>
          ${cliente.badge ? `<div class="badge ${cliente.badge.class}" style="font-size: 10px; white-space: nowrap;">${cliente.badge.label}</div>` : ''}
        </div>
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
        <a href="#cliente-edit?id=${cliente.id}" class="btn btn-sm btn-secondary" style="flex: 1; text-align: center;">
          <i>📝</i> Editar
        </a>
        <button class="btn btn-sm btn-secondary client-merge-btn" data-id="${cliente.id}" style="color: var(--accent-cyan); border-color: rgba(0, 229, 255, 0.2);" title="Fusionar con otro">🔗</button>
        <button class="btn btn-sm btn-secondary client-delete-btn" data-id="${cliente.id}" style="color: var(--danger); border-color: rgba(255, 71, 87, 0.2);" title="Eliminar cliente">🗑</button>
      </div>
      ` : ''}
    </div>
  `;
}
