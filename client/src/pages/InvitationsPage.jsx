/** @file Pantalla independiente del módulo invitations. */
import React from "react";
import CrudPage from "./CrudPage.jsx";
/**
 * @param {request:Function} props Cliente HTTP.
 * @returns {React.ReactElement} Pantalla del módulo.
 */
export default function InvitationsPage(props) {
  return <CrudPage {...props} type="invitations" />;
}
