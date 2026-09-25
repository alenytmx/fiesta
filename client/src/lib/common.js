/** @file Etiquetas, formato monetario y valores iniciales de formularios. */
import { DEFAULT_CROP } from "../../../shared/report-defaults.js";
/** @type {Object<string,string>} Nombres visibles de los módulos CRUD. */
export const modules = {
  clients: "Clientes",
  quotes: "Cotizaciones",
  guests: "Invitados",
  invitations: "Invitaciones",
};
/** @type {Object<string,string>} Etiquetas singulares usadas en acciones. */
export const single = {
  clients: "cliente",
  quotes: "cotización",
  guests: "invitado",
  invitations: "invitación",
};
/**
 * @param {number} cents Centavos de MXN.
 * @returns {string} Importe legible en la interfaz.
 */
export const money = (cents) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    (cents || 0) / 100,
  );
/**
 * @param {string} type Tipo de entidad.
 * @returns {object} Estado inicial nuevo, sin compartir arreglos mutables.
 */
export const fresh = (type) =>
  ({
    clients: {
      firstNames: "",
      paternalSurname: "",
      maternalSurname: "",
      phone: "",
      notes: "",
    },
    quotes: {
      client: "",
      title: "",
      eventDate: "",
      venue: "",
      notes: "",
      discountPercent: 0,
      discountReason: "",
      decorationElements: "",
      referenceImage: null,
      materialImages: [],
      materialTitles: [],
      referenceCrop: { ...DEFAULT_CROP },
      materialCrops: [],
      finalImage: null,
      finalCrop: { ...DEFAULT_CROP },
      customFrames: false,
      frameTop: null,
      frameBottom: null,
      items: [{ description: "", quantity: 1, unitPrice: 0 }],
    },
    guests: { client: "", name: "", phone: "", notes: "" },
    invitations: {
      quote: "",
      guest: "",
      status: "Pendiente",
      seats: 1,
      notes: "",
    },
  })[type];
