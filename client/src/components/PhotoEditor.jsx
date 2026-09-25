/** @file Editor de encuadre: comparte geometría con el generador PDF. */
import React, { useEffect, useState } from "react";
import { DEFAULT_CROP, imageBox } from "../../../shared/report-defaults.js";
/**
 * Muestra el resultado del ajuste de escala, anclaje y recorte de una fotografía.
 * @param {{id:string,request:Function,crop:object,onChange:Function,width?:number,height?:number}} props Encuadre.
 * @returns {React.ReactElement|null} Editor de foto con controles accesibles.
 */
export default function PhotoEditor({
  id,
  request,
  crop,
  onChange,
  width = 86,
  height = 95,
}) {
  const [src, setSrc] = useState(""),
    [natural, setNatural] = useState(null),
    [error, setError] = useState("");
  const c = { ...DEFAULT_CROP, ...crop };
  useEffect(() => {
    let disposed = false,
      url;
    setSrc("");
    setNatural(null);
    setError("");
    if (!id) return;
    request("/images/" + id, { blob: true })
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (disposed) URL.revokeObjectURL(url);
        else setSrc(url);
      })
      .catch((e) => {
        if (!disposed) setError(e.message);
      });
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, request]);
  if (!id) return null;
  const r = natural
    ? imageBox(natural.width, natural.height, width, height, c)
    : { x: 0, y: 0, width, height };
  return (
    <div className="photoeditor">
      {error && <p role="alert">{error}</p>}
      <div className="cropframe" style={{ aspectRatio: `${width}/${height}` }}>
        {src && (
          <img
            alt="Encuadre que se usará en el PDF"
            src={src}
            onLoad={(e) =>
              setNatural({
                width: e.currentTarget.naturalWidth,
                height: e.currentTarget.naturalHeight,
              })
            }
            style={{
              position: "absolute",
              maxWidth: "none",
              width: `${(r.width / width) * 100}%`,
              height: `${(r.height / height) * 100}%`,
              left: `${(r.x / width) * 100}%`,
              top: `${(r.y / height) * 100}%`,
            }}
          />
        )}
      </div>
      <div className="cropcontrols">
        <label>
          Ajuste
          <select
            value={c.fit}
            onChange={(e) => onChange({ ...c, fit: e.target.value })}
          >
            <option value="contain">Mostrar foto completa</option>
            <option value="cover">Llenar y recortar</option>
          </select>
        </label>
        {[
          ["zoom", "Acercamiento", 1, 3, 0.05],
          ["x", "Anclaje horizontal", 0, 100, 1],
          ["y", "Anclaje vertical", 0, 100, 1],
        ].map(([key, label, min, max, step]) => (
          <label key={key}>
            {label}: {c[key]}
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={c[key]}
              onChange={(e) =>
                onChange({ ...c, [key]: Number(e.target.value) })
              }
            />
          </label>
        ))}
        <button type="button" onClick={() => onChange({ ...DEFAULT_CROP })}>
          Restablecer encuadre
        </button>
      </div>
    </div>
  );
}
