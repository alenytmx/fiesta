/** @file Pruebas de validation.test; consultar VERIFICACION.md para sus límites. */
import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "./app.js";
import {
  quoteTotal,
  quoteAmounts,
  schemas,
  paymentSchema,
  setupSchema,
} from "./validation.js";
test("validación de fechas, inyección y precisión monetaria", () => {
  assert.equal(
    quoteTotal([
      { quantity: 3, unitPrice: 0.1 },
      { quantity: 1, unitPrice: 0.2 },
    ]),
    50,
  );
  assert.equal(
    schemas.clients.safeParse({ name: { $ne: null } }).success,
    false,
  );
  assert.equal(
    schemas.quotes.safeParse({
      client: "a".repeat(24),
      title: "Evento",
      eventDate: "2027-02-30",

      items: [{ description: "A", quantity: 1, unitPrice: 10 }],
    }).success,
    false,
  );
});

test("las rutas privadas rechazan solicitudes sin sesión", async () => {
  for (const route of ["clients", "quotes", "guests", "invitations"]) {
    const response = await request(createApp()).get("/api/" + route);
    assert.equal(response.status, 401);
  }
});

const validQuote = {
  client: "a".repeat(24),
  title: "Fiesta",
  eventDate: "2027-02-28",

  items: [{ description: "Globos", quantity: 3, unitPrice: 10.15 }],
  discountPercent: 10,
  discountReason: "Cliente frecuente",
};
test("descuento, materiales y campos de solo servidor", () => {
  assert.deepEqual(quoteAmounts(validQuote.items, 10), {
    subtotalCents: 3045,
    discountCents: 305,
    totalCents: 2740,
  });
  assert.equal(schemas.quotes.safeParse(validQuote).success, true);
  for (const input of [
    { ...validQuote, discountReason: "" },
    { ...validQuote, discountPercent: 101 },
    { ...validQuote, number: "COT-001" },
    { ...validQuote, createdAt: "2020-01-01" },
    { ...validQuote, totalCents: 0 },
    { ...validQuote, items: [{ description: "", quantity: 1, unitPrice: 1 }] },
  ])
    assert.equal(schemas.quotes.safeParse(input).success, false);
  assert.deepEqual(quoteAmounts([{ quantity: 1, unitPrice: 10 }], 100), {
    subtotalCents: 1000,
    discountCents: 1000,
    totalCents: 0,
  });
});
test("registro inicial y pagos requieren datos válidos", () => {
  assert.equal(
    setupSchema.safeParse({
      email: "ale@example.com",
      password: "corta",
      setupToken: "x".repeat(64),
    }).success,
    false,
  );
  const p = {
    requestId: "16f0c02a-cfe5-4c3e-b445-010cb9ab461e",
    kind: "Anticipo",
    amount: 100,
    method: "Efectivo",
  };
  assert.equal(paymentSchema.safeParse(p).success, true);
  for (const amount of [-1, 0, 1.111, NaN])
    assert.equal(paymentSchema.safeParse({ ...p, amount }).success, false);
  assert.equal(
    paymentSchema.safeParse({ ...p, requestId: "repetible" }).success,
    false,
  );
});

import { imageBox } from "../shared/report-defaults.js";
/** El mismo encuadre produce la misma geometría en el editor y en PDF. */
test("encuadre compartido no deforma la imagen", () => {
  assert.deepEqual(
    imageBox(200, 100, 100, 100, { fit: "contain", zoom: 1, x: 50, y: 50 }),
    { x: 0, y: 25, width: 100, height: 50 },
  );
  assert.deepEqual(
    imageBox(200, 100, 100, 100, { fit: "cover", zoom: 1, x: 100, y: 50 }),
    { x: -100, y: 0, width: 200, height: 100 },
  );
});
