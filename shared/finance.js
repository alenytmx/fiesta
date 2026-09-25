/** @file Reglas compartidas de saldo y estados; los movimientos anulados se conservan pero no suman. */
/** @param {object} quote Cotización. @returns {number} Pagos vigentes, en centavos. */
export function paid(quote) {
  return (quote.payments || [])
    .filter((p) => !p.voided)
    .reduce((sum, p) => sum + p.amountCents, 0);
}
/** @param {object} quote Cotización. @returns {string} Estado derivado del saldo o de la autorización manual. */
export function quoteStatus(quote) {
  if (quote.status === "Cancelada") return "Cancelada";
  const amount = paid(quote);
  if (amount > 0 && amount >= quote.totalCents) return "Pagado";
  if (amount > 0) return "Aceptada";
  return quote.approved ? "Aceptada" : "Esperando autorización";
}
/** @param {object} quote Cotización. @returns {number} Saldo vigente, sin borrar la deuda al anular pagos. */
export function balance(quote) {
  return quote.totalCents - paid(quote);
}
/** @param {object} person Datos separados o nombre anterior. @returns {string} Nombre para listas/documentos. */
export function fullName(person) {
  return (
    [person.firstNames, person.paternalSurname, person.maternalSurname]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    person.name ||
    ""
  );
}
