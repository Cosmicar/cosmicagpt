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
    .logo-name em { font-style: normal; color: #0284c7; }
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
    <div class="logo-block">
      <img class="logo-img" src="${LOGO_DATA_URI}" alt="Cósmica" />
      <div class="logo-text-block">
        <div class="logo-name">CÓS<em>MICA</em></div>
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
