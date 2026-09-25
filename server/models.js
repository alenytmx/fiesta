/** @file Modelos MongoDB e índices: propiedad, unicidad, sesiones, cotizaciones y configuración. */
import mongoose from "mongoose";
const { Schema } = mongoose;
const opts = { timestamps: true, versionKey: false };
/**
 * @param {string} model Modelo destino.
 * @returns {object} Referencia requerida e indexada.
 */
const ref = (model) => ({
  type: Schema.Types.ObjectId,
  ref: model,
  required: true,
  index: true,
});
/** Cuenta privada; almacena hash de contraseña, nunca la contraseña original. */
export const User = mongoose.model(
  "User",
  new Schema(
    {
      email: { type: String, unique: true, required: true },
      passwordHash: { type: String, required: true },
    },
    opts,
  ),
);
/** Sesión aleatoria cuyo hash y vencimiento permiten revocación y limpieza TTL. */
export const Session = mongoose.model(
  "Session",
  new Schema(
    {
      tokenHash: { type: String, unique: true },
      user: ref("User"),
      expiresAt: { type: Date, index: { expires: 0 } },
    },
    opts,
  ),
);
const base = { owner: ref("User"), active: { type: Boolean, default: true } };
/** Cliente o socio titular de cotizaciones e invitados. */
export const Client = mongoose.model(
  "Client",
  new Schema(
    {
      ...base,
      name: String,
      firstNames: String,
      paternalSurname: String,
      maternalSurname: String,
      phone: String,
      notes: String,
    },
    opts,
  ),
);
/** Movimiento financiero inmutable desde la interfaz, con clave de reintento y fecha del servidor. */
const paymentSchema = new Schema(
  {
    requestId: { type: String, required: true },
    kind: { type: String, enum: ["Anticipo", "Abono"] },
    amountCents: Number,
    method: String,
    parts: [{ method: String, amountCents: Number, _id: false }],
    voided: { type: Boolean, default: false },
    voidedAt: Date,
    voidReason: String,
    note: String,
    date: { type: Date, default: Date.now },
  },
  { _id: true },
);
/** Parámetros de recorte compartidos por referencia, fotos de materiales y resultado final. */
const cropDefinition = {
  fit: { type: String, default: "contain" },
  zoom: { type: Number, default: 1 },
  x: { type: Number, default: 50 },
  y: { type: Number, default: 50 },
};
/** Documento con versión para impedir sobrescritura de pagos/ediciones concurrentes. */
const quoteSchema = new Schema(
  {
    ...base,
    number: String,
    client: ref("Client"),
    clientName: String,
    title: String,
    eventDate: String,
    venue: String,
    status: String,
    approved: { type: Boolean, default: false },
    notes: String,
    items: [
      {
        description: String,
        quantity: Number,
        unitPrice: Number,
        totalCents: Number,
        _id: false,
      },
    ],
    subtotalCents: Number,
    discountPercent: { type: Number, default: 0 },
    discountReason: String,
    discountCents: { type: Number, default: 0 },
    totalCents: Number,
    decorationElements: String,
    referenceImage: {
      type: Schema.Types.ObjectId,
      ref: "Image",
      default: null,
    },
    materialImages: [{ type: Schema.Types.ObjectId, ref: "Image" }],
    materialTitles: [String],
    referenceCrop: cropDefinition,
    materialCrops: [new Schema(cropDefinition, { _id: false })],
    finalImage: { type: Schema.Types.ObjectId, ref: "Image", default: null },
    finalCrop: cropDefinition,
    customFrames: { type: Boolean, default: false },
    frameTop: { type: Schema.Types.ObjectId, ref: "Image", default: null },
    frameBottom: { type: Schema.Types.ObjectId, ref: "Image", default: null },
    payments: { type: [paymentSchema], default: [] },
  },
  { timestamps: true, optimisticConcurrency: true },
);
quoteSchema.index(
  { owner: 1, number: 1 },
  { unique: true, partialFilterExpression: { number: { $type: "string" } } },
);
/** Cotización con importes, encuadres, pagos y control optimista de concurrencia. */
export const Quote = mongoose.model("Quote", quoteSchema);
/** Invitado asociado a un cliente del mismo propietario. */
export const Guest = mongoose.model(
  "Guest",
  new Schema(
    {
      ...base,
      client: ref("Client"),
      name: String,

      phone: String,
      notes: String,
    },
    opts,
  ),
);
const invitationSchema = new Schema(
  {
    ...base,
    quote: ref("Quote"),
    guest: ref("Guest"),
    status: String,
    seats: Number,
    notes: String,
  },
  opts,
);
invitationSchema.index(
  { owner: 1, quote: 1, guest: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
/** Vínculo único activo entre invitado y cotización. */
export const Invitation = mongoose.model("Invitation", invitationSchema);
/** Imagen privada normalizada; el binario se excluye de consultas ordinarias. */
export const Image = mongoose.model(
  "Image",
  new Schema(
    {
      owner: ref("User"),
      data: { type: Buffer, select: false },
      mime: String,
      name: String,
      size: Number,
    },
    opts,
  ),
);
/** Secuencia de folios por propietario; admite saltos sin reutilizar números. */
export const Counter = mongoose.model(
  "Counter",
  new Schema({ _id: String, value: { type: Number, default: 0 } }),
);
/** Registro de entidades que comparten operaciones CRUD. */
export const models = {
  clients: Client,
  quotes: Quote,
  guests: Guest,
  invitations: Invitation,
};

/** Configuración por propietario; el contrato estricto se valida antes de guardar. */
export const Settings = mongoose.model(
  "Settings",
  new Schema(
    {
      owner: { ...ref("User"), unique: true },
      report: { type: Schema.Types.Mixed, required: true },
    },
    opts,
  ),
);

/** Identidad pública del login. Únicamente nombre, eslóganes, colores y logo; nunca RFC ni firma. */
export const Branding = mongoose.model(
  "Branding",
  new Schema(
    { _id: String, owner: ref("User"), data: Schema.Types.Mixed },
    opts,
  ),
);
