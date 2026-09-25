/** @file PrivateImage — componente independiente de presentación e interacción. */
import React, { useEffect, useState, useRef, useId } from "react";
import { money, single } from "../lib/common.js";
/**
 * Carga una imagen autenticada y libera su URL al desmontarse.
 * @param {object} props Propiedades del componente.
 * @returns {React.ReactElement} Vista del componente.
 */
export default function PrivateImage({ id, request }) {
  const [src, setSrc] = useState(""),
    [error, setError] = useState(false);
  useEffect(() => {
    let disposed = false,
      url;
    setError(false);
    request("/images/" + id, { blob: true })
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (disposed) URL.revokeObjectURL(url);
        else setSrc(url);
      })
      .catch(() => {
        if (!disposed) setError(true);
      });
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return error ? (
    <span>Imagen no disponible</span>
  ) : src ? (
    <a href={src} target="_blank" rel="noreferrer">
      <img src={src} alt="Imagen de la cotización" />
    </a>
  ) : (
    <span>Cargando…</span>
  );
}
