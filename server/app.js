/**
 * @file API Express: autenticación, permisos de propietario, CRUD, pagos, imágenes y diseño PDF.
 * @description Todas las rutas privadas pasan por la comprobación de sesión antes de acceder a datos.
 */
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import {
  User,
  Session,
  models,
  Client,
  Guest,
  Quote,
  Invitation,
  Image,
  Counter,
  Settings,
  Branding,
} from "./models.js";
import {
  schemas,
  loginSchema,
  objectId,
  quoteAmounts,
  paid,
  setupSchema,
  paymentSchema,
  imageSchema,
  reportSettingsSchema,
  voidPaymentSchema,
  quoteStatusSchema,
} from "./validation.js";
import { quoteStatus, fullName } from "../shared/finance.js";
import { DEFAULT_REPORT } from "../shared/report-defaults.js";
/**
 * @param {string} v Token secreto.
 * @returns {string} SHA-256 usado en persistencia/comparación.
 */
const hash = (v) => createHash("sha256").update(v).digest("hex");
/**
 * @param {number} status Estado HTTP.
 * @param {string} message Mensaje público.
 * @returns {Error} Error controlado.
 */
const fail = (status, message) => Object.assign(new Error(message), { status });
/**
 * Construye la API sin abrir puertos, para permitir pruebas HTTP aisladas.
 * @param {{setupToken?:string}} [options] Secreto temporal del primer registro.
 * @returns {import('express').Express} Aplicación configurada.
 */
export function createApp({
  setupToken,
  publish = () => {},
  disconnectSession = () => {},
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  const origin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          imgSrc: ["'self'", "data:", "blob:"],
          frameSrc: ["'self'", "blob:"],
        },
      },
    }),
  );
  app.use(
    cors({
      origin,
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use("/api/images", express.json({ limit: "8mb" }));
  app.use(express.json({ limit: "150kb" }));
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { message: "Demasiadas solicitudes. Intenta en un minuto." },
    }),
  );
  /** Indica que el servidor está operativo; no expone configuración ni datos.
   * @param {import('express').Request} req Petición HTTP.
   * @param {import('express').Response} res Respuesta JSON o binaria.
   * @returns {Promise<void>|void} Respuesta o error manejado por Express.
   */
  app.use("/api", (req, res, next) => {
    const resource = req.path.split("/")[1];
    res.on("finish", () => {
      if (
        req.owner &&
        ["POST", "PUT", "DELETE"].includes(req.method) &&
        res.statusCode < 300
      ) {
        if (
          ["clients", "quotes", "guests", "invitations", "settings"].includes(
            resource,
          )
        )
          publish(String(req.owner), resource);
      }
    });
    next();
  });
  /** Identidad pública mínima necesaria para personalizar el acceso antes de autenticarse. */
  app.get("/api/branding", async (_req, res) => {
    const doc = await Branding.findById("public").lean();
    const {
      programName,
      loginSlogan,
      menuSlogan,
      theme,
      primaryColor,
      titleColor,
      tableColor,
      indicatorColor,
    } = DEFAULT_REPORT;
    res
      .set("Cache-Control", "no-store")
      .json(
        doc?.data || {
          programName,
          loginSlogan,
          menuSlogan,
          theme,
          primaryColor,
          titleColor,
          tableColor,
          indicatorColor,
          hasLogo: false,
        },
      );
  });
  /** Solo se publica el logo expresamente elegido para el login, no otros recursos del usuario. */
  app.get("/api/branding/logo", async (_req, res) => {
    const brand = await Branding.findById("public").lean();
    if (!brand?.data?.logo) throw fail(404, "Logo no configurado.");
    const image = await Image.findOne({
      _id: brand.data.logo,
      owner: brand.owner,
    }).select("+data");
    if (!image) throw fail(404, "Logo no disponible.");
    res.type(image.mime).set("Cache-Control", "no-store").send(image.data);
  });
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  /** Indica si falta la cuenta inicial, sin revelar correos registrados.
   * @param {import('express').Request} req Petición HTTP.
   * @param {import('express').Response} res Respuesta JSON o binaria.
   * @returns {Promise<void>|void} Respuesta o error manejado por Express.
   */
  app.get("/api/setup/status", async (_req, res) =>
    res
      .set("Cache-Control", "no-store")
      .json({ required: !(await User.exists({})) }),
  );
  /** Crea una sola cuenta inicial usando un secreto de instalación y una clave única atómica.
   * @param {import('express').Request} req Petición HTTP.
   * @param {import('express').Response} res Respuesta JSON o binaria.
   * @returns {Promise<void>|void} Respuesta o error manejado por Express.
   */
  app.post(
    "/api/setup",
    rateLimit({
      windowMs: 15 * 60000,
      limit: 10,
      message: {
        message: "Demasiados intentos de configuración. Espera 15 minutos.",
      },
    }),
    async (req, res) => {
      if (await User.exists({}))
        throw fail(409, "El administrador ya fue creado. Inicia sesión.");
      const data = setupSchema.parse(req.body);
      if (
        !setupToken ||
        !timingSafeEqual(
          Buffer.from(hash(data.setupToken)),
          Buffer.from(hash(setupToken)),
        )
      )
        throw fail(
          403,
          "Clave de instalación inválida. Abre el programa desde INICIAR-FIESTA.bat.",
        );
      const passwordHash = await bcrypt.hash(data.password, 12);
      // Un _id fijo hace que dos altas simultáneas no puedan crear dos administradores.
      try {
        await User.create({
          _id: "000000000000000000000001",
          email: data.email,
          passwordHash,
        });
      } catch (e) {
        if (e.code === 11000)
          throw fail(409, "El administrador ya fue creado. Inicia sesión.");
        throw e;
      }
      res
        .status(201)
        .json({ message: "Administrador creado. Ya puedes iniciar sesión." });
    },
  );
  /** Verifica la contraseña y emite una sesión aleatoria de ocho horas; limita intentos fallidos.
   * @param {import('express').Request} req Petición HTTP.
   * @param {import('express').Response} res Respuesta JSON o binaria.
   * @returns {Promise<void>|void} Respuesta o error manejado por Express.
   */
  app.post(
    "/api/auth/login",
    rateLimit({
      windowMs: 15 * 60000,
      limit: 15,
      skipSuccessfulRequests: true,
      message: { message: "Demasiados intentos. Espera 15 minutos." },
    }),
    async (req, res) => {
      const { email, password } = loginSchema.parse(req.body);
      const user = await User.findOne({ email });
      // Hash fijo de relleno: mantiene el trabajo de bcrypt también cuando el usuario no existe.
      const valid = await bcrypt.compare(
        password,
        user?.passwordHash ||
          "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW",
      );
      if (!user || !valid) throw fail(401, "Correo o contraseña incorrectos.");
      const token = randomBytes(32).toString("hex");
      await Session.create({
        tokenHash: hash(token),
        user: user._id,
        expiresAt: new Date(Date.now() + 8 * 3600000),
      });
      res.set("Cache-Control", "no-store").json({ token, email: user.email });
    },
  );
  /** Exige una sesión vigente y adjunta propietario/sesión antes de cualquier ruta privada.
   * @param {import('express').Request} req Petición HTTP.
   * @param {import('express').Response} res Respuesta JSON o binaria.
   * @returns {Promise<void>|void} Respuesta o error manejado por Express.
   */
  app.use("/api", async (req, res, next) => {
    const token = req.headers.authorization?.match(
      /^Bearer ([a-f0-9]{64})$/,
    )?.[1];
    if (!token) throw fail(401, "Inicia sesión para continuar.");
    const session = await Session.findOne({
      tokenHash: hash(token),
      expiresAt: { $gt: new Date() },
    });
    if (!session)
      throw fail(401, "Tu sesión terminó. Inicia sesión nuevamente.");
    req.owner = session.user;
    req.session = session;
    res.set("Cache-Control", "no-store");
    next();
  });
  /** Revoca la sesión persistida; el token deja de autorizar solicitudes.
   * @param {import('express').Request} req Petición HTTP.
   * @param {import('express').Response} res Respuesta JSON o binaria.
   * @returns {Promise<void>|void} Respuesta o error manejado por Express.
   */
  app.post("/api/auth/logout", async (req, res) => {
    await Session.deleteOne({ _id: req.session._id });
    disconnectSession(String(req.session._id));
    res.status(204).end();
  });
  /** Devuelve únicamente el correo de la cuenta autenticada.
   * @param {import('express').Request} req Petición HTTP.
   * @param {import('express').Response} res Respuesta JSON o binaria.
   * @returns {Promise<void>|void} Respuesta o error manejado por Express.
   */
  app.get("/api/auth/me", async (req, res) => {
    const user = await User.findById(req.owner);
    if (!user) throw fail(401, "Sesión inválida");
    res.json({ email: user.email });
  });

  /** Valida firma del archivo, decodifica, limita píxeles y guarda WebP sin metadatos.
   * @param {import('express').Request} req Petición HTTP.
   * @param {import('express').Response} res Respuesta JSON o binaria.
   * @returns {Promise<void>|void} Respuesta o error manejado por Express.
   */
  app.post(
    "/api/images",
    rateLimit({
      windowMs: 60000,
      limit: 20,
      message: { message: "Espera un minuto antes de subir más imágenes." },
    }),
    async (req, res) => {
      const { name, base64 } = imageSchema.parse(req.body);
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))
        throw fail(400, "Imagen inválida.");
      const raw = Buffer.from(base64, "base64");
      if (raw.length > 5 * 1024 * 1024)
        throw fail(400, "Cada imagen debe pesar como máximo 5 MB.");
      const jpeg = raw[0] === 255 && raw[1] === 216 && raw[2] === 255;
      const png = raw
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const webp =
        raw.subarray(0, 4).toString() === "RIFF" &&
        raw.subarray(8, 12).toString() === "WEBP";
      if (!jpeg && !png && !webp)
        throw fail(400, "Solo se permiten imágenes JPEG, PNG o WebP.");
      let buffer;
      try {
        buffer = await sharp(raw, { limitInputPixels: 20000000 })
          .rotate()
          .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 82 })
          .toBuffer();
      } catch {
        throw fail(
          400,
          "Imagen dañada o demasiado grande (máximo 20 megapíxeles).",
        );
      }
      const image = await Image.create({
        owner: req.owner,
        name,
        data: buffer,
        mime: "image/webp",
        size: buffer.length,
      });
      res
        .status(201)
        .json({ _id: image._id, name: image.name, size: image.size });
    },
  );
  /** Entrega una imagen del propietario; permite PNG binario para la generación del PDF.
   * @param {import('express').Request} req Petición HTTP.
   * @param {import('express').Response} res Respuesta JSON o binaria.
   * @returns {Promise<void>|void} Respuesta o error manejado por Express.
   */
  app.get("/api/images/:id", async (req, res) => {
    const image = await Image.findOne({
      _id: objectId.parse(req.params.id),
      owner: req.owner,
    }).select("+data");
    if (!image) throw fail(404, "Imagen no encontrada.");
    const png = req.query.format === "png";
    res
      .type(png ? "image/png" : image.mime)
      .set("X-Content-Type-Options", "nosniff")
      .send(png ? await sharp(image.data).png().toBuffer() : image.data);
  });
  /** Lee la configuración del propietario o devuelve valores iniciales seguros. */
  app.get("/api/settings", async (req, res) => {
    const doc = await Settings.findOne({ owner: req.owner }).lean();
    res.json({ ...DEFAULT_REPORT, ...doc?.report });
  });
  /** Valida el diseño y la propiedad de todas las imágenes antes de persistir. */
  app.put("/api/settings", async (req, res) => {
    const report = reportSettingsSchema.parse(req.body);
    const ids = [
      ...new Set(
        [
          "logo",
          "signature",
          "frameTop",
          "frameBottom",
          "facebookIcon",
          "instagramIcon",
          "locationIcon",
          "invitationImage",
        ]
          .map((k) => report[k])
          .filter(Boolean),
      ),
    ];
    if (
      (await Image.countDocuments({ _id: { $in: ids }, owner: req.owner })) !==
      ids.length
    )
      throw fail(400, "Alguna imagen de configuración no está disponible.");
    await Settings.findOneAndUpdate(
      { owner: req.owner },
      { $set: { report } },
      { upsert: true, new: true },
    );
    const publicData = Object.fromEntries(
      [
        "programName",
        "loginSlogan",
        "menuSlogan",
        "theme",
        "primaryColor",
        "titleColor",
        "tableColor",
        "indicatorColor",
        "logo",
      ].map((k) => [k, report[k]]),
    );
    publicData.hasLogo = !!report.logo;
    publicData.version = Date.now();
    await Branding.findByIdAndUpdate(
      "public",
      { $set: { owner: req.owner, data: publicData } },
      { upsert: true },
    );
    res.json(report);
  });
  /** Obtiene cotizaciones e historial del cliente y calcula sus saldos en centavos.
   * @param {import('express').Request} req Petición HTTP.
   * @param {import('express').Response} res Respuesta JSON o binaria.
   * @returns {Promise<void>|void} Respuesta o error manejado por Express.
   */
  app.get("/api/clients/:id/account", async (req, res) => {
    const id = objectId.parse(req.params.id);
    if (!(await Client.exists({ _id: id, owner: req.owner, active: true })))
      throw fail(404, "Cliente no encontrado.");
    const quotes = await Quote.find({
      client: id,
      owner: req.owner,
      active: true,
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      quotes: quotes.map((q) => ({
        ...q,
        paidCents: paid(q),
        balanceCents: q.totalCents - paid(q),
      })),
    });
  });
  /** Registra un pago idempotente y usa versión de documento para evitar sobrepagos concurrentes.
   * @param {import('express').Request} req Petición HTTP.
   * @param {import('express').Response} res Respuesta JSON o binaria.
   * @returns {Promise<void>|void} Respuesta o error manejado por Express.
   */
  app.post("/api/quotes/:id/payments", async (req, res) => {
    const data = paymentSchema.parse(req.body);
    const quote = await Quote.findOne({
      _id: objectId.parse(req.params.id),
      owner: req.owner,
      active: true,
    });
    if (!quote) throw fail(404, "Cotización no encontrada.");
    if (quote.payments.some((p) => p.requestId === data.requestId))
      return res.json(quote);
    if (quote.status === "Cancelada")
      throw fail(409, "No puedes abonar a una cotización cancelada.");
    const amountCents = Math.round(data.amount * 100);
    if (paid(quote) + amountCents > quote.totalCents)
      throw fail(409, "El pago excede el saldo pendiente.");
    if (data.kind === "Anticipo" && quote.payments.some((p) => !p.voided))
      throw fail(409, "Ya existe un pago vigente; registra un abono.");
    const parts = (
      data.parts || [{ method: data.method, amount: data.amount }]
    ).map((p) => ({
      method: p.method,
      amountCents: Math.round(p.amount * 100),
    }));
    quote.payments.push({
      requestId: data.requestId,
      kind: data.kind,
      amountCents,
      parts,
      method: parts.length > 1 ? "Mixto" : parts[0].method,
      note: data.note,
      date: new Date(),
    });
    quote.status = quoteStatus(quote);
    await quote.save();
    res.status(201).json(quote);
  });
  /** Anula el efecto de un pago sin borrar importe, fecha, desglose ni motivo del historial. */
  app.post("/api/quotes/:id/payments/:paymentId/void", async (req, res) => {
    const data = voidPaymentSchema.parse(req.body);
    const quote = await Quote.findOne({
      _id: objectId.parse(req.params.id),
      owner: req.owner,
      active: true,
    });
    if (!quote) throw fail(404, "Cotización no encontrada.");
    const payment = quote.payments.id(objectId.parse(req.params.paymentId));
    if (!payment) throw fail(404, "Pago no encontrado.");
    if (payment.voided) return res.json(quote);
    if (data.version !== quote.__v)
      throw fail(409, "El historial cambió. Actualiza antes de anular.");
    payment.voided = true;
    payment.voidedAt = new Date();
    payment.voidReason = data.reason;
    quote.status = quoteStatus(quote);
    await quote.save();
    res.json(quote);
  });
  /** La autorización se edita desde la tabla; el estado Pagado nunca puede asignarse manualmente. */
  app.put("/api/quotes/:id/status", async (req, res) => {
    const data = quoteStatusSchema.parse(req.body);
    const quote = await Quote.findOne({
      _id: objectId.parse(req.params.id),
      owner: req.owner,
      active: true,
    });
    if (!quote) throw fail(404, "Cotización no encontrada.");
    if (quote.__v !== data.version)
      throw fail(409, "La cotización cambió. Actualiza antes de continuar.");
    if (paid(quote) > 0)
      throw fail(
        409,
        "El estado depende de los pagos vigentes. Anula el pago correspondiente si necesitas corregirlo.",
      );
    quote.status = data.status;
    quote.approved = data.status === "Aceptada";
    await quote.save();
    res.json(quote);
  });
  /** Datos íntegros de una invitación sin exponer al público las referencias del cliente. */
  app.get("/api/invitations/:id/document", async (req, res) => {
    const invitation = await Invitation.findOne({
      _id: objectId.parse(req.params.id),
      owner: req.owner,
      active: true,
    }).lean();
    if (!invitation) throw fail(404, "Invitación no encontrada.");
    const [quote, guest] = await Promise.all([
      Quote.findOne({
        _id: invitation.quote,
        owner: req.owner,
        active: true,
      }).lean(),
      Guest.findOne({
        _id: invitation.guest,
        owner: req.owner,
        active: true,
      }).lean(),
    ]);
    if (!quote || !guest)
      throw fail(409, "La cotización o el invitado ya no están disponibles.");
    res.json({ invitation, quote, guest });
  });
  /**
   * @param {import('express').Request} req Sesión autenticada.
   * @returns {object} Filtro obligatorio de propietario.
   */
  const owned = (req) => ({ owner: req.owner, active: true });
  /**
   * Obtiene una relación activa perteneciente al usuario actual.
   * @param {import('mongoose').Model} Model Modelo relacionado.
   * @param {string} id Identificador validado.
   * @param {import('express').Request} req Petición autenticada.
   * @returns {Promise<object>} Registro relacionado; lanza 400 si no está disponible.
   */
  async function relation(Model, id, req) {
    const result = await Model.findOne({ _id: id, ...owned(req) });
    if (!result)
      throw fail(
        400,
        "El registro relacionado no existe o no está disponible.",
      );
    return result;
  }
  /**
   * Valida referencias, titularidad y restricciones al cambiar clientes de registros con pagos.
   * @param {string} type Entidad CRUD.
   * @param {object} data Cuerpo ya validado con Zod.
   * @param {import('express').Request} req Petición con propietario.
   * @param {object} [current] Documento previo en una edición.
   * @returns {Promise<void>} Rechaza operaciones que romperían relaciones activas.
   */
  async function validateRelations(type, data, req, current) {
    if (type === "guests" || type === "quotes") {
      const client = await relation(Client, data.client, req);
      if (type === "quotes") data.clientName = client.name;
      if (
        current &&
        String(current.client) !== data.client &&
        (await Invitation.exists({
          ...owned(req),
          [type === "guests" ? "guest" : "quote"]: current._id,
        }))
      )
        throw fail(
          409,
          "No puedes cambiar el cliente mientras existan invitaciones relacionadas.",
        );
    }
    if (type === "quotes") {
      const ids = [
        ...new Set(
          [
            data.referenceImage,
            data.finalImage,
            data.frameTop,
            data.frameBottom,
            ...data.materialImages,
          ].filter(Boolean),
        ),
      ];
      if (
        ids.length !==
        (await Image.countDocuments({ _id: { $in: ids }, owner: req.owner }))
      )
        throw fail(400, "Alguna imagen no está disponible.");
      if (
        current &&
        current.payments.length &&
        String(current.client) !== data.client
      )
        throw fail(
          409,
          "No puedes cambiar el cliente de una cotización con pagos.",
        );
    }
    if (type === "invitations") {
      const [quote, guest] = await Promise.all([
        relation(Quote, data.quote, req),
        relation(Guest, data.guest, req),
      ]);
      if (String(quote.client) !== String(guest.client))
        throw fail(
          400,
          "La cotización y el invitado deben pertenecer al mismo cliente.",
        );
    }
  }
  for (const [type, Model] of Object.entries(models)) {
    /** Lista registros activos del propietario con paginación y filtro opcional por cliente.
     * @param {import('express').Request} req Petición HTTP.
     * @param {import('express').Response} res Respuesta JSON o binaria.
     * @returns {Promise<void>|void} Respuesta o error manejado por Express.
     */
    app.get(`/api/${type}`, async (req, res) => {
      const page = Math.max(1, Math.min(100000, parseInt(req.query.page) || 1));
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
      const query = owned(req);
      if (req.query.client && ["guests", "quotes"].includes(type))
        query.client = objectId.parse(req.query.client);
      const [items, total] = await Promise.all([
        Model.find(query)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Model.countDocuments(query),
      ]);
      res.json({
        items,
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
      });
    });
    /** Consulta un registro sin permitir acceso por identificadores de otro propietario.
     * @param {import('express').Request} req Petición HTTP.
     * @param {import('express').Response} res Respuesta JSON o binaria.
     * @returns {Promise<void>|void} Respuesta o error manejado por Express.
     */
    app.get(`/api/${type}/:id`, async (req, res) => {
      const doc = await Model.findOne({
        _id: objectId.parse(req.params.id),
        ...owned(req),
      });
      if (!doc) throw fail(404, "Registro no encontrado.");
      res.json(doc);
    });
    /** Crea un registro; en cotizaciones calcula importes y asigna folio del servidor.
     * @param {import('express').Request} req Petición HTTP.
     * @param {import('express').Response} res Respuesta JSON o binaria.
     * @returns {Promise<void>|void} Respuesta o error manejado por Express.
     */
    app.post(`/api/${type}`, async (req, res) => {
      const data = schemas[type].parse(req.body);
      if (type === "clients") data.name = fullName(data);
      await validateRelations(type, data, req);
      if (type === "quotes") {
        delete data.version;
        data.status = "Esperando autorización";
        Object.assign(data, quoteAmounts(data.items, data.discountPercent));
        data.items = data.items.map((item) => ({
          ...item,
          totalCents: quoteAmounts([item]).totalCents,
        }));
        const counter = await Counter.findByIdAndUpdate(
          "quote:" + req.owner,
          { $inc: { value: 1 } },
          { upsert: true, new: true },
        );
        data.number = "COT-" + String(counter.value).padStart(6, "0");
      }
      const doc = await Model.create({ ...data, owner: req.owner });
      res.status(201).json(doc);
    });
    /** Edita datos validados; protege la versión y el total ya abonado de una cotización.
     * @param {import('express').Request} req Petición HTTP.
     * @param {import('express').Response} res Respuesta JSON o binaria.
     * @returns {Promise<void>|void} Respuesta o error manejado por Express.
     */
    app.put(`/api/${type}/:id`, async (req, res) => {
      const doc = await Model.findOne({
        _id: objectId.parse(req.params.id),
        ...owned(req),
      });
      if (!doc) throw fail(404, "Registro no encontrado.");
      const data = schemas[type].parse(req.body);
      if (type === "clients") data.name = fullName(data);
      await validateRelations(type, data, req, doc);
      if (type === "quotes") {
        if (data.version !== doc.__v)
          throw fail(
            409,
            "La cotización cambió. Cierra el formulario y vuelve a abrirla.",
          );
        delete data.version;
        Object.assign(data, quoteAmounts(data.items, data.discountPercent));
        data.items = data.items.map((item) => ({
          ...item,
          totalCents: quoteAmounts([item]).totalCents,
        }));
        if (data.totalCents < paid(doc))
          throw fail(
            409,
            "El total no puede ser menor que los pagos recibidos.",
          );
        if (doc.status === "Cancelada" && paid(doc) > 0)
          throw fail(
            409,
            "No puedes cancelar una cotización con pagos registrados.",
          );
      }
      Object.assign(doc, data);
      if (type === "quotes") doc.status = quoteStatus(doc);
      await doc.save();
      res.json(doc);
    });
    /** Desactiva un registro sin pagos ni dependencias activas; no borra historial financiero.
     * @param {import('express').Request} req Petición HTTP.
     * @param {import('express').Response} res Respuesta JSON o binaria.
     * @returns {Promise<void>|void} Respuesta o error manejado por Express.
     */
    app.delete(`/api/${type}/:id`, async (req, res) => {
      const id = objectId.parse(req.params.id);
      let dependent = false;
      if (type === "clients")
        dependent =
          (await Quote.exists({ ...owned(req), client: id })) ||
          (await Guest.exists({ ...owned(req), client: id }));
      if (type === "quotes" || type === "guests")
        dependent = await Invitation.exists({
          ...owned(req),
          [type === "quotes" ? "quote" : "guest"]: id,
        });
      if (
        type === "quotes" &&
        (await Quote.exists({
          _id: id,
          ...owned(req),
          "payments.0": { $exists: true },
        }))
      )
        throw fail(
          409,
          "No puedes eliminar una cotización con historial de pagos.",
        );
      if (dependent)
        throw fail(409, "Primero elimina los registros relacionados.");
      const filter = {
        _id: id,
        ...owned(req),
        ...(type === "quotes" ? { "payments.0": { $exists: false } } : {}),
      };
      const doc = await Model.findOneAndUpdate(filter, {
        $set: { active: false },
        ...(type === "quotes" ? { $inc: { __v: 1 } } : {}),
      });
      if (!doc)
        throw fail(
          409,
          "Registro eliminado o modificado; actualiza el listado.",
        );
      res.status(204).end();
    });
  }
  app.use("/api", (_req, _res, next) => next(fail(404, "Ruta no encontrada.")));
  const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../client/dist",
  );
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(path.join(dist, "index.html")),
    );
  }
  /** Convierte errores de validación, concurrencia y base en respuestas sin stack ni secretos.
   * @param {import('express').Request} req Petición HTTP.
   * @param {import('express').Response} res Respuesta JSON o binaria.
   * @returns {Promise<void>|void} Respuesta o error manejado por Express.
   */
  app.use((err, _req, res, _next) => {
    if (err.name === "ZodError")
      return res.status(400).json({
        message: err.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join("; "),
      });
    if (err.name === "VersionError")
      return res.status(409).json({
        message:
          "Otro movimiento modificó la cotización. Actualiza la información antes de reintentar.",
      });
    if (err.code === 11000)
      return res.status(409).json({
        message: "Ya existe una invitación para este invitado y cotización.",
      });
    const status = err.status || 500;
    if (status >= 500) console.error("Error interno:", err.name);
    res.status(status).json({
      message: status >= 500 ? "Ocurrió un error interno." : err.message,
    });
  });
  return app;
}
