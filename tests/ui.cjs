/** @file Regresión de navegación e interacciones con DOM y API simulada; no sustituye pruebas MongoDB. */
const { JSDOM } = require("jsdom");
const path = require("path");
const root = path.resolve(__dirname, "..");
const esbuild = require(root + "/node_modules/esbuild");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const files = {
  clients: [
    {
      _id: "a".repeat(24),
      name: "Ana Pérez",
      email: "ana@example.com",
      phone: "3111234567",
      notes: "",
    },
  ],
  quotes: [],
  guests: [],
  invitations: [],
};
let setup = true;
let config;
const uiErrors = [];
let createdPdfUrls = 0,
  revokedUrls = 0;
config = {
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
  notes: "Notas de ejemplo",
  contracting: "Paso 1. Contratar.",
};
const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: "http://localhost:4000/#setup=" + "x".repeat(64),
  runScripts: "dangerously",
  pretendToBeVisual: true,
});
const w = dom.window;
w.addEventListener("error", (e) => uiErrors.push(e.message));
w.URL.createObjectURL = (blob) => {
  assert.equal(blob.type, "application/pdf");
  createdPdfUrls++;
  return "blob:qa";
};
w.URL.revokeObjectURL = () => {
  revokedUrls++;
};
w.TextEncoder = TextEncoder;
w.TextDecoder = TextDecoder;
w.structuredClone = structuredClone;
w.crypto.randomUUID = randomUUID;
w.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
w.HTMLDialogElement.prototype.close = function () {
  this.open = false;
};
w.fetch = async (url, opts = {}) => {
  const route = url.replace("/api", ""),
    method = opts.method || "GET",
    body = opts.body && JSON.parse(opts.body);
  let data = {};
  if (route === "/settings") {
    if (method === "PUT") config = body;
    data = config;
  } else if (route === "/setup/status") data = { required: setup };
  else if (route === "/setup") {
    assert.equal(body.setupToken, "x".repeat(64));
    assert.equal(body.password, "Clave-larga-12345");
    setup = false;
    data = { message: "Creado" };
  } else if (route === "/auth/login")
    data = { token: "a".repeat(64), email: "admin@example.com" };
  else if (/^\/quotes\/[a-f0-9]{24}$/.test(route))
    data = files.quotes.find((q) => q._id === route.split("/")[2]);
  else if (route.includes("/account"))
    data = {
      quotes: files.quotes.map((q) => ({
        ...q,
        paidCents: q.payments.reduce((s, p) => s + p.amountCents, 0),
        balanceCents:
          q.totalCents - q.payments.reduce((s, p) => s + p.amountCents, 0),
      })),
    };
  else if (route.endsWith("/payments")) {
    files.quotes[0].payments.push({
      _id: randomUUID(),
      ...body,
      amountCents: body.amount * 100,
      date: new Date().toISOString(),
    });
    data = files.quotes[0];
  } else {
    const type = route.split(/[/?]/)[1];
    if (method === "GET") {
      await new Promise((r) => setTimeout(r, 70));
      data = {
        items: files[type] || [],
        total: (files[type] || []).length,
        pages: 1,
        page: 1,
      };
    } else if (method === "POST") {
      assert.equal(type, "quotes");
      assert.equal(body.discountReason, "Promoción");
      const subtotal = Math.round(
        body.items[0].quantity * body.items[0].unitPrice * 100,
      );
      data = {
        ...body,
        _id: "b".repeat(24),
        number: "COT-000001",
        clientName: "Ana Pérez",
        createdAt: new Date().toISOString(),
        totalCents:
          subtotal - Math.round((subtotal * body.discountPercent) / 100),
        status: "Esperando autorización",
        payments: [],
        __v: 0,
      };
      files[type].push(data);
    }
  }
  return { ok: true, status: 200, json: async () => data };
};
const bundle = esbuild.buildSync({
  alias: { "socket.io-client": root + "/tests/socket-stub.js" },
  entryPoints: [root + "/client/src/main.jsx"],
  bundle: true,
  write: false,
  format: "iife",
  loader: { ".css": "empty" },
  define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
}).outputFiles[0].text;
w.eval(bundle);
const pause = () => new Promise((r) => setTimeout(r, 100));
const text = () => w.document.body.textContent;
const btn = (s) =>
  [...w.document.querySelectorAll("button")].find(
    (b) => b.textContent.trim() === s,
  );
function input(label, value) {
  const el = [...w.document.querySelectorAll("label")]
    .find((l) => l.textContent.trim().startsWith(label))
    ?.querySelector("input,select,textarea");
  assert.ok(el, "Campo " + label);
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(
    new w.Event(el.tagName === "SELECT" ? "change" : "input", {
      bubbles: true,
    }),
  );
}
function submit() {
  const form =
    w.document.querySelector("dialog[open] form") ||
    w.document.querySelector("form");
  form.dispatchEvent(
    new w.Event("submit", { bubbles: true, cancelable: true }),
  );
}
(async () => {
  await pause();
  assert.match(text(), /Crear administrador/);
  input("Correo electrónico", "admin@example.com");
  input("Contraseña", "Clave-larga-12345");
  input("Confirmar contraseña", "Clave-larga-12345");
  await pause();
  submit();
  await pause();
  assert.match(text(), /Administrador creado/);
  input("Contraseña", "Clave-larga-12345");
  await pause();
  submit();
  await pause();
  await pause();
  assert.match(text(), /Cotizaciones/);
  btn("＋ Nueva cotización").click();
  await pause();
  assert.match(text(), /Fecha actual/);
  assert.doesNotMatch(text(), /Fecha del cliente/);
  input("Nombre del cliente", "a".repeat(24));
  input("Nombre del evento", "Cumpleaños");
  input("Fecha del evento", "2027-04-15");
  input("Descripción", "Globos");
  input("Cantidad", "2");
  input("Precio MXN", "100");
  input("Descuento (%)", "10");
  input("Razón del descuento", "Promoción");
  await pause();
  assert.match(text(), /180\.00/);
  submit();
  await pause();
  await pause();
  assert.equal(files.quotes.length, 1);
  assert.match(text(), /COT-000001/);
  btn("Pagos / historial").click();
  await pause();
  await pause();
  assert.match(text(), /Cuenta de Ana Pérez/);
  input("Efectivo MXN", "20");
  input("Transferencia MXN", "30");
  await pause();
  submit();
  await pause();
  await pause();
  assert.match(text(), /Pago registrado/);
  assert.equal(files.quotes[0].payments[0].amountCents, 5000);
  assert.match(text(), /130\.00/);
  assert.match(text(), /Historial de pagos/);
  w.document.querySelector('dialog[open] button[aria-label="Cerrar"]').click();
  await pause();
  for (const section of [
    "Clientes",
    "Cotizaciones",
    "Clientes",
    "Invitados",
    "Cotizaciones",
    "Invitaciones",
    "Cotizaciones",
  ]) {
    btn(section).click();
    await pause();
    await pause();
    await pause();
    assert.ok(w.document.querySelector("h1").textContent === section);
    assert.doesNotMatch(text(), /No se pudo mostrar/);
  }
  for (const section of [
    "Clientes",
    "Cotizaciones",
    "Invitados",
    "Clientes",
    "Invitaciones",
    "Cotizaciones",
  ])
    btn(section).click();
  await pause();
  await pause();
  assert.equal(w.document.querySelector("h1").textContent, "Cotizaciones");
  assert.doesNotMatch(text(), /No se pudo mostrar/);
  btn("PDF").click();
  for (
    let tries = 0;
    tries < 20 && !w.document.querySelector("iframe");
    tries++
  )
    await pause();
  assert.ok(w.document.querySelector("iframe"), "El botón PDF abre el visor");
  assert.equal(createdPdfUrls, 1);
  w.document.querySelector('dialog[open] button[aria-label="Cerrar"]').click();
  await pause();
  assert.equal(revokedUrls, 1, "El visor libera la URL del PDF");
  btn("Ticket").click();
  for (let i = 0; i < 20 && !w.document.querySelector("iframe"); i++)
    await pause();
  assert.ok(w.document.querySelector("iframe"));
  w.document.querySelector('dialog[open] button[aria-label="Cerrar"]').click();
  await pause();
  assert.equal(createdPdfUrls, revokedUrls);
  files.quotes[0].title = "Evento actualizado remotamente";
  w.qaChanged({ resource: "quotes" });
  await pause();
  await pause();
  assert.match(text(), /Evento actualizado remotamente/);
  w.document
    .querySelector('button[aria-label="Cambiar modo claro u oscuro"]')
    .click();
  await pause();
  assert.equal(w.document.documentElement.dataset.theme, "dark");
  btn("Configuración").click();
  await pause();
  await pause();
  btn("Cotizaciones y tickets").click();
  input("Fuente", "times");
  input("Tamaño del texto", "12");
  await pause();
  submit();
  await pause();
  assert.equal(config.font, "times");
  assert.equal(config.fontSize, 12);
  assert.match(text(), /Configuración guardada/);
  btn("Programa").click();
  input("Nombre del programa", "Fiestas Ale");
  input("Eslogan del menú", "Eventos inolvidables");
  await pause();
  submit();
  await pause();
  assert.match(
    w.document.querySelector(".brand").textContent,
    /Fiestas AleEventos inolvidables/,
  );
  [...w.document.querySelectorAll(".settingtabs button")]
    .find((b) => b.textContent === "Invitaciones")
    .click();
  await pause();
  btn("Vista previa del diseño").click();
  for (let i = 0; i < 20 && !w.document.querySelector("iframe"); i++)
    await pause();
  assert.ok(w.document.querySelector("iframe"));
  w.document.querySelector('dialog[open] button[aria-label="Cerrar"]').click();
  await pause();
  assert.equal(createdPdfUrls, revokedUrls);
  assert.equal(uiErrors.length, 0, uiErrors.join(";"));
  console.log(
    "OK: registro, login, cotización sin ID material, pagos, navegación lenta/rápida configuración y apertura/liberación del PDF con API simulada.",
  );
  w.close();
})().catch((e) => {
  console.error(e);
  w.close();
  process.exitCode = 1;
});
