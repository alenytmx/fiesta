/** @file Editor — componente independiente de presentación e interacción. */
import React, { useEffect, useState, useRef, useId } from "react";
import { money, single } from "../lib/common.js";
import QuoteDesignEditor from "./QuoteDesignEditor.jsx";
import Modal from "./Modal.jsx";
import ImagePicker from "./ImagePicker.jsx";
/**
 * Edita un registro y comunica al padre exclusivamente sus datos validados.
 * @param {object} props Propiedades del componente.
 * @returns {React.ReactElement} Vista del componente.
 */
export default function Editor({
  type,
  initial,
  title,
  refs,
  request,
  number,
  createdAt,
  payments = [],
  busy,
  onClose,
  onSave,
}) {
  const [data, setData] = useState(() => structuredClone(initial)),
    [error, setError] = useState(""),
    [uploading, setUploading] = useState(false);
  const subtotal = (data.items || []).reduce(
    (sum, i) =>
      sum + Math.round(Number(i.unitPrice) * 100) * Number(i.quantity),
    0,
  );
  const discount = Math.round(
    (subtotal * Math.round(Number(data.discountPercent || 0) * 100)) / 10000,
  );
  const set = (key, value) => setData((d) => ({ ...d, [key]: value }));
  const input = (key, label, kind = "text", required = false) => (
    <label>
      {label}
      <input
        type={kind}
        value={data[key]}
        maxLength={key === "email" ? 254 : key === "phone" ? 40 : 200}
        required={required}
        onChange={(e) => set(key, e.target.value)}
      />
    </label>
  );
  const select = (key, label, options, changed) => (
    <label>
      {label}
      <select
        required
        value={data[key]}
        onChange={(e) => {
          set(key, e.target.value);
          changed?.(e.target.value);
        }}
      >
        <option value="">Selecciona una opción</option>
        {options.map((x) => (
          <option key={x.value} value={x.value}>
            {x.label}
          </option>
        ))}
      </select>
    </label>
  );
  const clientOptions = refs.clients.map((x) => ({
    value: x._id,
    label: x.name,
  }));
  const selectedQuote = refs.quotes.find((x) => x._id === data.quote);
  const guestOptions = refs.guests
    .filter((x) => selectedQuote && x.client === selectedQuote.client)
    .map((x) => ({ value: x._id, label: x.name }));
  const statuses = ["Pendiente", "Enviada", "Confirmada", "Declinada"];
  return (
    <Modal title={title} onClose={() => !busy && !uploading && onClose()}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await onSave(data);
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        <fieldset disabled={busy || uploading}>
          {error && (
            <div role="alert" className="alert error">
              {error}
            </div>
          )}
          {type === "quotes" && (
            <div className="quoteidentity">
              <div>
                <small>No. cotización</small>
                <strong>{number || "Asignado al guardar"}</strong>
              </div>
              <div>
                <small>Fecha actual</small>
                <strong>
                  {new Date(createdAt || Date.now()).toLocaleDateString(
                    "es-MX",
                    { day: "2-digit", month: "long", year: "numeric" },
                  )}
                </strong>
              </div>
            </div>
          )}
          {["guests", "quotes"].includes(type) &&
            select("client", "Nombre del cliente", clientOptions)}
          {type === "clients" && (
            <div className="formgrid">
              {input("firstNames", "Nombre(s)", "text", true)}
              {input("paternalSurname", "Apellido paterno")}
              {input("maternalSurname", "Apellido materno")}
              {input("phone", "Teléfono", "tel")}
            </div>
          )}
          {type === "guests" && (
            <div className="formgrid">
              {input("name", "Nombre completo", "text", true)}
              {input("phone", "Teléfono", "tel")}
            </div>
          )}
          {type === "quotes" && (
            <>
              <div className="formgrid">
                {input("title", "Nombre del evento", "text", true)}
                {input("eventDate", "Fecha del evento", "date", true)}
                {input("venue", "Lugar")}
              </div>
              <div className="lineheading">
                <h3>Materiales</h3>
                <button
                  type="button"
                  disabled={data.items.length >= 100}
                  onClick={() =>
                    set("items", [
                      ...data.items,
                      { description: "", quantity: 1, unitPrice: 0 },
                    ])
                  }
                >
                  ＋ Agregar material
                </button>
              </div>
              {data.items.map((item, index) => (
                <div className="lineitem" key={index}>
                  <label>
                    Descripción
                    <input
                      required
                      maxLength={200}
                      value={item.description}
                      onChange={(e) =>
                        set(
                          "items",
                          data.items.map((v, i) =>
                            i === index
                              ? { ...v, description: e.target.value }
                              : v,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Cantidad
                    <input
                      type="number"
                      required
                      min="1"
                      max="100000"
                      step="1"
                      value={item.quantity}
                      onChange={(e) =>
                        set(
                          "items",
                          data.items.map((v, i) =>
                            i === index
                              ? {
                                  ...v,
                                  quantity:
                                    e.target.value === ""
                                      ? ""
                                      : Number(e.target.value),
                                }
                              : v,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Precio MXN
                    <input
                      type="number"
                      required
                      min="0"
                      max="10000000"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) =>
                        set(
                          "items",
                          data.items.map((v, i) =>
                            i === index
                              ? {
                                  ...v,
                                  unitPrice:
                                    e.target.value === ""
                                      ? ""
                                      : Number(e.target.value),
                                }
                              : v,
                          ),
                        )
                      }
                    />
                  </label>
                  <div className="linetotal">
                    <small>Total</small>
                    <strong>
                      {money(
                        Math.round(Number(item.unitPrice) * 100) *
                          Number(item.quantity),
                      )}
                    </strong>
                  </div>
                  <button
                    type="button"
                    className="danger"
                    disabled={data.items.length === 1}
                    aria-label={`Quitar material ${index + 1}`}
                    onClick={() =>
                      set(
                        "items",
                        data.items.filter((_, i) => i !== index),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}

              <div className="formgrid">
                <label>
                  Descuento (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    required
                    value={data.discountPercent}
                    onChange={(e) =>
                      set(
                        "discountPercent",
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                  />
                </label>
                <label>
                  Razón del descuento
                  <input
                    maxLength={500}
                    required={Number(data.discountPercent) > 0}
                    value={data.discountReason}
                    onChange={(e) => set("discountReason", e.target.value)}
                  />
                </label>
              </div>
              <div className="quotetotals">
                <div>
                  Subtotal <strong>{money(subtotal)}</strong>
                </div>
                <div>
                  Descuento ({data.discountPercent || 0}%){" "}
                  <strong>− {money(discount)}</strong>
                </div>
                <div className="grandtotal">
                  Total <strong>{money(subtotal - discount)}</strong>
                </div>
              </div>
              <label>
                Elementos de la decoración
                <textarea
                  rows="4"
                  maxLength={5000}
                  placeholder="Arco de globos, fondo, colores, flores…"
                  value={data.decorationElements}
                  onChange={(e) => set("decorationElements", e.target.value)}
                />
              </label>
              <QuoteDesignEditor
                data={data}
                set={set}
                request={request}
                onBusy={setUploading}
                number={number}
                createdAt={createdAt}
                payments={payments}
                clientName={
                  refs.clients.find((c) => c._id === data.client)?.name
                }
              />
              {uploading && <p role="status">Guardando imagen…</p>}
            </>
          )}
          {type === "invitations" && (
            <>
              {select(
                "quote",
                "Cotización / evento",
                refs.quotes.map((x) => ({
                  value: x._id,
                  label:
                    x.title +
                    " · " +
                    (refs.clients.find((c) => c._id === x.client)?.name || ""),
                })),
                () => set("guest", ""),
              )}
              {select("guest", "Invitado", guestOptions)}
              <p className="muted">
                Se muestran los invitados del cliente de la cotización.
              </p>
              <div className="formgrid">
                {select(
                  "status",
                  "Estado",
                  statuses.map((x) => ({ value: x, label: x })),
                )}
                <label>
                  Lugares
                  <input
                    type="number"
                    required
                    min="1"
                    max="100"
                    value={data.seats}
                    onChange={(e) =>
                      set(
                        "seats",
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                  />
                </label>
              </div>
            </>
          )}
          <label>
            Notas
            <textarea
              rows="3"
              maxLength={3000}
              value={data.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </label>
          <div className="formactions">
            <button type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary">
              {busy || uploading ? "Guardando…" : "Guardar " + single[type]}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
