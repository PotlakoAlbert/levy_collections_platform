import type http from "http";
import { logger } from "./logger";
import { verifyToken } from "./auth";

let io: any = null;

export function initWebsocket(server: http.Server) {
  if (io) return io;

  // lazy-require socket.io to avoid type dependency when packages not installed
  // at dev-time in this repo context
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const SocketIo = require("socket.io");
  io = new SocketIo.Server(server, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  // Handshake validation: require a valid JWT (from handshake.auth.token or Authorization header)
  io.use((socket: any, next: any) => {
    try {
      const auth = socket.handshake?.auth as Record<string, unknown> | undefined;
      let token = typeof auth?.token === "string" ? (auth.token as string) : undefined;
      if (!token) {
        const authHeader = socket.handshake?.headers?.authorization as string | undefined;
        if (authHeader && authHeader.startsWith("Bearer ")) token = authHeader.slice(7);
      }
      if (!token) return next(new Error("Unauthorized"));

      const payload = verifyToken(token);
      if (!payload) return next(new Error("Unauthorized"));

      socket.data = socket.data || {};
      socket.data.user = payload;
      return next();
    } catch (err) {
      logger.warn({ err }, "WebSocket handshake auth error");
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket: any) => {
    logger.info({ id: socket.id, user: socket.data?.user }, "WebSocket client connected");

    socket.on("joinDebtor", (debtorId: string) => {
      try {
        socket.join(`debtor:${debtorId}`);
        logger.info({ socket: socket.id, debtorId }, "Socket joined debtor room");
      } catch (err) {
        logger.warn({ err }, "Failed to join debtor room");
      }
    });

    socket.on("leaveDebtor", (debtorId: string) => {
      try {
        socket.leave(`debtor:${debtorId}`);
      } catch (err) {
        logger.warn({ err }, "Failed to leave debtor room");
      }
    });

    socket.on("disconnect", (reason: any) => {
      logger.info({ id: socket.id, reason }, "WebSocket client disconnected");
    });
  });

  return io;
}

export function emitToDebtor(debtorId: string, eventName: string, data: unknown) {
  if (!io) return;
  try {
    io.to(`debtor:${debtorId}`).emit(eventName, data);
  } catch (err) {
    logger.warn({ err, debtorId, eventName }, "Failed to emit websocket event to debtor");
  }
}

export function getIo() {
  return io;
}

export default {};
