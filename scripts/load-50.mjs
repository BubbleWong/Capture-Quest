import assert from "node:assert/strict";
import http from "node:http";
import { Server } from "socket.io";
import { io as connectClient } from "socket.io-client";
import { GameEngine } from "../server/gameEngine.js";

const playerCount = 50;
const normalRounds = 5;
const tinyMiss = "data:image/jpeg;mock,MISS";
const tinyMatch = "data:image/jpeg;mock,MATCH";
const seed = Number(process.env.LOAD_TEST_SEED || Math.floor(Math.random() * 0x7fffffff)) || 1;

function createRng(initialSeed) {
  let state = initialSeed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const random = createRng(seed);

function randomInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function shuffle(values) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const nextIndex = randomInt(0, index);
    [output[index], output[nextIndex]] = [output[nextIndex], output[index]];
  }
  return output;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitFor(predicate, label, timeoutMs = 15000) {
  const startedAt = performance.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      try {
        const result = predicate();
        if (result) {
          clearInterval(timer);
          resolve(result);
        } else if (performance.now() - startedAt > timeoutMs) {
          clearInterval(timer);
          reject(new Error(`Timed out waiting for ${label} (seed=${seed}).`));
        }
      } catch (error) {
        clearInterval(timer);
        reject(error);
      }
    }, 10);
  });
}

function createClientId(index) {
  return `${String(index + 1).padStart(8, "0")}-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function createLoadConfig() {
  return {
    game: {
      maxPlayers: playerCount,
      normalRounds,
      objectTimeoutMs: 5000,
      nextRoundDelayMs: 20,
      itemBatchSize: 120,
      refillThreshold: 30,
      submissionLimitBytes: 2_000_000
    }
  };
}

function createLoadLlm(metrics) {
  let generatedBatch = 0;
  return {
    async prepareInitialItems() {
      return [];
    },
    async generateItems({ count = 20 } = {}) {
      generatedBatch += 1;
      return Array.from({ length: count + 20 }, (_, index) => `load object ${generatedBatch}-${index + 1}`);
    },
    async verifyPhoto({ imageDataUrl }) {
      metrics.verifications += 1;
      await sleep(randomInt(1, 4));
      const match = String(imageDataUrl || "").includes("MATCH");
      return {
        match,
        confidence: match ? 0.98 : 0.22,
        reason: match ? "load-test match" : "load-test miss"
      };
    }
  };
}

function ack(callback, payload) {
  if (typeof callback === "function") callback(payload);
}

function gameJoinPayload(baseUrl, game, player) {
  const gameUrl = new URL(baseUrl);
  gameUrl.searchParams.set("game", game.id);
  return {
    ok: true,
    gameId: game.id,
    playerId: player.id,
    gameUrl: gameUrl.toString(),
    qrCode: "data:image/png;base64,load-test"
  };
}

function wireSocketServer(ioServer, engine, baseUrl) {
  ioServer.on("connection", (socket) => {
    socket.on("create_game", (payload, callback) => {
      try {
        const { game, player } = engine.createGame(socket, payload);
        ack(callback, gameJoinPayload(baseUrl, game, player));
      } catch (error) {
        ack(callback, { ok: false, error: error.message });
      }
    });

    socket.on("join_game", (payload, callback) => {
      try {
        const result = engine.joinGame(socket, payload);
        if (result.error) return ack(callback, { ok: false, error: result.error });
        ack(callback, gameJoinPayload(baseUrl, result.game, result.player));
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

    socket.on("submit_capture", (payload, callback) => {
      const result = engine.submitCapture(socket, payload);
      ack(callback, result.error ? { ok: false, error: result.error } : { ok: true, ignored: Boolean(result.ignored) });
    });

    socket.on("skip_round", (payload, callback) => {
      const result = engine.voteSkipRound(socket, payload);
      ack(callback, result.error ? { ok: false, error: result.error } : { ok: true, ignored: Boolean(result.ignored) });
    });

    socket.on("disconnect", () => {
      engine.handleDisconnect(socket);
    });
  });
}

async function listen(httpServer) {
  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(httpServer, ioServer) {
  await new Promise((resolve) => ioServer.close(resolve));
  await new Promise((resolve) => httpServer.close(resolve));
}

async function connect(baseUrl, index, metrics) {
  const socket = connectClient(baseUrl, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    timeout: 5000
  });
  const client = {
    index,
    username: index === 0 ? "Load Owner" : `Load Player ${index}`,
    clientId: createClientId(index),
    playerId: "",
    socket,
    latestState: null,
    stateEvents: 0,
    notices: 0
  };
  socket.on("game_state", (state) => {
    client.latestState = state;
    client.stateEvents += 1;
    metrics.stateEvents += 1;
  });
  socket.on("capture_notice", () => {
    client.notices += 1;
    metrics.captureNotices += 1;
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Client ${index} connection timed out.`)), 5000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", reject);
  });
  return client;
}

async function emitAck(client, event, payload, metrics, timeoutMs = 10000) {
  const startedAt = performance.now();
  return new Promise((resolve, reject) => {
    client.socket.timeout(timeoutMs).emit(event, payload, (error, response) => {
      const elapsed = performance.now() - startedAt;
      metrics.ackTimes.push(elapsed);
      if (error) reject(new Error(`${event} timed out for ${client.username}.`));
      else resolve(response || { ok: true });
    });
  });
}

function percentile(values, percentileValue) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index];
}

function playersByTeam(latestState, clients, teamId) {
  const teamByPlayer = new Map(latestState.players.map((player) => [player.id, player.teamId]));
  return clients.filter((client) => teamByPlayer.get(client.playerId) === teamId);
}

const metrics = {
  ackTimes: [],
  captureNotices: 0,
  stateEvents: 0,
  verifications: 0
};
const database = {
  results: [],
  async saveGameResult(result) {
    this.results.push(result);
  }
};
const httpServer = http.createServer();
const ioServer = new Server(httpServer, {
  maxHttpBufferSize: 8e6,
  cors: { origin: true }
});
const llm = createLoadLlm(metrics);
const engine = new GameEngine({
  io: ioServer,
  config: createLoadConfig(),
  llm,
  database,
  audioCache: {
    enabled: false,
    async prepareAudio() {
      return "";
    }
  },
  logger: { warn() {}, info() {}, error() {} }
});

const startedAt = performance.now();
let baseUrl = "";
const clients = [];

try {
  baseUrl = await listen(httpServer);
  wireSocketServer(ioServer, engine, baseUrl);

  clients[0] = await connect(baseUrl, 0, metrics);
  const created = await emitAck(
    clients[0],
    "create_game",
    {
      username: clients[0].username,
      clientId: clients[0].clientId,
      teamUpEnabled: true
    },
    metrics
  );
  assert.equal(created.ok, true);
  assert.equal(new URL(created.gameUrl).searchParams.get("game"), created.gameId);
  clients[0].playerId = created.playerId;

  const joinStartedAt = performance.now();
  const newClients = await Promise.all(Array.from({ length: playerCount - 1 }, (_, index) => connect(baseUrl, index + 1, metrics)));
  const joinResponses = await Promise.all(
    newClients.map((client) =>
      emitAck(
        client,
        "join_game",
        {
          gameId: created.gameId,
          username: client.username,
          clientId: client.clientId
        },
        metrics
      )
    )
  );
  for (let index = 0; index < newClients.length; index += 1) {
    assert.equal(joinResponses[index].ok, true);
    newClients[index].playerId = joinResponses[index].playerId;
    clients[index + 1] = newClients[index];
  }

  const overflowClient = await connect(baseUrl, playerCount, metrics);
  const overflow = await emitAck(
    overflowClient,
    "join_game",
    {
      gameId: created.gameId,
      username: "Overflow Player",
      clientId: createClientId(playerCount)
    },
    metrics
  );
  assert.equal(overflow.ok, false);
  assert.match(overflow.error, /full/i);
  overflowClient.socket.disconnect();

  await waitFor(() => clients[0].latestState?.players?.length === playerCount, "all players joined");
  assert.equal(clients[0].latestState.maxPlayers, playerCount);

  for (const client of shuffle(clients.slice(1)).slice(0, 3)) {
    const previousSocket = client.socket;
    const kicked = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Rejoin kick timed out for ${client.username}.`)), 5000);
      previousSocket.once("left_game", (payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
    const replacement = await connect(baseUrl, client.index, metrics);
    replacement.username = client.username;
    replacement.clientId = client.clientId;
    const rejoined = await emitAck(
      replacement,
      "join_game",
      {
        gameId: created.gameId,
        username: replacement.username,
        clientId: replacement.clientId
      },
      metrics
    );
    assert.equal(rejoined.ok, true);
    assert.equal(rejoined.playerId, client.playerId);
    replacement.playerId = client.playerId;
    const kickedMessage = await kicked;
    assert.equal(kickedMessage.preserveSession, true);
    clients[client.index] = replacement;
  }

  await emitAck(clients[clients.length - 1], "set_ready", { gameId: created.gameId, ready: false }, metrics);
  await waitFor(() => clients[0].latestState?.allReady === false, "one player unready");
  const blockedStart = await emitAck(clients[0], "start_game", { gameId: created.gameId }, metrics);
  assert.equal(blockedStart.ok, false);
  assert.match(blockedStart.error, /ready/i);

  await Promise.all(shuffle(clients).map((client) => emitAck(client, "set_ready", { gameId: created.gameId, ready: true }, metrics)));
  await waitFor(() => clients[0].latestState?.allReady === true, "all ready");

  const startResponse = await emitAck(clients[0], "start_game", { gameId: created.gameId }, metrics);
  assert.equal(startResponse.ok, true);

  const firstActiveState = await waitFor(
    () => clients[0].latestState?.currentRound?.status === "active" && clients[0].latestState,
    "first active round"
  );
  const targetTeamId = firstActiveState.me.teamId;
  assert.ok(targetTeamId);

  const handledRounds = new Set();
  while (clients[0].latestState?.lastResult?.status !== "ended") {
    const state = await waitFor(() => {
      const next = clients[0].latestState;
      if (next?.lastResult?.status === "ended") return next;
      if (next?.currentRound?.status === "active" && !handledRounds.has(next.currentRound.id)) return next;
      return null;
    }, "next active round");
    if (state.lastResult?.status === "ended") break;

    const round = state.currentRound;
    handledRounds.add(round.id);

    const skipVoters = shuffle(clients).slice(0, randomInt(0, 5));
    await Promise.all(
      skipVoters.map((client) =>
        emitAck(client, "skip_round", { gameId: created.gameId, challengeId: round.id }, metrics)
      )
    );

    const targetTeamClients = playersByTeam(state, clients, targetTeamId);
    const otherTeamClients = clients.filter((client) => !targetTeamClients.includes(client));
    const missers = shuffle(otherTeamClients).slice(0, randomInt(4, Math.min(12, otherTeamClients.length)));
    await Promise.all(
      missers.map((client) =>
        emitAck(client, "submit_capture", { gameId: created.gameId, challengeId: round.id, imageDataUrl: tinyMiss }, metrics)
      )
    );

    await waitFor(
      () =>
        clients[0].latestState?.players?.some((player) => player.score < 0) ||
        clients[0].latestState?.currentRound?.id !== round.id,
      "queued misses"
    );

    const matcher = shuffle(targetTeamClients)[0];
    assert.ok(matcher, "expected a matcher on the target team");
    const matched = await emitAck(
      matcher,
      "submit_capture",
      { gameId: created.gameId, challengeId: round.id, imageDataUrl: tinyMatch },
      metrics
    );
    assert.equal(matched.ok, true);

    await waitFor(
      () =>
        clients[0].latestState?.lastResult?.status === "ended" ||
        clients[0].latestState?.lastResult?.status === "found" ||
        clients[0].latestState?.currentRound?.id !== round.id,
      "round resolution"
    );
  }

  const finalState = await waitFor(
    () => {
      const next = clients[0].latestState;
      return next?.status === "lobby" && next.lastResult?.status === "ended" && next;
    },
    "game ended"
  );
  assert.equal(finalState.players.length, playerCount);
  assert.equal(finalState.teamUpEnabled, true);
  assert.equal(finalState.teamScores.reduce((total, team) => total + team.players, 0), playerCount);
  assert.equal(finalState.winner.id, targetTeamId);
  assert.equal(database.results.length, 1);
  assert.equal(database.results[0].players.length, playerCount);
  assert.equal(database.results[0].teams.reduce((total, team) => total + team.players, 0), playerCount);
  assert.ok(database.results[0].teams.some((team) => team.contributors.length > 0));

  const totalMs = performance.now() - startedAt;
  const p95AckMs = percentile(metrics.ackTimes, 95);
  assert.ok(totalMs < 20000, `50-player load test took too long: ${Math.round(totalMs)}ms`);
  assert.ok(p95AckMs < 2500, `p95 ack time too high: ${Math.round(p95AckMs)}ms`);

  console.log(
    [
      `50-player randomized load test passed.`,
      `seed=${seed}`,
      `baseUrl=${baseUrl}`,
      `joinMs=${Math.round(performance.now() - joinStartedAt)}`,
      `totalMs=${Math.round(totalMs)}`,
      `ackCount=${metrics.ackTimes.length}`,
      `p95AckMs=${Math.round(p95AckMs)}`,
      `stateEvents=${metrics.stateEvents}`,
      `captureNotices=${metrics.captureNotices}`,
      `verifications=${metrics.verifications}`,
      `rounds=${handledRounds.size}`
    ].join(" ")
  );
} finally {
  for (const game of engine.games.values()) {
    engine.clearTimers(game);
  }
  for (const client of clients) {
    client?.socket?.disconnect();
  }
  await closeServer(httpServer, ioServer).catch(() => {});
}
