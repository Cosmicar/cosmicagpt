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
        
        <form id="config-form" class="card glass-card" style="max-width: 800px; padding: var(--space-xl); display: flex; flex-direction: column; gap: var(--space-lg); position: relative; overflow: hidden;">
          <!-- Premium background accent -->
          <div style="position: absolute; top: -50px; right: -50px; width: 150px; height: 150px; background: var(--accent-cyan); filter: blur(80px); opacity: 0.15; pointer-events: none;"></div>
          
          <div style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: var(--space-md); margin-bottom: var(--space-xs);">
            <h3 style="font-size: var(--font-lg); margin: 0 0 4px 0; color: var(--text-primary); font-weight: 700; letter-spacing: -0.01em;">Ajustes Generales</h3>
            <div style="font-size: var(--font-sm); color: var(--text-muted); opacity: 0.8;">
              Estos datos se utilizarán en los tickets impresos, mensajes de WhatsApp y encabezados del sistema.
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-xl);">
            <!-- Columna Izquierda -->
            <div style="display: flex; flex-direction: column; gap: var(--space-md);">
              <div class="form-group">
                <label class="label" style="display:flex;align-items:center;gap:6px;"><span style="opacity:0.7">🏢</span> Nombre del Taller</label>
                <input type="text" name="nombreTaller" class="input" value="${config.nombreTaller || ''}" required placeholder="Ej. Cósmica Repairs">
              </div>

              <div class="form-group">
                <label class="label" style="display:flex;align-items:center;gap:6px;"><span style="opacity:0.7">📍</span> Dirección Física</label>
                <input type="text" name="direccion" class="input" value="${config.direccion || ''}" placeholder="Ej. Av. Central 456, Ciudad">
              </div>

              <div class="form-group">
                <label class="label" style="display:flex;align-items:center;gap:6px;"><span style="opacity:0.7">🎨</span> Color Principal (Acento UI)</label>
                <div style="display: flex; gap: 12px; align-items: center; background: rgba(0,0,0,0.2); padding: 8px; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.05);">
                  <input type="color" name="colorPrincipal" value="${config.colorPrincipal || '#00e5ff'}" style="height: 32px; width: 32px; padding: 0; border: none; border-radius: 4px; background: none; cursor: pointer;">
                  <span style="font-size: var(--font-sm); color: var(--text-primary); font-family: monospace; opacity: 0.8;">${config.colorPrincipal || '#00e5ff'}</span>
                </div>
              </div>
            </div>

            <!-- Columna Derecha -->
            <div style="display: flex; flex-direction: column; gap: var(--space-md);">
              <div class="form-group">
                <label class="label" style="display:flex;align-items:center;gap:6px;"><span style="opacity:0.7">💬</span> WhatsApp Contacto</label>
                <input type="text" name="whatsapp" class="input" value="${config.whatsapp || ''}" placeholder="Ej. +54 9 11 2345-6789">
              </div>

              <div class="form-group">
                <label class="label" style="display:flex;align-items:center;gap:6px;"><span style="opacity:0.7">📸</span> Instagram / Redes</label>
                <input type="text" name="instagram" class="input" value="${config.instagram || ''}" placeholder="Ej. @cosmica.repairs">
              </div>

              <div class="form-group">
                <label class="label" style="display:flex;align-items:center;gap:6px;"><span style="opacity:0.7">🖼️</span> URL del Logo (Opcional)</label>
                <input type="url" name="logoUrl" class="input" value="${config.logoUrl || ''}" placeholder="https://tu-dominio.com/logo.png">
              </div>
            </div>
          </div>

          <div class="form-group" style="margin-top: var(--space-sm);">
            <label class="label" style="display:flex;align-items:center;gap:6px;"><span style="opacity:0.7">⚖️</span> Texto legal (Footer tickets)</label>
            <textarea name="textoFooter" class="input" style="min-height: 80px; resize: vertical; line-height: 1.5; padding: 12px;" placeholder="Términos y condiciones de la reparación...">${config.textoFooter || ''}</textarea>
          </div>

          <div style="margin-top: var(--space-md); border-top: 1px solid rgba(255,255,255,0.05); padding-top: var(--space-lg); display: flex; justify-content: flex-end;">
            <button type="submit" class="btn btn-primary" style="padding: 10px 24px; font-weight: 600; box-shadow: 0 4px 14px rgba(0,229,255,0.2);">
              💾 Guardar Configuración
            </button>
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
