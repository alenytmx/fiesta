/** @file Contratos estrictos de entrada y aritmética monetaria del servidor. */
import { z } from "zod";
export { paid } from "../shared/finance.js";
const text = z.string().trim().max(200);
const name = text.min(1, "Campo obligatorio");
const notes = z.string().trim().max(3000).default("");
const email = z
  .union([z.literal(""), z.string().trim().email().max(254)])
  .default("");
const phone = z.string().trim().max(40).default("");
const id = z.string().regex(/^[a-f\d]{24}$/i, "Identificador inválido");
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v);
    return !isNaN(d) && d.toISOString().slice(0, 10) === v;
  }, "Fecha inválida");
const money = z
  .number()
  .min(0)
  .max(10000000)
  .refine(
    (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001,
    "Máximo dos decimales",
  );
/** Esquema de encuadre; impide valores que salgan de los límites del editor. */
export const cropSchema = z
  .object({
    fit: z.enum(["contain", "cover"]).default("contain"),
    zoom: z.number().min(1).max(3).default(1),
    x: z.number().min(0).max(100).default(50),
    y: z.number().min(0).max(100).default(50),
  })
  .strict();
/** Contrato de configuración persistente del PDF, compartido por todos los reportes del propietario. */
export const reportSettingsSchema = z
  .object({
    programName: z.string().trim().min(1).max(60),
    loginSlogan: z.string().trim().max(180),
    menuSlogan: z.string().trim().max(80),
    theme: z.enum(["light", "dark", "system"]),
    ...Object.fromEntries(
      [
        "primaryColor",
        "titleColor",
        "tableColor",
        "indicatorColor",
        "invitationAccent",
      ].map((k) => [k, z.string().regex(/^#[a-f0-9]{6}$/i)]),
    ),
    rfc: z
      .string()
      .trim()
      .toUpperCase()
      .max(13)
      .refine(
        (v) => !v || /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(v),
        "RFC inválido",
      ),
    showRfcOnQuote: z.boolean(),
    showRfcOnInvitation: z.boolean(),
    ticketWidth: z.union([z.literal(58), z.literal(80)]),
    ticketMessage: z.string().trim().max(300),
    invitationTitle: z.string().trim().min(1).max(100),
    invitationMessage: z.string().trim().max(1200),
    invitationFooter: z.string().trim().max(500),
    invitationImage: id.nullable(),
    invitationFont: z.enum(["helvetica", "times", "courier"]),
    invitationFontSize: z.number().min(10).max(20),
    font: z.enum(["helvetica", "times", "courier"]),
    fontSize: z.number().min(8).max(14),
    accent: z.string().regex(/^#[a-f0-9]{6}$/i),
    ...Object.fromEntries(
      [
        "logo",
        "signature",
        "frameTop",
        "frameBottom",
        "facebookIcon",
        "instagramIcon",
        "locationIcon",
      ].map((k) => [k, id.nullable()]),
    ),
    facebook: z.string().trim().max(100),
    instagram: z.string().trim().max(100),
    location: z.string().trim().max(160),
    logoSide: z.enum(["left", "right"]),
    referenceSide: z.enum(["left", "right"]),
    referenceWidth: z.number().min(60).max(95),
    referenceHeight: z.number().min(50).max(110),
    referenceY: z.number().min(48).max(75),
    finalX: z.number().min(18).max(130),
    finalY: z.number().min(48).max(180),
    finalWidth: z.number().min(40).max(174),
    finalHeight: z.number().min(40).max(207),
    signatureAlign: z.enum(["left", "center", "right"]),
    notes: z.string().trim().max(3000),
    contracting: z.string().trim().max(12000),
  })
  .strict()
  .refine(
    (v) => v.finalX + v.finalWidth <= 192 && v.finalY + v.finalHeight <= 255,
    {
      message: "La imagen final debe quedar dentro del área imprimible",
      path: ["finalWidth"],
    },
  );
/** Esquemas CRUD; excluyen propietario, folio, fechas automáticas e importes calculados. */
export const schemas = {
  clients: z
    .object({
      firstNames: name,
      paternalSurname: text.default(""),
      maternalSurname: text.default(""),
      phone,
      notes,
    })
    .strict(),
  guests: z.object({ client: id, name, phone, notes }).strict(),
  quotes: z
    .object({
      client: id,
      title: name,
      eventDate: date,
      venue: text.default(""),

      notes,
      items: z
        .array(
          z
            .object({
              description: name,
              quantity: z.number().int().min(1).max(100000),
              unitPrice: money,
            })
            .strict(),
        )
        .min(1)
        .max(100),
      discountPercent: z
        .number()
        .min(0)
        .max(100)
        .refine(
          (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001,
          "Máximo dos decimales",
        )
        .default(0),
      discountReason: z.string().trim().max(500).default(""),
      decorationElements: z.string().trim().max(5000).default(""),
      referenceImage: id.nullable().default(null),
      materialImages: z.array(id).max(12).default([]),
      materialTitles: z.array(z.string().trim().max(100)).max(12).default([]),
      referenceCrop: cropSchema.default({}),
      materialCrops: z.array(cropSchema).max(12).default([]),
      finalImage: id.nullable().default(null),
      finalCrop: cropSchema.default({}),
      customFrames: z.boolean().default(false),
      frameTop: id.nullable().default(null),
      frameBottom: id.nullable().default(null),
      version: z.number().int().min(0).optional(),
    })
    .strict()
    .refine((v) => quoteTotal(v.items) <= 10000000000, {
      message: "El subtotal no puede exceder 100 millones de MXN",
      path: ["items"],
    })
    .refine((v) => v.discountPercent === 0 || v.discountReason.length > 0, {
      message: "Indica la razón del descuento",
      path: ["discountReason"],
    }),
  invitations: z
    .object({
      quote: id,
      guest: id,
      status: z.enum(["Pendiente", "Enviada", "Confirmada", "Declinada"]),
      seats: z.number().int().min(1).max(100),
      notes,
    })
    .strict(),
};
/** Datos de acceso; respeta el límite de bytes admitido por bcrypt. */
export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z
      .string()
      .min(1)
      .max(128)
      .refine(
        (v) => Buffer.byteLength(v, "utf8") <= 72,
        "Máximo 72 bytes en la contraseña",
      ),
  })
  .strict();
/** Alta inicial con contraseña robusta y secreto de instalación. */
export const setupSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z
      .string()
      .min(12)
      .max(128)
      .refine(
        (v) => Buffer.byteLength(v, "utf8") <= 72,
        "Máximo 72 bytes en la contraseña",
      ),
    setupToken: z.string().min(32).max(256),
  })
  .strict();
/** Pago positivo con UUID para evitar duplicación de reintentos. */
export const paymentSchema = z
  .object({
    requestId: z.string().uuid(),
    kind: z.enum(["Anticipo", "Abono"]),
    amount: money.refine((v) => v > 0, "El monto debe ser mayor que cero"),
    method: z.enum(["Efectivo", "Transferencia", "Tarjeta", "Mixto"]),
    parts: z
      .array(
        z
          .object({
            method: z.enum(["Efectivo", "Transferencia", "Tarjeta"]),
            amount: money.refine(
              (v) => v > 0,
              "El importe debe ser mayor que cero",
            ),
          })
          .strict(),
      )
      .min(1)
      .max(3)
      .optional(),
    note: z.string().trim().max(500).default(""),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!v.parts && v.method === "Mixto")
      ctx.addIssue({
        code: "custom",
        message: "Desglosa el pago mixto",
        path: ["parts"],
      });
    if (
      v.parts &&
      (new Set(v.parts.map((p) => p.method)).size !== v.parts.length ||
        v.parts.reduce((s, p) => s + Math.round(p.amount * 100), 0) !==
          Math.round(v.amount * 100))
    )
      ctx.addIssue({
        code: "custom",
        message:
          "El desglose no coincide con el total o repite una forma de pago",
        path: ["parts"],
      });
  });
/** Anulación auditable: requiere motivo y versión actual para impedir sobrescrituras. */
export const voidPaymentSchema = z
  .object({
    reason: z.string().trim().min(3).max(500),
    version: z.number().int().min(0),
  })
  .strict();
/** Cambios de autorización permitidos desde la tabla; Pagado se deriva de movimientos reales. */
export const quoteStatusSchema = z
  .object({
    status: z.enum(["Esperando autorización", "Aceptada", "Cancelada"]),
    version: z.number().int().min(0),
  })
  .strict();
/** Carga de imagen acotada antes de decodificar su contenido. */
export const imageSchema = z
  .object({ name: z.string().max(200), base64: z.string().min(1).max(7100000) })
  .strict();
/** Identificador MongoDB validado antes de construir consultas. */
export const objectId = id;
/**
 * @param {Array<object>} items Materiales.
 * @returns {number} Subtotal entero en centavos.
 */
export function quoteTotal(items) {
  return items.reduce(
    (sum, item) => sum + Math.round(item.unitPrice * 100) * item.quantity,
    0,
  );
}
/**
 * @param {Array<object>} items Materiales.
 * @param {number} [discountPercent=0] Descuento porcentual.
 * @returns {{subtotalCents:number,discountCents:number,totalCents:number}} Importes redondeados al centavo.
 */
export function quoteAmounts(items, discountPercent = 0) {
  const subtotalCents = quoteTotal(items);
  const discountCents = Math.round(
    (subtotalCents * Math.round(discountPercent * 100)) / 10000,
  );
  return {
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
  };
}
/**
 * @param {object} quote Cotización.
 * @returns {number} Suma de movimientos persistidos en centavos.
 */
