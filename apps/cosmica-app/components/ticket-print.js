import { getCurrentSession } from '../core/session.js';

// ── Utilities ─────────────────────────────────────────────────────────────────

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function v(val) {
  const s = esc(val);
  return s || 'No especificado';
}

function fmtDate(iso) {
  if (!iso) return 'No especificado';
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch { return 'No especificado'; }
}

function fmtMoney(val) {
  const n = Number(val);
  return n ? '$' + n.toLocaleString('es-AR') : null;
}

function buildTrackingUrl(ticket) {
  try {
    const href = window.location.href;
    const base = href.includes('/apps/cosmica-app/')
      ? href.split('/apps/cosmica-app/')[0]
      : window.location.origin;
    return `${base}/estado.html?id=${encodeURIComponent(ticket.id || '')}`;
  } catch { return ''; }
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml(ticket) {
  const session  = getCurrentSession();
  const tecnico  = session?.profile?.nombre || session?.user?.email || 'No especificado';

  const orden        = esc(ticket.numeroOrden) || '—';
  const fechaIngreso = fmtDate(ticket.fechaIngreso);
  const fechaPrint   = new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const clienteNombre = esc([ticket.nombre, ticket.apellido].filter(Boolean).join(' ')) || 'No especificado';
  const clienteDni    = v(ticket.dni);
  const clienteTel    = v(ticket.telefono);

  const equipo      = v(ticket.equipo);
  const marcaModelo = esc([ticket.marca, ticket.modelo].filter(Boolean).join(' ')) || 'No especificado';
  const problema    = v(ticket.problema);
  const estado      = v(ticket.estado) || 'Ingresado';
  const plan        = ticket.planServicio
    ? ticket.planServicio.charAt(0).toUpperCase() + ticket.planServicio.slice(1)
    : 'Estándar';
  const tipo        = ticket.tipo === 'remoto' ? 'Remoto' : 'Taller';

  const presupuesto = fmtMoney(ticket.presupuesto);
  const precio      = fmtMoney(ticket.precio);

  const METODO_PRINT_LABELS = {
    efectivo:      'Efectivo',
    transferencia: 'Transferencia',
    mercadopago:   'Mercado Pago',
    debito:        'Débito',
    credito:       'Crédito',
  };
  const metodoPagoLabel = ticket.metodoPago
    ? (METODO_PRINT_LABELS[ticket.metodoPago] || ticket.metodoPago)
    : null;

  const trackingUrl = buildTrackingUrl(ticket);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(trackingUrl)}`;

  const presupuestoRow = presupuesto ? `
      <div class="op-item"><span class="op-label">Presupuesto</span><span class="op-value money">${presupuesto}</span></div>` : '';

  const precioRow = precio ? `
      <div class="op-item"><span class="op-label">Total Final</span><span class="op-value money">${precio}</span></div>` : '';

  const metodoPagoRow = precio && metodoPagoLabel ? `
      <div class="op-item"><span class="op-label">Método de pago</span><span class="op-value">${esc(metodoPagoLabel)}</span></div>` : '';

  const garantia = Number(ticket.garantiaDias) || 90;

  const servicioHtml = ticket.servicioRealizado ? `
    <section class="section">
      <div class="section-label">Servicio Realizado</div>
      <p class="text-block">${esc(ticket.servicioRealizado)}</p>
    </section>` : '';

  const diagHtml = ticket.diagnosticoTecnico ? `
    <section class="section">
      <div class="section-label">Diagnóstico Técnico</div>
      <p class="text-block">${esc(ticket.diagnosticoTecnico)}</p>
    </section>` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Orden ${orden} — Cósmica</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    @page {
      size: A4;
      margin: 14mm 16mm 16mm 16mm;
    }

    html, body {
      font-family: 'Helvetica Neue', Arial, 'Segoe UI', sans-serif;
      font-size: 10.5pt;
      line-height: 1.5;
      color: #111111;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .doc {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 9pt;
    }

    /* ── Header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 10pt;
      border-bottom: 2pt solid #111111;
    }
    .logo-name {
      font-size: 24pt;
      font-weight: 900;
      letter-spacing: -0.5pt;
      line-height: 1;
      color: #111111;
    }
    .logo-name em { font-style: normal; color: #0284c7; }
    .logo-tagline {
      font-size: 7pt;
      letter-spacing: 1.5pt;
      text-transform: uppercase;
      color: #888888;
      font-weight: 600;
      margin-top: 5pt;
    }
    .header-right { text-align: right; }
    .doc-label {
      font-size: 7pt;
      letter-spacing: 2pt;
      text-transform: uppercase;
      color: #888888;
      font-weight: 700;
    }
    .orden-num {
      font-size: 28pt;
      font-weight: 900;
      letter-spacing: -1pt;
      line-height: 1;
      color: #111111;
      margin-top: 2pt;
    }
    .fecha-ingreso { font-size: 8pt; color: #555555; margin-top: 4pt; }
    .fecha-print   { font-size: 7pt; color: #aaaaaa; margin-top: 2pt; }

    /* ── Sections ── */
    .section { page-break-inside: avoid; }
    .section-label {
      font-size: 6.5pt;
      font-weight: 700;
      letter-spacing: 1.5pt;
      text-transform: uppercase;
      color: #888888;
      padding-bottom: 3pt;
      border-bottom: 0.5pt solid #dddddd;
      margin-bottom: 5pt;
    }

    /* ── Two-col grid ── */
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12pt;
    }

    /* ── Data rows ── */
    .row {
      display: flex;
      gap: 0;
      padding: 2.5pt 0;
      border-bottom: 0.4pt solid #f0f0f0;
    }
    .row:last-child { border-bottom: none; }
    .row-label {
      font-size: 7.5pt;
      color: #888888;
      font-weight: 600;
      min-width: 36%;
      flex-shrink: 0;
    }
    .row-value {
      font-size: 9pt;
      color: #111111;
      font-weight: 500;
    }

    /* ── Operational grid ── */
    .op-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1pt 18pt;
    }
    .op-item {
      display: flex;
      align-items: baseline;
      gap: 6pt;
      padding: 3pt 0;
      border-bottom: 0.4pt solid #f2f2f2;
    }
    .op-label {
      font-size: 7.5pt;
      color: #888888;
      font-weight: 600;
      min-width: 56pt;
      flex-shrink: 0;
    }
    .op-value { font-size: 9pt; color: #111111; font-weight: 500; }
    .money    { font-size: 10.5pt; font-weight: 700; }

    /* ── Estado badge ── */
    .estado-badge {
      display: inline-block;
      padding: 1.5pt 7pt;
      border: 1pt solid #333333;
      border-radius: 20pt;
      font-size: 7.5pt;
      font-weight: 700;
      color: #333333;
    }

    /* ── Text blocks ── */
    .text-block {
      font-size: 9.5pt;
      line-height: 1.6;
      color: #222222;
      white-space: pre-wrap;
    }

    /* ── Divider ── */
    hr { border: none; border-top: 0.5pt solid #dddddd; }

    /* ── Footer ── */
    .footer {
      display: grid;
      grid-template-columns: 105pt 1fr;
      gap: 14pt;
      margin-top: 4pt;
      padding-top: 10pt;
      border-top: 1pt solid #cccccc;
      page-break-inside: avoid;
    }
    .qr-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5pt;
    }
    .qr-img {
      width: 98pt;
      height: 98pt;
      border: 0.5pt solid #dddddd;
      border-radius: 3pt;
      display: block;
    }
    .qr-caption {
      font-size: 6.5pt;
      color: #999999;
      text-align: center;
      letter-spacing: 0.5pt;
      text-transform: uppercase;
    }
    .qr-url {
      font-size: 5.5pt;
      color: #bbbbbb;
      text-align: center;
      word-break: break-all;
      max-width: 100pt;
      line-height: 1.4;
    }
    .footer-main {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 8pt;
    }
    .disclaimer {
      font-size: 7.5pt;
      color: #666666;
      line-height: 1.55;
    }
    .disclaimer strong { color: #333333; }

    /* ── Signatures ── */
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18pt;
    }
    .sig { display: flex; flex-direction: column; gap: 5pt; }
    .sig-line { border-bottom: 0.75pt solid #333333; height: 22pt; }
    .sig-label { font-size: 6.5pt; color: #888888; letter-spacing: 0.5pt; text-align: center; }

    /* ── Print enforcement ── */
    @media print {
      html, body { background: white !important; }
      * { box-shadow: none !important; }
    }

    /* ── Screen preview ── */
    @media screen {
      body {
        background: #e0e0e0;
        padding: 24px;
        display: flex;
        justify-content: center;
        min-height: 100vh;
      }
      .doc {
        background: white;
        padding: 18mm 20mm;
        max-width: 210mm;
        width: 100%;
        min-height: 270mm;
        box-shadow: 0 4px 40px rgba(0,0,0,0.20);
        border-radius: 3px;
      }
    }
  </style>
</head>
<body>
<div class="doc">

  <!-- HEADER -->
  <header class="header">
    <div>
      <div class="logo-name">CÓS<em>MICA</em></div>
      <div class="logo-tagline">Servicio Técnico Profesional</div>
    </div>
    <div class="header-right">
      <div class="doc-label">Orden de Servicio</div>
      <div class="orden-num">${orden}</div>
      <div class="fecha-ingreso">Ingreso: ${fechaIngreso}</div>
      <div class="fecha-print">Impreso: ${fechaPrint}</div>
    </div>
  </header>

  <!-- CLIENTE + EQUIPO -->
  <div class="grid-2">
    <section class="section">
      <div class="section-label">Cliente</div>
      <div class="row"><span class="row-label">Nombre</span><span class="row-value">${clienteNombre}</span></div>
      <div class="row"><span class="row-label">DNI</span><span class="row-value">${clienteDni}</span></div>
      <div class="row"><span class="row-label">Teléfono</span><span class="row-value">${clienteTel}</span></div>
    </section>
    <section class="section">
      <div class="section-label">Equipo</div>
      <div class="row"><span class="row-label">Dispositivo</span><span class="row-value">${equipo}</span></div>
      <div class="row"><span class="row-label">Marca / Modelo</span><span class="row-value">${marcaModelo}</span></div>
      <div class="row"><span class="row-label">Tipo de servicio</span><span class="row-value">${tipo}</span></div>
    </section>
  </div>

  <!-- PROBLEMA -->
  <section class="section">
    <div class="section-label">Problema Reportado</div>
    <p class="text-block">${problema}</p>
  </section>

  <hr>

  <!-- OPERACIONAL -->
  <section class="section">
    <div class="section-label">Detalles del Servicio</div>
    <div class="op-grid">
      <div class="op-item"><span class="op-label">Estado</span><span class="op-value"><span class="estado-badge">${estado}</span></span></div>
      <div class="op-item"><span class="op-label">Plan</span><span class="op-value">${plan}</span></div>
      <div class="op-item"><span class="op-label">Técnico</span><span class="op-value">${esc(tecnico)}</span></div>
      <div class="op-item"><span class="op-label">Garantía</span><span class="op-value">${garantia} días</span></div>
      ${presupuestoRow}
      ${precioRow}
      ${metodoPagoRow}
    </div>
  </section>

  ${servicioHtml}

  ${diagHtml}

  <!-- FOOTER -->
  <div class="footer">
    <div class="qr-col">
      <img class="qr-img" src="${qrUrl}" alt="QR Seguimiento">
      <div class="qr-caption">Seguimiento en línea</div>
      <div class="qr-url">${esc(trackingUrl)}</div>
    </div>
    <div class="footer-main">
      <div class="disclaimer">
        <strong>Garantía de Servicio:</strong> El trabajo realizado tiene una garantía de
        <strong>${garantia} días</strong> sobre mano de obra a partir de la fecha de entrega del equipo.
        Los repuestos están sujetos a la garantía del fabricante. La garantía no cubre daños
        por humedad, golpes o mal uso posterior a la entrega.
      </div>
      <div class="signatures">
        <div class="sig">
          <div class="sig-line"></div>
          <div class="sig-label">Firma y aclaración del cliente</div>
        </div>
        <div class="sig">
          <div class="sig-line"></div>
          <div class="sig-label">Firma del técnico responsable</div>
        </div>
      </div>
    </div>
  </div>

</div>
<script>
  window.addEventListener('load', function () {
    var img = document.querySelector('.qr-img');
    function doPrint() {
      window.focus();
      window.print();
      window.addEventListener('afterprint', function () { window.close(); });
    }
    if (img && !img.complete) {
      img.addEventListener('load', doPrint);
      img.addEventListener('error', doPrint);
      setTimeout(doPrint, 3500);
    } else {
      setTimeout(doPrint, 200);
    }
  });
</script>
</body>
</html>`;
}

// ── Thermal HTML builder (80mm roll) ─────────────────────────────────────────

function buildThermalHtml(ticket) {
  const orden        = esc(ticket.numeroOrden) || '—';
  const fechaIngreso = fmtDate(ticket.fechaIngreso);
  const fechaPrint   = new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const clienteNombre = esc([ticket.nombre, ticket.apellido].filter(Boolean).join(' ')) || 'No especificado';
  const clienteTel    = v(ticket.telefono);
  const equipo        = v(ticket.equipo);
  const marcaModelo   = esc([ticket.marca, ticket.modelo].filter(Boolean).join(' ')) || '';
  const estado        = v(ticket.estado) || 'Ingresado';
  const garantia      = Number(ticket.garantiaDias) || 90;
  const trackingUrl   = buildTrackingUrl(ticket);
  const qrUrl         = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(trackingUrl)}`;

  const presupuesto = fmtMoney(ticket.presupuesto);
  const precio      = fmtMoney(ticket.precio);

  const rows = (label, val) => val
    ? `<tr><td class="lbl">${label}</td><td class="val">${val}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Ticket ${orden} — Cósmica</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    @page {
      size: 80mm auto;
      margin: 2mm;
    }

    html, body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 10px;
      line-height: 1.4;
      color: #000;
      background: #fff;
      width: 100%;
    }

    .doc {
      max-width: 380px;
      margin: 0 auto;
      padding: 4px 2px;
    }

    .center { text-align: center; }
    .bold   { font-weight: bold; }
    .lg     { font-size: 14px; }
    .xl     { font-size: 18px; }
    .muted  { color: #555; }
    .small  { font-size: 8px; }

    hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }

    table { width: 100%; border-collapse: collapse; }
    td { padding: 2px 0; vertical-align: top; }
    td.lbl { color: #555; width: 38%; font-size: 9px; padding-right: 4px; }
    td.val { font-weight: 600; }

    .block-label {
      font-size: 8px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #555;
      margin-bottom: 2px;
      margin-top: 6px;
    }

    .text-prose {
      font-size: 9px;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .qr-wrap { text-align: center; margin-top: 8px; }
    .qr-wrap img { width: 100px; height: 100px; display: block; margin: 0 auto; }

    .footer-note {
      font-size: 8px;
      color: #555;
      text-align: center;
      margin-top: 4px;
      line-height: 1.4;
    }

    @media print {
      html, body { background: white !important; }
    }

    @media screen {
      body { background: #ccc; padding: 16px; }
      .doc {
        background: white;
        padding: 12px;
        box-shadow: 0 2px 20px rgba(0,0,0,0.2);
      }
    }
  </style>
</head>
<body>
<div class="doc">

  <div class="center bold xl">CÓSMICA</div>
  <div class="center muted small">Servicio Técnico Profesional</div>

  <hr>

  <div class="center bold lg">ORDEN #${orden}</div>
  <div class="center small muted">Ingreso: ${fechaIngreso} &nbsp;|&nbsp; Impreso: ${fechaPrint}</div>

  <hr>

  <div class="block-label">Cliente</div>
  <table>
    ${rows('Nombre', clienteNombre)}
    ${rows('Teléfono', clienteTel)}
  </table>

  <div class="block-label">Equipo</div>
  <table>
    ${rows('Dispositivo', equipo)}
    ${marcaModelo ? rows('Marca/Modelo', marcaModelo) : ''}
  </table>

  <div class="block-label">Estado</div>
  <table>
    ${rows('Estado', estado)}
    ${rows('Garantía', garantia + ' días')}
    ${presupuesto ? rows('Presupuesto', presupuesto) : ''}
    ${precio ? rows('Total Final', precio) : ''}
    ${precio && metodoPagoLabel ? rows('Método de pago', metodoPagoLabel) : ''}
  </table>

  <hr>

  <div class="block-label">Problema Reportado</div>
  <div class="text-prose">${esc(ticket.problema) || 'No especificado'}</div>

  ${ticket.servicioRealizado ? `
  <div class="block-label">Servicio Realizado</div>
  <div class="text-prose">${esc(ticket.servicioRealizado)}</div>` : ''}

  ${ticket.diagnosticoTecnico ? `
  <div class="block-label">Diagnóstico Técnico</div>
  <div class="text-prose">${esc(ticket.diagnosticoTecnico)}</div>` : ''}

  <hr>

  <div class="qr-wrap">
    <img src="${qrUrl}" alt="QR Seguimiento">
    <div class="small muted" style="margin-top:4px;">Escaneá para ver el estado</div>
  </div>

  <hr>

  <div class="footer-note">
    Garantía de servicio: <strong>${garantia} días</strong> sobre mano de obra.<br>
    Repuestos sujetos a garantía del fabricante.<br>
    No cubre daños por humedad, golpes o mal uso.
  </div>

  <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:20px;">
    <div>
      <div style="border-bottom:1px solid #000;height:24px;"></div>
      <div class="small muted center" style="margin-top:2px;">Firma cliente</div>
    </div>
    <div>
      <div style="border-bottom:1px solid #000;height:24px;"></div>
      <div class="small muted center" style="margin-top:2px;">Firma técnico</div>
    </div>
  </div>

</div>
<script>
  window.addEventListener('load', function () {
    var img = document.querySelector('.qr-wrap img');
    function doPrint() { window.focus(); window.print(); window.addEventListener('afterprint', function() { window.close(); }); }
    if (img && !img.complete) {
      img.addEventListener('load', doPrint);
      img.addEventListener('error', doPrint);
      setTimeout(doPrint, 3500);
    } else {
      setTimeout(doPrint, 200);
    }
  });
</script>
</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Abre una ventana popup con el comprobante de la orden y dispara window.print().
 *
 * @param {Object} ticket          Objeto ticket completo del cache local — no hace fetch.
 * @param {'a4'|'thermal'} [mode]  Formato de impresión. Por defecto 'a4'.
 */
export function openTicketPrint(ticket, mode = 'a4') {
  const isThermal = mode === 'thermal';
  const winSpec   = isThermal
    ? 'width=420,height=800,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes'
    : 'width=820,height=1060,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes';

  const win = window.open('', '_blank', winSpec);
  if (!win) {
    alert('Habilitá las ventanas emergentes para imprimir. Luego intentá de nuevo.');
    return;
  }
  win.document.open();
  win.document.write(isThermal ? buildThermalHtml(ticket) : buildHtml(ticket));
  win.document.close();
}
