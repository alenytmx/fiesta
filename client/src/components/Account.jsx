/** @file Account — componente independiente de presentación e interacción. */
import React, { useEffect, useState, useRef, useId } from "react";
import { money, single } from "../lib/common.js";
import { useApp } from "../context/AppContext.jsx";
import PdfPreview from "./PdfPreview.jsx";
import Modal from "./Modal.jsx";
/**
 * Muestra saldos y registra pagos sin modificar el historial previo.
 * @param {object} props Propiedades del componente.
 * @returns {React.ReactElement} Vista del componente.
 */
export default function Account({ account, request, onChange, onClose }) {
  const { revision } = useApp();
  const [ticket, setTicket] = useState(null),
    [voiding, setVoiding] = useState(null),
    [reason, setReason] = useState("");
  const [cash, setCash] = useState(""),
    [transfer, setTransfer] = useState("");
  const [quotes, setQuotes] = useState([]),
    [selected, setSelected] = useState(account.quote || ""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(""),
    [kind, setKind] = useState("Anticipo"),
    [method, setMethod] = useState("Efectivo"),
    [note, setNote] = useState("");
  const requestId = useRef(crypto.randomUUID());
  /** @returns {Promise<void>} Recarga saldo e historial después de un movimiento o conflicto. */
  async function load() {
    setLoading(true);
    try {
      const result = await request("/clients/" + account.id + "/account");
      setQuotes(result.quotes);
      setSelected((s) =>
        result.quotes.some((q) => q._id === s)
          ? s
          : result.quotes[0]?._id || "",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [account.id, revision]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 10000);
    return () => clearTimeout(timer);
  }, [notice]);
  const quote = quotes.find((q) => q._id === selected);
  useEffect(() => {
    setKind(quote?.payments.some((p) => !p.voided) ? "Abono" : "Anticipo");
    setAmount("");
    setCash("");
    setTransfer("");
    setNote("");
    requestId.current = crypto.randomUUID();
  }, [selected, quote?.payments.length]);
  const history = quotes
    .flatMap((q) =>
      (q.payments || []).map((p) => ({
        ...p,
        quote: q.number,
        quoteId: q._id,
        version: q.__v,
        title: q.title,
      })),
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  return (
    <Modal
      title={"Cuenta de " + account.name}
      onClose={() => !busy && onClose()}
    >
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="alert success">
          {notice}
        </p>
      )}
      {loading ? (
        <p>Cargando cuenta…</p>
      ) : (
        <>
          <div className="accountsummary">
            <div>
              Total cotizado
              <strong>
                {money(
                  quotes
                    .filter((q) => q.status !== "Cancelada")
                    .reduce((s, q) => s + q.totalCents, 0),
                )}
              </strong>
            </div>
            <div>
              Pagos recibidos
              <strong>
                {money(quotes.reduce((s, q) => s + q.paidCents, 0))}
              </strong>
            </div>
            <div>
              Saldo pendiente
              <strong>
                {money(
                  quotes
                    .filter((q) => q.status !== "Cancelada")
                    .reduce((s, q) => s + q.balanceCents, 0),
                )}
              </strong>
            </div>
          </div>
          {quotes.length === 0 ? (
            <p>Este cliente aún no tiene cotizaciones.</p>
          ) : (
            <>
              <h3>Cotizaciones</h3>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>No. / evento</th>
                      <th>Total</th>
                      <th>Pagado</th>
                      <th>Saldo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((q) => (
                      <tr key={q._id}>
                        <td>
                          {q.number}
                          <small>{q.title}</small>
                        </td>
                        <td>{money(q.totalCents)}</td>
                        <td>{money(q.paidCents)}</td>
                        <td>{money(q.balanceCents)}</td>
                        <td>
                          {q.status}
                          <button
                            type="button"
                            onClick={() => setTicket(q._id)}
                          >
                            Ticket PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <form
                className="paymentform"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!quote) return;
                  setBusy(true);
                  setError("");
                  setNotice("");
                  try {
                    await request("/quotes/" + quote._id + "/payments", {
                      method: "POST",
                      body: JSON.stringify({
                        requestId: requestId.current,
                        kind,
                        amount:
                          (Math.round(Number(cash) * 100) +
                            Math.round(Number(transfer) * 100)) /
                          100,
                        method:
                          Number(cash) > 0 && Number(transfer) > 0
                            ? "Mixto"
                            : Number(cash) > 0
                              ? "Efectivo"
                              : "Transferencia",
                        parts: [
                          { method: "Efectivo", amount: Number(cash) },
                          { method: "Transferencia", amount: Number(transfer) },
                        ].filter((p) => p.amount > 0),
                        note,
                      }),
                    });
                    requestId.current = crypto.randomUUID();
                    setAmount("");
                    setCash("");
                    setTransfer("");
                    setNote("");
                    setNotice("Pago registrado.");
                    onChange();
                    await load();
                  } catch (e) {
                    setError(e.message);
                    await load();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <fieldset disabled={busy}>
                  <h3>Registrar pago</h3>
                  <label>
                    Cotización
                    <select
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      {quotes.map((q) => (
                        <option key={q._id} value={q._id}>
                          {q.number} · {q.title} · Saldo {money(q.balanceCents)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="formgrid">
                    <label>
                      Movimiento
                      <select
                        value={kind}
                        onChange={(e) => setKind(e.target.value)}
                      >
                        <option
                          disabled={!!quote?.payments.some((p) => !p.voided)}
                        >
                          Anticipo
                        </option>
                        <option>Abono</option>
                      </select>
                    </label>
                    <label>
                      Efectivo MXN
                      <input
                        aria-label="Efectivo MXN"
                        type="number"
                        min="0"
                        step="0.01"
                        value={cash}
                        onChange={(e) => setCash(e.target.value)}
                      />
                    </label>
                    <label>
                      Transferencia MXN
                      <input
                        aria-label="Transferencia MXN"
                        type="number"
                        min="0"
                        step="0.01"
                        value={transfer}
                        onChange={(e) => setTransfer(e.target.value)}
                      />
                    </label>
                    <p>
                      Total del pago:{" "}
                      {money(
                        Math.round(Number(cash) * 100) +
                          Math.round(Number(transfer) * 100),
                      )}
                    </p>
                    <label>
                      Nota / referencia
                      <input
                        maxLength={500}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </label>
                  </div>
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      !(Number(cash) + Number(transfer) > 0) ||
                      !quote ||
                      quote.balanceCents <= 0 ||
                      quote.status === "Cancelada"
                    }
                  >
                    {busy ? "Registrando…" : "Registrar " + kind.toLowerCase()}
                  </button>
                </fieldset>
              </form>
            </>
          )}
          <h3>Historial de pagos</h3>
          {history.length === 0 ? (
            <p className="muted">Todavía no hay anticipos ni abonos.</p>
          ) : (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cotización</th>
                    <th>Movimiento</th>
                    <th>Importe</th>
                    <th>Forma / nota</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((p) => (
                    <tr key={p._id}>
                      <td>{new Date(p.date).toLocaleString("es-MX")}</td>
                      <td>
                        {p.quote}
                        <small>{p.title}</small>
                      </td>
                      <td>
                        {p.kind}
                        {p.voided && <small>Anulado · {p.voidReason}</small>}
                      </td>
                      <td>{money(p.amountCents)}</td>
                      <td>
                        {(p.parts?.length
                          ? p.parts
                          : [{ method: p.method, amountCents: p.amountCents }]
                        ).map((part, i) => (
                          <small key={i}>
                            {part.method}: {money(part.amountCents)}
                          </small>
                        ))}
                        <small>{p.note}</small>
                        {!p.voided && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setVoiding(p);
                              setReason("");
                            }}
                          >
                            Anular pago
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {voiding && (
        <Modal title="Anular pago" onClose={() => !busy && setVoiding(null)}>
          <p>
            El movimiento permanecerá en el historial. Su importe volverá al
            saldo pendiente.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await request(
                  `/quotes/${voiding.quoteId}/payments/${voiding._id}/void`,
                  {
                    method: "POST",
                    body: JSON.stringify({ reason, version: voiding.version }),
                  },
                );
                setVoiding(null);
                onChange();
                await load();
              } catch (e) {
                setError(e.message);
                setVoiding(null);
                await load();
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Motivo de anulación
              <input
                required
                minLength={3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <button disabled={busy} className="danger">
              Confirmar anulación
            </button>
          </form>
        </Modal>
      )}
      {ticket && (
        <PdfPreview
          quoteId={ticket}
          documentType="ticket"
          request={request}
          onClose={() => setTicket(null)}
        />
      )}
    </Modal>
  );
}
