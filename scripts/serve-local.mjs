/** @file Arranque local limitado a loopback con variables del proceso, sin reescribir .env. */
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(path.join(root, "server"));
process.env.HOST = "127.0.0.1";
process.env.PORT = process.env.PORT || "4000";
process.env.CLIENT_ORIGIN = "http://localhost:" + process.env.PORT;
process.env.OPEN_BROWSER = "1";
await import("../server/index.js");
