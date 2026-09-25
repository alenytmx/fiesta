/** @file Pantalla independiente del módulo clients. */
import React from "react";
import CrudPage from "./CrudPage.jsx";
/**
 * @param {request:Function} props Cliente HTTP.
 * @returns {React.ReactElement} Pantalla del módulo.
 */
export default function ClientsPage(props) {
  return <CrudPage {...props} type="clients" />;
}
