/** @file Celdas específicas de cada entidad. Nunca interpretan datos de otro módulo. */
import React from "react";
import { paid } from "../../../shared/finance.js";
import { money } from "../lib/common.js";
/**
 * @param {object} props Cliente.
 * @returns {React.ReactElement} Celdas de cliente.
 */
export function ClientsRow({ row }) {
  return (
    <>
      <td>
        <strong>{row.name}</strong>
      </td>
      <td>{row.phone || "—"}</td>
    </>
  );
}
/**
 * @param {object} props Cotización y resolvedor de cliente.
 * @returns {React.ReactElement} Celdas de cotización.
 */
export function QuotesRow({ row, clientName, onStatus }) {
  return (
    <>
      <td>
        <strong>{row.number || "Sin número"}</strong>
        <small>{row.title}</small>
      </td>
      <td>{row.clientName || clientName(row.client)}</td>
      <td>
        {row.createdAt
          ? new Date(row.createdAt).toLocaleDateString("es-MX")
          : "—"}
        <small>
          Evento: {row.eventDate?.split("-").reverse().join("/") || "Sin fecha"}
        </small>
      </td>
      <td>
        <span
          className={
            "badge " + (row.status || "").toLowerCase().replaceAll(" ", "-")
          }
        >
          {row.status}
        </span>
        {paid(row) === 0 && (
          <select
            className="statusselect"
            aria-label={"Estado de " + row.number}
            value={row.status}
            onChange={(e) => onStatus(row, e.target.value)}
          >
            {["Esperando autorización", "Aceptada", "Cancelada"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
      </td>
      <td className="amount">
        {money(row.totalCents)}
        <small>Saldo: {money(row.totalCents - paid(row))}</small>
      </td>
    </>
  );
}
/**
 * @param {object} props Invitado y resolvedor de cliente.
 * @returns {React.ReactElement} Celdas de invitado.
 */
export function GuestsRow({ row, clientName }) {
  return (
    <>
      <td>
        <strong>{row.name}</strong>
      </td>
      <td>{clientName(row.client)}</td>
      <td>{row.phone || "—"}</td>
    </>
  );
}
/**
 * @param {object} props Invitación y resolvedores de relaciones.
 * @returns {React.ReactElement} Celdas de invitación.
 */
export function InvitationsRow({ row, guestName, quoteName }) {
  return (
    <>
      <td>
        <strong>{guestName(row.guest)}</strong>
      </td>
      <td>{quoteName(row.quote)}</td>
      <td>{row.seats}</td>
      <td>
        <span className={"badge " + (row.status || "").toLowerCase()}>
          {row.status}
        </span>
      </td>
    </>
  );
}
/** @type {Object<string,Function>} Selección de componente por módulo. */
export const ROW_COMPONENTS = {
  clients: ClientsRow,
  quotes: QuotesRow,
  guests: GuestsRow,
  invitations: InvitationsRow,
};
