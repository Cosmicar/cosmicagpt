import { BaseView } from '../core/base-view.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { showToast } from '../components/toast.js';
import {
  listAllUsers, createUser, updateUser,
  agregarPuntos, getPuntosLog,
  listBeneficios, saveBeneficio, deleteBeneficio,
  listPenalidades, savePenalidad, deletePenalidad,
  aplicarPreset,
  PERMISOS_LABEL, PERMISOS_POR_ROL, ROLES_INFO
} from '../services/admin.js';

const ROLES_MAP = Object.fromEntries(ROLES_INFO.map(r => [r.value, r]));

export class UsuariosView extends BaseView {
  constructor(params) {
    super(params);
    this._tab = params?.get('tab') || 'operadores';
    this._users = [];
    this._beneficios = [];
    this._penalidades = [];
  }

  // ── helpers de UI (mismo estilo que ConfiguracionView) ─────────

  _tabBtn(id, label, icon) {
    const active = this._tab === id;
    return `<button type="button" class="config-tab-btn${active ? ' active' : ''}" data-tab="${id}" style="
      display:flex;align-items:center;gap:8px;padding:10px 20px;
      border:none;background:${active ? 'rgba(0,229,255,0.12)' : 'transparent'};
      color:${active ? 'var(--accent-cyan)' : 'var(--text-muted)'};cursor:pointer;
      font-size:13px;font-weight:600;border-radius:var(--radius-md);
      border-bottom:2px solid ${active ? 'var(--accent-cyan)' : 'transparent'};
      transition:all 0.2s ease;white-space:nowrap;
    ">${icon} ${label}</button>`;
  }

  _badge(text, color) {
    return `<span style="display:inline-block;padding:2px 10px;border-radius:20px;
      font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
      background:${color}22;color:${color};border:1px solid ${color}44;">${text}</span>`;
  }

  _emptyRow(colspan, msg) {
    return `<tr><td colspan="${colspan}" style="text-align:center;padding:32px;color:var(--text-muted);font-size:13px;">${msg}</td></tr>`;
  }

  _tableHead(...cols) {
    return `<thead><tr style="border-bottom:1px solid var(--border);">
      ${cols.map(c => `<th style="padding:12px 14px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);text-align:left;">${c}</th>`).join('')}
    </tr></thead>`;
  }

  // ── renderizado de tabs ───────────────────────────────────────

  _renderTabOperadores(users) {
    const rows = users.length
      ? users.map(u => {
          const rol = ROLES_MAP[u.rol] || { label: u.rol, color: 'var(--text-muted)' };
          const activo = u.activo !== false;
          const pts = u.puntos ?? 0;
          return `<tr class="table-row-hover" style="border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.15s;">
            <td style="padding:14px;">
              <div style="font-weight:600;color:var(--text-primary);">${u.nombre || '—'}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${u.email || ''}</div>
            </td>
            <td style="padding:14px;">${this._badge(rol.label, rol.color)}</td>
            <td style="padding:14px;">
              ${activo
                ? `<span style="color:#10B981;font-size:12px;font-weight:600;">● Activo</span>`
                : `<span style="color:var(--text-muted);font-size:12px;font-weight:600;">● Inactivo</span>`}
            </td>
            <td style="padding:14px;font-weight:700;font-size:15px;color:${pts >= 0 ? '#10B981' : '#EF4444'};">
              ${pts >= 0 ? '+' : ''}${pts}
            </td>
            <td style="padding:14px;">
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button data-action="edit-user" data-uid="${u.id}" class="btn btn-secondary"
                  style="padding:5px 12px;font-size:12px;">Editar</button>
                <button data-action="open-puntos" data-uid="${u.id}" class="btn btn-secondary"
                  style="padding:5px 12px;font-size:12px;border-color:var(--accent-cyan);color:var(--accent-cyan);">⭐ Puntos</button>
              </div>
            </td>
          </tr>`;
        }).join('')
      : this._emptyRow(5, 'Sin usuarios registrados');

    return `
      <div style="display:flex;justify-content:flex-end;margin-bottom:var(--space-lg);">
        <button class="btn btn-primary" id="btn-crear-usuario" style="padding:10px 22px;font-weight:600;">
          + Nuevo usuario
        </button>
      </div>
      <div style="overflow-x:auto;border-radius:var(--radius-lg);border:1px solid var(--border);">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          ${this._tableHead('Usuario', 'Rol', 'Estado', 'Puntos', 'Acciones')}
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  _renderTabBeneficios(items) {
    const rows = items.length
      ? items.map(b => `<tr class="table-row-hover" style="border-bottom:1px solid rgba(255,255,255,0.04);">
          <td style="padding:14px;font-weight:600;">${b.nombre}</td>
          <td style="padding:14px;color:var(--text-muted);font-size:12px;">${b.descripcion || '—'}</td>
          <td style="padding:14px;color:#10B981;font-weight:700;">+${b.puntos} pts</td>
          <td style="padding:14px;">${b.activo !== false
            ? `<span style="color:#10B981;font-size:12px;font-weight:600;">● Activo</span>`
            : `<span style="color:var(--text-muted);font-size:12px;">● Inactivo</span>`}
          </td>
          <td style="padding:14px;">
            <div style="display:flex;gap:6px;">
              <button data-action="edit-beneficio" data-id="${b.id}" data-item='${JSON.stringify(b)}'
                class="btn btn-secondary" style="padding:5px 12px;font-size:12px;">Editar</button>
              <button data-action="del-beneficio" data-id="${b.id}"
                class="btn btn-secondary" style="padding:5px 12px;font-size:12px;border-color:#EF4444;color:#EF4444;">Eliminar</button>
            </div>
          </td>
        </tr>`).join('')
      : this._emptyRow(5, 'Sin beneficios registrados. Creá el primero.');

    return `
      <div style="display:flex;justify-content:flex-end;margin-bottom:var(--space-lg);">
        <button class="btn btn-primary" id="btn-crear-beneficio"
          style="padding:10px 22px;font-weight:600;background:rgba(16,185,129,0.12);color:#10B981;border:1px solid rgba(16,185,129,0.3);">
          + Agregar beneficio
        </button>
      </div>
      <div style="overflow-x:auto;border-radius:var(--radius-lg);border:1px solid var(--border);">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          ${this._tableHead('Nombre', 'Descripción', 'Puntos', 'Estado', 'Acciones')}
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  _renderTabPenalidades(items) {
    const rows = items.length
      ? items.map(p => `<tr class="table-row-hover" style="border-bottom:1px solid rgba(255,255,255,0.04);">
          <td style="padding:14px;font-weight:600;">${p.nombre}</td>
          <td style="padding:14px;color:var(--text-muted);font-size:12px;">${p.descripcion || '—'}</td>
          <td style="padding:14px;color:#EF4444;font-weight:700;">${p.puntos} pts</td>
          <td style="padding:14px;">${p.activo !== false
            ? `<span style="color:#10B981;font-size:12px;font-weight:600;">● Activo</span>`
            : `<span style="color:var(--text-muted);font-size:12px;">● Inactivo</span>`}
          </td>
          <td style="padding:14px;">
            <div style="display:flex;gap:6px;">
              <button data-action="edit-penalidad" data-id="${p.id}" data-item='${JSON.stringify(p)}'
                class="btn btn-secondary" style="padding:5px 12px;font-size:12px;">Editar</button>
              <button data-action="del-penalidad" data-id="${p.id}"
                class="btn btn-secondary" style="padding:5px 12px;font-size:12px;border-color:#EF4444;color:#EF4444;">Eliminar</button>
            </div>
          </td>
        </tr>`).join('')
      : this._emptyRow(5, 'Sin penalidades registradas. Creá la primera.');

    return `
      <div style="display:flex;justify-content:flex-end;margin-bottom:var(--space-lg);">
        <button class="btn btn-primary" id="btn-crear-penalidad"
          style="padding:10px 22px;font-weight:600;background:rgba(239,68,68,0.1);color:#EF4444;border:1px solid rgba(239,68,68,0.3);">
          + Agregar penalidad
        </button>
      </div>
      <div style="overflow-x:auto;border-radius:var(--radius-lg);border:1px solid var(--border);">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          ${this._tableHead('Nombre', 'Descripción', 'Puntos', 'Estado', 'Acciones')}
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  render() {
    const breadcrumb = renderBreadcrumb([
      { label: 'Administración', href: '#dashboard', icon: '⚙️' },
      { label: 'Operadores', href: '#usuarios', icon: '👥' }
    ]);
    const header = renderSectionHeader('Gestión de Operadores', 'Usuarios, roles, permisos y sistema de puntos.', '👥 Módulo');

    return `
      <div class="animate-fade-in" style="display:flex;flex-direction:column;gap:var(--space-lg);">
        ${breadcrumb}
        ${header}

        <div style="display:flex;gap:4px;background:rgba(0,0,0,0.2);border:1px solid var(--border);
          border-radius:var(--radius-lg);padding:6px;overflow-x:auto;width:fit-content;">
          ${this._tabBtn('operadores', 'Operadores', '👤')}
          ${this._tabBtn('beneficios', 'Beneficios', '🎁')}
          ${this._tabBtn('penalidades', 'Penalidades', '⚠️')}
        </div>

        <div class="card glass-card" style="padding:var(--space-xl);position:relative;overflow:hidden;">
          <div style="position:absolute;top:-60px;right:-60px;width:180px;height:180px;
            background:var(--accent-cyan);filter:blur(100px);opacity:0.06;pointer-events:none;"></div>

          <div id="tab-panel-operadores"   style="display:${this._tab === 'operadores'  ? 'block' : 'none'};">
            <div id="usuarios-content">Cargando...</div>
          </div>
          <div id="tab-panel-beneficios"   style="display:${this._tab === 'beneficios'  ? 'block' : 'none'};">
            <div id="beneficios-content">Cargando...</div>
          </div>
          <div id="tab-panel-penalidades"  style="display:${this._tab === 'penalidades' ? 'block' : 'none'};">
            <div id="penalidades-content">Cargando...</div>
          </div>
        </div>
      </div>`;
  }

  async afterRender() {
    // Cargar datos en paralelo — cada uno falla de forma independiente
    const [usersResult, benResult, penResult] = await Promise.allSettled([
      listAllUsers(), listBeneficios(), listPenalidades()
    ]);

    if (usersResult.status === 'fulfilled') {
      this._users = usersResult.value;
    } else {
      console.warn('[Usuarios] listAllUsers:', usersResult.reason?.message);
      showToast('No se pudieron cargar los usuarios: ' + usersResult.reason?.message, 'error');
    }

    if (benResult.status === 'fulfilled') {
      this._beneficios = benResult.value;
    } else {
      console.warn('[Usuarios] listBeneficios:', benResult.reason?.message);
      showToast('Beneficios no disponibles — desplegá las reglas de Firestore.', 'info');
    }

    if (penResult.status === 'fulfilled') {
      this._penalidades = penResult.value;
    } else {
      console.warn('[Usuarios] listPenalidades:', penResult.reason?.message);
    }

    this._renderAllPanels();
    this._bindTabSwitching();
    this._bindTableActions();
  }

  _renderAllPanels() {
    const op  = document.getElementById('usuarios-content');
    const ben = document.getElementById('beneficios-content');
    const pen = document.getElementById('penalidades-content');
    if (op)  op.innerHTML  = this._renderTabOperadores(this._users);
    if (ben) ben.innerHTML = this._renderTabBeneficios(this._beneficios);
    if (pen) pen.innerHTML = this._renderTabPenalidades(this._penalidades);
    this._bindTableActions();
    this._bindTabButtons();
  }

  _bindTabSwitching() {
    document.querySelectorAll('.config-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._tab = btn.dataset.tab;
        document.querySelectorAll('.config-tab-btn').forEach(b => {
          const active = b.dataset.tab === this._tab;
          b.style.background  = active ? 'rgba(0,229,255,0.12)' : 'transparent';
          b.style.color       = active ? 'var(--accent-cyan)' : 'var(--text-muted)';
          b.style.borderBottom = active ? '2px solid var(--accent-cyan)' : '2px solid transparent';
        });
        ['operadores', 'beneficios', 'penalidades'].forEach(t => {
          const panel = document.getElementById(`tab-panel-${t}`);
          if (panel) panel.style.display = t === this._tab ? 'block' : 'none';
        });
      });
    });
  }

  _bindTabButtons() {
    document.getElementById('btn-crear-usuario')
      ?.addEventListener('click', () => this._modalCrearUsuario());
    document.getElementById('btn-crear-beneficio')
      ?.addEventListener('click', () => this._modalBeneficio(null));
    document.getElementById('btn-crear-penalidad')
      ?.addEventListener('click', () => this._modalPenalidad(null));
  }

  _bindTableActions() {
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;

        if (action === 'edit-user') {
          const u = this._users.find(x => x.id === btn.dataset.uid);
          if (u) this._modalEditarUsuario(u);
        }
        if (action === 'open-puntos') {
          const u = this._users.find(x => x.id === btn.dataset.uid);
          if (u) this._modalPuntos(u);
        }
        if (action === 'edit-beneficio') {
          this._modalBeneficio(JSON.parse(btn.dataset.item));
        }
        if (action === 'del-beneficio') {
          if (!confirm('¿Eliminar este beneficio?')) return;
          try {
            await deleteBeneficio(btn.dataset.id);
            this._beneficios = await listBeneficios();
            document.getElementById('beneficios-content').innerHTML = this._renderTabBeneficios(this._beneficios);
            this._bindTableActions();
            showToast('Beneficio eliminado', 'success');
          } catch (e) { showToast(e.message, 'error'); }
        }
        if (action === 'edit-penalidad') {
          this._modalPenalidad(JSON.parse(btn.dataset.item));
        }
        if (action === 'del-penalidad') {
          if (!confirm('¿Eliminar esta penalidad?')) return;
          try {
            await deletePenalidad(btn.dataset.id);
            this._penalidades = await listPenalidades();
            document.getElementById('penalidades-content').innerHTML = this._renderTabPenalidades(this._penalidades);
            this._bindTableActions();
            showToast('Penalidad eliminada', 'success');
          } catch (e) { showToast(e.message, 'error'); }
        }
      });
    });
  }

  // ── Modales ────────────────────────────────────────────────────

  _modal(id, content) {
    document.getElementById(id)?.remove();
    const el = document.createElement('div');
    el.id = id;
    el.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;overflow-y:auto;';
    el.innerHTML = `<div style="background:#0A1628;padding:28px;border-radius:var(--radius-xl,14px);width:100%;max-width:560px;border:1px solid var(--border);position:relative;">
      <button onclick="document.getElementById('${id}').remove()"
        style="position:absolute;top:16px;right:16px;background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer;line-height:1;">×</button>
      ${content}
    </div>`;
    document.body.appendChild(el);
    return el;
  }

  _permisosCheckboxes(cls, defaults = []) {
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      ${Object.entries(PERMISOS_LABEL).map(([k, label]) =>
        `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-muted);">
          <input type="checkbox" class="${cls}" value="${k}" ${defaults.includes(k) ? 'checked' : ''}
            style="accent-color:var(--accent-cyan);width:14px;height:14px;">
          ${label}
        </label>`
      ).join('')}
    </div>`;
  }

  _rolSelect(selectId, selectedVal, onchangeFn) {
    const opts = ROLES_INFO.map(r =>
      `<option value="${r.value}" ${r.value === selectedVal ? 'selected' : ''}>${r.label}</option>`
    ).join('');
    return `<select id="${selectId}" onchange="${onchangeFn}" class="input">${opts}</select>`;
  }

  // ── Modal: crear usuario ─────────────────────────────────────

  _modalCrearUsuario() {
    const defaultRol = 'operador';
    const modal = this._modal('m-crear-usuario', `
      <h3 style="margin:0 0 20px;font-size:17px;">+ Nuevo usuario</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
        <div class="form-group">
          <label class="label">Nombre</label>
          <input id="cu-nombre" class="input" type="text" placeholder="Ej. Juan García">
        </div>
        <div class="form-group">
          <label class="label">Email</label>
          <input id="cu-email" class="input" type="email" placeholder="usuario@cosmica.ar">
        </div>
        <div class="form-group">
          <label class="label">Contraseña</label>
          <input id="cu-pass" class="input" type="password" placeholder="Mínimo 6 caracteres">
        </div>
        <div class="form-group">
          <label class="label">Rol</label>
          ${this._rolSelect('cu-rol', defaultRol, 'cuActualizarPermisos()')}
        </div>
      </div>
      <div style="margin-bottom:18px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin-bottom:10px;">Permisos</div>
        ${this._permisosCheckboxes('cu-perm', PERMISOS_POR_ROL[defaultRol])}
      </div>
      <div id="cu-error" style="display:none;color:#EF4444;font-size:12px;margin-bottom:12px;padding:10px;background:rgba(239,68,68,0.08);border-radius:8px;"></div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:4px;">
        <button onclick="document.getElementById('m-crear-usuario').remove()" class="btn btn-secondary">Cancelar</button>
        <button id="cu-submit" class="btn btn-primary" style="padding:10px 24px;">Crear usuario</button>
      </div>
    `);

    // auto-fill permisos al cambiar rol
    modal.querySelector('#cu-rol').addEventListener('change', () => {
      const rol = modal.querySelector('#cu-rol').value;
      const defaults = PERMISOS_POR_ROL[rol] || [];
      modal.querySelectorAll('.cu-perm').forEach(cb => { cb.checked = defaults.includes(cb.value); });
    });

    modal.querySelector('#cu-submit').addEventListener('click', async () => {
      const nombre  = modal.querySelector('#cu-nombre').value.trim();
      const email   = modal.querySelector('#cu-email').value.trim();
      const pass    = modal.querySelector('#cu-pass').value;
      const rol     = modal.querySelector('#cu-rol').value;
      const permisos = [...modal.querySelectorAll('.cu-perm:checked')].map(c => c.value);
      const errEl   = modal.querySelector('#cu-error');
      const btn     = modal.querySelector('#cu-submit');

      errEl.style.display = 'none';
      if (!email || !pass) { errEl.textContent = 'Email y contraseña requeridos.'; errEl.style.display = 'block'; return; }
      if (pass.length < 6) { errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.'; errEl.style.display = 'block'; return; }

      btn.disabled = true; btn.textContent = 'Creando…';
      try {
        await createUser({ email, password: pass, nombre, rol, permisos });
        document.getElementById('m-crear-usuario')?.remove();
        this._users = await listAllUsers();
        document.getElementById('usuarios-content').innerHTML = this._renderTabOperadores(this._users);
        this._bindTableActions();
        this._bindTabButtons();
        showToast(`Usuario ${email} creado correctamente`, 'success');
      } catch (e) {
        errEl.textContent = e.message; errEl.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Crear usuario';
      }
    });
  }

  // ── Modal: editar usuario ─────────────────────────────────────

  _modalEditarUsuario(u) {
    const permsActuales = u.permisos || PERMISOS_POR_ROL[u.rol] || [];
    const modal = this._modal('m-editar-usuario', `
      <h3 style="margin:0 0 4px;font-size:17px;">✏️ Editar usuario</h3>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px;">${u.email}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
        <div class="form-group">
          <label class="label">Nombre</label>
          <input id="eu-nombre" class="input" value="${u.nombre || ''}">
        </div>
        <div class="form-group">
          <label class="label">Rol</label>
          ${this._rolSelect('eu-rol', u.rol, 'euActualizarPermisos()')}
        </div>
      </div>
      <div style="margin-bottom:14px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin-bottom:10px;">Permisos</div>
        ${this._permisosCheckboxes('eu-perm', permsActuales)}
      </div>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:20px;">
        <input type="checkbox" id="eu-activo" ${u.activo !== false ? 'checked' : ''} style="accent-color:#10B981;width:16px;height:16px;">
        <span style="font-size:14px;color:var(--text-primary);">Usuario activo</span>
      </label>
      <div id="eu-error" style="display:none;color:#EF4444;font-size:12px;margin-bottom:12px;padding:10px;background:rgba(239,68,68,0.08);border-radius:8px;"></div>
      <div style="display:flex;justify-content:flex-end;gap:10px;">
        <button onclick="document.getElementById('m-editar-usuario').remove()" class="btn btn-secondary">Cancelar</button>
        <button id="eu-submit" class="btn btn-primary" style="padding:10px 24px;">Guardar cambios</button>
      </div>
    `);

    modal.querySelector('#eu-rol').addEventListener('change', () => {
      const rol = modal.querySelector('#eu-rol').value;
      const defaults = PERMISOS_POR_ROL[rol] || [];
      modal.querySelectorAll('.eu-perm').forEach(cb => { cb.checked = defaults.includes(cb.value); });
    });

    modal.querySelector('#eu-submit').addEventListener('click', async () => {
      const nombre  = modal.querySelector('#eu-nombre').value.trim();
      const rol     = modal.querySelector('#eu-rol').value;
      const activo  = modal.querySelector('#eu-activo').checked;
      const permisos = [...modal.querySelectorAll('.eu-perm:checked')].map(c => c.value);
      const errEl   = modal.querySelector('#eu-error');
      const btn     = modal.querySelector('#eu-submit');

      errEl.style.display = 'none';
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        await updateUser(u.id, { nombre, rol, activo, permisos });
        document.getElementById('m-editar-usuario')?.remove();
        this._users = await listAllUsers();
        document.getElementById('usuarios-content').innerHTML = this._renderTabOperadores(this._users);
        this._bindTableActions();
        this._bindTabButtons();
        showToast('Usuario actualizado', 'success');
      } catch (e) {
        errEl.textContent = e.message; errEl.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Guardar cambios';
      }
    });
  }

  // ── Modal: puntos ─────────────────────────────────────────────

  async _modalPuntos(u) {
    // Recargar siempre datos frescos para que aparezcan presets recién creados
    const [log, beneficiosFrescos, penalidadesFrescas] = await Promise.all([
      getPuntosLog(u.id).catch(() => []),
      listBeneficios().catch(() => this._beneficios),
      listPenalidades().catch(() => this._penalidades)
    ]);
    // Actualizar cache de la vista
    this._beneficios  = beneficiosFrescos;
    this._penalidades = penalidadesFrescas;

    const pts = u.puntos ?? 0;
    const ptsColor = pts >= 0 ? '#10B981' : '#EF4444';

    const logRows = log.length
      ? log.map(e => {
          const sign = e.puntos > 0 ? '+' : '';
          const col  = e.puntos > 0 ? '#10B981' : '#EF4444';
          const fecha = e.creadoEn?.toDate
            ? e.creadoEn.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
            : '—';
          return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px;">
            <td style="padding:8px 10px;color:var(--text-muted);">${fecha}</td>
            <td style="padding:8px 10px;">${e.motivo}</td>
            <td style="padding:8px 10px;font-weight:700;color:${col};">${sign}${e.puntos}</td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="3" style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">Sin movimientos</td></tr>`;

    const benActivos = this._beneficios.filter(b => b.activo !== false);
    const penActivas = this._penalidades.filter(p => p.activo !== false);

    const benOpts = benActivos.length
      ? `<optgroup label="🎁 Beneficios">` +
        benActivos.map(b =>
          `<option value="${b.id}" data-tipo="beneficio">🎁 ${b.nombre} (+${b.puntos} pts)</option>`
        ).join('') + `</optgroup>`
      : '';

    const penOpts = penActivas.length
      ? `<optgroup label="⚠️ Penalidades">` +
        penActivas.map(p =>
          `<option value="${p.id}" data-tipo="penalidad">⚠️ ${p.nombre} (${p.puntos} pts)</option>`
        ).join('') + `</optgroup>`
      : '';

    const modal = this._modal('m-puntos', `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
        <div>
          <h3 style="margin:0 0 4px;font-size:17px;">⭐ Gestión de Puntos</h3>
          <div style="font-size:12px;color:var(--text-muted);">${u.nombre || u.email}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:30px;font-weight:800;color:${ptsColor};">${pts >= 0 ? '+' : ''}${pts}</div>
          <div style="font-size:11px;color:var(--text-muted);">puntos actuales</div>
        </div>
      </div>

      <!-- Ajuste manual -->
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;margin-bottom:14px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin-bottom:12px;">Ajuste manual</div>
        <div style="display:grid;grid-template-columns:90px 1fr;gap:10px;margin-bottom:10px;">
          <input id="mp-puntos" type="number" class="input" placeholder="±pts" style="margin:0;">
          <input id="mp-motivo" type="text" class="input" placeholder="Motivo del ajuste" style="margin:0;">
        </div>
        <button id="mp-apply" class="btn btn-primary" style="width:100%;padding:9px;font-size:13px;">Aplicar ajuste</button>
      </div>

      ${benActivos.length ? `
      <!-- Beneficios -->
      <div style="background:rgba(16,185,129,0.04);border:1px solid rgba(16,185,129,0.2);border-radius:var(--radius-md);padding:16px;margin-bottom:14px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#10B981;margin-bottom:12px;">🎁 Aplicar Beneficio</div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:10px;">
          <select id="mp-ben-preset" class="input" style="margin:0;">
            ${benActivos.map(b => `<option value="${b.id}">🎁 ${b.nombre} (+${b.puntos} pts)</option>`).join('')}
          </select>
          <button id="mp-ben-apply" class="btn" style="padding:9px 16px;white-space:nowrap;background:rgba(16,185,129,0.15);border-color:rgba(16,185,129,0.4);color:#10B981;">Aplicar</button>
        </div>
      </div>` : ''}

      <!-- Penalidades -->
      <div style="background:rgba(239,68,68,0.04);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-md);padding:16px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#EF4444;">⚠️ Aplicar Penalidad</div>
          <button id="mp-new-pen-toggle" class="btn btn-secondary" style="padding:4px 10px;font-size:11px;border-color:rgba(239,68,68,0.4);color:#EF4444;">+ Nueva</button>
        </div>

        <!-- Form crear penalidad rápida (oculto por defecto) -->
        <div id="mp-new-pen-form" style="display:none;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:8px;padding:12px;margin-bottom:12px;">
          <div style="font-size:11px;color:#EF4444;font-weight:600;margin-bottom:8px;">Crear nueva penalidad</div>
          <div style="display:grid;grid-template-columns:1fr 80px;gap:8px;margin-bottom:8px;">
            <input id="mp-pen-nombre" class="input" placeholder="Nombre (ej. Llegada tarde)" style="margin:0;">
            <input id="mp-pen-pts" type="number" class="input" placeholder="−pts" style="margin:0;" max="-1">
          </div>
          <button id="mp-pen-crear" class="btn" style="width:100%;padding:8px;font-size:12px;background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4);color:#EF4444;">Crear penalidad</button>
        </div>

        ${penActivas.length ? `
        <div style="display:grid;grid-template-columns:1fr auto;gap:10px;">
          <select id="mp-pen-preset" class="input" style="margin:0;border-color:rgba(239,68,68,0.3);">
            ${penActivas.map(p => `<option value="${p.id}">⚠️ ${p.nombre} (${p.puntos} pts)</option>`).join('')}
          </select>
          <button id="mp-pen-apply" class="btn" style="padding:9px 16px;white-space:nowrap;background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4);color:#EF4444;">Aplicar</button>
        </div>` : `
        <div id="mp-pen-empty" style="font-size:12px;color:var(--text-muted);text-align:center;padding:8px 0;">
          No hay penalidades configuradas. Creá una con "+ Nueva".
        </div>`}
      </div>

      <!-- Historial -->
      <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px;">Historial (últimos 50)</div>
      <div style="max-height:190px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-md);">
        <table style="width:100%;border-collapse:collapse;">
          <thead style="position:sticky;top:0;background:#0A1628;">
            <tr style="border-bottom:1px solid var(--border);">
              <th style="padding:8px 10px;font-size:10px;color:var(--text-muted);text-align:left;">Fecha</th>
              <th style="padding:8px 10px;font-size:10px;color:var(--text-muted);text-align:left;">Motivo</th>
              <th style="padding:8px 10px;font-size:10px;color:var(--text-muted);text-align:left;">Pts</th>
            </tr>
          </thead>
          <tbody>${logRows}</tbody>
        </table>
      </div>
      <div id="mp-error" style="display:none;color:#EF4444;font-size:12px;margin-top:12px;padding:10px;background:rgba(239,68,68,0.08);border-radius:8px;"></div>
    `);

    const errEl = modal.querySelector('#mp-error');

    // Reload helper — recarga el modal fresco
    const reloadModal = async () => {
      this._users = await listAllUsers();
      document.getElementById('m-puntos')?.remove();
      document.getElementById('usuarios-content').innerHTML = this._renderTabOperadores(this._users);
      this._bindTableActions();
      this._bindTabButtons();
    };

    // Ajuste manual
    modal.querySelector('#mp-apply')?.addEventListener('click', async () => {
      const puntos = Number(modal.querySelector('#mp-puntos').value);
      const motivo = modal.querySelector('#mp-motivo').value.trim();
      errEl.style.display = 'none';
      if (!puntos || isNaN(puntos)) { errEl.textContent = 'Ingresá un valor de puntos válido (puede ser negativo).'; errEl.style.display = 'block'; return; }
      if (!motivo) { errEl.textContent = 'El motivo es requerido.'; errEl.style.display = 'block'; return; }
      try {
        await agregarPuntos(u.id, puntos, motivo);
        showToast('Puntos actualizados', 'success');
        await reloadModal();
      } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
    });

    // Beneficio preset
    modal.querySelector('#mp-ben-apply')?.addEventListener('click', async () => {
      const select = modal.querySelector('#mp-ben-preset');
      const itemId = select?.value;
      if (!itemId) return;
      errEl.style.display = 'none';
      try {
        await aplicarPreset(u.id, itemId, 'beneficio');
        showToast('Beneficio aplicado', 'success');
        await reloadModal();
      } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
    });

    // Toggle form nueva penalidad
    modal.querySelector('#mp-new-pen-toggle')?.addEventListener('click', () => {
      const form = modal.querySelector('#mp-new-pen-form');
      const visible = form.style.display !== 'none';
      form.style.display = visible ? 'none' : 'block';
      if (!visible) modal.querySelector('#mp-pen-nombre')?.focus();
    });

    // Crear penalidad rápida
    modal.querySelector('#mp-pen-crear')?.addEventListener('click', async () => {
      const nombre = modal.querySelector('#mp-pen-nombre')?.value.trim();
      let pts = Number(modal.querySelector('#mp-pen-pts')?.value);
      errEl.style.display = 'none';
      if (!nombre) { errEl.textContent = 'El nombre de la penalidad es requerido.'; errEl.style.display = 'block'; return; }
      if (!pts || pts === 0) { errEl.textContent = 'Ingresá los puntos a descontar (número negativo).'; errEl.style.display = 'block'; return; }
      if (pts > 0) pts = -pts; // asegurar que sea negativo
      try {
        await savePenalidad(null, { nombre, puntos: pts, descripcion: '', activo: true });
        showToast(`Penalidad "${nombre}" creada`, 'success');
        // Reabrir el modal con datos frescos
        document.getElementById('m-puntos')?.remove();
        const updatedUser = { ...u };
        await this._modalPuntos(updatedUser);
      } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
    });

    // Penalidad preset
    modal.querySelector('#mp-pen-apply')?.addEventListener('click', async () => {
      const select = modal.querySelector('#mp-pen-preset');
      const itemId = select?.value;
      if (!itemId) return;
      errEl.style.display = 'none';
      try {
        await aplicarPreset(u.id, itemId, 'penalidad');
        showToast('Penalidad aplicada', 'success');
        await reloadModal();
      } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
    });
  }


  // ── Modal: beneficio ──────────────────────────────────────────

  _modalBeneficio(item) {
    const modal = this._modal('m-beneficio', `
      <h3 style="margin:0 0 20px;font-size:17px;color:#10B981;">${item ? '✏️ Editar' : '+'} Beneficio</h3>
      <div class="form-group" style="margin-bottom:12px;">
        <label class="label">Nombre</label>
        <input id="ben-nombre" class="input" value="${item?.nombre || ''}" placeholder="Ej. Trabajo del mes">
      </div>
      <div class="form-group" style="margin-bottom:12px;">
        <label class="label">Descripción</label>
        <input id="ben-desc" class="input" value="${item?.descripcion || ''}" placeholder="Descripción opcional">
      </div>
      <div class="form-group" style="margin-bottom:16px;">
        <label class="label">Puntos que otorga</label>
        <input id="ben-pts" type="number" min="1" class="input" value="${item?.puntos || ''}" placeholder="Ej. 100">
      </div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:20px;">
        <input type="checkbox" id="ben-activo" ${!item || item.activo !== false ? 'checked' : ''} style="accent-color:#10B981;width:15px;height:15px;">
        <span style="font-size:13px;">Activo (disponible para aplicar)</span>
      </label>
      <div id="ben-error" style="display:none;color:#EF4444;font-size:12px;margin-bottom:12px;padding:10px;background:rgba(239,68,68,0.08);border-radius:8px;"></div>
      <div style="display:flex;justify-content:flex-end;gap:10px;">
        <button onclick="document.getElementById('m-beneficio').remove()" class="btn btn-secondary">Cancelar</button>
        <button id="ben-submit" class="btn btn-primary" style="padding:10px 22px;background:#10B981;border-color:#10B981;color:#000;">Guardar</button>
      </div>
    `);

    modal.querySelector('#ben-submit').addEventListener('click', async () => {
      const nombre = modal.querySelector('#ben-nombre').value.trim();
      const desc   = modal.querySelector('#ben-desc').value.trim();
      const puntos = Number(modal.querySelector('#ben-pts').value);
      const activo = modal.querySelector('#ben-activo').checked;
      const errEl  = modal.querySelector('#ben-error');
      const btn    = modal.querySelector('#ben-submit');

      errEl.style.display = 'none';
      if (!nombre) { errEl.textContent = 'El nombre es requerido.'; errEl.style.display = 'block'; return; }
      if (!puntos || puntos <= 0) { errEl.textContent = 'Ingresá una cantidad de puntos válida.'; errEl.style.display = 'block'; return; }

      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        await saveBeneficio({ id: item?.id, nombre, descripcion: desc, puntos, activo });
        document.getElementById('m-beneficio')?.remove();
        this._beneficios = await listBeneficios();
        document.getElementById('beneficios-content').innerHTML = this._renderTabBeneficios(this._beneficios);
        this._bindTableActions();
        showToast('Beneficio guardado', 'success');
      } catch (e) {
        errEl.textContent = e.message; errEl.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Guardar';
      }
    });
  }

  // ── Modal: penalidad ──────────────────────────────────────────

  _modalPenalidad(item) {
    const ptsAbs = item?.puntos ? Math.abs(item.puntos) : '';
    const modal = this._modal('m-penalidad', `
      <h3 style="margin:0 0 20px;font-size:17px;color:#EF4444;">${item ? '✏️ Editar' : '+'} Penalidad</h3>
      <div class="form-group" style="margin-bottom:12px;">
        <label class="label">Nombre</label>
        <input id="pen-nombre" class="input" value="${item?.nombre || ''}" placeholder="Ej. Llegada tarde">
      </div>
      <div class="form-group" style="margin-bottom:12px;">
        <label class="label">Descripción</label>
        <input id="pen-desc" class="input" value="${item?.descripcion || ''}" placeholder="Descripción opcional">
      </div>
      <div class="form-group" style="margin-bottom:16px;">
        <label class="label">Puntos que descuenta</label>
        <input id="pen-pts" type="number" min="1" class="input" value="${ptsAbs}" placeholder="Ej. 50 (se guardan como -50)">
      </div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:20px;">
        <input type="checkbox" id="pen-activo" ${!item || item.activo !== false ? 'checked' : ''} style="accent-color:#10B981;width:15px;height:15px;">
        <span style="font-size:13px;">Activo (disponible para aplicar)</span>
      </label>
      <div id="pen-error" style="display:none;color:#EF4444;font-size:12px;margin-bottom:12px;padding:10px;background:rgba(239,68,68,0.08);border-radius:8px;"></div>
      <div style="display:flex;justify-content:flex-end;gap:10px;">
        <button onclick="document.getElementById('m-penalidad').remove()" class="btn btn-secondary">Cancelar</button>
        <button id="pen-submit" class="btn btn-primary" style="padding:10px 22px;background:#EF4444;border-color:#EF4444;">Guardar</button>
      </div>
    `);

    modal.querySelector('#pen-submit').addEventListener('click', async () => {
      const nombre = modal.querySelector('#pen-nombre').value.trim();
      const desc   = modal.querySelector('#pen-desc').value.trim();
      const puntos = Number(modal.querySelector('#pen-pts').value);
      const activo = modal.querySelector('#pen-activo').checked;
      const errEl  = modal.querySelector('#pen-error');
      const btn    = modal.querySelector('#pen-submit');

      errEl.style.display = 'none';
      if (!nombre) { errEl.textContent = 'El nombre es requerido.'; errEl.style.display = 'block'; return; }
      if (!puntos || puntos <= 0) { errEl.textContent = 'Ingresá una cantidad de puntos positiva.'; errEl.style.display = 'block'; return; }

      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        await savePenalidad({ id: item?.id, nombre, descripcion: desc, puntos, activo });
        document.getElementById('m-penalidad')?.remove();
        this._penalidades = await listPenalidades();
        document.getElementById('penalidades-content').innerHTML = this._renderTabPenalidades(this._penalidades);
        this._bindTableActions();
        showToast('Penalidad guardada', 'success');
      } catch (e) {
        errEl.textContent = e.message; errEl.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Guardar';
      }
    });
  }
}
