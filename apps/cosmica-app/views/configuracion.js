import { BaseView } from '../core/base-view.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';
import { showToast } from '../components/toast.js';
import { getCurrentSession } from '../core/session.js';
import { activarPush, desactivarPush, pushActivo } from '../services/push.js';

export class ConfiguracionView extends BaseView {
  constructor(params) {
    super(params);
    this.containerId = 'config-container';
    this.configKey = 'cosmica_config_v1';
    
    const session = getCurrentSession();
    const isAdmin = session?.profile?.rol === 'admin' || session?.profile?.rol === 'tester';
    this._activeTab = params?.get('tab') || (isAdmin ? 'taller' : 'perfil');
    this._driftLoaded = false;
  }

  loadConfig() {
    try {
      const saved = localStorage.getItem(this.configKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Error reading config from localStorage', e);
    }
    return {
      nombreTaller: 'Cósmica App',
      direccion: '',
      whatsapp: '+54 9 11 0000-0000',
      instagram: '',
      colorPrincipal: '#00e5ff',
      textoFooter: 'Garantía de Servicio: El trabajo realizado tiene una garantía de 90 días sobre mano de obra a partir de la fecha de entrega del equipo.',
      logoUrl: '',
      comisionTaller: 30,
      comisionRemoto: 20,
      precioBronce: 0,
      precioOro: 0,
      precioPlatinum: 0,
      precioReset: 0,
    };
  }

  async saveConfig(data) {
    try {
      localStorage.setItem(this.configKey, JSON.stringify(data));
      
      // Save comisiones to Firestore so it's globally available
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');
      const { db } = await import('../../../js/firebase.js');
      
      const comisionesData = {
        taller: Number(data.comisionTaller ?? 30),
        remoto: Number(data.comisionRemoto ?? 20)
      };
      await setDoc(doc(db, 'config', 'comisiones'), comisionesData, { merge: true });

      const { clearComisionesCache } = await import('../services/finanzas.js');
      clearComisionesCache();

      showToast('Configuración guardada correctamente', 'success');
      if (data.colorPrincipal) {
        document.documentElement.style.setProperty('--accent-cyan', data.colorPrincipal);
      }
    } catch (e) {
      console.error('Error saving config', e);
      showToast('Error al guardar configuración', 'error');
    }
  }

  _tabBtn(id, label, icon, active) {
    return `<button type="button" class="config-tab-btn${active ? ' active' : ''}" data-tab="${id}" style="
      display:flex; align-items:center; gap:8px; padding:10px 20px;
      border:none; background:${active ? 'rgba(0,229,255,0.12)' : 'transparent'};
      color:${active ? 'var(--accent-cyan)' : 'var(--text-muted)'}; cursor:pointer;
      font-size:13px; font-weight:600; border-radius:var(--radius-md);
      border-bottom:2px solid ${active ? 'var(--accent-cyan)' : 'transparent'};
      transition:all 0.2s ease; white-space:nowrap;
    ">${icon} ${label}</button>`;
  }

  _section(html) {
    return `<div style="display:flex;flex-direction:column;gap:var(--space-lg);">${html}</div>`;
  }

  _row(cols) {
    return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:var(--space-lg);">${cols.join('')}</div>`;
  }

  _field(icon, label, inputHtml, hint = '') {
    return `<div class="form-group">
      <label class="label" style="display:flex;align-items:center;gap:6px;"><span style="opacity:0.7">${icon}</span> ${label}</label>
      ${inputHtml}
      ${hint ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px;opacity:0.7;">${hint}</div>` : ''}
    </div>`;
  }

  _input(name, value, opts = {}) {
    const { type = 'text', placeholder = '', extra = '', min = '', max = '', step = '' } = opts;
    return `<input type="${type}" name="${name}" class="input" value="${value ?? ''}" placeholder="${placeholder}" 
      ${min ? `min="${min}"` : ''} ${max ? `max="${max}"` : ''} ${step ? `step="${step}"` : ''} ${extra}>`;
  }

  _pctInput(name, value, placeholder) {
    return `<div style="position:relative;">
      ${this._input(name, value, { type: 'number', placeholder, min: '0', max: '100', step: '0.5', extra: 'style="padding-right:36px;margin:0;"' })}
      <span style="position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:14px;pointer-events:none;">%</span>
    </div>`;
  }

  _moneyInput(name, value, placeholder) {
    return `<div style="position:relative;">
      <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:14px;pointer-events:none;">$</span>
      ${this._input(name, value, { type: 'number', placeholder, min: '0', step: '100', extra: 'style="padding-left:28px;margin:0;"' })}
    </div>`;
  }

  _infoBox(icon, text, color = '0,229,255') {
    return `<div style="padding:var(--space-md);background:rgba(${color},0.04);border:1px solid rgba(${color},0.12);border-radius:var(--radius-md);font-size:var(--font-sm);color:var(--text-muted);display:flex;align-items:center;gap:10px;">
      <span style="font-size:18px;opacity:0.7;">${icon}</span><span>${text}</span>
    </div>`;
  }

  _sectionTitle(icon, title, subtitle) {
    return `<div style="border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:var(--space-md);margin-bottom:var(--space-xs);">
      <h3 style="font-size:var(--font-md);margin:0 0 4px 0;color:var(--text-primary);font-weight:700;display:flex;align-items:center;gap:8px;">${icon} ${title}</h3>
      <div style="font-size:var(--font-sm);color:var(--text-muted);opacity:0.8;">${subtitle}</div>
    </div>`;
  }

  renderTabTaller(config) {
    return this._section(`
      ${this._sectionTitle('🏢', 'Ajustes Generales', 'Datos de marca usados en tickets impresos, WhatsApp y encabezados del sistema.')}
      ${this._row([
        this._field('🏢', 'Nombre del Taller', this._input('nombreTaller', config.nombreTaller, { placeholder: 'Ej. Cósmica Repairs' })),
        this._field('💬', 'WhatsApp Contacto', this._input('whatsapp', config.whatsapp, { placeholder: '+54 9 11 2345-6789' })),
        this._field('📍', 'Dirección Física', this._input('direccion', config.direccion, { placeholder: 'Av. Central 456, Ciudad' })),
        this._field('📸', 'Instagram / Redes', this._input('instagram', config.instagram, { placeholder: '@cosmica.repairs' })),
        this._field('🖼️', 'URL del Logo (Opcional)', this._input('logoUrl', config.logoUrl, { type: 'url', placeholder: 'https://tu-dominio.com/logo.png' })),
        this._field('🎨', 'Color Principal (Acento UI)', `
          <div style="display:flex;gap:12px;align-items:center;background:rgba(0,0,0,0.2);padding:8px;border-radius:var(--radius-md);border:1px solid rgba(255,255,255,0.05);">
            <input type="color" name="colorPrincipal" value="${config.colorPrincipal || '#00e5ff'}" style="height:32px;width:32px;padding:0;border:none;border-radius:4px;background:none;cursor:pointer;">
            <span style="font-size:var(--font-sm);font-family:monospace;opacity:0.8;" id="color-hex-preview">${config.colorPrincipal || '#00e5ff'}</span>
          </div>
        `),
      ])}
      ${this._field('⚖️', 'Texto legal (Footer tickets)', `<textarea name="textoFooter" class="input" style="min-height:80px;resize:vertical;line-height:1.5;padding:12px;" placeholder="Términos y condiciones...">${config.textoFooter || ''}</textarea>`)}

      <div style="border-top:1px solid rgba(255,255,255,0.05);padding-top:var(--space-lg);">
        ${this._sectionTitle('👷', 'Comisiones de Operadores', 'Porcentaje sobre el monto cobrado que le corresponde al técnico.')}
        ${this._row([
          this._field('🏭', 'Comisión Taller (%)', this._pctInput('comisionTaller', config.comisionTaller ?? 30, '30'), 'Para trabajos en taller presencial'),
          this._field('🌐', 'Comisión Remoto (%)', this._pctInput('comisionRemoto', config.comisionRemoto ?? 20, '20'), 'Para servicios remotos o a domicilio'),
        ])}
        ${this._infoBox('💡', 'El reporte se genera automáticamente en Finanzas usando los tickets entregados del período.')}
      </div>

      <div style="border-top:1px solid rgba(255,255,255,0.05);padding-top:var(--space-lg);">
        ${this._sectionTitle('💎', 'Precios de Planes Remotos', 'Tarifas sugeridas para autocompletar al crear servicios remotos.')}
        ${this._row([
          this._field('🥉', 'Bronce', this._moneyInput('precioBronce', config.precioBronce ?? 0, '5000')),
          this._field('🥇', 'Oro', this._moneyInput('precioOro', config.precioOro ?? 0, '10000')),
          this._field('💎', 'Platinum', this._moneyInput('precioPlatinum', config.precioPlatinum ?? 0, '15000')),
          this._field('🔄', 'Reset Impresoras', this._moneyInput('precioReset', config.precioReset ?? 0, '3000')),
        ])}
        ${this._infoBox('📦', 'Cero impacto en tickets existentes. Solo aplica a nuevos servicios remotos.', '139,92,246')}
      </div>
    `);
  }

  renderTabPerfil(session) {
    const p = session?.profile || {};
    const email = session?.user?.email || '';
    const tipoServicio = p.tipoServicio || 'taller';
    const rol = p.rol || 'operador';

    const rolLabels = { admin: '👑 Administrador', tecnico: '🔧 Técnico', recepcion: '🗂️ Recepción', operador: '⚙️ Operador', tester: '🧪 Tester' };

    return `<div style="display:flex;flex-direction:column;gap:var(--space-xl);">

      <!-- Badge de rol -->
      <div style="display:flex;align-items:center;gap:14px;padding:16px;background:rgba(0,229,255,0.05);border:1px solid rgba(0,229,255,0.12);border-radius:var(--radius-lg);">
        <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--accent-cyan),var(--accent-purple));display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">
          ${rolLabels[rol]?.split(' ')[0] || '👤'}
        </div>
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text-primary);">${p.nombre || 'Sin nombre'} ${p.apellido || ''}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${email}</div>
          <div style="font-size:11px;color:var(--accent-cyan);margin-top:4px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">${rolLabels[rol] || rol}</div>
        </div>
      </div>

      <!-- Datos personales -->
      ${this._sectionTitle('👤', 'Datos Personales', 'Tu información de perfil visible en el sistema.')}
      ${this._row([
        this._field('👤', 'Nombre', `<input type="text" id="prof-nombre" class="input" value="${p.nombre || ''}" placeholder="Tu nombre">`),
        this._field('👤', 'Apellido', `<input type="text" id="prof-apellido" class="input" value="${p.apellido || ''}" placeholder="Tu apellido">`),
        this._field('🪪', 'DNI / CUIT', `<input type="text" id="prof-dni" class="input" value="${p.dni || ''}" placeholder="Ej. 30.123.456">`),
        this._field('📱', 'Teléfono Personal', `<input type="tel" id="prof-telefono" class="input" value="${p.telefono || ''}" placeholder="+54 9 11 0000-0000">`),
        this._field('📍', 'Dirección Personal', `<input type="text" id="prof-direccion" class="input" value="${p.direccion || ''}" placeholder="Tu domicilio">`),
        this._field('🏙️', 'Ciudad / Localidad', `<input type="text" id="prof-ciudad" class="input" value="${p.ciudad || ''}" placeholder="Ej. Buenos Aires">`),
      ])}

      <!-- Datos laborales -->
      <div style="border-top:1px solid rgba(255,255,255,0.05);padding-top:var(--space-lg);">
        ${this._sectionTitle('🛠️', 'Configuración Operacional', 'Parámetros que afectan cómo operás dentro del sistema.')}
        ${this._row([
          this._field('🏭', 'Tipo de Servicio Asignado',
            `<div style="display:flex;gap:8px;">
              <button type="button" class="tipo-toggle-btn ${tipoServicio === 'taller' ? 'active' : ''}" data-tipo="taller" id="btn-tipo-taller"
                style="flex:1;padding:10px 0;border-radius:var(--radius-md);border:1px solid ${tipoServicio === 'taller' ? 'var(--accent-cyan)' : 'var(--border)'};
                background:${tipoServicio === 'taller' ? 'rgba(0,229,255,0.12)' : 'rgba(0,0,0,0.2)'};
                color:${tipoServicio === 'taller' ? 'var(--accent-cyan)' : 'var(--text-muted)'};
                cursor:pointer;font-size:13px;font-weight:600;transition:all 0.2s;">
                🏭 Taller
              </button>
              <button type="button" class="tipo-toggle-btn ${tipoServicio === 'remoto' ? 'active' : ''}" data-tipo="remoto" id="btn-tipo-remoto"
                style="flex:1;padding:10px 0;border-radius:var(--radius-md);border:1px solid ${tipoServicio === 'remoto' ? 'var(--accent-purple)' : 'var(--border)'};
                background:${tipoServicio === 'remoto' ? 'rgba(139,92,246,0.12)' : 'rgba(0,0,0,0.2)'};
                color:${tipoServicio === 'remoto' ? 'var(--accent-purple)' : 'var(--text-muted)'};
                cursor:pointer;font-size:13px;font-weight:600;transition:all 0.2s;">
                🌐 Remoto
              </button>
            </div>
            <input type="hidden" id="prof-tipoServicio" value="${tipoServicio}">`,
            'Define el tipo de trabajo predeterminado al crear órdenes.'
          ),
          this._field('📝', 'Especialidad / Cargo', `<input type="text" id="prof-especialidad" class="input" value="${p.especialidad || ''}" placeholder="Ej. Técnico en Impresoras">`),
          this._field('🔗', 'Link de contacto / Portfolio', `<input type="url" id="prof-link" class="input" value="${p.link || ''}" placeholder="https://...">`, 'Opcional. Visible solo para el admin.'),
          this._field('📧', 'Email de contacto alternativo', `<input type="email" id="prof-emailAlt" class="input" value="${p.emailAlt || ''}" placeholder="otro@email.com">`),
        ])}
        ${this._field('📋', 'Bio / Notas internas', `<textarea id="prof-bio" class="input" style="min-height:80px;resize:vertical;line-height:1.5;padding:12px;" placeholder="Experiencia, especialidades, notas...">${p.bio || ''}</textarea>`)}
      </div>

      ${this._infoBox('🔒', `Rol asignado: <strong>${rolLabels[rol] || rol}</strong>. El rol solo puede ser modificado por un Administrador del sistema desde el panel de operadores.`)}

      <!-- Cambio de contraseña -->
      <div style="border-top:1px solid rgba(255,255,255,0.05);padding-top:var(--space-lg);margin-top:var(--space-md);">
        ${this._sectionTitle('🔑', 'Cambiar Contraseña', 'Requiere tu contraseña actual para confirmar el cambio.')}
        <div id="pwd-error" class="alert alert-danger" style="display:none;margin-bottom:var(--space-md);"></div>
        <div id="pwd-success" class="alert alert-success" style="display:none;margin-bottom:var(--space-md);"></div>
        ${this._row([
          this._field('🔒', 'Contraseña Actual', `<input type="password" id="pwd-actual" class="input" placeholder="Tu contraseña actual" autocomplete="current-password">`),
          this._field('🔑', 'Nueva Contraseña', `<input type="password" id="pwd-nueva" class="input" placeholder="Mínimo 6 caracteres" autocomplete="new-password">`),
          this._field('✅', 'Confirmar Nueva', `<input type="password" id="pwd-confirm" class="input" placeholder="Repetí la nueva contraseña" autocomplete="new-password">`),
        ])}
        <div style="display:flex;justify-content:flex-end;margin-top:var(--space-md);">
          <button type="button" id="change-pwd-btn" class="btn btn-secondary" style="padding:10px 24px;font-weight:600;">
            🔑 Cambiar Contraseña
          </button>
        </div>
      </div>

      <!-- Notificaciones Push -->
      <div style="border-top:1px solid rgba(255,255,255,0.05);padding-top:var(--space-lg);margin-top:var(--space-md);">
        ${this._sectionTitle('🔔', 'Notificaciones Push', 'Recibí alertas de puntos, penalidades y novedades en este dispositivo.')}
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;
          padding:16px;background:rgba(0,229,255,0.04);border:1px solid rgba(0,229,255,0.1);border-radius:var(--radius-md);">
          <div>
            <div id="push-status-label" style="font-size:13px;font-weight:600;color:var(--text-primary);">Cargando estado...</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">
              Activá para recibir alertas de puntos y novedades aunque la app esté en segundo plano.
            </div>
          </div>
          <button type="button" id="push-toggle-btn" class="btn btn-secondary"
            style="padding:9px 20px;font-size:13px;font-weight:600;white-space:nowrap;">
            Cargando…
          </button>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;padding-top:var(--space-md);border-top:1px solid rgba(255,255,255,0.05);">
        <button type="button" id="save-profile-btn" class="btn btn-primary" style="padding:10px 28px;font-weight:600;box-shadow:0 4px 14px rgba(0,229,255,0.2);">
          💾 Guardar Perfil
        </button>
      </div>
    </div>`;
  }

  render() {
    const config = this.loadConfig();
    const session = getCurrentSession();
    const isAdmin = session?.profile?.rol === 'admin' || session?.profile?.rol === 'tester';

    const breadcrumb = renderBreadcrumb([
      { label: 'Administración', href: '#dashboard', icon: '⚙️' },
      { label: 'Configuración', href: '#configuracion', icon: '🔧' }
    ]);
    const header = renderSectionHeader('Configuración del Taller', 'Ajustes de marca, operación y perfil de usuario.', '🔧 Módulo');
    const tab = this._activeTab;

    return `
      <div class="animate-fade-in" style="display:flex;flex-direction:column;gap:var(--space-lg);">
        ${breadcrumb}
        ${header}

        <!-- Tab bar -->
        <div style="display:flex;gap:4px;background:rgba(0,0,0,0.2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:6px;overflow-x:auto;width:fit-content;">
          ${this._tabBtn('perfil', 'Mi Perfil', '👤', tab === 'perfil')}
          ${isAdmin ? this._tabBtn('taller', 'Taller & Marca', '🏢', tab === 'taller') : ''}
          ${isAdmin ? this._tabBtn('mantenimiento', 'Mantenimiento', '🔍', tab === 'mantenimiento') : ''}
        </div>

        <!-- Tab content card — full width -->
        <form id="config-form" class="card glass-card" style="padding:var(--space-xl);position:relative;overflow:hidden;">
          <div style="position:absolute;top:-60px;right:-60px;width:180px;height:180px;background:var(--accent-cyan);filter:blur(100px);opacity:0.1;pointer-events:none;"></div>
          <div style="position:absolute;bottom:-60px;left:-40px;width:140px;height:140px;background:var(--accent-purple);filter:blur(90px);opacity:0.08;pointer-events:none;"></div>

          <div id="tab-panel-taller" style="display:${tab === 'taller' ? 'block' : 'none'};">
            ${isAdmin ? this.renderTabTaller(config) : ''}
          </div>
          <div id="tab-panel-perfil" style="display:${tab === 'perfil' ? 'block' : 'none'};">
            ${this.renderTabPerfil(session)}
          </div>
          <div id="tab-panel-mantenimiento" style="display:${tab === 'mantenimiento' ? 'block' : 'none'};">
            <div id="drift-panel-content" style="padding:var(--space-xl);text-align:center;color:var(--text-muted);">
              <div style="font-size:32px;margin-bottom:12px;">🔍</div>
              <div>Cargando análisis de drift...</div>
            </div>
          </div>

          ${tab === 'taller' ? `
          <div style="margin-top:var(--space-lg);border-top:1px solid rgba(255,255,255,0.05);padding-top:var(--space-lg);display:flex;justify-content:flex-end;">
            <button type="submit" class="btn btn-primary" style="padding:10px 28px;font-weight:600;box-shadow:0 4px 14px rgba(0,229,255,0.2);">
              💾 Guardar Configuración
            </button>
          </div>` : ''}
        </form>
      </div>
    `;
  }

  afterRender() {
    const session = getCurrentSession();

    // ── Tab switching ─────────────────────────────────────────────────────────
    document.querySelectorAll('.config-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._activeTab = btn.dataset.tab;
        document.querySelectorAll('.config-tab-btn').forEach(b => {
          const active = b.dataset.tab === this._activeTab;
          b.style.background = active ? 'rgba(0,229,255,0.12)' : 'transparent';
          b.style.color = active ? 'var(--accent-cyan)' : 'var(--text-muted)';
          b.style.borderBottom = active ? '2px solid var(--accent-cyan)' : '2px solid transparent';
        });
        ['taller', 'perfil', 'mantenimiento'].forEach(t => {
          const panel = document.getElementById(`tab-panel-${t}`);
          if (panel) panel.style.display = t === this._activeTab ? 'block' : 'none';
        });
        // Show/hide the taller submit button
        const tallerSubmit = document.querySelector('#config-form > div[style*="justify-content:flex-end"]');
        if (tallerSubmit) tallerSubmit.style.display = this._activeTab === 'taller' ? 'flex' : 'none';
        // Lazy-load drift data when switching to mantenimiento
        if (this._activeTab === 'mantenimiento' && !this._driftLoaded) {
          this._loadMantenimientoTab();
        }
      });
    });

    // Trigger drift load if mantenimiento is the initial active tab
    if (this._activeTab === 'mantenimiento' && !this._driftLoaded) {
      this._loadMantenimientoTab();
    }

    // ── Color preview ─────────────────────────────────────────────────────────
    const colorInput = document.querySelector('input[name="colorPrincipal"]');
    const colorPreview = document.getElementById('color-hex-preview');
    if (colorInput && colorPreview) {
      colorInput.addEventListener('input', () => { colorPreview.textContent = colorInput.value; });
    }

    // ── Taller form submit ────────────────────────────────────────────────────
    const form = document.getElementById('config-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        this.saveConfig(Object.fromEntries(fd.entries()));
      });
    }

    // ── Tipo de servicio toggle ────────────────────────────────────────────────
    const tipoHidden = document.getElementById('prof-tipoServicio');
    document.querySelectorAll('.tipo-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tipo = btn.dataset.tipo;
        if (tipoHidden) tipoHidden.value = tipo;
        document.querySelectorAll('.tipo-toggle-btn').forEach(b => {
          const isRemoto = b.dataset.tipo === 'remoto';
          const active = b.dataset.tipo === tipo;
          const activeColor = isRemoto ? '139,92,246' : '0,229,255';
          const accentVar = isRemoto ? 'var(--accent-purple)' : 'var(--accent-cyan)';
          b.style.background = active ? `rgba(${activeColor},0.12)` : 'rgba(0,0,0,0.2)';
          b.style.color = active ? accentVar : 'var(--text-muted)';
          b.style.borderColor = active ? accentVar : 'var(--border)';
        });
      });
    });

    // ── Save profile ──────────────────────────────────────────────────────────
    const saveProfileBtn = document.getElementById('save-profile-btn');
    if (saveProfileBtn) {
      saveProfileBtn.addEventListener('click', async () => {
        if (!session?.user?.uid) { showToast('No hay sesión activa', 'error'); return; }

        const get = id => document.getElementById(id)?.value?.trim() ?? '';
        const profileData = {
          nombre:       get('prof-nombre'),
          apellido:     get('prof-apellido'),
          dni:          get('prof-dni'),
          telefono:     get('prof-telefono'),
          direccion:    get('prof-direccion'),
          ciudad:       get('prof-ciudad'),
          especialidad: get('prof-especialidad'),
          link:         get('prof-link'),
          emailAlt:     get('prof-emailAlt'),
          bio:          get('prof-bio'),
          tipoServicio: get('prof-tipoServicio') || 'taller',
        };

        saveProfileBtn.disabled = true;
        saveProfileBtn.textContent = 'Guardando…';

        try {
          const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');
          const { db }          = await import('../../../js/firebase.js');
          const { COLLECTIONS } = await import('../../../js/domain.js');

          await setDoc(doc(db, COLLECTIONS.usuarios, session.user.uid), profileData, { merge: true });

          // Patch in-memory session so navbar updates instantly
          if (session.profile) Object.assign(session.profile, profileData);
          const nameEl = document.getElementById('userEmail');
          const perfilEl = document.getElementById('perfilEmail');
          const fullName = [profileData.nombre, profileData.apellido].filter(Boolean).join(' ');
          if (nameEl && fullName)   nameEl.textContent = fullName;
          if (perfilEl && fullName) perfilEl.textContent = fullName;

          showToast('Perfil guardado correctamente ✓', 'success');
        } catch (err) {
          console.error('[Perfil] save error:', err);
          showToast('Error al guardar el perfil', 'error');
        } finally {
          saveProfileBtn.disabled = false;
          saveProfileBtn.textContent = '💾 Guardar Perfil';
        }
      });
    }

    // ── Push notifications toggle ─────────────────────────────────────────────
    const pushToggleBtn  = document.getElementById('push-toggle-btn');
    const pushStatusLabel = document.getElementById('push-status-label');

    function updatePushUI() {
      const activo = pushActivo();
      if (pushStatusLabel) {
        pushStatusLabel.innerHTML = activo
          ? '🔔 <span style="color:#10B981;">Notificaciones activadas</span> en este dispositivo'
          : '🔕 Notificaciones <span style="color:var(--text-muted);">desactivadas</span>';
      }
      if (pushToggleBtn) {
        pushToggleBtn.textContent = activo ? 'Desactivar notificaciones' : 'Activar notificaciones';
        pushToggleBtn.style.borderColor = activo ? '#EF4444' : 'var(--accent-cyan)';
        pushToggleBtn.style.color       = activo ? '#EF4444' : 'var(--accent-cyan)';
      }
    }
    updatePushUI();

    if (pushToggleBtn) {
      pushToggleBtn.addEventListener('click', async () => {
        pushToggleBtn.disabled = true;
        pushToggleBtn.textContent = 'Procesando…';
        try {
          if (pushActivo()) {
            await desactivarPush();
            showToast('Notificaciones desactivadas', 'info');
          } else {
            await activarPush();
            showToast('🔔 Notificaciones activadas correctamente', 'success');
          }
        } catch (err) {
          showToast('Error: ' + err.message, 'error');
        } finally {
          pushToggleBtn.disabled = false;
          updatePushUI();
        }
      });
    }

    // ── Mantenimiento: drift refresh + details chevron + reset contabilidad ──
    const driftPanel = document.getElementById('drift-panel-content');
    if (driftPanel) {
      driftPanel.addEventListener('click', (e) => {
        // Re-scan
        if (e.target.id === 'drift-refresh') {
          this._driftLoaded = false;
          this._loadMantenimientoTab();
          return;
        }
        // Mostrar área de confirmación
        if (e.target.id === 'reset-contab-btn') {
          const area = document.getElementById('reset-contab-confirm-area');
          if (area) { area.style.display = 'block'; e.target.style.display = 'none'; }
          return;
        }
        // Cancelar
        if (e.target.id === 'reset-contab-cancel-btn') {
          const area = document.getElementById('reset-contab-confirm-area');
          const btn  = document.getElementById('reset-contab-btn');
          if (area) area.style.display = 'none';
          if (btn)  btn.style.display = '';
          const inp = document.getElementById('reset-contab-input');
          if (inp) inp.value = '';
          return;
        }
        // Ejecutar reset
        if (e.target.id === 'reset-contab-execute-btn') {
          const inp = document.getElementById('reset-contab-input');
          if (!inp || inp.value.trim() !== 'RESET') {
            showToast('Escribí exactamente RESET para confirmar', 'error');
            if (inp) inp.focus();
            return;
          }
          this._ejecutarResetContabilidad(e.target);
        }
      });
      // Animación chevron en <details>
      driftPanel.addEventListener('toggle', (e) => {
        if (e.target.tagName === 'DETAILS') {
          const chevron = e.target.querySelector('.details-chevron');
          if (chevron) chevron.style.transform = e.target.open ? 'rotate(180deg)' : '';
        }
      }, true);
    }

    // ── Change password ───────────────────────────────────────────────────────
    const changePwdBtn = document.getElementById('change-pwd-btn');
    if (changePwdBtn) {
      changePwdBtn.addEventListener('click', async () => {
        const errEl     = document.getElementById('pwd-error');
        const successEl = document.getElementById('pwd-success');
        const actual    = document.getElementById('pwd-actual')?.value?.trim() ?? '';
        const nueva     = document.getElementById('pwd-nueva')?.value?.trim() ?? '';
        const confirm   = document.getElementById('pwd-confirm')?.value?.trim() ?? '';

        if (errEl)     errEl.style.display = 'none';
        if (successEl) successEl.style.display = 'none';

        if (!actual || !nueva || !confirm) {
          if (errEl) { errEl.textContent = 'Completá todos los campos de contraseña.'; errEl.style.display = 'block'; }
          return;
        }
        if (nueva.length < 6) {
          if (errEl) { errEl.textContent = 'La nueva contraseña debe tener al menos 6 caracteres.'; errEl.style.display = 'block'; }
          return;
        }
        if (nueva !== confirm) {
          if (errEl) { errEl.textContent = 'Las contraseñas nuevas no coinciden.'; errEl.style.display = 'block'; }
          return;
        }

        changePwdBtn.disabled = true;
        changePwdBtn.textContent = 'Cambiando…';

        try {
          const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } =
            await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js');
          const { auth } = await import('../../../js/firebase.js');

          const user = auth.currentUser;
          if (!user) throw new Error('No hay sesión activa.');

          const credential = EmailAuthProvider.credential(user.email, actual);
          await reauthenticateWithCredential(user, credential);
          await updatePassword(user, nueva);

          // Clear fields
          ['pwd-actual', 'pwd-nueva', 'pwd-confirm'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
          });
          if (successEl) { successEl.textContent = 'Contraseña actualizada correctamente.'; successEl.style.display = 'block'; }
          showToast('Contraseña cambiada ✓', 'success');
        } catch (err) {
          console.error('[Perfil] change password error:', err);
          let msg = 'Error al cambiar la contraseña.';
          if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') msg = 'La contraseña actual es incorrecta.';
          if (err.code === 'auth/too-many-requests') msg = 'Demasiados intentos. Intentá más tarde.';
          if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
          showToast(msg, 'error');
        } finally {
          changePwdBtn.disabled = false;
          changePwdBtn.textContent = '🔑 Cambiar Contraseña';
        }
      });
    }
  }

  async _loadMantenimientoTab() {
    const panel = document.getElementById('drift-panel-content');
    if (!panel) return;
    panel.innerHTML = `<div style="padding:var(--space-xl);text-align:center;color:var(--text-muted);">
      <div style="font-size:28px;margin-bottom:12px;">⏳</div><div>Analizando inconsistencias...</div>
    </div>`;
    try {
      const { getTickets }     = await import('../services/tickets.js');
      const { getCajaEntries } = await import('../services/finanzas.js');
      const { WORK_STATUS }    = await import('../../../js/domain.js');
      const { collection, query, orderBy, limit, getDocs } =
        await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');
      const { db } = await import('../../../js/firebase.js');

      const [tickets, cajaEntries, logsSnap] = await Promise.all([
        getTickets(),
        getCajaEntries(),
        getDocs(query(collection(db, 'system_logs'), orderBy('ts', 'desc'), limit(50)))
          .catch(() => ({ docs: [] })),
      ]);

      const cajaPorTicket = new Map();
      for (const entry of cajaEntries) {
        if (!entry.ticketRef) continue;
        if (!cajaPorTicket.has(entry.ticketRef)) cajaPorTicket.set(entry.ticketRef, []);
        cajaPorTicket.get(entry.ticketRef).push(entry);
      }
      const ticketIds = new Set(tickets.map(t => t.id));

      const entregadosSinCaja = [];
      for (const t of tickets) {
        if (t.estado !== WORK_STATUS.entregado) continue;
        const precio = Number(t.precio || 0);
        if (precio <= 0) continue;
        const asientos = cajaPorTicket.get(t.id) || [];
        if (!asientos.some(a => a.tipo === 'ingreso')) entregadosSinCaja.push(t);
      }

      const cajaHuerfana = cajaEntries.filter(e =>
        e.origen === 'ticket' && e.ticketRef && !ticketIds.has(e.ticketRef)
      );

      const montoDesalineado = [];
      for (const t of tickets) {
        if (t.estado !== WORK_STATUS.entregado) continue;
        const precio = Number(t.precio || 0);
        if (precio <= 0) continue;
        const ingresos = (cajaPorTicket.get(t.id) || []).filter(a => a.tipo === 'ingreso');
        if (ingresos.length === 0) continue;
        const totalCaja = ingresos.reduce((s, a) => s + Number(a.monto || 0), 0);
        if (Math.abs(totalCaja - precio) >= 1) {
          montoDesalineado.push({ ticket: t, totalCaja, precio, delta: totalCaja - precio });
        }
      }

      const logs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      this._driftLoaded = true;
      panel.innerHTML = this._renderDriftContent({ entregadosSinCaja, cajaHuerfana, montoDesalineado, logs });
    } catch (err) {
      console.error('[Mantenimiento] drift load error:', err);
      panel.innerHTML = `<div style="padding:var(--space-xl);text-align:center;color:var(--danger);">
        ⚠️ Error al cargar datos: ${err.message}
        <br><br><button class="btn btn-secondary btn-sm" id="drift-refresh">🔄 Reintentar</button>
      </div>`;
    }
  }

  _renderDriftContent({ entregadosSinCaja, cajaHuerfana, montoDesalineado, logs }) {
    const total = entregadosSinCaja.length + cajaHuerfana.length + montoDesalineado.length;
    return `
      <div style="display:flex;flex-direction:column;gap:var(--space-lg);">

        <!-- ── Drift Detection ─────────────────────────────────── -->
        <div>
          ${this._sectionTitle('🔍', 'Drift Detection', 'Inconsistencias entre tickets entregados y movimientos de caja. Read-only — corrección manual desde Finanzas.')}

          <!-- Banner resumen -->
          <div style="display:flex;align-items:center;gap:var(--space-lg);padding:var(--space-lg);
              background:rgba(0,0,0,0.15);border-radius:var(--radius-md);margin-bottom:var(--space-md);
              border-left:4px solid ${total === 0 ? 'var(--accent-green)' : 'var(--danger)'};">
            <div style="font-size:28px;">${total === 0 ? '✅' : '⚠️'}</div>
            <div style="flex:1;">
              <div style="font-size:var(--font-md);font-weight:700;color:var(--text-primary);">
                ${total === 0 ? 'Sin drift detectado' : `${total} inconsistencia${total > 1 ? 's' : ''} detectada${total > 1 ? 's' : ''}`}
              </div>
              <div style="font-size:var(--font-sm);color:var(--text-muted);margin-top:4px;">
                ${total === 0
                  ? 'Todos los tickets entregados tienen su asiento de caja correspondiente.'
                  : 'Revisá cada sección y corregí manualmente desde Finanzas si corresponde.'}
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" id="drift-refresh">🔄 Re-escanear</button>
          </div>

          <!-- Categorías colapsables -->
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${this._renderDriftCategory('Entregados sin caja', '⚠️',
              'Ticket marcado Entregado con precio > 0, pero sin asiento de caja tipo ingreso.',
              'var(--danger)', entregadosSinCaja,
              (t) => `
                <td style="padding:8px;font-family:var(--font-mono);">#${t.numeroOrden || '—'}</td>
                <td style="padding:8px;">${[t.nombre, t.apellido].filter(Boolean).join(' ') || '—'}</td>
                <td style="padding:8px;color:var(--text-muted);">${t.equipo || '—'}</td>
                <td style="padding:8px;text-align:right;font-weight:700;color:var(--danger);">${this._ars(t.precio)}</td>
                <td style="padding:8px;color:var(--text-muted);font-size:11px;">${this._fmtTs(t.fechaEntregado)}</td>
                <td style="padding:8px;"><a href="#ticket-edit?id=${t.id}" class="btn btn-sm btn-primary">Abrir</a></td>
              `,
              ['Orden', 'Cliente', 'Equipo', 'Precio', 'Entregado', '']
            )}
            ${this._renderDriftCategory('Caja huérfana', '👻',
              'Asiento de caja con origen ticket cuyo ticketRef ya no existe en la base.',
              'var(--accent-orange)', cajaHuerfana,
              (e) => `
                <td style="padding:8px;font-family:var(--font-mono);font-size:11px;">${e.id.slice(0, 8)}…</td>
                <td style="padding:8px;color:var(--text-muted);">${e.descripcion || '—'}</td>
                <td style="padding:8px;text-align:right;font-weight:700;">${this._ars(e.monto)}</td>
                <td style="padding:8px;color:var(--text-muted);">${e.metodoPago || '—'}</td>
                <td style="padding:8px;color:var(--text-muted);font-size:11px;">${this._fmtTs(e.createdAt)}</td>
                <td style="padding:8px;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">${(e.ticketRef || '').slice(0, 8)}…</td>
              `,
              ['Asiento', 'Descripción', 'Monto', 'Método', 'Creado', 'TicketRef']
            )}
            ${this._renderDriftCategory('Monto desalineado', '⚖️',
              'El total registrado en caja para el ticket difiere del precio del ticket.',
              'var(--accent-orange)', montoDesalineado,
              (row) => `
                <td style="padding:8px;font-family:var(--font-mono);">#${row.ticket.numeroOrden || '—'}</td>
                <td style="padding:8px;">${[row.ticket.nombre, row.ticket.apellido].filter(Boolean).join(' ') || '—'}</td>
                <td style="padding:8px;text-align:right;">${this._ars(row.precio)}</td>
                <td style="padding:8px;text-align:right;">${this._ars(row.totalCaja)}</td>
                <td style="padding:8px;text-align:right;font-weight:700;color:${row.delta > 0 ? 'var(--accent-green)' : 'var(--danger)'};">${row.delta > 0 ? '+' : ''}${this._ars(row.delta)}</td>
                <td style="padding:8px;"><a href="#ticket-edit?id=${row.ticket.id}" class="btn btn-sm btn-primary">Abrir</a></td>
              `,
              ['Orden', 'Cliente', 'Precio ticket', 'Total caja', 'Δ', '']
            )}

            <!-- System logs colapsable -->
            <details style="background:rgba(0,0,0,0.15);border-radius:var(--radius-md);border-left:3px solid rgba(255,255,255,0.1);overflow:hidden;">
              <summary style="display:flex;align-items:center;gap:10px;padding:14px var(--space-lg);cursor:pointer;list-style:none;user-select:none;">
                <span style="font-size:16px;">📋</span>
                <span style="font-size:var(--font-sm);font-weight:700;color:var(--text-primary);flex:1;">
                  Eventos del sistema
                </span>
                <span style="font-size:11px;background:rgba(255,255,255,0.07);color:var(--text-muted);padding:2px 8px;border-radius:20px;font-weight:600;">${logs.length}</span>
                <span class="details-chevron" style="color:var(--text-muted);font-size:12px;transition:transform 0.2s;">▼</span>
              </summary>
              <div style="padding:0 var(--space-lg) var(--space-lg);">
                <p style="margin:0 0 var(--space-sm);font-size:var(--font-xs);color:var(--text-muted);">Últimos ${logs.length} eventos · más recientes primero</p>
                ${logs.length === 0 ? `
                  <div style="padding:var(--space-md);text-align:center;color:var(--text-muted);font-size:var(--font-sm);">No hay eventos registrados aún.</div>
                ` : `
                  <div style="max-height:280px;overflow-y:auto;font-family:var(--font-mono);font-size:11px;line-height:1.6;border:1px solid rgba(255,255,255,0.05);border-radius:var(--radius-sm);">
                    ${logs.map(l => `
                      <div style="padding:5px 8px;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;gap:10px;align-items:flex-start;">
                        <span style="color:${this._levelColor(l.level)};font-weight:700;min-width:44px;">${(l.level || 'info').toUpperCase()}</span>
                        <span style="color:var(--text-muted);min-width:120px;flex-shrink:0;">${this._fmtTs(l.ts)}</span>
                        <span style="color:var(--accent-cyan);min-width:200px;flex-shrink:0;">${l.event}</span>
                        <span style="color:var(--text-muted);flex:1;word-break:break-all;">${this._stringifyData(l.data)}</span>
                      </div>
                    `).join('')}
                  </div>
                `}
              </div>
            </details>
          </div>
        </div>

        <!-- ── Reset de Contabilidad ───────────────────────────── -->
        <div style="border-top:1px solid rgba(255,255,255,0.05);padding-top:var(--space-lg);">
          ${this._sectionTitle('🗑️', 'Reset de Contabilidad', 'Elimina todos los movimientos de caja y sesiones. Acción irreversible.')}
          <div style="padding:var(--space-lg);background:rgba(239,68,68,0.04);border:1px solid rgba(239,68,68,0.15);border-radius:var(--radius-md);display:flex;align-items:flex-start;gap:var(--space-md);">
            <div style="font-size:24px;flex-shrink:0;">☢️</div>
            <div style="flex:1;">
              <div style="font-size:var(--font-sm);font-weight:700;color:#EF4444;margin-bottom:6px;">Zona de peligro</div>
              <div style="font-size:var(--font-sm);color:var(--text-muted);line-height:1.6;">
                Borra <strong style="color:var(--text-primary);">todos</strong> los asientos de caja y sesiones de caja registrados en Firestore.
                Los tickets <strong style="color:var(--text-primary);">no se modifican</strong>. Esta operación
                <strong style="color:#EF4444;">no se puede deshacer</strong>.
              </div>
              <div id="reset-contab-confirm-area" style="display:none;margin-top:var(--space-md);">
                <div style="font-size:var(--font-sm);color:#EF4444;font-weight:600;margin-bottom:8px;">
                  ¿Estás completamente seguro? Escribí <code style="background:rgba(239,68,68,0.1);padding:1px 6px;border-radius:4px;">RESET</code> para confirmar:
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                  <input type="text" id="reset-contab-input" class="input" placeholder="Escribí RESET"
                    style="max-width:180px;margin:0;border-color:rgba(239,68,68,0.3);">
                  <button type="button" id="reset-contab-execute-btn" class="btn"
                    style="background:rgba(239,68,68,0.15);color:#EF4444;border:1px solid rgba(239,68,68,0.4);padding:9px 18px;font-weight:700;white-space:nowrap;">
                    ☢️ Ejecutar reset
                  </button>
                  <button type="button" id="reset-contab-cancel-btn" class="btn btn-secondary btn-sm">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
            <button type="button" id="reset-contab-btn" class="btn"
              style="background:rgba(239,68,68,0.1);color:#EF4444;border:1px solid rgba(239,68,68,0.3);padding:9px 18px;font-weight:700;white-space:nowrap;flex-shrink:0;">
              Resetear contabilidad
            </button>
          </div>
        </div>

      </div>
    `;
  }

  _renderDriftCategory(title, icon, desc, color, rows, rowFn, headers) {
    const isEmpty = rows.length === 0;
    return `
      <details style="background:rgba(0,0,0,0.15);border-radius:var(--radius-md);
          border-left:3px solid ${isEmpty ? 'rgba(255,255,255,0.08)' : color};overflow:hidden;">
        <summary style="display:flex;align-items:center;gap:10px;padding:14px var(--space-lg);cursor:pointer;list-style:none;user-select:none;">
          <span style="font-size:16px;">${icon}</span>
          <span style="font-size:var(--font-sm);font-weight:700;color:${isEmpty ? 'var(--text-muted)' : color};flex:1;">
            ${title}
          </span>
          <span style="font-size:11px;background:${isEmpty ? 'rgba(255,255,255,0.07)' : `rgba(${color === 'var(--danger)' ? '239,68,68' : '251,146,60'},0.15)`};
              color:${isEmpty ? 'var(--text-muted)' : color};padding:2px 8px;border-radius:20px;font-weight:700;">${rows.length}</span>
          <span class="details-chevron" style="color:var(--text-muted);font-size:12px;transition:transform 0.2s;">▼</span>
        </summary>
        <div style="padding:0 var(--space-lg) var(--space-lg);">
          <p style="margin:0 0 var(--space-sm);font-size:var(--font-xs);color:var(--text-muted);">${desc}</p>
          ${isEmpty ? `
            <div style="padding:var(--space-md);text-align:center;color:var(--text-muted);font-size:var(--font-sm);">✓ Sin problemas en esta categoría.</div>
          ` : `
            <div style="overflow-x:auto;border:1px solid rgba(255,255,255,0.05);border-radius:var(--radius-sm);">
              <table style="width:100%;min-width:600px;border-collapse:collapse;font-size:13px;">
                <thead>
                  <tr style="text-align:left;color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid var(--border);background:rgba(0,0,0,0.15);">
                    ${headers.map(h => `<th style="padding:8px 10px;font-weight:600;">${h}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${rows.map(r => `<tr style="border-bottom:1px solid rgba(255,255,255,0.03);">${rowFn(r)}</tr>`).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </details>
    `;
  }

  async _ejecutarResetContabilidad(btn) {
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ Borrando...';
    try {
      const { collection, getDocs, writeBatch, doc } =
        await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');
      const { db }          = await import('../../../js/firebase.js');
      const { COLLECTIONS } = await import('../../../js/domain.js');

      // Borramos en lotes de 490 (límite Firestore = 500 ops/batch)
      const deleteBatch = async (colName) => {
        let snap = await getDocs(collection(db, colName));
        while (!snap.empty) {
          const chunks = [];
          for (let i = 0; i < snap.docs.length; i += 490) {
            chunks.push(snap.docs.slice(i, i + 490));
          }
          for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach(d => batch.delete(doc(db, colName, d.id)));
            await batch.commit();
          }
          snap = await getDocs(collection(db, colName));
        }
      };

      await deleteBatch(COLLECTIONS.caja);
      await deleteBatch(COLLECTIONS.cajaSesiones);

      showToast('✅ Contabilidad reseteada a cero correctamente', 'success');
      // Refrescar el panel completo
      this._driftLoaded = false;
      this._loadMantenimientoTab();
    } catch (err) {
      console.error('[Reset contabilidad]', err);
      showToast('Error al resetear: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  _ars(n) { return '$' + Math.round(Number(n || 0)).toLocaleString('es-AR'); }

  _fmtTs(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  _levelColor(level) {
    if (level === 'error') return 'var(--danger)';
    if (level === 'warn')  return 'var(--accent-orange)';
    return 'var(--accent-cyan)';
  }

  _stringifyData(data) {
    if (data == null) return '—';
    try {
      const str = JSON.stringify(data);
      return str.length > 200 ? str.slice(0, 200) + '…' : str;
    } catch { return '[unsanitizable]'; }
  }
}
