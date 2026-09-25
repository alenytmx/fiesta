/** @file Pruebas de app.test; consultar VERIFICACION.md para sus límites. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "./app.js";
import { User, Invitation } from "./models.js";
import { quoteTotal, schemas } from "./validation.js";
let mongo, app, token, other;
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Invitation.init();
  app = createApp();
  for (const email of ["admin@example.com", "other@example.com"])
    await User.create({
      email,
      passwordHash: await bcrypt.hash("Prueba-segura-123", 12),
    });
  token = (
    await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "Prueba-segura-123" })
  ).body.token;
  other = (
    await request(app)
      .post("/api/auth/login")
      .send({ email: "other@example.com", password: "Prueba-segura-123" })
  ).body.token;
});
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
const api = (method, url, t = token) =>
  request(app)
    [method]("/api" + url)
    .set("Authorization", "Bearer " + t);
test("CRUD, relaciones, totales, aislamiento y cierre de sesión", async () => {
  assert.equal((await request(app).get("/api/clients")).status, 401);
  const c = await api("post", "/clients").send({ firstNames: "Cliente uno" });
  assert.equal(c.status, 201);
  const cid = c.body._id;
  const c2 = await api("post", "/clients").send({ firstNames: "Cliente dos" });
  assert.equal((await api("get", "/clients/" + cid, other)).status, 404);
  assert.equal(
    (await api("put", "/clients/" + cid, other).send({ firstNames: "Ataque" }))
      .status,
    404,
  );
  assert.equal((await api("delete", "/clients/" + cid, other)).status, 409);
  assert.equal((await api("get", "/clients", other)).body.total, 0);
  const guest = await api("post", "/guests").send({
    client: cid,
    name: "Invitado A",
  });
  assert.equal(guest.status, 201);
  const otherGuest = await api("post", "/guests").send({
    client: c2.body._id,
    name: "Invitado B",
  });
  const body = {
    client: cid,
    title: "Boda",
    eventDate: "2027-02-20",
    venue: "Salón",

    items: [{ description: "Servicio", quantity: 3, unitPrice: 10.15 }],
  };
  const q = await api("post", "/quotes").send(body);
  assert.equal(q.status, 201);
  assert.equal(q.body.totalCents, 3045);
  assert.equal(
    (await api("post", "/quotes").send({ ...body, totalCents: 1 })).status,
    400,
  );
  assert.equal(
    (await api("post", "/quotes").send({ ...body, client: cid }, other)).status,
    400,
  );
  const invitation = {
    quote: q.body._id,
    guest: guest.body._id,
    status: "Pendiente",
    seats: 2,
  };
  assert.equal(
    (
      await api("post", "/invitations").send({
        ...invitation,
        guest: otherGuest.body._id,
      })
    ).status,
    400,
  );
  const i = await api("post", "/invitations").send(invitation);
  assert.equal(i.status, 201);
  assert.equal(
    (await api("post", "/invitations").send(invitation)).status,
    409,
  );
  assert.equal(
    (
      await api("put", "/invitations/" + i.body._id).send({
        ...invitation,
        status: "Confirmada",
      })
    ).status,
    200,
  );
  assert.equal(
    (await api("get", "/invitations/" + i.body._id)).body.status,
    "Confirmada",
  );
  assert.equal(
    (
      await api("put", "/guests/" + guest.body._id).send({
        name: "Invitado A",
        client: c2.body._id,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await api("put", "/quotes/" + q.body._id).send({
        ...body,
        client: c2.body._id,
      })
    ).status,
    409,
  );
  assert.equal((await api("delete", "/clients/" + cid)).status, 409);
  assert.equal((await api("delete", "/quotes/" + q.body._id)).status, 409);
  assert.equal((await api("delete", "/guests/" + guest.body._id)).status, 409);
  assert.equal((await api("delete", "/invitations/" + i.body._id)).status, 204);
  assert.equal(
    (
      await api("put", "/quotes/" + q.body._id).send({
        ...body,
        title: "Boda editada",
        version: 0,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await api("put", "/guests/" + guest.body._id).send({
        name: "Invitado editado",
        client: cid,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await api("put", "/clients/" + cid).send({
        firstNames: "Cliente editado",
      })
    ).status,
    200,
  );
  assert.equal(
    (await api("get", "/clients/" + cid)).body.name,
    "Cliente editado",
  );
  assert.equal((await api("get", "/quotes")).body.total, 1);
  assert.equal((await api("get", "/guests?limit=1")).body.pages, 2);
  assert.equal((await api("delete", "/quotes/" + q.body._id)).status, 204);
  assert.equal((await api("delete", "/guests/" + guest.body._id)).status, 204);
  assert.equal((await api("delete", "/clients/" + cid)).status, 204);
  assert.equal((await api("get", "/clients/" + cid)).status, 404);

  const paidQuote = await api("post", "/quotes").send({
    ...body,
    client: c2.body._id,
    discountPercent: 10,
    discountReason: "Promoción",
  });
  assert.equal(paidQuote.status, 201);
  assert.match(paidQuote.body.number, /^COT-\d+$/);
  assert.equal(paidQuote.body.totalCents, 2740);
  assert.equal(paidQuote.body.clientName, "Cliente dos");
  const pid = paidQuote.body._id;
  const payment = {
    requestId: "16f0c02a-cfe5-4c3e-b445-010cb9ab461e",
    kind: "Anticipo",
    amount: 10,
    method: "Efectivo",
  };
  assert.equal(
    (await api("post", "/quotes/" + pid + "/payments", other).send(payment))
      .status,
    404,
  );
  assert.equal(
    (await api("post", "/quotes/" + pid + "/payments").send(payment)).status,
    201,
  );
  assert.equal(
    (await api("post", "/quotes/" + pid + "/payments").send(payment)).status,
    200,
  );
  const state = await api("get", "/quotes/" + pid);
  assert.equal(state.body.payments.length, 1);
  assert.equal(
    (
      await api("post", "/quotes/" + pid + "/payments").send({
        ...payment,
        requestId: "26f0c02a-cfe5-4c3e-b445-010cb9ab461e",
        kind: "Abono",
        amount: 20,
      })
    ).status,
    409,
  );
  const account = await api("get", "/clients/" + c2.body._id + "/account");
  assert.equal(account.body.quotes[0].balanceCents, 1740);
  assert.equal((await api("delete", "/quotes/" + pid)).status, 409);
  assert.equal(
    (
      await api("put", "/quotes/" + pid).send({
        ...body,
        client: c2.body._id,
        version: 0,
      })
    ).status,
    409,
  );
  const version = state.body.__v;
  assert.equal(
    (
      await api("put", "/quotes/" + pid).send({
        ...body,
        client: c2.body._id,
        version,
        discountPercent: 100,
        discountReason: "Gratis",
      })
    ).status,
    409,
  );
  const concurrent = await Promise.all(
    [
      "36f0c02a-cfe5-4c3e-b445-010cb9ab461e",
      "46f0c02a-cfe5-4c3e-b445-010cb9ab461e",
    ].map((requestId) =>
      api("post", "/quotes/" + pid + "/payments").send({
        ...payment,
        kind: "Abono",
        amount: 17.4,
        requestId,
      }),
    ),
  );
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    (await api("get", "/clients/" + c2.body._id + "/account")).body.quotes[0]
      .balanceCents,
    0,
  );
  assert.equal((await request(app).post("/api/setup").send({})).status, 409);
  assert.equal((await api("post", "/auth/logout")).status, 204);
  assert.equal((await api("get", "/clients")).status, 401);
});
