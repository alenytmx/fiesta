/** @file Generador PDF binario. No usa data-URI ni cadenas base64 para el documento. */
import { socialIcon } from "./documents.js";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import {
  DEFAULT_REPORT,
  DEFAULT_CROP,
  imageBox,
} from "../../../shared/report-defaults.js";
/**
 * @param {number} cents Centavos.
 * @returns {string} Importe MXN sin espacios no separables.
 */
const money = (cents) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })
    .format((cents || 0) / 100)
    .replace(/\u00a0/g, " ");
/**
 * @param {string|Date} value Fecha almacenada.
 * @returns {string} Fecha sin convertir días civiles a UTC.
 */
const date = (value) =>
  !value
    ? "—"
    : /^\d{4}-\d{2}-\d{2}$/.test(String(value))
      ? String(value).split("-").reverse().join("/")
      : new Date(value).toLocaleDateString("es-MX", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
/**
 * Genera las cuatro secciones; añade continuaciones si los textos o tablas no caben.
 * @param {object} quote Cotización persistida o borrador para vista previa.
 * @param {object} settings Configuración validada del propietario.
 * @param {Map<string,Uint8Array>} [assets] Imágenes PNG autenticadas; nunca URLs arbitrarias.
 * @returns {ArrayBuffer} Documento PDF listo para un Blob.
 */
export function buildQuotePdf(quote, settings = {}, assets = new Map()) {
  const s = { ...DEFAULT_REPORT, ...settings };
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const fs = s.fontSize,
    step = fs * 0.3528 * 1.4;
  let y = 35;
  const color = s.titleColor;
  doc.setFont(s.font);
  doc.setFontSize(fs);
  doc.setTextColor(35, 42, 55);
  /** Inserta una fotografía recortada con el mismo cálculo del editor. */
  function photo(id, x, y, w, h, crop = DEFAULT_CROP, label = "") {
    const bytes = assets.get(id);
    if (!bytes) {
      if (label) {
        doc.setFillColor(245, 246, 249);
        doc.rect(x, y, w, h, "F");
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(label, x + w / 2, y + h / 2, { align: "center" });
        doc.setTextColor(35, 42, 55);
        doc.setFontSize(fs);
      }
      return;
    }
    const meta = doc.getImageProperties(bytes);
    const r = imageBox(meta.width, meta.height, w, h, crop);
    doc.saveGraphicsState();
    doc.rect(x, y, w, h, null).clip().discardPath();
    doc.addImage(bytes, "PNG", x + r.x, y + r.y, r.width, r.height, id, "FAST");
    doc.restoreGraphicsState();
  }
  /** Empieza una página de contenido preservando márgenes de marcos y pie. */
  function page(title) {
    doc.addPage();
    y = 35;
    heading(title);
  }
  /** Dibuja un encabezado que no colisiona con el marco superior. */
  function heading(title) {
    doc.setFont(s.font, "bold");
    doc.setFontSize(18);
    doc.setTextColor(color);
    doc.text(title, 18, y);
    doc.setTextColor(35, 42, 55);
    doc.setFont(s.font, "normal");
    doc.setFontSize(fs);
    y += 12;
  }
  /** Desborda contenido a una continuación en lugar de recortarlo. */
  function ensure(height) {
    if (y + height > 254) {
      doc.addPage();
      y = 35;
    }
  }
  /** Escribe un párrafo ajustado, con saltos de página cuando sea necesario. */
  function paragraph(text, width = 174, x = 18) {
    for (const line of doc.splitTextToSize(String(text || ""), width)) {
      ensure(step);
      doc.text(line, x, y);
      y += step;
    }
    y += 3;
  }
  /** Imprime etiqueta a la izquierda e importe alineado a la derecha. */
  function amount(label, value, bold = false) {
    ensure(step + 3);
    doc.setFont(s.font, bold ? "bold" : "normal");
    doc.text(label, 18, y);
    doc.text(money(value), 192, y, { align: "right" });
    doc.setFont(s.font, "normal");
    y += step + 3;
  }
  const headerX = s.logoSide === "right" ? 18 : 100;
  doc.setFontSize(20);
  doc.setFont(s.font, "bold");
  doc.setTextColor(color);
  doc.text("COTIZACION", headerX, 34);
  doc.setFontSize(9);
  doc.text(s.programName, 18, 24);
  if (s.showRfcOnQuote && s.rfc)
    doc.text("RFC: " + s.rfc, 192, 24, { align: "right" });
  doc.setTextColor(35, 42, 55);
  doc.setFontSize(fs);
  doc.setFont(s.font, "normal");
  const numberLines = doc.splitTextToSize(
    "No. " + (quote.number || "BORRADOR"),
    92,
  );
  doc.text(numberLines, headerX, 43);
  const currentDateY = 43 + numberLines.length * step + 1;
  doc.text(
    "Fecha actual: " + date(quote.createdAt || new Date()),
    headerX,
    currentDateY,
  );
  const clientY = currentDateY + step + 1;
  const clientLines = doc.splitTextToSize(
    "Cliente: " + (quote.clientName || "Sin cliente"),
    92,
  );
  doc.text(clientLines, headerX, clientY);
  const logoX = s.logoSide === "right" ? 145 : 18;
  photo(s.logo, logoX, 28, 45, 24);
  doc.setFontSize(9);
  doc.text("Fecha del evento: " + date(quote.eventDate), logoX, 61);
  doc.setFontSize(fs);
  y = Math.max(75, clientY + clientLines.length * step + 5);
  autoTable(doc, {
    startY: y,
    head: [["Descripción", "Cantidad", "Precio unitario", "Total"]],
    body: (quote.items || []).map((i) => [
      i.description,
      i.quantity,
      money(Math.round(i.unitPrice * 100)),
      money(i.totalCents ?? Math.round(i.unitPrice * 100) * i.quantity),
    ]),
    margin: { left: 18, right: 18, top: 30, bottom: 44 },
    styles: {
      font: s.font,
      fontSize: fs,
      cellPadding: 3,
      lineColor: [225, 225, 232],
    },
    headStyles: { fillColor: s.tableColor, textColor: 255 },
    columnStyles: {
      0: { cellWidth: 88 },
      1: { cellWidth: 22, halign: "right" },
      2: { cellWidth: 32, halign: "right" },
      3: { cellWidth: 32, halign: "right" },
    },
    theme: "striped",
  });
  y = doc.lastAutoTable.finalY + 10;
  const subtotal =
    quote.subtotalCents ??
    (quote.items || []).reduce(
      (sum, i) => sum + Math.round(i.unitPrice * 100) * i.quantity,
      0,
    );
  const discount =
    quote.discountCents ??
    Math.round((subtotal * (quote.discountPercent || 0)) / 100);
  const total = quote.totalCents ?? subtotal - discount;
  amount("SUBTOTAL", subtotal);
  amount("DESCUENTO " + (quote.discountPercent || 0) + "%", discount);
  if (quote.discountReason)
    paragraph("Razón del descuento: " + quote.discountReason);
  amount("TOTAL", total, true);
  const payments = [...(quote.payments || [])]
    .filter((p) => !p.voided)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const [index, payment] of payments.entries())
    amount(
      (index === 0 ? "AGENDADO " : "ABONADO ") + date(payment.date),
      payment.amountCents,
    );
  amount(
    "PENDIENTE DE LIQUIDAR",
    total - payments.reduce((sum, p) => sum + p.amountCents, 0),
    true,
  );
  ensure(15);
  y += 2;
  doc.setFont(s.font, "bold");
  doc.text("Notas:", 18, y);
  doc.setFont(s.font, "normal");
  y += step;
  paragraph(s.notes);
  if (quote.notes) paragraph(quote.notes);
  if (s.signature) {
    ensure(36);
    const x = { left: 18, center: 80, right: 142 }[s.signatureAlign];
    photo(s.signature, x, y, 50, 23);
    doc.setDrawColor(150);
    doc.line(x, y + 25, x + 50, y + 25);
    doc.setFontSize(9);
    doc.text("Firma", x + 25, y + 30, { align: "center" });
    doc.setFontSize(fs);
    y += 35;
  }
  page("Propuesta de decoración");
  const x = s.referenceSide === "left" ? 18 : 192 - s.referenceWidth;
  const textX = s.referenceSide === "left" ? x + s.referenceWidth + 10 : 18;
  const textW = 174 - s.referenceWidth - 10;
  photo(
    quote.referenceImage,
    x,
    s.referenceY,
    s.referenceWidth,
    s.referenceHeight,
    quote.referenceCrop,
    "Sin imagen de referencia",
  );
  doc.setFont(s.font, "bold");
  const title = doc.splitTextToSize(
    "Descripción de elementos de la decoración:",
    textW,
  );
  doc.text(title, textX, s.referenceY + 4);
  doc.setFont(s.font, "normal");
  const description = doc.splitTextToSize(
    quote.decorationElements || "Sin descripción.",
    textW,
  );
  const textTop = s.referenceY + 4 + title.length * step + 3;
  const count = Math.max(1, Math.floor((190 - textTop) / step));
  doc.text(description.slice(0, count), textX, textTop);
  for (let i = 0; i < 3; i++) {
    const px = 18 + i * 60;
    photo(
      quote.materialImages?.[i],
      px,
      207,
      54,
      35,
      quote.materialCrops?.[i],
      `Material ${i + 1}`,
    );
    doc.setFontSize(Math.min(fs, 10));
    const lines = doc.splitTextToSize(
      quote.materialTitles?.[i] || `Material ${i + 1}`,
      54,
    );
    doc.text(lines, px + 27, 248, { align: "center", maxWidth: 54 });
    doc.setFontSize(fs);
  }
  if (description.length > count) {
    page("Elementos de la decoración (continuación)");
    paragraph(description.slice(count).join("\n"));
  }
  page("Resultado final");
  photo(
    quote.finalImage,
    s.finalX,
    s.finalY,
    s.finalWidth,
    s.finalHeight,
    quote.finalCrop,
    "Resultado final pendiente",
  );
  page("Dinámica de contratación");
  paragraph(s.contracting);
  const totalPages = doc.getNumberOfPages();
  // Marcos y pie se dibujan solo en zonas reservadas, fuera del flujo de tablas/textos.
  for (let n = 1; n <= totalPages; n++) {
    doc.setPage(n);
    photo(quote.customFrames ? quote.frameTop : s.frameTop, 0, 0, 210, 20, {
      ...DEFAULT_CROP,
      fit: "cover",
    });
    photo(
      quote.customFrames ? quote.frameBottom : s.frameBottom,
      0,
      277,
      210,
      20,
      { ...DEFAULT_CROP, fit: "cover" },
    );
    doc.setFont(s.font);
    doc.setFontSize(8);
    doc.setTextColor(75);
    for (const [i, key] of ["facebook", "instagram", "location"].entries()) {
      const yy = 258 + i * 5.5;
      if (s[key]) socialIcon(doc, key, 18, yy - 3);
      doc.setFont(s.font, "normal");
      doc.setFontSize(7.5);
      const lines = doc.splitTextToSize(s[key] || "", 164);
      doc.text(lines, 24, yy);
    }
    doc.setFontSize(8);
    doc.text(`${n} / ${totalPages}`, 192, 274, { align: "right" });
  }
  return doc.output("arraybuffer");
}
/**
 * Carga solo las imágenes usadas en el PDF y en formato PNG, conservando autorización.
 * @param {object} quote Cotización.
 * @param {object} settings Diseño efectivo.
 * @param {Function} request Cliente HTTP autenticado.
 * @returns {Promise<Map<string,Uint8Array>>} Recursos binarios disponibles.
 */
export async function loadReportAssets(quote, settings, request) {
  const keys = ["logo", "signature", "invitationImage"];
  const ids = [
    ...new Set(
      [
        ...keys.map((k) => settings[k]),
        quote.customFrames ? quote.frameTop : settings.frameTop,
        quote.customFrames ? quote.frameBottom : settings.frameBottom,
        quote.referenceImage,
        quote.finalImage,
        ...(quote.materialImages || []).slice(0, 3),
      ].filter(Boolean),
    ),
  ];
  const result = new Map();
  // Secuencial para no mantener varias conversiones PNG pesadas simultáneamente.
  for (const id of ids)
    result.set(
      id,
      new Uint8Array(
        await request("/images/" + id + "?format=png", { arrayBuffer: true }),
      ),
    );
  return result;
}
