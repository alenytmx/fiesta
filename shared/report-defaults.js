/** @file Valores comunes del editor y del generador PDF. No contiene secretos. */
/** @type {Readonly<{fit:string,zoom:number,x:number,y:number}>} Encuadre de una fotografía. */
export const DEFAULT_CROP = Object.freeze({
  fit: "contain",
  zoom: 1,
  x: 50,
  y: 50,
});
/** @type {Readonly<object>} Configuración inicial; se almacena por administrador en MongoDB. */
export const DEFAULT_REPORT = Object.freeze({
  programName: "Fiesta",
  loginSlogan: "Cada evento empieza con una buena idea.",
  menuSlogan: "Cotizaciones y eventos",
  theme: "light",
  primaryColor: "#4436bd",
  titleColor: "#4436bd",
  tableColor: "#4436bd",
  indicatorColor: "#176747",
  rfc: "",
  showRfcOnQuote: false,
  showRfcOnInvitation: false,
  ticketWidth: 80,
  ticketMessage: "Gracias por tu preferencia.",
  invitationTitle: "Estás invitado",
  invitationMessage: "Nos encantará contar con tu presencia.",
  invitationFooter: "Presenta esta invitación al llegar al evento.",
  invitationImage: null,
  invitationAccent: "#4436bd",
  invitationFont: "times",
  invitationFontSize: 14,
  font: "helvetica",
  fontSize: 10,
  accent: "#4436bd",
  logo: null,
  signature: null,
  frameTop: null,
  frameBottom: null,
  facebookIcon: null,
  instagramIcon: null,
  locationIcon: null,
  facebook: "",
  instagram: "",
  location: "",
  logoSide: "right",
  referenceSide: "left",
  referenceWidth: 86,
  referenceHeight: 95,
  referenceY: 55,
  finalX: 18,
  finalY: 55,
  finalWidth: 174,
  finalHeight: 190,
  signatureAlign: "right",
  notes:
    "La cotización es válida por 7 días.\nSe requiere del 50% del costo total para agendar la fecha de tu evento.\nSe requiere la liquidación total del costo de la decoración de manera previa al inicio del montaje.",
  contracting:
    "1. Revisa la propuesta y confirma los detalles del evento.\n2. Para agendar la fecha, registra el anticipo del 50% del total.\n3. Los abonos se registran en el historial de la cotización.\n4. Liquida el costo total antes de iniciar el montaje.\n5. Confirma con anticipación el lugar, horario y acceso para la instalación.",
});
/**
 * Calcula el encuadre usado tanto por el editor visual como por el PDF.
 * @param {number} iw Ancho original de la imagen.
 * @param {number} ih Alto original de la imagen.
 * @param {number} fw Ancho del marco.
 * @param {number} fh Alto del marco.
 * @param {object} [crop] Ajuste de escala y anclaje.
 * @returns {{x:number,y:number,width:number,height:number}} Rectángulo relativo al marco.
 */
export function imageBox(iw, ih, fw, fh, crop = DEFAULT_CROP) {
  const c = { ...DEFAULT_CROP, ...crop };
  const scale =
    (c.fit === "cover"
      ? Math.max(fw / iw, fh / ih)
      : Math.min(fw / iw, fh / ih)) * c.zoom;
  const width = iw * scale,
    height = ih * scale;
  return {
    x: ((fw - width) * c.x) / 100,
    y: ((fh - height) * c.y) / 100,
    width,
    height,
  };
}
