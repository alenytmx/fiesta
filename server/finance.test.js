/** @file Regresión de pagos mixtos, anulación y aislamiento de avisos en tiempo real. */
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { io } from "socket.io-client";
import { Session, Quote } from "./models.js";
import { createApp } from "./app.js";
import { createRealtime } from "./realtime.js";
import { paymentSchema } from "./validation.js";
import { paid } from "../shared/finance.js";
test("pago mixto, liquidación, anulación, saldo y aviso autenticado (modelo simulado)", async () => {
  const owner = "a".repeat(24),
    q = new Quote({
      _id: "b".repeat(24),
      owner,
      totalCents: 10000,
      status: "Esperando autorización",
      payments: [],
      __v: 0,
    });
  const session = mock.method(Session, "findOne", async () => ({
    user: owner,
  }));
  const lookup = mock.method(Quote, "findOne", async (filter) => {
    assert.equal(filter.owner, owner);
    return q;
  });
  const save = mock.method(q, "save", async () => {
    q.__v++;
    return q;
  });
  let events = [];
  const api = request(createApp({ publish: (...args) => events.push(args) })),
    auth = "Bearer " + "a".repeat(64);
  try {
    let p = {
      requestId: crypto.randomUUID(),
      kind: "Anticipo",
      amount: 40,
      method: "Mixto",
      parts: [
        { method: "Efectivo", amount: 15 },
        { method: "Transferencia", amount: 25 },
      ],
    };
    assert.equal(paymentSchema.safeParse({ ...p, amount: 41 }).success, false);
    assert.equal(
      (
        await api
          .post("/api/quotes/" + q._id + "/payments")
          .set("Authorization", auth)
          .send(p)
      ).status,
      201,
    );
    assert.equal(q.status, "Aceptada");
    assert.equal(paid(q), 4000);
    assert.equal(q.payments[0].parts[1].amountCents, 2500);
    await api
      .post("/api/quotes/" + q._id + "/payments")
      .set("Authorization", auth)
      .send(p);
    assert.equal(q.payments.length, 1);
    p = {
      requestId: crypto.randomUUID(),
      kind: "Abono",
      amount: 60,
      method: "Transferencia",
    };
    assert.equal(
      (
        await api
          .post("/api/quotes/" + q._id + "/payments")
          .set("Authorization", auth)
          .send(p)
      ).status,
      201,
    );
    assert.equal(q.status, "Pagado");
    const route =
      "/api/quotes/" + q._id + "/payments/" + q.payments[1]._id + "/void";
    assert.equal(
      (
        await api
          .post(route)
          .set("Authorization", auth)
          .send({ reason: "Corrección de liquidación", version: 0 })
      ).status,
      409,
    );
    assert.equal(
      (
        await api
          .post(route)
          .set("Authorization", auth)
          .send({ reason: "Corrección de liquidación", version: q.__v })
      ).status,
      200,
    );
    assert.equal(q.status, "Aceptada");
    assert.equal(q.totalCents - paid(q), 6000);
    assert.equal(q.payments.length, 2);
    assert.equal(q.payments[1].voided, true);
    assert.ok(events.every(([o, r]) => o === owner && r === "quotes"));
    assert.ok(events.length >= 3);
  } finally {
    session.mock.restore();
    lookup.mock.restore();
    save.mock.restore();
  }
});
test("socket real rechaza token inválido, separa propietarios y revoca sesión", async () => {
  const tokens = ["a".repeat(64), "b".repeat(64)];
  const stub = mock.method(Session, "findOne", async ({ tokenHash }) => {
    const i = tokens.findIndex(
      (t) => createHash("sha256").update(t).digest("hex") === tokenHash,
    );
    return i < 0
      ? null
      : {
          _id: "s" + i,
          user: "u" + i,
          expiresAt: new Date(Date.now() + 60000),
        };
  });
  const http = createServer();
  const rt = createRealtime(http);
  await new Promise((r) => http.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + http.address().port;
  const clients = [];
  /** Espera un evento con límite para detectar fallos del canal. */ const wait =
    (s, e) =>
      new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("Sin evento " + e)), 3000);
        s.once(e, (v) => {
          clearTimeout(t);
          resolve(v);
        });
      });
  try {
    for (const token of tokens) {
      const c = io(url, {
        auth: { token },
        transports: ["websocket"],
        reconnection: false,
      });
      clients.push(c);
      await wait(c, "connect");
    }
    let foreign = false;
    clients[1].on("changed", () => (foreign = true));
    const changed = wait(clients[0], "changed");
    rt.publish("u0", "quotes");
    assert.equal((await changed).resource, "quotes");
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(foreign, false);
    const bad = io(url, { auth: { token: "wrong" }, reconnection: false });
    clients.push(bad);
    assert.match((await wait(bad, "connect_error")).message, /inválida/);
    const disconnected = wait(clients[0], "disconnect");
    rt.disconnectSession("s0");
    await disconnected;
  } finally {
    clients.forEach((c) => c.disconnect());
    rt.close();
    stub.mock.restore();
  }
});
