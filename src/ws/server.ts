import { WebSocket, WebSocketServer } from "ws";
import { Server } from "node:http";
import { type InferSelectModel } from "drizzle-orm";
import { matches } from "../db/schema.js";
import { wsArcjet } from "../config/arcjet.js";
import type { Request } from "express";

type Match = InferSelectModel<typeof matches>;

type WebSocketMessage =
  | {
      type: "Welcome";
    }
  | {
      type: "match_created";
      data: Match;
    };

function sendJSON(socket: WebSocket, payload: WebSocketMessage): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(payload));
}

function broadcast(wss: WebSocketServer, payload: WebSocketMessage): void {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) {
      continue;
    }

    client.send(JSON.stringify(payload));
  }
}

export function attachWebSocketServer(server: Server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  wss.on("connection", async (socket: WebSocket, req: Request) => {
    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req);

        if (decision.isDenied()) {
          const code = decision.reason.isRateLimit() ? 1013 : 1008;
          const reason = decision.reason.isRateLimit()
            ? "Rate limit exceeded"
            : "Access denied";

          socket.close(code, reason);
          return;
        }
      } catch (err) {
        console.log(`WS connection error ${err}`);
        socket.close(1011, "Server security error");
      }
    }

    socket.isAlive = true;

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    sendJSON(socket, { type: "Welcome" });
    socket.on("error", console.error);
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));

  function broadcastMatchCreated(match: Match): void {
    broadcast(wss, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}
