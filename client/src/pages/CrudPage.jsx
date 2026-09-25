/** @file Página CRUD con estado aislado por módulo y descarte de respuestas obsoletas. */
import { useApp } from "../context/AppContext.jsx";
import React, { useEffect, useState } from "react";
import { History, Pencil, Trash2, FileText, Receipt } from "lucide-react";
import { modules, single, money, fresh } from "../lib/common.js";
import Editor from "../components/Editor.jsx";
import Account from "../components/Account.jsx";
import Modal from "../components/Modal.jsx";
import PdfPreview from "../components/PdfPreview.jsx";
import { ROW_COMPONENTS } from "../components/ModuleRows.jsx";
/**
 * Monta un CRUD de tipo fijo. El padre desmonta esta instancia al navegar.
 * @param {{type:string,request:Function}} props Tipo de entidad y cliente HTTP autenticado.
 * @returns {React.ReactElement} Tabla, formulario y acciones del módulo.
 */
export default function CrudPage({ type, request }) {
  const section = type;
  const { revision, settings } = useApp();
  // Esta instancia pertenece a un solo tipo de entidad y se desmonta al cambiar de pantalla.
  const [rows, setRows] = useState([]),
    [refs, setRefs] = useState({ clients: [], quotes: [], guests: [] });
  const [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [edit, setEdit] = useState(null),
    [remove, setRemove] = useState(null),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0),
    [account, setAccount] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setRows([]);
    request(`/${section}?page=${page}`)
      .then((data) => {
        if (!cancelled) {
          if (page > data.pages) {
            setPage(data.pages);
            return;
          }
          setRows(data.items);
          setPages(data.pages);
          setTotal(data.total);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [request, section, page, refresh, revision]);
  useEffect(() => {
    let cancelled = false;
    /**
     * @param {string} type Entidad de referencia.
     * @returns {Promise<object[]>} Registros paginados para los selectores.
     */
    async function all(type) {
      const first = await request(`/${type}?limit=100`);
      let result = first.items;
      for (let i = 2; i <= first.pages; i++) {
        const next = await request(`/${type}?limit=100&page=${i}`);
        result = result.concat(next.items);
      }
      return result;
    }
    Promise.all(["clients", "quotes", "guests"].map(all))
      .then(([clients, quotes, guests]) => {
        if (!cancelled) setRefs({ clients, quotes, guests });
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [request, refresh, revision]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 10000);
    return () => clearTimeout(t);
  }, [notice]);
  const clientName = (id) =>
    refs.clients.find((x) => x._id === id)?.name || "Cliente no disponible";
  const quoteName = (id) =>
    refs.quotes.find((x) => x._id === id)?.title || "Cotización no disponible";
  const guestName = (id) =>
    refs.guests.find((x) => x._id === id)?.name || "Invitado no disponible";
  /**
   * @param {object} form Datos editables.
   * @returns {Promise<void>} Guarda y actualiza solo este módulo.
   */
  async function save(form) {
    setBusy(true);
    try {
      await request(`/${section}${edit.id ? "/" + edit.id : ""}`, {
        method: edit.id ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      setEdit(null);
      setNotice("Registro guardado.");
      setRefresh((x) => x + 1);
    } finally {
      setBusy(false);
    }
  }
  /** @returns {Promise<void>} Elimina tras confirmar y conserva visibles los errores de dependencias. */
  async function deleteRow() {
    setBusy(true);
    try {
      await request(`/${section}/${remove._id}`, { method: "DELETE" });
      setRemove(null);
      setNotice("Registro eliminado.");
      setRefresh((x) => x + 1);
    } catch (e) {
      setError(e.message);
      setRemove(null);
    } finally {
      setBusy(false);
    }
  }
  const Row = ROW_COMPONENTS[section];
  const [pdf, setPdf] = useState(null);
  const headers = {
    clients: ["Nombre completo", "Teléfono"],
    quotes: [
      "No. / evento",
      "Cliente",
      "Fecha actual / evento",
      "Estado",
      "Total / saldo",
    ],
    guests: ["Nombre", "Cliente", "Teléfono"],
    invitations: ["Invitado", "Cotización", "Lugares", "Estado"],
  }[section];
  return (
    <>
      {" "}
      <main>
        <div className="pageheading">
          <div>
            <p className="eyebrow">ADMINISTRACIÓN DE EVENTOS</p>
            <h1>{modules[section]}</h1>
          </div>
          <button
            className="primary"
            onClick={() => setEdit({ id: null, data: fresh(section) })}
          >
            ＋{" "}
            {section === "quotes"
              ? "Nueva cotización"
              : section === "invitations"
                ? "Nueva invitación"
                : "Nuevo " + single[section]}
          </button>
        </div>
        {error && (
          <div role="alert" className="alert error">
            {error}
            <button onClick={() => setRefresh((x) => x + 1)}>Reintentar</button>
          </div>
        )}
        {notice && (
          <div role="status" className="alert success">
            {notice}
          </div>
        )}
        <section
          className="panel"
          aria-label={`Listado de ${modules[section].toLowerCase()}`}
        >
          <div className="panelhead">
            <strong>Todos los registros</strong>
            <span>
              {total} {total === 1 ? "registro" : "registros"}
            </span>
          </div>
          {loading ? (
            <p className="empty" role="status">
              Cargando registros…
            </p>
          ) : rows.length === 0 ? (
            <div className="empty">
              <div className="emptyicon">＋</div>
              <h2>Aún no hay {modules[section].toLowerCase()}</h2>
              <p>Agrega tu primer registro para comenzar.</p>
            </div>
          ) : (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    {headers.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                    <th className="actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row._id}>
                      <Row
                        row={row}
                        clientName={clientName}
                        quoteName={quoteName}
                        guestName={guestName}
                        onStatus={async (row, status) => {
                          try {
                            await request("/quotes/" + row._id + "/status", {
                              method: "PUT",
                              body: JSON.stringify({
                                status,
                                version: row.__v ?? 0,
                              }),
                            });
                            setRefresh((n) => n + 1);
                          } catch (e) {
                            setError(e.message);
                            setRefresh((n) => n + 1);
                          }
                        }}
                      />
                      <td className="actions">
                        {section === "quotes" && (
                          <button
                            className="textbutton"
                            onClick={() =>
                              setPdf({ ...row, documentType: "quote" })
                            }
                          >
                            <FileText size={16} /> PDF
                          </button>
                        )}
                        {section === "quotes" && (
                          <button
                            className="textbutton"
                            onClick={() =>
                              setPdf({ ...row, documentType: "ticket" })
                            }
                          >
                            <Receipt size={16} /> Ticket
                          </button>
                        )}
                        {section === "invitations" && (
                          <button
                            className="textbutton"
                            onClick={() =>
                              setPdf({ ...row, documentType: "invitation" })
                            }
                          >
                            <FileText size={16} /> Invitación PDF
                          </button>
                        )}
                        {["clients", "quotes"].includes(section) && (
                          <button
                            className="textbutton"
                            onClick={() =>
                              setAccount({
                                id:
                                  section === "clients" ? row._id : row.client,
                                name:
                                  section === "clients"
                                    ? row.name
                                    : clientName(row.client),
                                quote: section === "quotes" ? row._id : "",
                              })
                            }
                          >
                            <History size={16} /> Pagos / historial
                          </button>
                        )}
                        <button
                          className="textbutton"
                          onClick={() => {
                            const data = fresh(section);
                            for (const key of Object.keys(data))
                              data[key] = row[key] ?? data[key];
                            if (data.items) {
                              data.items = data.items.map(
                                ({ description, quantity, unitPrice }) => ({
                                  description,
                                  quantity,
                                  unitPrice,
                                }),
                              );
                              data.version = row.__v ?? 0;
                            }
                            setEdit({
                              id: row._id,
                              data,
                              number: row.number,
                              createdAt: row.createdAt,
                              payments: row.payments || [],
                            });
                          }}
                        >
                          <Pencil size={16} /> Ver / editar
                        </button>
                        <button
                          className="textbutton danger"
                          aria-label={`Eliminar ${row.name || row.title || guestName(row.guest)}`}
                          onClick={() => setRemove(row)}
                        >
                          <Trash2 size={16} /> Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <footer className="pagination">
            <span>
              Página {page} de {pages}
            </span>
            <div>
              <button
                disabled={page === 1 || loading}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </button>
              <button
                disabled={page === pages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          </footer>
        </section>
        <p className="footnote">
          {settings?.programName} · Gestión de clientes y cotizaciones
        </p>
      </main>
      {pdf && (
        <PdfPreview
          quoteId={pdf.documentType === "invitation" ? undefined : pdf._id}
          invitationId={pdf.documentType === "invitation" ? pdf._id : undefined}
          documentType={pdf.documentType}
          request={request}
          onClose={() => setPdf(null)}
        />
      )}
      {edit && (
        <Editor
          type={section}
          initial={edit.data}
          title={(edit.id ? "Editar " : "Crear ") + single[section]}
          refs={refs}
          request={request}
          number={edit.number}
          createdAt={edit.createdAt}
          payments={edit.payments || []}
          busy={busy}
          onClose={() => setEdit(null)}
          onSave={save}
        />
      )}
      {account && (
        <Account
          account={account}
          request={request}
          onChange={() => setRefresh((x) => x + 1)}
          onClose={() => setAccount(null)}
        />
      )}
      {remove && (
        <Modal
          title="Eliminar registro"
          onClose={() => !busy && setRemove(null)}
        >
          <p>
            ¿Quieres eliminar este registro? Dejará de aparecer en el sistema.
          </p>
          <p className="muted">
            Si tiene registros relacionados, tendrás que eliminarlos primero.
          </p>
          <div className="formactions">
            <button disabled={busy} onClick={() => setRemove(null)}>
              Cancelar
            </button>
            <button className="destructive" disabled={busy} onClick={deleteRow}>
              {busy ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
