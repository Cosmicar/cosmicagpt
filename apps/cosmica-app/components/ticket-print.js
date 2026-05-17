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
    return `${base}/estado.html?orden=${encodeURIComponent(ticket.numeroOrden || '')}`;
  } catch { return ''; }
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml(ticket) {
  const session  = getCurrentSession();
  const tecnicoActual  = session?.profile?.nombre || session?.user?.email || 'No especificado';
  const tecnicoAsignado = ticket.tecnicoAsignadoNombre || tecnicoActual;

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

  const trackingUrl = buildTrackingUrl(ticket);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(trackingUrl)}`;

  const presupuestoRow = presupuesto ? `
      <div class="op-item"><span class="op-label">Presupuesto</span><span class="op-value money">${presupuesto}</span></div>` : '';

  const precioRow = precio ? `
      <div class="op-item"><span class="op-label">Total Final</span><span class="op-value money">${precio}</span></div>` : '';

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

  const LOGO_DATA_URI = 'data:image/png;base64,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';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Orden ${orden} — Cósmica</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    @page {
      size: A4;
      margin: 0;
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
    .logo-block {
      display: flex;
      align-items: center;
      gap: 10pt;
    }
    .logo-img {
      width: 44pt;
      height: 44pt;
      object-fit: contain;
      flex-shrink: 0;
    }
    .logo-text-block { display: flex; flex-direction: column; }
    .logo-name {
      font-size: 22pt;
      font-weight: 900;
      letter-spacing: -0.5pt;
      line-height: 1;
      color: #111111;
    }
    .logo-tagline {
      font-size: 7pt;
      letter-spacing: 1.5pt;
      text-transform: uppercase;
      color: #888888;
      font-weight: 600;
      margin-top: 4pt;
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
      /* Prevent long words/URLs from overflowing the column */
      word-break: break-word;
      overflow-wrap: break-word;
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
      html, body {
        width: 210mm;
        height: 297mm;
        background: white !important;
      }
      .doc {
        width: 210mm !important;
        max-width: 210mm !important;
        padding: 16mm 20mm !important;
        margin: 0 !important;
        box-shadow: none !important;
      }
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
    <div class="logo-block">
      <img class="logo-img" src="${LOGO_DATA_URI}" alt="Cósmica" />
      <div class="logo-text-block">
        <div class="logo-name">CÓSMICA</div>
        <div class="logo-tagline">Servicio Técnico Profesional</div>
      </div>
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
      <div class="op-item"><span class="op-label">Técnico</span><span class="op-value">${esc(tecnicoAsignado)}</span></div>
      <div class="op-item"><span class="op-label">Garantía</span><span class="op-value">${garantia} días</span></div>
      <div class="op-item"><span class="op-label">Pago</span><span class="op-value" style="text-transform:capitalize;">${esc(ticket.metodoPago || 'Efectivo')}</span></div>
      ${presupuestoRow}
      ${precioRow}
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
  const tecnicoAsignado = ticket.tecnicoAsignadoNombre || 'No asignado';
  const garantia      = Number(ticket.garantiaDias) || 90;
  const trackingUrl   = buildTrackingUrl(ticket);
  const qrUrl         = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(trackingUrl)}`;

  const presupuesto = fmtMoney(ticket.presupuesto);
  const precio      = fmtMoney(ticket.precio);

  const rows = (label, val) => val
    ? `<tr><td class="lbl">${label}</td><td class="val">${val}</td></tr>`
    : '';

  const THERMAL_LOGO_URI = 'data:image/png;base64,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';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Ticket ${orden} — Cósmica</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    @page {
      size: 80mm auto;
      margin: 0;
    }

    html, body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.3;
      color: #000;
      background: #fff;
      width: 100%;
    }

    .doc {
      width: 74mm;
      margin: 0 auto;
      padding: 6mm 2mm 15mm 2mm;
    }

    .center { text-align: center; }
    .bold   { font-weight: bold; }
    .lg     { font-size: 14px; }
    .xl     { font-size: 18px; }
    .muted  { color: #555; }
    .small  { font-size: 8px; }

    hr { border: none; border-top: 1px dashed #000; margin: 10px 0; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    td { padding: 3px 0; vertical-align: top; }
    td.lbl { color: #555; width: 42%; font-size: 9px; padding-right: 4px; }
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
      /* Prevent long words from overflowing 74mm column — critical for thermal */
      word-break: break-word;
      overflow-wrap: break-word;
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
      table, .text-prose, .qr-wrap, .footer-note, .signatures { 
        page-break-inside: avoid; 
        break-inside: avoid; 
      }
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

  <div class="center" style="margin-bottom:4px;">
    <img src="${THERMAL_LOGO_URI}" alt="Cósmica" style="width:60px;height:60px;object-fit:contain;display:block;margin:0 auto;" />
  </div>
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
    ${rows('Técnico', tecnicoAsignado)}
    ${rows('Pago', ticket.metodoPago ? ticket.metodoPago.charAt(0).toUpperCase() + ticket.metodoPago.slice(1) : 'Efectivo')}
    ${rows('Garantía', garantia + ' días')}
    ${presupuesto ? rows('Presupuesto', presupuesto) : ''}
    ${precio ? rows('Total Final', precio) : ''}
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
    <img src="${qrUrl}" alt="QR Seguimiento" style="width:72px;height:72px;">
    <div class="small muted" style="margin-top:3px;">Estado en línea</div>
    <div class="small muted" style="font-size:7px;word-break:break-all;max-width:70mm;line-height:1.3;">${esc(trackingUrl)}</div>
  </div>

  <hr>

  <div class="footer-note">
    Garantía: <strong>${garantia} días</strong> mano de obra desde entrega.<br>
    Repuestos sujetos a garantía del fabricante.<br>
    No cubre daños por humedad, golpes o mal uso.<br>
    <strong>Cósmica Online</strong> · <strong>https://cosmica.ar</strong><br>
    Tel.: <strong>+54 9 11 0000-0000</strong>
  </div>

  <div class="signatures" style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:16px;">
    <div>
      <div style="border-bottom:1px solid #000;height:22px;"></div>
      <div class="small muted center" style="margin-top:2px;">Firma cliente</div>
    </div>
    <div>
      <div style="border-bottom:1px solid #000;height:22px;"></div>
      <div class="small muted center" style="margin-top:2px;">Firma técnico</div>
    </div>
  </div>

  <div class="center small muted" style="margin-top:10px;font-size:7px;line-height:1.4;">
    Este comprobante acredita la recepción del equipo.<br>
    Cósmica no se responsabiliza por equipos no retirados<br>
    después de 90 días desde la finalización del servicio.
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
