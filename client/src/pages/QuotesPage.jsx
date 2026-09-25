/** @file Pantalla independiente del módulo quotes. */
import React from "react";
import CrudPage from "./CrudPage.jsx";
/**
 * @param {request:Function} props Cliente HTTP.
 * @returns {React.ReactElement} Pantalla del módulo.
 */
export default function QuotesPage(props) {
  return <CrudPage {...props} type="quotes" />;
}
