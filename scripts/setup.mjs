/** @file Copia ejemplos de configuración solamente cuando no existen archivos locales. */
import { copyFileSync, existsSync } from "node:fs";
for (const directory of ["client", "server"]) {
  const target = `${directory}/.env`;
  if (!existsSync(target)) {
    copyFileSync(`${directory}/.env.example`, target);
    console.log(`Creado ${target}`);
  }
}
