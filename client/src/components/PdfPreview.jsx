/** @file Vista PDF temporal con liberación explícita de URLs y recursos binarios. */
import React, { useEffect, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import Modal from "./Modal.jsx";

/**
 * Genera una vista previa; las descargas definitivas consultan la cotización vigente.
 * @param {{quoteId?:string,quote?:object,settings?:object,request:Function,onClose:Function}} props Datos o identificador.
 * @returns {React.ReactElement} Visor con enlace de apertura y descarga.
 */
export default function PdfPreview({
  quoteId,
  invitationId,
  invitation: invitationInitial,
  documentType = "quote",
  quote: initial,
  settings: override,
  request,
  onClose,
}) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [name, setName] = useState("cotizacion.pdf");
  useEffect(() => {
    let disposed = false,
      objectUrl;
    /** @returns {Promise<void>} Obtiene datos actuales, genera ArrayBuffer y crea una única URL temporal. */
    async function generate() {
      try {
        const { buildQuotePdf, loadReportAssets } =
          await import("../lib/report.js");
        const invitation =
          documentType === "invitation"
            ? invitationId
              ? await request("/invitations/" + invitationId + "/document")
              : invitationInitial
            : null;
        const quote =
          invitation?.quote ||
          (quoteId ? await request("/quotes/" + quoteId) : initial);
        const settings = override || (await request("/settings"));
        // Los tickets no necesitan fotos; las invitaciones cargan solo sus dos recursos.
        const assets =
          documentType === "ticket"
            ? new Map()
            : documentType === "invitation"
              ? await loadReportAssets(
                  {},
                  {
                    logo: settings.logo,
                    invitationImage: settings.invitationImage,
                  },
                  request,
                )
              : await loadReportAssets(quote, settings, request);
        if (disposed) return;
        const { buildTicketPdf, buildInvitationPdf } =
          await import("../lib/documents.js");
        const buffer =
          documentType === "ticket"
            ? buildTicketPdf(quote, settings)
            : documentType === "invitation"
              ? buildInvitationPdf(invitation, settings, assets)
              : buildQuotePdf(quote, settings, assets);
        assets.clear();
        objectUrl = URL.createObjectURL(
          new Blob([buffer], { type: "application/pdf" }),
        );
        if (disposed) URL.revokeObjectURL(objectUrl);
        else {
          setUrl(objectUrl);
          setName(
            documentType + "-" + (quote.number || "vista-previa") + ".pdf",
          );
        }
      } catch (e) {
        if (!disposed) setError(e.message);
      }
    }
    generate();
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    quoteId,
    invitationId,
    invitationInitial,
    documentType,
    initial,
    override,
    request,
  ]);
  return (
    <Modal
      title={
        documentType === "ticket"
          ? "Ticket térmico"
          : documentType === "invitation"
            ? "Invitación PDF"
            : "Reporte de cotización"
      }
      onClose={onClose}
    >
      {error ? (
        <p className="alert error" role="alert">
          {error}
        </p>
      ) : !url ? (
        <p role="status">Generando PDF…</p>
      ) : (
        <>
          <div className="pdfactions">
            <a
              className="buttonlink"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} /> Abrir PDF
            </a>
            <a className="buttonlink" href={url} download={name}>
              <Download size={16} /> Descargar
            </a>
          </div>
          <iframe
            title="Vista previa del reporte PDF"
            className="pdfviewer"
            src={url}
          />
        </>
      )}
    </Modal>
  );
}
