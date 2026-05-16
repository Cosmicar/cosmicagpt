import { BaseView } from '../core/base-view.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';
import { showToast } from '../components/toast.js';

export class ConfiguracionView extends BaseView {
  constructor(params) {
    super(params);
    this.containerId = 'config-container';
    this.configKey = 'cosmica_config_v1';
  }

  loadConfig() {
    try {
      const saved = localStorage.getItem(this.configKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Error reading config from localStorage', e);
    }
    // Default values
    return {
      nombreTaller: 'Cósmica App',
      direccion: '',
      whatsapp: '+54 9 11 0000-0000',
      instagram: '',
      colorPrincipal: '#00e5ff',
      textoFooter: 'Garantía de Servicio: El trabajo realizado tiene una garantía de 90 días sobre mano de obra a partir de la fecha de entrega del equipo.',
      logoUrl: ''
    };
  }

  saveConfig(data) {
    try {
      localStorage.setItem(this.configKey, JSON.stringify(data));
      showToast('Configuración guardada correctamente', 'success');
      
      // Update custom properties if main color changes (simplistic approach for demo)
      if (data.colorPrincipal) {
        document.documentElement.style.setProperty('--accent-cyan', data.colorPrincipal);
      }
    } catch (e) {
      console.error('Error saving config', e);
      showToast('Error al guardar configuración', 'error');
    }
  }

  render() {
    const config = this.loadConfig();
    const breadcrumb = renderBreadcrumb([
      { label: 'Administración', href: '#dashboard', icon: '⚙️' },
      { label: 'Configuración', href: '#configuracion', icon: '🔧' }
    ]);
    
    const header = renderSectionHeader(
      'Configuración del Taller',
      'Ajustes de marca, contacto y plantillas de impresión.',
      '🔧 Módulo'
    );

    return `
      <div class="animate-fade-in" style="display:flex;flex-direction:column;gap:var(--space-lg);">
        ${breadcrumb}
        ${header}
        
        <form id="config-form" class="card glass-card" style="max-width: 600px; padding: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-md);">
          <div style="font-size: var(--font-sm); color: var(--text-muted); margin-bottom: var(--space-sm);">
            Estos datos se utilizarán en los tickets impresos, mensajes de WhatsApp y encabezados del sistema.
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);">
            <div class="form-group">
              <label class="label">Nombre del Taller</label>
              <input type="text" name="nombreTaller" class="input" value="${config.nombreTaller || ''}" required>
            </div>
            <div class="form-group">
              <label class="label">Color Principal</label>
              <div style="display: flex; gap: 8px; align-items: center;">
                <input type="color" name="colorPrincipal" value="${config.colorPrincipal || '#00e5ff'}" style="height: 40px; width: 40px; padding: 0; border: 1px solid var(--border); border-radius: 4px; background: none;">
                <span style="font-size: var(--font-xs); color: var(--text-muted);">Acento UI</span>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="label">Dirección Física</label>
            <input type="text" name="direccion" class="input" value="${config.direccion || ''}" placeholder="Av. Siempre Viva 123">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);">
            <div class="form-group">
              <label class="label">WhatsApp Contacto</label>
              <input type="text" name="whatsapp" class="input" value="${config.whatsapp || ''}" placeholder="+54 9 11...">
            </div>
            <div class="form-group">
              <label class="label">Instagram / Redes</label>
              <input type="text" name="instagram" class="input" value="${config.instagram || ''}" placeholder="@taller_ejemplo">
            </div>
          </div>

          <div class="form-group">
            <label class="label">URL del Logo (Opcional)</label>
            <input type="url" name="logoUrl" class="input" value="${config.logoUrl || ''}" placeholder="https://ejemplo.com/logo.png">
          </div>

          <div class="form-group">
            <label class="label">Texto legal (Footer tickets)</label>
            <textarea name="textoFooter" class="input" style="min-height: 80px;">${config.textoFooter || ''}</textarea>
          </div>

          <div style="margin-top: var(--space-md); border-top: 1px solid var(--border); padding-top: var(--space-md); display: flex; justify-content: flex-end;">
            <button type="submit" class="btn btn-primary">💾 Guardar Configuración</button>
          </div>
        </form>
      </div>
    `;
  }

  afterRender() {
    const form = document.getElementById('config-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        this.saveConfig(data);
      });
    }
  }
}
