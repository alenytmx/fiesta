/** @file Pantalla independiente del módulo guests. */
import React from "react";
import CrudPage from "./CrudPage.jsx";
/**
 * @param {request:Function} props Cliente HTTP.
 * @returns {React.ReactElement} Pantalla del módulo.
 */
export default function GuestsPage(props) {
  return <CrudPage {...props} type="guests" />;
}
