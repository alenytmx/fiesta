/** @file Pruebas de security.test; consultar VERIFICACION.md para sus límites. */
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import sharp from "sharp";
import { createApp } from "./app.js";
import { User, Session, Image, Settings, Branding } from "./models.js";
test("setup protegido, validación de contraseña y cierre después del alta (dobles de modelos)", async () => {
  let created = false,
    captured;
  const exists = mock.method(User, "exists", async () =>
    created ? { _id: "000000000000000000000001" } : null,
  );
  const create = mock.method(User, "create", async (doc) => {
    captured = doc;
    created = true;
    return doc;
  });
  try {
    const app = createApp({ setupToken: "x".repeat(64) });
    const payload = {
      email: "Admin@example.com",
      password: "Clave-larga-12345",
      setupToken: "x".repeat(64),
    };
    assert.equal(
      (await request(app).get("/api/setup/status")).body.required,
      true,
    );
    assert.equal(
      (
        await request(app)
          .post("/api/setup")
          .send({ ...payload, setupToken: "z".repeat(64) })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(app)
          .post("/api/setup")
          .send({ ...payload, password: "abc" })
      ).status,
      400,
    );
    assert.equal(
      (await request(app).post("/api/setup").send(payload)).status,
      201,
    );
    assert.equal(captured._id, "000000000000000000000001");
    assert.equal(captured.email, "admin@example.com");
    assert.notEqual(captured.passwordHash, payload.password);
    assert.equal(
      (await request(app).get("/api/setup/status")).body.required,
      false,
    );
    assert.equal(
      (await request(app).post("/api/setup").send(payload)).status,
      409,
    );
  } finally {
    exists.mock.restore();
    create.mock.restore();
  }
});
test("carga de imágenes: autenticación, rechazo de SVG y normalización (dobles de modelos)", async () => {
  const session = mock.method(Session, "findOne", async () => ({
    user: "a".repeat(24),
  }));
  let saved;
  const create = mock.method(Image, "create", async (image) => {
    saved = image;
    return { ...image, _id: "b".repeat(24) };
  });
  try {
    const app = createApp();
    const auth = "Bearer " + "a".repeat(64);
    assert.equal(
      (
        await request(app)
          .post("/api/images")
          .send({ name: "a", base64: "abcd" })
      ).status,
      401,
    );
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    ).toString("base64");
    assert.equal(
      (
        await request(app)
          .post("/api/images")
          .set("Authorization", auth)
          .send({ name: "a.png", base64: svg })
      ).status,
      400,
    );
    const png = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "#6544bb" },
    })
      .png()
      .toBuffer();
    const result = await request(app)
      .post("/api/images")
      .set("Authorization", auth)
      .send({ name: "foto.png", base64: png.toString("base64") });
    assert.equal(result.status, 201);
    assert.equal(saved.owner, "a".repeat(24));
    assert.equal(saved.mime, "image/webp");
    assert.equal((await sharp(saved.data).metadata()).format, "webp");
  } finally {
    session.mock.restore();
    create.mock.restore();
  }
});

import { DEFAULT_REPORT } from "../shared/report-defaults.js";

/** Verifica permisos y validación del diseño sin presentar el doble como persistencia real. */
test("configuración privada y recursos del propietario", async () => {
  const owner = "a".repeat(24);
  const session = mock.method(Session, "findOne", async () => ({
    user: owner,
  }));
  const read = mock.method(Settings, "findOne", (query) => {
    assert.equal(query.owner, owner);
    return { lean: async () => null };
  });
  const write = mock.method(
    Settings,
    "findOneAndUpdate",
    async (query, update) => {
      assert.equal(query.owner, owner);
      return update.$set.report;
    },
  );
  const branding = mock.method(Branding, "findOneAndUpdate", async () => ({}));
  const count = mock.method(Image, "countDocuments", async (query) => {
    assert.equal(query.owner, owner);
    return 0;
  });
  try {
    const app = createApp(),
      auth = "Bearer " + "a".repeat(64);
    assert.equal((await request(app).get("/api/settings")).status, 401);
    const defaults = await request(app)
      .get("/api/settings")
      .set("Authorization", auth);
    assert.equal(defaults.body.font, "helvetica");
    const saved = await request(app)
      .put("/api/settings")
      .set("Authorization", auth)
      .send({ ...DEFAULT_REPORT, font: "times" });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.font, "times");
    assert.equal(
      (
        await request(app)
          .put("/api/settings")
          .set("Authorization", auth)
          .send({ ...DEFAULT_REPORT, logo: "b".repeat(24) })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(app)
          .put("/api/settings")
          .set("Authorization", auth)
          .send({ ...DEFAULT_REPORT, finalX: 130, finalWidth: 174 })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(app)
          .put("/api/settings")
          .set("Authorization", auth)
          .send({ ...DEFAULT_REPORT, font: "fuente-inyectada" })
      ).status,
      400,
    );
    assert.match(
      defaults.headers["content-security-policy"],
      /frame-src 'self' blob:/,
    );
  } finally {
    session.mock.restore();
    read.mock.restore();
    write.mock.restore();
    count.mock.restore();
    branding.mock.restore();
  }
});
