import { getTrabajoWithCliente } from "./work-repository.js";
import { escapeHtml, formatDateTime, formatMoney } from "./utils.js";

export async function printTicket(id) {
  const data = await getTrabajoWithCliente(id);
  if (!data) throw new Error("No se encontró la orden.");

  const { trabajo: t, cliente: c = {} } = data;
  const ticketUrl = new URL(`panel.html?orden=${encodeURIComponent(t.numeroOrden || "")}`, window.location.href);
  const logoUrl = new URL("cosmica-logo.png", window.location.href).href;
  const qrData = encodeURIComponent(ticketUrl.href);
  const v = window.open("", "_blank");

  if (!v) {
    throw new Error("El navegador bloqueó la ventana del ticket.");
  }

  v.document.write(`
    <html><head><title>Ticket ${escapeHtml(t.numeroOrden)}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@700&family=DM+Sans:wght@400;500&display=swap');
      * { box-sizing:border-box; margin:0; padding:0; }
      body { font-family:'DM Sans',sans-serif; font-size:13px; max-width:380px; margin:0 auto; padding:20px; color:#111; }
      .header-ticket { text-align:center; margin-bottom:16px; }
      .logo-img { width:58px; height:58px; object-fit:contain; display:block; margin:0 auto 6px; }
      .logo-t { font-family:'Rajdhani',sans-serif; font-size:22px; font-weight:700; letter-spacing:2px; }
      .sub-t  { font-size:11px; color:#888; margin-top:2px; }
      .orden-num { font-family:'Rajdhani',sans-serif; font-size:28px; font-weight:700; text-align:center; margin:10px 0; }
      .qr-wrap { text-align:center; margin-bottom:12px; }
      hr { border:none; border-top:1px dashed #ccc; margin:12px 0; }
      .row { margin:5px 0; display:flex; justify-content:space-between; gap:12px; }
      .row b { min-width:90px; color:#555; font-weight:500; }
      .problema-box { background:#f5f5f5; border-radius:6px; padding:8px 10px; margin:6px 0; font-size:12px; }
      .footer-ticket { text-align:center; font-size:11px; color:#888; margin-top:16px; }
      .garantia-box { background:#e8f8f2; border-radius:6px; padding:8px 10px; text-align:center; font-size:12px; color:#0a7a50; }
    </style>
    </head>
    <body>
      <div class="header-ticket">
        <img class="logo-img" src="${logoUrl}" alt="Cosmica.ar">
        <div class="logo-t">Cosmica.ar</div>
        <div class="sub-t">Servicio técnico integral · Jujuy, Argentina</div>
      </div>

      <div class="orden-num">${escapeHtml(t.numeroOrden || "—")}</div>

      <div class="qr-wrap">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${qrData}" id="qr">
      </div>

      <hr>
      <div class="row"><b>Cliente</b> <span>${escapeHtml(c?.nombre || "")} ${escapeHtml(c?.apellido || "")}</span></div>
      <div class="row"><b>DNI</b> <span>${escapeHtml(c?.dni || "—")}</span></div>
      <div class="row"><b>Teléfono</b> <span>${escapeHtml(c?.telefono || "—")}</span></div>
      <hr>
      <div class="row"><b>Tipo</b> <span>${escapeHtml(t.tipo || "—")}</span></div>
      <div class="row"><b>Equipo</b> <span>${escapeHtml(t.equipo || "—")}</span></div>
      <div class="row"><b>Marca</b> <span>${escapeHtml(t.marca || "—")}</span></div>
      <div class="row"><b>Modelo</b> <span>${escapeHtml(t.modelo || "—")}</span></div>
      <hr>
      <div style="margin:5px 0;color:#555;font-size:12px;font-weight:500;">Problema reportado:</div>
      <div class="problema-box">${escapeHtml(t.problema || "—")}</div>
      <hr>
      <div class="row"><b>Precio</b> <b>$${formatMoney(t.precio)}</b></div>
      <div class="row"><b>Estado</b> <span>${escapeHtml(t.estado || "—")}</span></div>
      <hr>
      <div class="row"><b>Ingreso</b> <span>${formatDateTime(t.fechaIngreso)}</span></div>
      <div class="row"><b>Reparado</b> <span>${formatDateTime(t.fechaReparado)}</span></div>
      <div class="row"><b>Entregado</b> <span>${formatDateTime(t.fechaEntregado)}</span></div>
      <hr>
      <div class="garantia-box">Garantía de ${escapeHtml(t.garantiaDias || 90)} días por la reparación</div>
      <div class="footer-ticket">
        WhatsApp: 3883298736 · Ramírez de Velazco 111, SSJ<br>
        www.cosmica.ar
      </div>

      <script>document.getElementById("qr").onload = () => window.print();<\/script>
    </body></html>
  `);
  v.document.close();
}
