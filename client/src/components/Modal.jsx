/** @file Modal — componente independiente de presentación e interacción. */
import React, { useEffect, useState, useRef, useId } from "react";
import { money, single } from "../lib/common.js";
/**
 * Encapsula un diálogo accesible y devuelve el foco al cerrarse.
 * @param {object} props Propiedades del componente.
 * @returns {React.ReactElement} Vista del componente.
 */
export default function Modal({ title, onClose, children }) {
  const titleId = useId();
  const ref = useRef();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby={titleId}
    >
      <div className="dialoghead">
        <h2 id={titleId}>{title}</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
