/** @file Arranque, conexión MongoDB, compatibilidad de registros previos y cierre ordenado. */
import "dotenv/config";
import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { listenAddress } from "./listen-address.js";
import { createRealtime } from "./realtime.js";
import { quoteStatus } from "../shared/finance.js";
import { createApp } from "./app.js";
import {
  models,
  User,
  Session,
  Image,
  Counter,
  Quote,
  Settings,
  Client,
  Guest,
  Branding,
} from "./models.js";
try {
  const { port, host } = listenAddress();
  if (!process.env.MONGODB_URI)
    throw new Error("Configura MONGODB_URI en server/.env.");
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  await Promise.all(
    [
      ...Object.values(models),
      User,
      Session,
      Image,
      Counter,
      Settings,
      Branding,
    ].map((model) => model.init()),
  );
  // Compatibilidad con cotizaciones v1: conservar fecha, total y registros previos.
  for await (const q of Quote.find({
    $or: [{ number: { $exists: false } }, { __v: { $exists: false } }],
  }).lean()) {
    await Quote.collection.updateOne(
      { _id: q._id },
      {
        $set: {
          number: q.number || "COT-LEG-" + q._id.toString().toUpperCase(),
          subtotalCents: q.subtotalCents ?? q.totalCents,
          discountPercent: q.discountPercent ?? 0,
          discountCents: q.discountCents ?? 0,
          payments: q.payments || [],
          __v: q.__v ?? 0,
        },
      },
    );
  }
  // No se adivinan apellidos antiguos: el nombre completo previo se conserva en Nombre(s).
  await Client.updateMany({ firstNames: { $exists: false } }, [
    { $set: { firstNames: "$name", paternalSurname: "", maternalSurname: "" } },
  ]);
  await Client.collection.updateMany(
    { email: { $exists: true } },
    { $unset: { email: 1 } },
  );
  await Guest.collection.updateMany(
    { email: { $exists: true } },
    { $unset: { email: 1 } },
  );
  for await (const quote of Quote.find({})) {
    if (quote.status === "Aceptada" && !quote.payments?.length)
      quote.approved = true;
    const status = quoteStatus(quote);
    if (status !== quote.status || quote.isModified("approved")) {
      quote.status = status;
      await quote.save();
    }
  }
  const first = !(await User.exists({}));
  let setupToken = process.env.SETUP_TOKEN;
  if (first && !setupToken) {
    if (process.env.NODE_ENV === "production")
      throw new Error(
        "Primera instalación: configura SETUP_TOKEN con al menos 32 caracteres aleatorios.",
      );
    const file = ".setup-key";
    if (existsSync(file)) setupToken = readFileSync(file, "utf8").trim();
    else {
      setupToken = randomBytes(32).toString("hex");
      writeFileSync(file, setupToken, { mode: 0o600 });
    }
  }
  if (first && (!setupToken || setupToken.length < 32))
    throw new Error(
      "La clave de instalación debe tener al menos 32 caracteres.",
    );
  let realtime;
  const app = createApp({
    setupToken,
    publish: (...args) => realtime?.publish(...args),
    disconnectSession: (id) => realtime?.disconnectSession(id),
  });
  const server = createServer(app);
  realtime = createRealtime(server);
  server.listen(port, host, () => {
    const url =
      `http://localhost:${port}` +
      (first ? "#setup=" + encodeURIComponent(setupToken) : "");
    console.log(
      `Fiesta escuchando en ${host}:${port}.`,
    );
    if (first)
      console.log(
        process.env.SETUP_TOKEN
          ? "Crea el administrador desde la pantalla inicial usando la clave configurada en SETUP_TOKEN."
          : "Crea el administrador desde la pantalla inicial. La clave local está en server/.setup-key.",
      );
    if (process.env.OPEN_BROWSER === "1" && process.platform === "win32")
      spawn("cmd.exe", ["/c", "start", "", url], { stdio: "ignore" });
  });
  server.on("error", (e) => {
    console.error(
      e.code === "EADDRINUSE"
        ? "El puerto está ocupado. Cierra la instancia anterior del programa."
        : "No se pudo abrir el servidor.",
    );
    process.exitCode = 1;
    mongoose.disconnect();
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      realtime.close();
      server.close(async () => {
        await mongoose.disconnect();
        process.exit(0);
      });
    });
} catch (e) {
  console.error(
    e.name === "MongooseServerSelectionError"
      ? "No se pudo conectar a MongoDB. Revisa server/.env, el servicio local o el acceso a Atlas."
      : e.message,
  );
  await mongoose.disconnect();
  process.exitCode = 1;
}
