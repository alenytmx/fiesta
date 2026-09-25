/** @file Marca, diseño y revisión de datos compartidos sin duplicar el estado de las tablas. */
import { createContext, useContext } from "react";
/** @type {React.Context<object>} Configuración y canal de invalidación en tiempo real. */
export const AppContext = createContext({
  revision: 0,
  resource: "",
  settings: null,
});
/** @returns {object} Contexto de marca, avisos y revisión actual. */
export const useApp = () => useContext(AppContext);
