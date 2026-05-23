import http from "node:http";
import path from "node:path";
import express from "express";
import { Server } from "socket.io";
import QRCode from "qrcode";
import { config, projectRoot } from "./runtimeConfig.js";
import { createDatabase } from "./database.js";
import { createLlm } from "./llm.js";
import { GameEngine } from "./gameEngine.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 8e6,
  cors: {
    origin: true
  }
});

const publicDir = path.join(projectRoot, "public");
const database = await createDatabase(config);
const llm = createLlm(config);
const engine = new GameEngine({ io, config, llm, database });

app.use(express.json({ limit: "2mb" }));
app.use(express.static(publicDir));

function ack(callback, payload) {
  if (typeof callback === "function") callback(payload);
}

function publicBaseUrl(socket) {
  if (config.publicBaseUrl) return config.publicBaseUrl.replace(/\/$/, "");
  const proto = socket.handshake.headers["x-forwarded-proto"] || "http";
  return `${proto}://${socket.handshake.headers.host}`;
}

async function gameJoinPayload(socket, game, player) {
  const url = `${publicBaseUrl(socket)}/?game=${encodeURIComponent(game.id)}`;
  const qrCode = await QRCode.toDataURL(url, {
    margin: 1,
    scale: 8,
    color: {
      dark: "#1f2937",
      light: "#ffffff"
    }
  });
  return {
    ok: true,
    gameId: game.id,
    playerId: player.id,
    gameUrl: url,
    qrCode
  };
}

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    database: database.enabled ? "postgres" : "memory",
    model: config.openRouter.model
  });
});

app.get("/api/leaderboard", async (request, response) => {
  const limit = Math.min(Number(request.query.limit || 25), 100);
  response.json({
    rows: await database.getLeaderboard(limit)
  });
});

app.get("*", (_request, response) => {
  response.sendFile(path.join(publicDir, "index.html"));
});

io.on("connection", (socket) => {
  socket.on("create_game", async (payload, callback) => {
    try {
      const { game, player } = engine.createGame(socket, payload);
      ack(callback, await gameJoinPayload(socket, game, player));
    } catch (error) {
      ack(callback, { ok: false, error: error.message });
    }
  });

  socket.on("join_game", async (payload, callback) => {
    try {
      const result = engine.joinGame(socket, payload);
      if (result.error) return ack(callback, { ok: false, error: result.error });
      ack(callback, await gameJoinPayload(socket, result.game, result.player));
    } catch (error) {
      ack(callback, { ok: false, error: error.message });
    }
  });

  socket.on("rejoin_game", async (payload, callback) => {
    try {
      const result = engine.rejoinGame(socket, payload);
      if (result.error) return ack(callback, { ok: false, error: result.error });
      ack(callback, await gameJoinPayload(socket, result.game, result.player));
    } catch (error) {
      ack(callback, { ok: false, error: error.message });
    }
  });

  socket.on("set_ready", (payload, callback) => {
    const result = engine.setReady(socket, payload);
    ack(callback, result.error ? { ok: false, error: result.error } : { ok: true });
  });

  socket.on("start_game", async (payload, callback) => {
    const result = await engine.startGame(socket, payload);
    ack(callback, result.error ? { ok: false, error: result.error } : { ok: true });
  });

  socket.on("restart_game", async (payload, callback) => {
    const result = await engine.restartGame(socket, payload);
    ack(callback, result.error ? { ok: false, error: result.error } : { ok: true });
  });

  socket.on("submit_capture", (payload, callback) => {
    const result = engine.submitCapture(socket, payload);
    ack(callback, result.error ? { ok: false, error: result.error } : { ok: true });
  });

  socket.on("disconnect", () => {
    engine.handleDisconnect(socket);
  });
});

server.listen(config.port, () => {
  console.log(`Capture Quest running on http://localhost:${config.port}`);
});
