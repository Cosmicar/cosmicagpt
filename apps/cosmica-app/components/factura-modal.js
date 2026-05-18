/**
 * Factura Modal — emisión AFIP desde el SaaS
 *
 * Premium SaaS UX:
 *  - Premium dark modal con backdrop blur
 *  - Pre-completado desde ticket (cliente, presupuesto, descripción)
 *  - Validación inline
 *  - Estado de carga ("Consultando AFIP...")
 *  - Resultado con CAE + botón "Descargar PDF"
 *  - Persistencia en Firestore tras éxito
 *
 * Lazy-loads jsPDF solo cuando el usuario pide el PDF.
 */
import { emitirFactura, saveFactura, buildFacturaRecord, TIPO_DOC, COND_IVA } from '../services/facturacion.js';
import { showToast } from './toast.js';

let _activeModal = null;
let _onCloseCallback = null;

/**
 * Abre el modal de facturación.
 * @param {Object} [opts]
 * @param {Object} [opts.ticket]       Pre-fill desde ticket
 * @param {Function} [opts.onSuccess]  Callback (factura) tras emisión exitosa
 * @param {Function} [opts.onClose]    Callback al cerrar (con o sin emisión)
 */
export function openFacturaModal({ ticket = null, onSuccess = null, onClose = null } = {}) {
  if (_activeModal) closeFacturaModal();

  _onCloseCallback = onClose;

  // Pre-fill desde ticket si se provee
  const prefill = ticket ? buildPrefillFromTicket(ticket) : {};

  const overlay = document.createElement('div');
  overlay.className = 'factura-modal-overlay';
  overlay.innerHTML = renderModalContent(prefill, ticket);
  document.body.appendChild(overlay);

  // Trap initial focus
  requestAnimationFrame(() => {
    overlay.classList.add('is-open');
    const monto = overlay.querySelector('#fm-monto');
    if (monto) monto.focus();
  });

  _activeModal = overlay;
  wireModalEvents(overlay, { ticket, onSuccess });
}

export function closeFacturaModal() {
  if (!_activeModal) return;
  _activeModal.classList.remove('is-open');
  const m = _activeModal;
  _activeModal = null;
  setTimeout(() => {
    m.remove();
    if (_onCloseCallback) _onCloseCallback();
    _onCloseCallback = null;
  }, 220);
}

// ─── Internals ──────────────────────────────────────────────────────────

function buildPrefillFromTicket(ticket) {
  const monto = Number(ticket.presupuesto || ticket.precio || 0);
  const cliente = [ticket.nombre, ticket.apellido].filter(Boolean).join(' ').trim();
  const equipo  = [ticket.equipo, ticket.marca, ticket.modelo].filter(Boolean).join(' ').trim();
  const descripcion = equipo
    ? `Reparación / servicio de ${equipo}`
    : 'Servicio de soporte técnico';
  const dni = String(ticket.dni || '').trim();
  // Auto-detect tipo doc por longitud
  let tipoDoc = 'sin_doc';
  if (dni.length === 11) tipoDoc = 'cuit';
  else if (dni.length >= 7 && dni.length <= 9) tipoDoc = 'dni';

  return {
    monto: monto > 0 ? monto : '',
    razonSocial: cliente,
    descripcion,
    tipoDoc,
    nroDoc: dni,
    condIva: 'consumidor_final',
  };
}

function renderModalContent(prefill, ticket) {
  const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ticketBadge = ticket
    ? `<div class="fm-ticket-context">
         <span class="fm-ticket-label">Ticket asociado:</span>
         <span class="fm-ticket-value">#${ticket.numeroOrden || '—'} · ${escape([ticket.equipo, ticket.marca].filter(Boolean).join(' ') || 'Servicio')}</span>
       </div>`
    : '';

  return `
    <div class="factura-modal-card" role="dialog" aria-modal="true" aria-labelledby="fm-title">
      <header class="fm-header">
        <h2 id="fm-title">
          <span class="fm-icon">🧾</span>
          Emitir Factura C — AFIP
        </h2>
        <button class="fm-close" id="fm-close-btn" aria-label="Cerrar">✕</button>
      </header>

      ${ticketBadge}

      <form id="fm-form" class="fm-form" novalidate>
        <div class="fm-grid">
          <div class="form-group">
            <label class="label">Condición IVA del receptor</label>
            <select class="input" id="fm-condIva" name="condIva">
              ${Object.entries(COND_IVA).map(([k, v]) => `
                <option value="${k}" ${prefill.condIva === k ? 'selected' : ''}>${v}</option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="label">Tipo de documento</label>
            <select class="input" id="fm-tipoDoc" name="tipoDoc">
              ${Object.entries(TIPO_DOC).map(([k, v]) => `
                <option value="${k}" ${prefill.tipoDoc === k ? 'selected' : ''}>${v.label}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="form-group" id="fm-doc-group" style="${prefill.tipoDoc === 'sin_doc' ? 'display:none;' : ''}">
          <label class="label">Número de documento</label>
          <input class="input" id="fm-nroDoc" name="nroDoc" type="text" inputmode="numeric"
                 value="${escape(prefill.nroDoc)}"
                 placeholder="${prefill.tipoDoc === 'cuit' ? '20123456789' : '12345678'}">
        </div>

        <div class="form-group">
          <label class="label">Razón social / Nombre del cliente</label>
          <input class="input" id="fm-razon" name="razonSocial" type="text"
                 value="${escape(prefill.razonSocial)}" placeholder="Nombre completo o razón social">
        </div>

        <div class="form-group">
          <label class="label">Descripción del servicio</label>
          <textarea class="input" id="fm-descripcion" name="descripcion" rows="2"
                    style="resize:vertical; min-height:48px;">${escape(prefill.descripcion)}</textarea>
        </div>

        <div class="form-group">
          <label class="label">Monto total <span style="color:var(--accent-cyan);font-weight:700;">(ARS)</span></label>
          <div style="position:relative;">
            <span style="position:absolute; left:14px; top:50%; transform:translateY(-50%); color:var(--text-muted); font-weight:600;">$</span>
            <input class="input" id="fm-monto" name="monto" type="number" min="1" step="0.01"
                   value="${escape(prefill.monto)}" placeholder="0.00"
                   style="padding-left:28px; font-size:18px; font-weight:700;">
          </div>
        </div>

        <div id="fm-feedback" class="fm-feedback"></div>

        <footer class="fm-footer">
          <button type="button" class="btn btn-secondary" id="fm-cancel-btn">Cancelar</button>
          <button type="submit" class="btn btn-primary" id="fm-submit-btn">
            <span id="fm-submit-icon">⚡</span>
            <span id="fm-submit-text">Generar Factura</span>
          </button>
        </footer>
      </form>
    </div>
  `;
}

function wireModalEvents(overlay, { ticket, onSuccess }) {
  const form        = overlay.querySelector('#fm-form');
  const closeBtn    = overlay.querySelector('#fm-close-btn');
  const cancelBtn   = overlay.querySelector('#fm-cancel-btn');
  const submitBtn   = overlay.querySelector('#fm-submit-btn');
  const submitIcon  = overlay.querySelector('#fm-submit-icon');
  const submitText  = overlay.querySelector('#fm-submit-text');
  const tipoDocSel  = overlay.querySelector('#fm-tipoDoc');
  const docGroup   = overlay.querySelector('#fm-doc-group');
  const nroDocInput = overlay.querySelector('#fm-nroDoc');
  const feedback    = overlay.querySelector('#fm-feedback');

  // Click on backdrop closes
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeFacturaModal();
  });
  closeBtn?.addEventListener('click', closeFacturaModal);
  cancelBtn?.addEventListener('click', closeFacturaModal);

  // ESC closes
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeFacturaModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // Tipo doc change → show/hide nro doc + adjust placeholder/maxLen
  tipoDocSel?.addEventListener('change', () => {
    const t = tipoDocSel.value;
    if (t === 'sin_doc') {
      docGroup.style.display = 'none';
      nroDocInput.value = '';
    } else {
      docGroup.style.display = '';
      nroDocInput.placeholder = t === 'cuit' ? '20123456789' : '12345678';
      nroDocInput.maxLength = TIPO_DOC[t].maxLen;
    }
  });

  // Submit
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    feedback.className = 'fm-feedback';
    feedback.innerHTML = '';

    const formData = new FormData(form);
    const input = {
      monto:        parseFloat(formData.get('monto')),
      descripcion:  String(formData.get('descripcion') || '').trim(),
      razonSocial:  String(formData.get('razonSocial') || '').trim(),
      tipoDoc:      formData.get('tipoDoc'),
      nroDoc:       String(formData.get('nroDoc') || '').trim(),
      condIva:      formData.get('condIva'),
    };

    // Locking UI
    submitBtn.disabled = true;
    submitIcon.textContent = '⏳';
    submitText.textContent = 'Consultando AFIP...';

    const result = await emitirFactura(input);

    if (!result.ok) {
      showFeedback(feedback, 'error', result.error + (result.detalle ? `<br><small style="opacity:0.8;">${result.detalle}</small>` : ''));
      submitBtn.disabled = false;
      submitIcon.textContent = '⚡';
      submitText.textContent = 'Reintentar';
      return;
    }

    // Build factura record + persist to Firestore
    const factura = buildFacturaRecord(result.data, input);
    const persist = await saveFactura(factura, ticket?.id || null);
    if (!persist.ok) {
      // Soft warning — AFIP did emit, but local persist failed
      console.warn('[factura-modal] persist failed but AFIP succeeded:', persist.error);
      showToast('Factura emitida, pero falló el guardado en historial: ' + persist.error, 'warning');
    }
    factura.id = persist.id;

    // Success UI
    const ambColor = factura.ambiente === 'PRODUCCION' ? 'var(--accent-green)' : 'var(--accent-orange)';
    showFeedback(feedback, 'success', `
      <strong style="font-size:15px;">✅ Factura emitida correctamente</strong>
      <div class="fm-result-rows" style="margin-top:14px; display:flex; flex-direction:column; gap:6px;">
        <div class="fm-row"><span>Tipo</span><span>${factura.tipo}</span></div>
        <div class="fm-row"><span>N° Comprobante</span><span class="fm-mono">${factura.numero}</span></div>
        <div class="fm-row"><span>CAE</span><span class="fm-mono" style="font-size:11.5px; letter-spacing:0.5px;">${factura.cae}</span></div>
        <div class="fm-row"><span>Vto. CAE</span><span>${factura.vto || '—'}</span></div>
        <div class="fm-row"><span>Monto</span><span style="color:var(--accent-green); font-weight:800;">$${Number(factura.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
        <div class="fm-row"><span>Ambiente</span><span style="color:${ambColor}; font-size:11px; font-weight:700;">${factura.ambiente}</span></div>
      </div>
      <button class="btn btn-primary" id="fm-pdf-btn" style="margin-top:16px; width:100%;">
        📄 Descargar PDF
      </button>
    `);

    // Wire PDF download (lazy load jsPDF)
    overlay.querySelector('#fm-pdf-btn')?.addEventListener('click', async () => {
      const pdfBtn = overlay.querySelector('#fm-pdf-btn');
      pdfBtn.disabled = true;
      pdfBtn.innerHTML = '⏳ Generando PDF...';
      try {
        const { generarFacturaPDF } = await import('./factura-pdf.js');
        await generarFacturaPDF(factura);
        pdfBtn.innerHTML = '📄 Descargar PDF';
        pdfBtn.disabled = false;
      } catch (err) {
        console.error('[factura-pdf] error:', err);
        showToast('Error al generar PDF: ' + err.message, 'error');
        pdfBtn.innerHTML = '📄 Descargar PDF';
        pdfBtn.disabled = false;
      }
    });

    // Reset submit button to "emit another"
    submitBtn.disabled = false;
    submitIcon.textContent = '⚡';
    submitText.textContent = 'Emitir otra';

    if (onSuccess) onSuccess(factura);
  });
}

function showFeedback(el, kind, html) {
  el.className = `fm-feedback fm-feedback-${kind}`;
  el.innerHTML = html;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
