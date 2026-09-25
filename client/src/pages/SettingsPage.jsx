/** @file Configuración persistente de identidad, tipografía, posiciones y textos del reporte. */
import React, { useEffect, useState, useRef } from "react";
import { Save, FileText, MapPin } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";
import { Facebook, Instagram } from "../components/SocialIcon.jsx";
import ImagePicker from "../components/ImagePicker.jsx";
import PdfPreview from "../components/PdfPreview.jsx";
import { DEFAULT_REPORT } from "../../../shared/report-defaults.js";
/** @type {Readonly<object>} Cotización ficticia solo para la vista previa del editor. */
const SAMPLE = Object.freeze({
  number: "COT-EJEMPLO",
  clientName: "Cliente de ejemplo",
  createdAt: new Date().toISOString(),
  eventDate: "2027-06-01",
  items: [
    { description: "Decoración del evento", quantity: 1, unitPrice: 5030 },
  ],
  subtotalCents: 503000,
  discountPercent: 10,
  discountReason: "POLICÍA MUNICIPAL",
  discountCents: 50300,
  totalCents: 452700,
  payments: [
    { date: "2026-06-01T12:00:00Z", amountCents: 50000 },
    { date: "2026-07-06T12:00:00Z", amountCents: 200000 },
  ],
  decorationElements:
    "Describe aquí los elementos de la decoración. Las imágenes reales se seleccionan dentro de cada cotización.",
  materialTitles: ["Globos", "Decoración", "Accesorios"],
});
/**
 * @param {{request:Function}} props Cliente autenticado.
 * @returns {React.ReactElement} Editor de configuración.
 */
export default function SettingsPage({ request }) {
  const { refreshSettings, revision } = useApp();
  const dirty = useRef(false);
  const [tab, setTab] = useState("general");
  const formRef = useRef();
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [preview, setPreview] = useState(null),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (dirty.current) return;
    let active = true;
    request("/settings")
      .then((s) => {
        if (active) {
          setData({ ...DEFAULT_REPORT, ...s });
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [request, retry, revision]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 10000);
    return () => clearTimeout(t);
  }, [notice]);
  /** Actualiza un campo sin mutar el objeto previo de React. */
  const set = (key, value) => {
    dirty.current = true;
    setData((d) => ({ ...d, [key]: value }));
  };
  if (!data)
    return (
      <main>
        <h1>Configuración</h1>
        {error ? <p role="alert">{error}</p> : <p>Cargando configuración…</p>}
        <button onClick={() => setRetry((x) => x + 1)}>Reintentar</button>
      </main>
    );
  /** Renderiza un selector de posiciones acotadas al área de contenido. */
  const choice = (key, label, options) => (
    <label>
      {label}
      <select value={data[key]} onChange={(e) => set(key, e.target.value)}>
        {options.map(([value, name]) => (
          <option key={value} value={value}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
  /** Renderiza una medida en milímetros o puntos, con límites coincidentes con la API. */
  const number = (key, label, min, max) => (
    <label>
      {label}
      <input
        required
        type="number"
        min={min}
        max={max}
        step="1"
        value={data[key]}
        onChange={(e) => set(key, Number(e.target.value))}
      />
    </label>
  );
  return (
    <main>
      <div className="pageheading">
        <div>
          <p className="eyebrow">DISEÑO DE DOCUMENTOS</p>
          <h1>Configuración</h1>
        </div>
        <button
          disabled={busy || uploading}
          onClick={() => {
            if (!formRef.current.reportValidity()) return;
            if (
              data.finalX + data.finalWidth > 192 ||
              data.finalY + data.finalHeight > 255
            ) {
              setError(
                "La imagen final debe quedar dentro del área imprimible.",
              );
              return;
            }
            setPreview(structuredClone(data));
          }}
        >
          <FileText size={18} /> Vista previa del diseño
        </button>
      </div>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="alert success" role="status">
          {notice}
        </p>
      )}
      <nav className="settingtabs" aria-label="Apartados de configuración">
        {[
          ["general", "Programa"],
          ["quotes", "Cotizaciones y tickets"],
          ["invitations", "Invitaciones"],
        ].map(([key, label]) => (
          <button
            type="button"
            className={tab === key ? "active" : ""}
            key={key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      <form
        ref={formRef}
        className="panel settingspanel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setNotice("");
          try {
            const saved = await request("/settings", {
              method: "PUT",
              body: JSON.stringify(data),
            });
            dirty.current = false;
            setData(saved);
            refreshSettings(saved);
            setNotice(
              "Configuración guardada. Se aplicará a los siguientes PDF.",
            );
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy || uploading}>
          <section hidden={tab !== "general"}>
            <h2>Identidad del programa</h2>
            <div className="formgrid">
              {[
                ["programName", "Nombre del programa", 60],
                ["loginSlogan", "Eslogan del login", 180],
                ["menuSlogan", "Eslogan del menú", 80],
                ["rfc", "RFC", 13],
              ].map(([key, label, max]) => (
                <label key={key}>
                  {label}
                  <input
                    required={key === "programName"}
                    maxLength={max}
                    value={data[key]}
                    onChange={(e) =>
                      set(
                        key,
                        key === "rfc"
                          ? e.target.value.toUpperCase()
                          : e.target.value,
                      )
                    }
                  />
                </label>
              ))}
              {choice("theme", "Tema predeterminado", [
                ["light", "Claro"],
                ["dark", "Oscuro"],
                ["system", "Según el dispositivo"],
              ])}
              {[
                ["primaryColor", "Color del programa"],
                ["titleColor", "Color de títulos"],
                ["tableColor", "Color de tablas"],
                ["indicatorColor", "Color de indicadores"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="color"
                    value={data[key]}
                    onChange={(e) => set(key, e.target.value)}
                  />
                </label>
              ))}
              <ImagePicker
                title="Logo del programa, login y documentos"
                ids={data.logo ? [data.logo] : []}
                max={1}
                request={request}
                onBusy={setUploading}
                onChange={(ids) => set("logo", ids[0] || null)}
              />
            </div>
          </section>
          <section hidden={tab !== "quotes"}>
            <h2>Tickets de impresora térmica</h2>
            <label>
              Ancho del papel
              <select
                value={data.ticketWidth}
                onChange={(e) => set("ticketWidth", Number(e.target.value))}
              >
                <option value={58}>58 mm</option>
                <option value={80}>80 mm</option>
              </select>
            </label>
            <label>
              Mensaje del ticket
              <input
                maxLength={300}
                value={data.ticketMessage}
                onChange={(e) => set("ticketMessage", e.target.value)}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={data.showRfcOnQuote}
                onChange={(e) => set("showRfcOnQuote", e.target.checked)}
              />{" "}
              Mostrar RFC también en la cotización
            </label>
            <p className="muted">
              El RFC configurado aparece en los tickets. Imprime al 100 % del
              tamaño, sin márgenes adicionales.
            </p>
            <h2>Fuente y tamaño</h2>
            <div className="formgrid">
              {choice("font", "Fuente", [
                ["helvetica", "Helvetica"],
                ["times", "Times"],
                ["courier", "Courier"],
              ])}
              {number("fontSize", "Tamaño del texto (puntos)", 8, 14)}
              <label>
                Color principal
                <input
                  type="color"
                  value={data.accent}
                  onChange={(e) => set("accent", e.target.value)}
                />
              </label>
            </div>
            <h2>Logo, firma y marcos</h2>
            <div className="formgrid">
              {[
                ["signature", "Firma"],
                ["frameTop", "Marco superior predeterminado"],
                ["frameBottom", "Marco inferior predeterminado"],
              ].map(([key, title]) => (
                <ImagePicker
                  key={key}
                  title={title}
                  ids={data[key] ? [data[key]] : []}
                  max={1}
                  request={request}
                  onBusy={setUploading}
                  onChange={(ids) => set(key, ids[0] || null)}
                />
              ))}
            </div>
            <p className="muted">
              Los marcos ocupan franjas de 210 × 20 mm arriba y abajo. Puedes
              reemplazarlos para una cotización desde su formulario.
            </p>
            <h2>Posición de imágenes en el PDF</h2>
            <div className="formgrid">
              {choice("logoSide", "Ubicación del logo", [
                ["right", "Derecha"],
                ["left", "Izquierda"],
              ])}
              {choice("signatureAlign", "Ubicación de la firma", [
                ["right", "Derecha"],
                ["center", "Centro"],
                ["left", "Izquierda"],
              ])}
              {choice("referenceSide", "Ubicación de la referencia", [
                ["left", "Izquierda del texto"],
                ["right", "Derecha del texto"],
              ])}
              {number(
                "referenceY",
                "Referencia: posición vertical (mm)",
                48,
                75,
              )}
              {number("referenceWidth", "Referencia: ancho (mm)", 60, 95)}
              {number("referenceHeight", "Referencia: alto (mm)", 50, 110)}
              {number("finalX", "Resultado: posición horizontal (mm)", 18, 130)}
              {number("finalY", "Resultado: posición vertical (mm)", 48, 180)}
              {number("finalWidth", "Resultado: ancho (mm)", 40, 174)}
              {number("finalHeight", "Resultado: alto (mm)", 40, 207)}
            </div>
            <p className="muted">
              El resultado debe caber antes de los 192 mm horizontales y 255 mm
              verticales. La vista previa muestra el PDF real. El encuadre de
              cada foto se ajusta dentro de Cotizaciones.
            </p>
            <h2>Facebook, Instagram y ubicación</h2>
            <div className="socialsettings">
              {[
                ["facebook", "Facebook", Facebook],
                ["instagram", "Instagram", Instagram],
                ["location", "Ubicación", MapPin],
              ].map(([key, label, Icon]) => (
                <label key={key}>
                  <Icon size={18} />
                  {label}
                  <input
                    maxLength={key === "location" ? 160 : 100}
                    value={data[key]}
                    onChange={(e) => set(key, e.target.value)}
                  />
                </label>
              ))}
            </div>{" "}
            <h2>Textos del reporte</h2>
            <label>
              Notas y condiciones de la cotización
              <textarea
                rows="6"
                maxLength={3000}
                value={data.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </label>
            <label>
              Dinámica de contratación — página 4
              <textarea
                rows="10"
                maxLength={12000}
                value={data.contracting}
                onChange={(e) => set("contracting", e.target.value)}
              />
            </label>
          </section>
          <section hidden={tab !== "invitations"}>
            <h2>Diseño de invitaciones</h2>
            <div className="formgrid">
              {[
                ["invitationTitle", "Título", 100],
                ["invitationMessage", "Mensaje", 1200],
                ["invitationFooter", "Pie de invitación", 500],
              ].map(([key, label, max]) => (
                <label key={key}>
                  {label}
                  <textarea
                    maxLength={max}
                    value={data[key]}
                    onChange={(e) => set(key, e.target.value)}
                  />
                </label>
              ))}
              {choice("invitationFont", "Fuente", [
                ["helvetica", "Helvetica"],
                ["times", "Times"],
                ["courier", "Courier"],
              ])}
              {number("invitationFontSize", "Tamaño de letra", 10, 20)}
              <label>
                Color de invitaciones
                <input
                  type="color"
                  value={data.invitationAccent}
                  onChange={(e) => set("invitationAccent", e.target.value)}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={data.showRfcOnInvitation}
                  onChange={(e) => set("showRfcOnInvitation", e.target.checked)}
                />{" "}
                Mostrar RFC en invitaciones
              </label>
              <ImagePicker
                title="Imagen de la invitación"
                ids={data.invitationImage ? [data.invitationImage] : []}
                max={1}
                request={request}
                onBusy={setUploading}
                onChange={(ids) => set("invitationImage", ids[0] || null)}
              />
            </div>
          </section>
          <div className="formactions">
            <button className="primary">
              <Save size={18} />
              {busy ? "Guardando…" : "Guardar configuración"}
            </button>
          </div>
        </fieldset>
      </form>
      {preview && (
        <PdfPreview
          documentType={tab === "invitations" ? "invitation" : "quote"}
          invitation={{
            invitation: { seats: 2 },
            guest: { name: "Invitado de ejemplo" },
            quote: {
              ...SAMPLE,
              title: "Nuestra celebración",
              venue: "Salón de eventos",
            },
          }}
          quote={SAMPLE}
          settings={preview}
          request={request}
          onClose={() => setPreview(null)}
        />
      )}
    </main>
  );
}
