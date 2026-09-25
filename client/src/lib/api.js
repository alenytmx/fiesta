/** @file Acceso a la API; conserva los tokens únicamente en memoria de React. */
export const API = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
/**
 * Construye un cliente autenticado con respuestas JSON o binarias.
 * @param {string|undefined} token Token de la sesión actual.
 * @param {Function} onExpired Notificación de sesión vencida.
 * @returns {Function} Petición que propaga errores y admite AbortSignal.
 */
export function createRequest(token, onExpired, notify = () => {}) {
  return async (route, options = {}) => {
    const { blob, arrayBuffer, ...init } = options;
    let res;
    try {
      res = await fetch(API + route, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...init.headers,
        },
      });
    } catch (e) {
      if (e.name === "AbortError") throw e;
      throw new Error(
        "No se pudo conectar con el servidor. Revisa la conexión y la URL de la API.",
      );
    }
    if (res.ok && blob) return res.blob();
    if (res.ok && arrayBuffer) return res.arrayBuffer();
    const data =
      res.status === 204
        ? null
        : await res
            .json()
            .catch(() => ({ message: "Respuesta inesperada del servidor." }));
    if (!res.ok) {
      if (res.status === 401 && token) onExpired();
      notify(data?.message || "No se pudo realizar la operación.", "error");
      throw new Error(data?.message || "No se pudo realizar la operación.");
    }
    if (
      ["POST", "PUT", "DELETE"].includes(init.method) &&
      /^\/(clients|quotes|guests|invitations|settings)(\/|$)/.test(route)
    ) {
      const message = route.endsWith("/void")
        ? "Pago anulado. Saldo actualizado."
        : route.endsWith("/payments")
          ? "Pago registrado."
          : route.endsWith("/status")
            ? "Estado actualizado."
            : route === "/settings"
              ? "Configuración guardada."
              : init.method === "DELETE"
                ? "Registro eliminado."
                : init.method === "POST"
                  ? "Registro creado."
                  : "Registro actualizado.";
      notify(message, "success");
    }
    return data;
  };
}
