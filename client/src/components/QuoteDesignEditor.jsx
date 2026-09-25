/** @file Edición visual específica de una cotización y sus cuatro secciones de reporte. */
import React, { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import ImagePicker from "./ImagePicker.jsx";
import PhotoEditor from "./PhotoEditor.jsx";
import PdfPreview from "./PdfPreview.jsx";
import {
  DEFAULT_REPORT,
  DEFAULT_CROP,
} from "../../../shared/report-defaults.js";
/**
 * Edita referencia, tres detalles titulados, resultado final y marcos particulares.
 * @param {object} props Datos del formulario, asignador y cliente HTTP.
 * @returns {React.ReactElement} Editor de imágenes y acceso a la vista previa real del PDF.
 */
export default function QuoteDesignEditor({
  data,
  set,
  request,
  onBusy,
  number,
  createdAt,
  payments = [],
  clientName,
}) {
  const [settings, setSettings] = useState(DEFAULT_REPORT),
    [preview, setPreview] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    request("/settings")
      .then((s) => {
        if (active) setSettings(s);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [request]);
  const ids = data.materialImages || [];
  return (
    <section className="designsection">
      <h3>Diseño del reporte</h3>
      {error && <p className="alert error">{error}</p>}
      <ImagePicker
        title="Imagen de referencia — página 2"
        ids={data.referenceImage ? [data.referenceImage] : []}
        max={1}
        request={request}
        onChange={(ids) => set("referenceImage", ids[0] || null)}
        onBusy={onBusy}
      />
      <PhotoEditor
        id={data.referenceImage}
        crop={data.referenceCrop}
        width={settings.referenceWidth}
        height={settings.referenceHeight}
        request={request}
        onChange={(crop) => set("referenceCrop", crop)}
      />
      <ImagePicker
        title="Tres imágenes de materiales — página 2"
        ids={ids}
        max={3}
        request={request}
        onChange={(next) => {
          const old = ids;
          set("materialImages", next);
          set(
            "materialTitles",
            next.map((id) => data.materialTitles?.[old.indexOf(id)] || ""),
          );
          set(
            "materialCrops",
            next.map(
              (id) =>
                data.materialCrops?.[old.indexOf(id)] || { ...DEFAULT_CROP },
            ),
          );
        }}
        onBusy={onBusy}
      />
      {ids.length > 3 && (
        <p className="muted">
          Esta cotización antigua conserva {ids.length} fotos. El PDF utiliza
          las tres primeras; quita las que no quieras incluir para cambiar la
          selección.
        </p>
      )}
      {ids.slice(0, 3).map((id, i) => (
        <div className="detailphoto" key={id}>
          <label>
            Título de imagen {i + 1}
            <input
              maxLength={100}
              value={data.materialTitles?.[i] || ""}
              onChange={(e) => {
                const titles = ids.map(
                  (_, n) => data.materialTitles?.[n] || "",
                );
                titles[i] = e.target.value;
                set("materialTitles", titles);
              }}
            />
          </label>
          <PhotoEditor
            id={id}
            request={request}
            width={54}
            height={35}
            crop={data.materialCrops?.[i]}
            onChange={(crop) => {
              const crops = ids.map(
                (_, n) => data.materialCrops?.[n] || { ...DEFAULT_CROP },
              );
              crops[i] = crop;
              set("materialCrops", crops);
            }}
          />
        </div>
      ))}
      <ImagePicker
        title="Resultado final — página 3"
        ids={data.finalImage ? [data.finalImage] : []}
        max={1}
        request={request}
        onChange={(ids) => set("finalImage", ids[0] || null)}
        onBusy={onBusy}
      />
      <PhotoEditor
        id={data.finalImage}
        crop={data.finalCrop}
        width={settings.finalWidth}
        height={settings.finalHeight}
        request={request}
        onChange={(crop) => set("finalCrop", crop)}
      />
      <label className="checklabel">
        <input
          type="checkbox"
          checked={!!data.customFrames}
          onChange={(e) => set("customFrames", e.target.checked)}
        />
        Usar marcos personalizados para esta cotización
      </label>
      {data.customFrames && (
        <div className="formgrid">
          {[
            ["frameTop", "Marco superior"],
            ["frameBottom", "Marco inferior"],
          ].map(([key, title]) => (
            <ImagePicker
              key={key}
              title={title}
              ids={data[key] ? [data[key]] : []}
              max={1}
              request={request}
              onChange={(ids) => set(key, ids[0] || null)}
              onBusy={onBusy}
            />
          ))}
        </div>
      )}
      <p className="muted">
        La fuente, los tamaños, la posición de las fotos, la firma y la dinámica
        de contratación se editan en Configuración. La vista previa incluye los
        cambios del formulario; guárdalos antes de emitir el PDF definitivo.
      </p>
      <button
        type="button"
        onClick={() =>
          setPreview({
            ...data,
            payments,
            clientName,
            number: number || "BORRADOR",
            createdAt: createdAt || new Date().toISOString(),
          })
        }
      >
        <FileText size={16} /> Vista previa de las cuatro páginas
      </button>
      {preview && (
        <PdfPreview
          quote={preview}
          settings={settings}
          request={request}
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  );
}
