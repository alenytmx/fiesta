/** @file Preparación local: conserva .env, instala dependencias verificadas por lockfile, compila y mantiene logs. */
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  createWriteStream,
  copyFileSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import readline from "node:readline/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
mkdirSync(".logs", { recursive: true });
const log = createWriteStream(
  path.join(
    ".logs",
    "inicio-" + new Date().toISOString().replace(/[:.]/g, "-") + ".log",
  ),
);
/**
 * @param {string} value Mensaje sin secretos.
 * @returns {void} Escribe consola y log.
 */
function message(value) {
  console.log(value);
  log.write(value + "\n");
}
/**
 * @param {string} command Ejecutable.
 * @param {string[]} args Argumentos constantes.
 * @param {object} [env] Variables del proceso hijo.
 * @returns {Promise<void>} Finalización o error visible.
 */
async function command(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...env },
      shell: process.platform === "win32" && command === "npm.cmd",
      stdio: ["inherit", "pipe", "pipe"],
    });
    child.stdout.on("data", (data) => {
      process.stdout.write(data);
      log.write(data);
    });
    child.stderr.on("data", (data) => {
      process.stderr.write(data);
      log.write(data);
    });
    child.on("error", () =>
      reject(new Error("No se pudo ejecutar " + command)),
    );
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              "El proceso terminó con error. Revisa los mensajes anteriores.",
            ),
          ),
    );
  });
}
try {
  for (const folder of ["client", "server"])
    if (!existsSync(folder + "/.env")) {
      copyFileSync(folder + "/.env.example", folder + "/.env");
      message(
        "Creado " + folder + "/.env. Configura la conexión si utilizas Atlas.",
      );
    }
  // Los .env existentes se conservan intactos. Una URI vacía se solicita sin mostrarla en los logs.
  const serverEnv = readFileSync("server/.env", "utf8");
  if (!/^MONGODB_URI\s*=\s*[^\s#]+/m.test(serverEnv)) {
    message(
      "Falta MONGODB_URI. Se abrirá server/.env; guarda la conexión y vuelve a ejecutar el iniciador.",
    );
    if (process.platform === "win32")
      spawn("notepad.exe", [path.join(root, "server/.env")], {
        stdio: "ignore",
      });
    throw new Error("Configura MONGODB_URI antes de continuar.");
  }
  const fingerprint = createHash("sha256")
    .update(readFileSync("package-lock.json"))
    .update(process.versions.node)
    .digest("hex");
  if (
    !existsSync("node_modules") ||
    !existsSync(".runtime/dependencies") ||
    readFileSync(".runtime/dependencies", "utf8") !== fingerprint
  ) {
    message("Instalando dependencias del proyecto…");
    await command(process.platform === "win32" ? "npm.cmd" : "npm", [
      "ci",
      "--include=dev",
      "--no-fund",
    ]);
    mkdirSync(".runtime", { recursive: true });
    writeFileSync(".runtime/dependencies", fingerprint);
  }
  message("Preparando la aplicación…");
  await command(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "build"],
    { VITE_API_URL: "/api" },
  );
  message(
    "Iniciando Fiesta. El navegador se abrirá cuando MongoDB esté conectado.",
  );
  await command(process.execPath, [
    "--env-file=server/.env",
    "scripts/serve-local.mjs",
  ]);
} catch (e) {
  message("ERROR: " + e.message);
  process.exitCode = 1;
} finally {
  log.end();
}
