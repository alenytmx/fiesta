/** @file Avisos accesibles, animados y descartables, con duración de diez segundos. */
import React, { useEffect } from "react";
import { CheckCircle, AlertCircle, X } from "lucide-react";
/** @param {object} props Aviso y acción de cierre. @returns {React.ReactElement} Mensaje temporal. */
function Toast({ item, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(item.id), 10000);
    return () => clearTimeout(timer);
  }, [item.id, onClose]);
  return (
    <div
      className={"toast " + item.type}
      role={item.type === "error" ? "alert" : "status"}
    >
      {item.type === "error" ? (
        <AlertCircle size={20} />
      ) : (
        <CheckCircle size={20} />
      )}
      <span>{item.message}</span>
      <button aria-label="Cerrar aviso" onClick={() => onClose(item.id)}>
        <X size={16} />
      </button>
      <i className="toasttimer" />
    </div>
  );
}
/** @param {object} props Lista de avisos. @returns {React.ReactElement} Contenedor superpuesto. */
export default function ToastStack({ items, onClose }) {
  return (
    <aside className="toaststack" aria-label="Notificaciones">
      {items.map((item) => (
        <Toast key={item.id} item={item} onClose={onClose} />
      ))}
    </aside>
  );
}
