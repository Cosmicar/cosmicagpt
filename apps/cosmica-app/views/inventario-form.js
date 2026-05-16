import { AsyncView } from '../core/async-view.js';
import { render as renderSectionHeader } from '../components/section-header.js';
import { renderBreadcrumb } from '../components/breadcrumb.js';
import { renderFormField } from '../components/form-field.js';
import { renderFormActions } from '../components/form-actions.js';
import { renderFormSkeleton } from '../components/app-state.js';
import {
  getInventarioItem,
  createInventarioItem,
  updateInventarioItem,
} from '../services/inventario.js';
import { showToast } from '../components/toast.js';
import { 
  guardBtn, setDirty, initUnsavedChangesGuard, 
  saveDraft, loadDraft, clearDraft 
} from '../core/chaos-guard.js';

const CATEGORIAS = [
  'Pantalla / Display', 'Batería', 'Cargador / Cable', 'Conector',
  'Placa / Módulo', 'Teclado / Táctil', 'Cámara', 'Altavoz / Micrófono',
  'Marco / Chasis', 'Tornillo / Adhesivo', 'Herramienta', 'Otro',
];

export class InventarioFormView extends AsyncView {
  constructor(params) {
    super(params);
    this.containerId = 'inventario-form-container';
    this.itemId      = this.params?.get('id');
    this.isEdit      = !!this.itemId;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  renderLoading() {
    return `
      <div style="margin-top: var(--space-xl);">
        <div class="skeleton" style="width: 250px; height: 32px; margin-bottom: var(--space-lg);"></div>
        ${renderFormSkeleton()}
      </div>`;
  }

  async loadData() {
    if (this.isEdit) {
      const item = await getInventarioItem(this.itemId);
      return { item };
    }
    return { item: null };
  }

  // ── Render ────────────────────────────────────────────────────────────────

  renderContent({ item }) {
    const breadcrumb = renderBreadcrumb([
      { label: 'Operaciones',  href: '#dashboard',         icon: '⚙️' },
      { label: 'Inventario',   href: '#inventario',         icon: '📦' },
      { label: this.isEdit ? 'Editar repuesto' : 'Nuevo repuesto',
        href: this.isEdit ? `#inventario-edit?id=${this.itemId}` : '#inventario-nuevo',
        icon: this.isEdit ? '📝' : '➕' },
    ]);

    const header = renderSectionHeader(
      this.isEdit ? `Editar: ${item?.nombre || ''}` : 'Nuevo Repuesto',
      this.isEdit ? 'Modificá los datos del repuesto en el inventario.' : 'Registrá un nuevo repuesto o material en el inventario.',
      this.isEdit ? '📝 Edición' : '📦 Registro'
    );

    const catOptions = CATEGORIAS.map(c => ({ value: c, label: c }));

    return `
      <div id="inv-form-wrapper" class="animate-fade-in stack-lg">
        ${breadcrumb}
        ${header}

        <div class="card glass-card" style="max-width: 860px;">
          <div id="inv-form-error" class="alert alert-danger" style="display:none;"></div>

          <form id="inv-form" class="stack-lg">
            <!-- Row 1 -->
            <div class="grid-stack" style="grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));">
              ${renderFormField({
                label: 'Nombre del repuesto',
                id:    'nombre',
                placeholder: 'Ej: Pantalla OLED iPhone 12',
                value: item?.nombre || '',
                required: true,
              })}
              ${renderFormField({
                label: 'SKU / Código',
                id:    'sku',
                placeholder: 'Ej: PAN-IOS12-OLED',
                value: item?.sku || '',
              })}
            </div>

            <!-- Row 2 -->
            <div class="grid-stack" style="grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));">
              ${renderFormField({
                label:    'Categoría',
                id:       'categoria',
                type:     'select',
                options:  [{ value: '', label: '-- Seleccioná una categoría --' }, ...catOptions],
                value:    item?.categoria || '',
                required: true,
              })}
              ${renderFormField({
                label:       'Proveedor',
                id:          'proveedor',
                placeholder: 'Ej: FixTech AR',
                value:       item?.proveedor || '',
              })}
            </div>

            <!-- Row 3: numeric fields -->
            <div class="grid-stack" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
              ${renderFormField({
                label:       'Stock actual',
                id:          'stock',
                type:        'number',
                placeholder: '0',
                value:       item?.stock ?? '',
                required:    true,
              })}
              ${renderFormField({
                label:       'Stock mínimo',
                id:          'stockMinimo',
                type:        'number',
                placeholder: '0',
                value:       item?.stockMinimo ?? '',
              })}
              ${renderFormField({
                label:       'Costo unitario ($)',
                id:          'costo',
                type:        'number',
                placeholder: '0',
                value:       item?.costo ?? '',
                required:    true,
              })}
            </div>

            <div style="display:flex;align-items:center;gap:var(--space-sm);color:var(--text-muted);font-size:var(--font-xs);">
              <span style="color:var(--danger);">*</span> Campos obligatorios
            </div>

            <div id="inv-form-actions">
              ${renderFormActions({
                saveLabel:    this.isEdit ? 'Guardar cambios' : 'Crear repuesto',
                onCancelHref: '#inventario',
              })}
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // ── Events ────────────────────────────────────────────────────────────────

  onContentReady() {
    const form = document.getElementById('inv-form');
    if (!form) return;

    this._initAutoRecovery();
    initUnsavedChangesGuard();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');

      await guardBtn(submitBtn, async () => {
        const fd   = new FormData(form);
        const data = Object.fromEntries(fd.entries());
        this.setLoading(true);
        this.hideError();

        const result = this.isEdit
          ? await updateInventarioItem(this.itemId, data)
          : await createInventarioItem(data);

        if (result.success) {
          clearDraft(this.isEdit ? `inv_${this.itemId}` : 'new_inv');
          showToast(
            this.isEdit ? 'Repuesto actualizado' : 'Repuesto creado correctamente',
            'success'
          );
          setTimeout(() => { window.location.hash = '#inventario'; }, 1100);
        } else {
          this.showError(result.error || 'Error al guardar');
          showToast(result.error || 'Error al guardar', 'error');
          this.setLoading(false);
        }
      });
    });

    const firstInput = document.getElementById('nombre');
    if (firstInput) firstInput.focus();
  }

  _initAutoRecovery() {
    const form = document.getElementById('inv-form');
    if (!form) return;
    const draftKey = this.isEdit ? `inv_${this.itemId}` : 'new_inv';
    
    const draft = loadDraft(draftKey);
    if (draft && confirm('Se encontró un borrador sin guardar. ¿Deseas restaurarlo?')) {
      Object.entries(draft).forEach(([key, val]) => {
        if (form.elements[key]) form.elements[key].value = val;
      });
      setDirty(true);
    }

    form.addEventListener('input', () => {
      setDirty(true);
      const data = Object.fromEntries(new FormData(form).entries());
      saveDraft(draftKey, data);
    });
  }

  setLoading(on) {
    const actionsEl = document.getElementById('inv-form-actions');
    if (actionsEl) {
      actionsEl.innerHTML = renderFormActions({
        saveLabel:    this.isEdit ? 'Guardar cambios' : 'Crear repuesto',
        onCancelHref: '#inventario',
        isSubmitting: on,
      });
    }
    document.querySelectorAll('#inv-form input, #inv-form select, #inv-form textarea')
      .forEach(el => { el.disabled = on; });
  }

  showError(msg) {
    const el = document.getElementById('inv-form-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }

  hideError() {
    const el = document.getElementById('inv-form-error');
    if (el) el.style.display = 'none';
  }
}
