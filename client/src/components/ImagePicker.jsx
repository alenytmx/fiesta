/** @file ImagePicker — componente independiente de presentación e interacción. */
import React, { useEffect, useState, useRef, useId } from "react";
import { money, single } from "../lib/common.js";
import PrivateImage from "./PrivateImage.jsx";
/**
 * Sube fotografías limitadas y comunica sus identificadores persistentes.
 * @param {object} props Propiedades del componente.
 * @returns {React.ReactElement} Vista del componente.
 */
export default function ImagePicker({
  title,
  ids,
  max,
  request,
  onChange,
  onBusy,
}) {
  const [error, setError] = useState("");
  /**
   * @param {Event} event Selección local de archivos.
   * @returns {Promise<void>} Sube secuencialmente y conserva los IDs de cargas exitosas.
   */
  async function upload(event) {
    const files = [...event.target.files];
    event.target.value = "";
    setError("");
    if (files.length + ids.length > max) {
      setError(`Máximo ${max} imágenes.`);
      return;
    }
    onBusy(true);
    const added = [];
    try {
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024)
          throw new Error("Cada foto debe pesar como máximo 5 MB.");
        const base64 = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result.split(",")[1]);
          r.onerror = () => reject(new Error("No se pudo leer la imagen."));
          r.readAsDataURL(file);
        });
        const result = await request("/images", {
          method: "POST",
          body: JSON.stringify({ name: file.name, base64 }),
        });
        added.push(result._id);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      if (added.length) onChange([...ids, ...added]);
      onBusy(false);
    }
  }
  return (
    <section className="imagepicker">
      <h3>{title}</h3>
      <p className="muted">
        JPEG, PNG o WebP · Hasta 5 MB por foto · {ids.length}/{max}
      </p>
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      <div className="imagegrid">
        {ids.map((id) => (
          <div className="imagecard" key={id}>
            <PrivateImage id={id} request={request} />
            <button
              type="button"
              onClick={() => onChange(ids.filter((x) => x !== id))}
            >
              Quitar
            </button>
          </div>
        ))}
      </div>
      {ids.length < max && (
        <label className="uploadlabel">
          Agregar {max === 1 ? "imagen" : "fotos"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={max > 1}
            onChange={upload}
          />
        </label>
      )}
    </section>
  );
}
