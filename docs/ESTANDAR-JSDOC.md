# Estándar de documentación — Fiesta

Se emplea JSDoc para JavaScript y JSX, con la estructura de bloques solicitada al mencionar JavaDoc.

- `@file`: propósito del módulo y su frontera de responsabilidad.
- `@param`: nombres, tipos y significado de parámetros; incluir opcionales y unidades (centavos, puntos o milímetros).
- `@returns`: tipo y semántica del resultado, incluidas promesas.
- `@type`: estructuras compartidas y configuración.
- Documentar reglas de negocio, permisos, redondeo, expiración, idempotencia y liberación de recursos junto al código correspondiente.
- Actualizar comentarios al cambiar comportamiento; no comentar cada asignación evidente ni dejar ejemplos con secretos.

```js
/**
 * Suma importes persistidos sin confiar en un saldo enviado por el navegador.
 * @param {object} quote Cotización con su historial de pagos.
 * @returns {number} Suma entera en centavos de MXN.
 */
function paid(quote) {
  return (quote.payments || []).reduce((sum, payment) => sum + payment.amountCents, 0);
}
```

Las funciones de render documentan sus props y resultado. Las rutas documentan su objetivo, petición/respuesta y protecciones. Los manejadores locales se explican dentro del contexto del componente. `AGENTS.md` conserva estas reglas para futuras modificaciones del proyecto.
