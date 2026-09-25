/** @file Socket.IO autenticado por sesión; cada propietario recibe únicamente avisos de sus registros. */
import { Server } from "socket.io";
import { createHash } from "node:crypto";
import { Session } from "./models.js";
/**
 * Conecta el servidor HTTP al canal de cambios. No acepta salas elegidas por el navegador.
 * @param {import('node:http').Server} http Servidor compartido con Express.
 * @returns {{publish:Function,disconnectSession:Function,close:Function}} Acciones exclusivas del backend.
 */
export function createRealtime(http) {
  const io = new Server(http, {
    cors: { origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" },
    maxHttpBufferSize: 10000,
    serveClient: false,
  });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
        return next(new Error("Sesión inválida"));
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const session = await Session.findOne({
        tokenHash,
        expiresAt: { $gt: new Date() },
      });
      if (!session) return next(new Error("Sesión vencida"));
      socket.data.session = session;
      next();
    } catch {
      next(new Error("No se pudo validar la sesión"));
    }
  });
  io.on("connection", (socket) => {
    const session = socket.data.session;
    socket.join("owner:" + session.user);
    socket.join("session:" + session._id);
    const timer = setTimeout(
      () => socket.disconnect(true),
      Math.max(1, new Date(session.expiresAt).getTime() - Date.now()),
    );
    timer.unref?.();
    socket.on("disconnect", () => clearTimeout(timer));
  });
  return {
    publish: (owner, resource) =>
      io.to("owner:" + owner).emit("changed", { resource, at: Date.now() }),
    disconnectSession: (id) => io.in("session:" + id).disconnectSockets(true),
    close: () => io.close(),
  };
}
