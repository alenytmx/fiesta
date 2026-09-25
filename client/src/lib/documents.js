/** @file Tickets térmicos e invitaciones generados directamente como ArrayBuffer. */
import { jsPDF } from "jspdf";
import { DEFAULT_REPORT } from "../../../shared/report-defaults.js";
import { paid } from "../../../shared/finance.js";
/** @param {number} n Centavos. @returns {string} Importe MXN. */
const money = (n) =>
  "$" +
  ((n || 0) / 100).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
/** @param {string} v Fecha civil o instante. @returns {string} Fecha legible. */
const date = (v) =>
  !v ? "—" : String(v).slice(0, 10).split("-").reverse().join("/");
/** Dibuja iconos vectoriales predeterminados, sin archivos externos. @param {object} doc PDF. @param {string} key Red. @param {number} x Posición. @param {number} y Posición. */
export function socialIcon(doc, key, x, y) {
  doc.setDrawColor(80);
  doc.setLineWidth(0.3);
  if (key === "facebook") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("f", x + 1, y + 3);
  } else if (key === "instagram") {
    doc.roundedRect(x, y, 3.5, 3.5, 1, 1);
    doc.circle(x + 1.75, y + 1.75, 0.8);
    doc.circle(x + 2.7, y + 0.7, 0.15, "F");
  } else {
    doc.circle(x + 1.75, y + 1.2, 1.1);
    doc.line(x + 0.8, y + 1.8, x + 1.75, y + 3.5);
    doc.line(x + 2.7, y + 1.8, x + 1.75, y + 3.5);
  }
}
/** @param {object} q Cotización con movimientos. @param {object} settings Configuración. @returns {ArrayBuffer} Ticket de ancho real, paginado si excede el papel. */
export function buildTicketPdf(q, settings = {}, pageHeight = 297) {
  const s = { ...DEFAULT_REPORT, ...settings },
    w = s.ticketWidth,
    doc = new jsPDF({ unit: "mm", format: [w, pageHeight], compress: true });
  let y = 8;
  doc.setFont("courier");
  doc.setFontSize(w === 58 ? 8 : 9);
  /** Ajusta cada línea y continúa en otra hoja sin recortar el historial. */
  const line = (value, bold = false) => {
    doc.setFont("courier", bold ? "bold" : "normal");
    for (const part of doc.splitTextToSize(String(value || ""), w - 10)) {
      if (y > pageHeight - 8) {
        doc.addPage([w, pageHeight]);
        y = 8;
      }
      doc.text(part, 5, y);
      y += 4.4;
    }
    y += 1;
  };
  line(s.programName, true);
  line(s.menuSlogan);
  if (s.rfc) line("RFC: " + s.rfc);
  line("COTIZACION " + q.number, true);
  line("Fecha: " + date(q.createdAt));
  line("Evento: " + date(q.eventDate));
  line("Cliente: " + q.clientName);
  line("Estado: " + q.status);
  line("-".repeat(w === 58 ? 26 : 35));
  for (const item of q.items || []) {
    line(item.description, true);
    line(
      `${item.quantity} x ${money(Math.round(item.unitPrice * 100))} = ${money(item.totalCents ?? Math.round(item.unitPrice * 100) * item.quantity)}`,
    );
  }
  line("SUBTOTAL: " + money(q.subtotalCents));
  line(`DESCUENTO ${q.discountPercent || 0}%: ${money(q.discountCents)}`);
  if (q.discountReason) line(q.discountReason);
  line("TOTAL: " + money(q.totalCents), true);
  for (const p of q.payments || []) {
    line(
      `${p.voided ? "ANULADO" : p.kind || "ABONO"} ${date(p.date)}: ${money(p.amountCents)}`,
      true,
    );
    for (const part of p.parts?.length
      ? p.parts
      : [{ method: p.method || "Pago", amountCents: p.amountCents }])
      line(`${part.method}: ${money(part.amountCents)}`);
    if (p.voided) line("Motivo: " + p.voidReason);
    if (p.note) line(p.note);
  }
  line("RECIBIDO: " + money(paid(q)));
  line("PENDIENTE: " + money(q.totalCents - paid(q)), true);
  line(s.ticketMessage);
  if (pageHeight === 297 && doc.getNumberOfPages() === 1 && y + 10 < 297)
    return buildTicketPdf(q, settings, y + 10);
  return doc.output("arraybuffer");
}
/** @param {object} data Invitación, invitado y evento autorizados. @param {object} settings Diseño. @param {Map} assets Imágenes privadas. @returns {ArrayBuffer} Invitación A5. */
export function buildInvitationPdf(data, settings = {}, assets = new Map()) {
  const s = { ...DEFAULT_REPORT, ...settings },
    doc = new jsPDF({ unit: "mm", format: "a5", compress: true }),
    { invitation = {}, guest = {}, quote = {} } = data;
  let y = 16;
  /** Escribe párrafos centrados y agrega páginas cuando el texto crece. */
  const text = (value, size = s.invitationFontSize, bold = false) => {
    doc.setFont(s.invitationFont, bold ? "bold" : "normal");
    doc.setFontSize(size);
    for (const line of doc.splitTextToSize(String(value || ""), 118)) {
      if (y > 190) {
        doc.addPage();
        y = 18;
      }
      doc.text(line, 74, y, { align: "center" });
      y += size * 0.48;
    }
    y += 5;
  };
  /** Inserta una imagen completa, sin deformación ni recorte. */
  const photo = (id, height) => {
    const bytes = assets.get(id);
    if (!bytes) return;
    if (y + height > 190) {
      doc.addPage();
      y = 18;
    }
    const m = doc.getImageProperties(bytes),
      scale = Math.min(118 / m.width, height / m.height);
    doc.addImage(
      bytes,
      "PNG",
      (148 - m.width * scale) / 2,
      y,
      m.width * scale,
      m.height * scale,
    );
    y += height + 6;
  };
  doc.setTextColor(s.invitationAccent);
  photo(s.logo, 20);
  text(s.programName, 12, true);
  text(s.invitationTitle, 22, true);
  doc.setTextColor(40);
  text(guest.name, 18, true);
  text(s.invitationMessage);
  text(quote.title, 17, true);
  text("Fecha: " + date(quote.eventDate));
  if (quote.venue) text("Lugar: " + quote.venue);
  text("Lugares reservados: " + (invitation.seats || 1));
  photo(s.invitationImage, 48);
  if (invitation.notes) text(invitation.notes, 12);
  text(s.invitationFooter, 10);
  if (s.showRfcOnInvitation && s.rfc) text("RFC: " + s.rfc, 9);
  return doc.output("arraybuffer");
}
