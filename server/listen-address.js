/** @file Dirección de escucha para Render, producción y ejecución local. */
/**
 * Resuelve la dirección sin abrir puertos ni modificar variables de entorno.
 * Render exige todas las interfaces; fuera de Render se permite HOST explícito.
 * @param {Record<string, string|undefined>} [env] Variables del proceso.
 * @returns {{host:string, port:number}} Dirección y puerto TCP válidos.
 * @throws {Error} Si PORT no es un entero entre 1 y 65535.
 */
export function listenAddress(env = process.env) {
  const port = Number(env.PORT || 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT debe ser un número entero entre 1 y 65535.");
  const host = env.RENDER === "true"
    ? "0.0.0.0"
    : env.HOST || (env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
  return { host, port };
}
