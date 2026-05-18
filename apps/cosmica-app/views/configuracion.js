import { BaseView } from '../core/base-view.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';
import { showToast } from '../components/toast.js';
import { getCurrentSession } from '../core/session.js';

export class ConfiguracionView extends BaseView {
  constructor(params) {
    super(params);
    this.containerId = 'config-container';
    this.configKey = 'cosmica_config_v1';
    this._activeTab = 'taller';
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

  saveConfig(data) {
    try {
      localStorage.setItem(this.configKey, JSON.stringify(data));
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
    return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:var(--space-lg);">${cols.join('')}</div>`;
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
        ['taller', 'perfil'].forEach(t => {
          const panel = document.getElementById(`tab-panel-${t}`);
          if (panel) panel.style.display = t === this._activeTab ? 'block' : 'none';
        });
        // Show/hide the taller submit button
        const tallerSubmit = document.querySelector('#config-form > div[style*="justify-content:flex-end"]');
        if (tallerSubmit) tallerSubmit.style.display = this._activeTab === 'taller' ? 'flex' : 'none';
      });
    });

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
  }
}
