/**
 * Factura PDF Generator — port del legacy /panel.html (idéntico al original)
 *
 * Diferencias con el legacy:
 *  - jsPDF se carga lazy desde CDN (cdnjs)
 *  - El QR AFIP se construye igual (RG 5003/2021)
 *  - El template visual es idéntico (Factura C argentina)
 *  - Se mantienen los datos del emisor (Cristian Aliaga, CUIT, IIBB, etc.)
 *
 * Resultado: archivo `Factura_NNNNNNNN.pdf` descargado al device del usuario.
 */

// ─── Datos del emisor (idéntico al legacy) ─────────────────────────────
const EMISOR = Object.freeze({
  razonSocial:  'Cristian Aliaga',
  cuit:         '20-32877197-8',
  condIva:      'Responsable Monotributo',
  iibb:         'A-1-54786',
  inicioAct:    '01/05/2025',
  domicilio:    'Patrias Argentinas 670, San Salvador de Jujuy',
});

const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

/**
 * Carga jsPDF dinámicamente desde CDN (una vez por sesión).
 */
async function loadJsPDF() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = JSPDF_CDN;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo cargar jsPDF desde CDN.'));
    document.head.appendChild(s);
  });
  if (!window.jspdf?.jsPDF) throw new Error('jsPDF no inicializó.');
  return window.jspdf.jsPDF;
}

/**
 * Genera y descarga el PDF de la factura.
 * @param {Object} f  Factura record (de buildFacturaRecord en services/facturacion.js)
 */
export async function generarFacturaPDF(f) {
  const jsPDF = await loadJsPDF();
  const doc   = new jsPDF({ unit: 'mm', format: 'a4' });

  const pageW    = 210;
  const margin   = 14;
  const contentW = pageW - margin * 2;

  // ─── Utilidades ───────────────────────────────────────────────────────
  const rect = (x, y, w, h, fillColor) => {
    if (fillColor) { doc.setFillColor(...fillColor); doc.rect(x, y, w, h, 'F'); }
    doc.setDrawColor(0); doc.rect(x, y, w, h, 'S');
  };
  const line = (x1, y1, x2, y2) => {
    doc.setDrawColor(0); doc.line(x1, y1, x2, y2);
  };
  const text = (str, x, y, opts) => doc.text(String(str || ''), x, y, opts || {});

  // ─── ENCABEZADO ───────────────────────────────────────────────────────
  rect(margin, 10, 80, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  text('FACTURA', margin + 5, 22);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  text('Cod. 011', margin + 5, 30);

  // Cuadro "C"
  rect(margin + 83, 10, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  text('C', margin + 89, 24);

  // Datos del emisor (derecha del encabezado)
  const rightX = margin + 103;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  text('COSMICA', rightX, 15);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  text(`Razón Social: ${EMISOR.razonSocial}`, rightX, 20);
  text(`CUIT: ${EMISOR.cuit}`,                 rightX, 24.5);
  text(`Cond. IVA: ${EMISOR.condIva}`,         rightX, 29);
  text(`Ing. Brutos: ${EMISOR.iibb}`,          rightX, 33.5);
  text(`Inicio Act.: ${EMISOR.inicioAct}`,     rightX, 38);
  text(`Domicilio: ${EMISOR.domicilio}`,       rightX, 42.5);

  // Número + fecha (esquina sup. derecha)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const farRight = pageW - margin;
  text(`Pto. Venta: ${String(f.puntoVenta || 1).padStart(5, '0')}`, farRight, 15, { align: 'right' });
  text(`Comp. Nro: ${f.numero}`, farRight, 20, { align: 'right' });
  text(`Fecha: ${f.fecha}`,      farRight, 25, { align: 'right' });

  line(margin, 49, pageW - margin, 49);

  // ─── DATOS DEL CLIENTE ────────────────────────────────────────────────
  let y = 55;
  rect(margin, y, contentW, 24, [248, 248, 248]);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  text('Razón Social:', margin + 4, y + 7);
  doc.setFont('helvetica', 'normal');
  text(f.cliente || 'Consumidor Final', margin + 36, y + 7);

  doc.setFont('helvetica', 'bold');
  text('CUIT / DNI:', margin + 4, y + 14);
  doc.setFont('helvetica', 'normal');
  text(f.doc || '-', margin + 36, y + 14);

  doc.setFont('helvetica', 'bold');
  text('Condición IVA:', margin + 4, y + 21);
  doc.setFont('helvetica', 'normal');
  text('Consumidor Final', margin + 40, y + 21);

  // ─── TABLA ITEMS ──────────────────────────────────────────────────────
  y += 30;
  rect(margin, y, contentW, 9, [220, 220, 220]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  text('Descripción / Concepto', margin + 3, y + 6);
  text('Subtotal', pageW - margin - 3, y + 6, { align: 'right' });

  y += 9;
  const rowH = 30;
  rect(margin, y, contentW, rowH);
  line(pageW - margin - 35, y, pageW - margin - 35, y + rowH);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const descLines = doc.splitTextToSize(f.descripcion || 'Servicio de soporte técnico', contentW - 42);
  doc.text(descLines, margin + 3, y + 7);
  doc.setFont('helvetica', 'bold');
  text(`$${Number(f.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, pageW - margin - 3, y + 7, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120);
  text('Servicio prestado por Cosmica.ar', margin + 3, y + rowH - 5);
  doc.setTextColor(0);

  // ─── TOTAL ────────────────────────────────────────────────────────────
  y += rowH + 8;
  const totalStr = `$${Number(f.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  rect(pageW - margin - 70, y, 70, 14, [240, 240, 240]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  text('TOTAL:', pageW - margin - 68, y + 9);
  text(totalStr, pageW - margin - 3, y + 9, { align: 'right' });

  // ─── PIE: QR + CAE ────────────────────────────────────────────────────
  y += 22;
  line(margin, y, pageW - margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80);
  text('Comprobante autorizado por AFIP / ARCA. Documento legal emitido electrónicamente (RG 5003/2021).', margin, y);
  y += 5;
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  text(`CAE N°: ${f.cae}`,         margin, y);
  text(`Vto. CAE: ${f.vto || '—'}`, pageW - margin, y, { align: 'right' });
  y += 5;

  // ─── QR AFIP (RG 5003/2021) ───────────────────────────────────────────
  const qrPayload = {
    ver:        1,
    fecha:      f.fechaISO || new Date().toISOString().slice(0, 10),
    cuit:       EMISOR.cuit.replace(/[^0-9]/g, ''),
    ptoVta:     f.puntoVenta || 1,
    tipoCmp:    11, // 11 = Factura C
    nroCmp:     f.nroComprobanteRaw || parseInt(f.numero, 10),
    importe:    Number(f.monto),
    moneda:     'PES',
    ctz:        1,
    tipoDocRec: f.tipoDocRec !== undefined ? f.tipoDocRec : 99,
    nroDocRec:  f.nroDocRec && f.nroDocRec !== '-' ? parseInt(f.nroDocRec, 10) : 0,
    tipoCodAut: 'E',
    codAut:     parseInt(f.cae, 10),
  };
  const qrBase64 = btoa(JSON.stringify(qrPayload));
  const afipUrl  = `https://www.afip.gob.ar/fe/qr/?p=${qrBase64}`;
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(afipUrl)}`;

  // Cargamos el QR antes de guardar (Promise para await)
  await new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth  || 200;
        canvas.height = img.naturalHeight || 200;
        canvas.getContext('2d').drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/png');

        const qrX = margin;
        const qrY = y;
        doc.addImage(dataURL, 'PNG', qrX, qrY, 28, 28);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(100);
        doc.text('Verificar en AFIP', qrX + 14, qrY + 30, { align: 'center' });
        doc.setTextColor(0);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(60);
        const qrTextX = qrX + 32;
        doc.text('Comprobante Fiscal Electrónico', qrTextX, qrY + 5);
        doc.setFontSize(7);
        doc.text('Escaneá el código QR para verificar', qrTextX, qrY + 10);
        doc.text('la autenticidad de esta factura en',  qrTextX, qrY + 14.5);
        doc.text('el sitio oficial de AFIP.',           qrTextX, qrY + 19);
        doc.setTextColor(0);
      } catch (err) {
        console.warn('[QR AFIP] No se pudo incrustar el QR:', err);
      }
      resolve();
    };
    img.onerror = () => {
      console.warn('[QR AFIP] No se pudo cargar el QR. PDF se guarda sin código.');
      resolve();
    };
    img.src = qrImgUrl;
  });

  // Descarga
  doc.save(`Factura_${f.numero}.pdf`);
}
