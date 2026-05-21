import { canAccess } from '../core/session.js';
import { normalizeProvincia } from '../core/utils.js';

export function render(cliente) {
  const canEdit = canAccess('create-client'); // Usamos create-client como permiso para recepcion/admin

  return `
    <div class="card glass-card" style="display: flex; flex-direction: column;">

      <!-- Header: nombre + badges -->
      <div class="flex-between" style="align-items: flex-start; margin-bottom: var(--space-sm);">
        <div style="flex: 1; min-width: 0; overflow: hidden;">
          <h3 class="card-title text-truncate"
              title="${cliente.nombre || ''} ${cliente.apellido || ''}"
              style="font-size: var(--font-md); margin: 0;">
            ${cliente.nombre || 'Sin Nombre'} ${cliente.apellido || ''}
          </h3>
          <div class="vm-meta" style="font-size: var(--font-xs); color: var(--text-muted); margin-top: 2px;">
            DNI: ${cliente.dni || '—'}
          </div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; margin-left: var(--space-sm);">
          <div class="badge badge-gray vm-meta">Cliente</div>
          ${cliente.badge ? `<div class="badge ${cliente.badge.class}" style="font-size: 10px; white-space: nowrap;">${cliente.badge.label}</div>` : ''}
        </div>
      </div>

      <!-- Body: datos de contacto -->
      <div style="flex: 1; min-width: 0;">
        <p style="color: var(--text-muted); font-size: var(--font-sm); margin: 0 0 var(--space-sm) 0; line-height: 1.7;">
          <strong style="color: var(--text-primary);">Tel:</strong>
          <span class="text-truncate" style="display: inline-block; max-width: calc(100% - 32px); vertical-align: bottom;">${cliente.telefono || '—'}</span><br>
          <strong style="color: var(--text-primary);">Provincia:</strong> ${normalizeProvincia(cliente.provincia) || '—'}<br>
          <span class="vm-details">
            <strong style="color: var(--text-primary);">Email:</strong>
            <span class="text-truncate" style="display: inline-block; max-width: calc(100% - 48px); vertical-align: bottom;">${cliente.email || '—'}</span>
          </span>
        </p>
      </div>

      <!-- Footer: action buttons — scoped container prevents flex-stretch -->
      ${canEdit ? `
      <div class="client-actions" style="margin-top: var(--space-md); padding-top: var(--space-sm); border-top: 1px solid var(--border); display: flex; gap: var(--space-xs);">
        <a href="#cliente-edit?id=${cliente.id}" class="btn btn-sm btn-secondary client-edit-btn" style="flex: 1; justify-content: center; font-weight: 600;">
          📝 Editar
        </a>
        <button class="btn btn-sm btn-secondary client-merge-btn"
                data-id="${cliente.id}"
                style="color: var(--accent-cyan); border-color: rgba(0, 229, 255, 0.1); width: 38px; flex-shrink: 0;"
                title="Fusionar con otro">🔗</button>
        <button class="btn btn-sm btn-secondary client-delete-btn"
                data-id="${cliente.id}"
                style="color: var(--danger); border-color: rgba(255, 71, 87, 0.1); width: 38px; flex-shrink: 0;"
                title="Eliminar cliente">🗑</button>
      </div>
      ` : ''}

    </div>
  `;
}
