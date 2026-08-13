import assert from "node:assert/strict";
import { io } from "socket.io-client";

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

function connectSocket() {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false
    });
    const timer = setTimeout(() => reject(new Error("Socket connection timed out.")), 8000);
    socket.on("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on("connect_error", reject);
  });
}

function emitAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(10000).emit(event, payload, (error, response) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}

function waitForState(states, predicate, timeoutMs = 12000) {
  const existing = states.at(-1);
  if (existing && predicate(existing)) return Promise.resolve(existing);

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const next = states.at(-1);
      if (next && predicate(next)) {
        clearInterval(timer);
        resolve(next);
      } else if (Date.now() - startedAt > timeoutMs) {
        clearInterval(timer);
        reject(new Error("Timed out waiting for expected game state."));
      }
    }, 100);
  });
}

function waitForSocketEvent(socket, event, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handleEvent);
      reject(new Error(`Timed out waiting for ${event}.`));
    }, timeoutMs);
    function handleEvent(payload) {
      clearTimeout(timer);
      resolve(payload);
    }
    socket.once(event, handleEvent);
  });
}

const socket = await connectSocket();
let playerSocket = null;
let rejoinedPlayerSocket = null;
const states = [];
socket.on("game_state", (state) => states.push(state));

try {
  const ownerClientId = "10000000-0000-4000-8000-000000000001";
  const playerClientId = "20000000-0000-4000-8000-000000000002";
  const created = await emitAck(socket, "create_game", { username: "Smoke Tester", clientId: ownerClientId });
  assert.equal(created.ok, true);
  assert.match(created.gameId, /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
  assert.equal(Boolean(created.qrCode), true);
  assert.equal(new URL(created.gameUrl).searchParams.get("game"), created.gameId);

  await waitForState(states, (state) => state.status === "lobby");
  playerSocket = await connectSocket();
  const joined = await emitAck(playerSocket, "join_game", {
    gameId: created.gameId,
    username: "Reconnect Tester",
    clientId: playerClientId
  });
  assert.equal(joined.ok, true);
  assert.notEqual(joined.playerId, created.playerId);

  rejoinedPlayerSocket = await connectSocket();
  const kickedPreviousSession = waitForSocketEvent(playerSocket, "left_game");
  const previousSessionDisconnected = waitForSocketEvent(playerSocket, "disconnect");
  const rejoined = await emitAck(rejoinedPlayerSocket, "join_game", {
    gameId: created.gameId,
    username: "Reconnect Tester",
    clientId: playerClientId
  });
  assert.equal(rejoined.ok, true);
  assert.equal(rejoined.playerId, joined.playerId);
  const kickedMessage = await kickedPreviousSession;
  assert.match(kickedMessage.message, /another tab or device/);
  assert.equal(kickedMessage.preserveSession, true);
  await previousSessionDisconnected;

  const ready = await emitAck(socket, "set_ready", { gameId: created.gameId, ready: true });
  assert.equal(ready.ok, true);

  const rejoinedUnready = await emitAck(rejoinedPlayerSocket, "set_ready", { gameId: created.gameId, ready: false });
  assert.equal(rejoinedUnready.ok, true);

  const blockedStart = await emitAck(socket, "start_game", { gameId: created.gameId });
  assert.equal(blockedStart.ok, false);
  assert.match(blockedStart.error, /Every player must be ready/);

  const rejoinedReady = await emitAck(rejoinedPlayerSocket, "set_ready", { gameId: created.gameId, ready: true });
  assert.equal(rejoinedReady.ok, true);

  const started = await emitAck(socket, "start_game", { gameId: created.gameId });
  assert.equal(started.ok, true);
  const activeRound = await waitForState(states, (state) => state.currentRound?.status === "active");
  assert.equal(activeRound.status, "running");
  assert.equal(typeof activeRound.currentRound.item, "string");

  const paused = await emitAck(socket, "pause_game", { gameId: created.gameId });
  assert.equal(paused.ok, true);
  const pausedState = await waitForState(states, (state) => state.status === "paused");
  assert.equal(pausedState.currentRound.id, activeRound.currentRound.id);

  const ignoredWhilePaused = await emitAck(socket, "submit_capture", {
    gameId: created.gameId,
    challengeId: activeRound.currentRound.id,
    imageDataUrl: tinyPng
  });
  assert.equal(ignoredWhilePaused.ok, true);
  assert.equal(ignoredWhilePaused.ignored, true);

  const resumed = await emitAck(socket, "resume_game", { gameId: created.gameId });
  assert.equal(resumed.ok, true);
  const resumedState = await waitForState(states, (state) => state.status === "running");

  const submitted = await emitAck(socket, "submit_capture", {
    gameId: created.gameId,
    challengeId: resumedState.currentRound.id,
    imageDataUrl: tinyPng
  });
  assert.equal(submitted.ok, true);

  const scored = await waitForState(states, (state) =>
    state.players.some((player) => player.username === "Smoke Tester" && player.score === 1)
  );
  assert.equal(scored.lastResult.status, "found");
  assert.equal(scored.roundsAwarded, 1);

  console.log(`Smoke test passed against ${baseUrl}.`);
} finally {
  playerSocket?.disconnect();
  rejoinedPlayerSocket?.disconnect();
  socket.disconnect();
}
