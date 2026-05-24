import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import express from "express";
import { Server } from "socket.io";
import QRCode from "qrcode";
import { config, projectRoot } from "./runtimeConfig.js";
import { createDatabase } from "./database.js";
import { createLlm } from "./llm.js";
import { GameEngine } from "./gameEngine.js";
import { createCloudflareTunnel } from "./cloudflareTunnel.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 8e6,
  cors: {
    origin: true
  }
});

const publicDir = path.join(projectRoot, "public");
const versionedFiles = [
  "index.html",
  "manifest.webmanifest",
  "service-worker.js",
  "styles.css",
  "scripts/app.js",
  "assets/quest-camera.svg"
];
const indexTemplate = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
const manifestTemplate = fs.readFileSync(path.join(publicDir, "manifest.webmanifest"), "utf8");
const database = await createDatabase(config);
const llm = createLlm(config);
const engine = new GameEngine({ io, config, llm, database });
const cloudflareTunnel = createCloudflareTunnel(config);

app.use(express.json({ limit: "2mb" }));

function currentAssetVersion() {
  if (process.env.CAPTURE_QUEST_ASSET_VERSION) return process.env.CAPTURE_QUEST_ASSET_VERSION;
  const signature = versionedFiles
    .map((file) => {
      const stats = fs.statSync(path.join(publicDir, file));
      return `${file}:${stats.size}:${Math.trunc(stats.mtimeMs)}`;
    })
    .join("|");
  return crypto.createHash("sha1").update(signature).digest("hex").slice(0, 12);
}

function withAssetVersion(content, assetVersion = currentAssetVersion()) {
  return content.replaceAll("__ASSET_VERSION__", encodeURIComponent(assetVersion));
}

function setNoStore(response) {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.setHeader("Surrogate-Control", "no-store");
}

function setStaticCacheHeaders(response, filePath) {
  const fileName = path.basename(filePath);
  if (fileName === "index.html" || fileName === "service-worker.js" || fileName === "manifest.webmanifest") {
    setNoStore(response);
    return;
  }

  if (response.req?.query?.v === currentAssetVersion()) {
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else {
    setNoStore(response);
  }
}

function sendIndex(_request, response) {
  setNoStore(response);
  response.type("html").send(withAssetVersion(indexTemplate));
}

app.get("/", sendIndex);
app.get("/index.html", sendIndex);
app.get("/manifest.webmanifest", (_request, response) => {
  setNoStore(response);
  response.type("application/manifest+json").send(withAssetVersion(manifestTemplate));
});
app.use(
  express.static(publicDir, {
    index: false,
    setHeaders: setStaticCacheHeaders
  })
);

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
    model: config.openRouter.model,
    assetVersion: currentAssetVersion()
  });
});

app.use("/api", (_request, response) => {
  response.status(404).json({ ok: false, error: "Not found." });
});

app.get("*", (_request, response) => {
  sendIndex(_request, response);
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

  socket.on("end_game", async (payload, callback) => {
    const result = await engine.endGameByOwner(socket, payload);
    ack(callback, result.error ? { ok: false, error: result.error } : { ok: true });
  });

  socket.on("leave_game", (payload, callback) => {
    const result = engine.leaveGame(socket, payload);
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

let shuttingDown = false;

function closeServer() {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  setTimeout(() => process.exit(1), 8000).unref();
  await Promise.all([closeServer(), cloudflareTunnel.stop()]);
  process.exit(signal === "SIGINT" ? 130 : 143);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
server.on("close", () => cloudflareTunnel.stop());

server.listen(config.port, () => {
  console.log(`Capture Quest running on http://localhost:${config.port}`);
  cloudflareTunnel.start();
});
