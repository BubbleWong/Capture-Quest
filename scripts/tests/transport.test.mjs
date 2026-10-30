import assert from "node:assert/strict";
import { test } from "node:test";
import { createGameTransport } from "../../public/scripts/transport.js";

const secureSession = {
  ok: true,
  gameId: "ABC123",
  playerId: "player-1",
  resumeToken: "server-issued-secret",
  gameUrl: "https://game.example/?game=ABC123",
  qrCode: "data:image/png;base64,test"
};

function fixture({ responses = [], autoStart = false,
  heartbeatIntervalMs = 0 } = {}) {
  const requests = [];
  const timers = new Map();
  let timerId = 0;
  class Socket {
    static instances = [];

    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.listeners = new Map();
      this.sent = [];
      Socket.instances.push(this);
    }

    addEventListener(event, listener) {
      if (!this.listeners.has(event)) this.listeners.set(event, []);
      this.listeners.get(event).push(listener);
    }

    dispatch(event, value = {}) {
      for (const listener of this.listeners.get(event) || []) listener(value);
    }

    open() {
      this.readyState = 1;
      this.dispatch("open");
    }

    message(value) {
      this.dispatch("message", { data: JSON.stringify(value) });
    }

    send(value) {
      if (this.readyState !== 1) throw new Error("Not open");
      this.sent.push(value === "ping" ? value : JSON.parse(value));
    }

    close() {
      this.readyState = 3;
      this.dispatch("close");
    }
  }

  const transport = createGameTransport({
    origin: "https://game.example",
    WebSocket: Socket,
    random: () => 0.5,
    autoStart,
    heartbeatIntervalMs,
    setTimeout(callback, delay) {
      const id = ++timerId;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    async fetch(url, options) {
      requests.push({ url: String(url), ...options });
      const next = responses.shift() || { body: secureSession };
      if (next.error) throw next.error;
      return new Response(JSON.stringify(next.body), {
        status: next.status || 200
      });
    }
  });

  return {
    transport, requests, timers, Socket,
    runTimer(delay) {
      const entry = [...timers].find(([, timer]) => timer.delay === delay);
      assert(entry, `Expected a ${delay}ms timer`);
      timers.delete(entry[0]);
      entry[1].callback();
    }
  };
}

function emit(transport, event, payload = {}, timeoutMs = 20000) {
  return new Promise((resolve) => {
    transport.timeout(timeoutMs).emit(event, payload, (error, response) => {
      resolve({ error, response });
    });
  });
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

async function join(context) {
  const result = emit(context.transport, "join_game", { gameId: "ABC123" });
  await flush();
  const socket = context.Socket.instances.at(-1);
  socket.open();
  socket.message({ event: "authenticated", payload: { ok: true } });
  socket.message({ event: "game_state", payload: { id: "ABC123" } });
  assert.equal((await result).response.ok, true);
  return socket;
}

test("registration authenticates after upgrade without a secret in the URL", async () => {
  const context = fixture();
  const states = [];
  const connects = [];
  context.transport.on("game_state", (value) => states.push(value));
  context.transport.on("connect", (value) => connects.push(value));
  const result = emit(context.transport, "create_game", { username: "Host" });
  await flush();
  const socket = context.Socket.instances[0];
  assert.equal(context.requests[0].url, "https://game.example/api/games");
  assert.equal(context.requests[0].credentials, "same-origin");
  assert.equal(socket.url, "wss://game.example/api/games/ABC123/ws");
  assert(!socket.url.includes(secureSession.resumeToken));
  socket.open();
  assert.deepEqual(socket.sent[0], {
    event: "authenticate",
    payload: {
      playerId: secureSession.playerId,
      resumeToken: secureSession.resumeToken
    }
  });
  socket.message({ event: "game_state", payload: { private: true } });
  assert.equal(states.length, 0);
  socket.message({ event: "authenticated", payload: { ok: true } });
  let completed = false;
  result.then(() => { completed = true; });
  await flush();
  assert.equal(completed, false,
    "Authentication alone must not render a lobby before its snapshot.");
  assert.deepEqual(connects, [{ roomConnected: true }]);
  socket.message({ event: "game_state", payload: { id: "ABC123" } });
  assert.equal((await result).response.ok, true);
  assert.deepEqual(states, [{ id: "ABC123" }]);
  context.transport.close();
});

test("acknowledgements complete once and stale replies cannot repeat them", async () => {
  const context = fixture();
  const socket = await join(context);
  let callbacks = 0;
  context.transport.timeout(2000).emit("set_ready", { ready: true },
    (error, response) => {
      assert.equal(error, null);
      assert.equal(response.ok, true);
      callbacks += 1;
    });
  const request = socket.sent.at(-1);
  assert.equal(request.event, "set_ready");
  socket.message({ id: request.id, ack: { ok: true } });
  socket.message({ id: request.id, ack: { ok: true } });
  assert.equal(callbacks, 1);
  assert.equal(context.timers.size, 0);
  context.transport.close();
});

test("a disconnected mutation fails without replay during secret-authenticated resume", async () => {
  const context = fixture();
  const socket = await join(context);
  const pending = emit(context.transport, "submit_capture", {
    challengeId: "round-1", imageDataUrl: "data:image/jpeg;base64,AAAA"
  });
  socket.close();
  assert((await pending).error instanceof Error);
  assert.equal(context.transport.connected, false);
  context.runTimer(500);
  await flush();
  const resumeRequest = context.requests[1];
  assert.equal(resumeRequest.url,
    "https://game.example/api/games/ABC123/rejoin");
  assert.equal(JSON.parse(resumeRequest.body).resumeToken,
    secureSession.resumeToken);
  const replacement = context.Socket.instances[1];
  replacement.open();
  replacement.message({ event: "authenticated", payload: { ok: true } });
  replacement.message({ event: "game_state", payload: { id: "ABC123" } });
  await flush();
  assert.deepEqual(replacement.sent.map((message) => message.event),
    ["authenticate"]);
  assert.equal(context.transport.connected, true);
  context.transport.close();
});

test("kicked tabs stop reconnecting even when the UI preserves the session", async () => {
  const context = fixture();
  const socket = await join(context);
  const notices = [];
  context.transport.on("left_game", (value) => notices.push(value));
  socket.message({
    event: "left_game", payload: { preserveSession: true }
  });
  assert.deepEqual(notices, [{ preserveSession: true }]);
  assert.equal(context.timers.size, 0);
  assert.equal(context.requests.length, 1);
  const pending = await emit(context.transport, "set_ready", { ready: true });
  assert(pending.error instanceof Error);
  context.transport.close();
});

test("ack timeout does not retry a mutation", async () => {
  const context = fixture();
  const socket = await join(context);
  const pending = emit(context.transport, "skip_round", {}, 1234);
  context.runTimer(1234);
  assert((await pending).error instanceof Error);
  assert.equal(socket.sent.filter((message) => message.event === "skip_round")
    .length, 1);
  assert.equal(context.requests.length, 1);
  context.transport.close();
});

test("departure notification can precede the leave acknowledgement", async () => {
  const context = fixture();
  const socket = await join(context);
  const departure = emit(context.transport, "leave_game", { gameId: "ABC123" });
  socket.message({ event: "left_game", payload: { preserveSession: false } });
  const result = await departure;
  assert.equal(result.error, null);
  assert.equal(result.response.ok, true);
  assert.equal(context.timers.size, 0);
  context.transport.close();
});

test("an expired resume secret clears automatic retries", async () => {
  const context = fixture({ responses: [
    { body: secureSession },
    { status: 403, body: { ok: false, error: "Session expired." } }
  ] });
  const socket = await join(context);
  const errors = [];
  context.transport.on("session_lost", (value) => errors.push(value));
  socket.close();
  context.runTimer(500);
  await flush();
  assert.equal(errors[0].error, "Session expired.");
  assert.equal(context.timers.size, 0);
  assert.equal(context.Socket.instances.length, 1);
  context.transport.close();
});

test("transient HTTP failures retry resume and do not discard the session", async () => {
  const context = fixture({ responses: [
    { body: secureSession },
    { status: 503, body: { ok: false, error: "Temporarily unavailable." } },
    { body: secureSession }
  ] });
  const socket = await join(context);
  socket.close();
  context.runTimer(500);
  await flush();
  context.runTimer(1000);
  await flush();
  const replacement = context.Socket.instances[1];
  replacement.open();
  replacement.message({ event: "authenticated", payload: { ok: true } });
  replacement.message({ event: "game_state", payload: { id: "ABC123" } });
  await flush();
  assert.equal(context.transport.connected, true);
  assert.equal(context.requests.length, 3);
  context.transport.close();
});

test("parallel create requests cannot create duplicate rooms", async () => {
  const context = fixture();
  const first = emit(context.transport, "create_game");
  const second = await emit(context.transport, "create_game");
  assert.equal(second.response.ok, false);
  await flush();
  assert.equal(context.requests.length, 1);
  const socket = context.Socket.instances[0];
  socket.open();
  socket.message({ event: "authenticated", payload: { ok: true } });
  socket.message({ event: "game_state", payload: { id: "ABC123" } });
  assert.equal((await first).response.ok, true);
  context.transport.close();
});

test("boot reports availability without opening an unauthenticated socket", async () => {
  const context = fixture({
    autoStart: true, responses: [{ body: { ok: true } }]
  });
  const connects = [];
  context.transport.on("connect", (value) => connects.push(value));
  await flush();
  assert.deepEqual(connects, [{ roomConnected: false }]);
  assert.equal(context.requests[0].url, "https://game.example/api/health");
  assert.equal(context.Socket.instances.length, 0);
  context.transport.close();
});

test("hibernatable heartbeats keep idle connections healthy without game events", async () => {
  const context = fixture({ heartbeatIntervalMs: 25000 });
  const socket = await join(context);
  context.runTimer(25000);
  assert.equal(socket.sent.at(-1), "ping");
  assert([...context.timers.values()].some((timer) => timer.delay === 10000));
  socket.dispatch("message", { data: "pong" });
  assert(![...context.timers.values()].some((timer) => timer.delay === 10000));
  assert([...context.timers.values()].some((timer) => timer.delay === 25000));
  assert.equal(context.transport.connected, true);
  context.transport.close();
  assert.equal(context.timers.size, 0);
});

test("a missing heartbeat reply closes the dead connection and resumes safely", async () => {
  const context = fixture({ heartbeatIntervalMs: 25000 });
  const socket = await join(context);
  context.runTimer(25000);
  context.runTimer(10000);
  assert.equal(context.transport.connected, false);
  assert.equal(socket.readyState, 3);
  assert([...context.timers.values()].some((timer) => timer.delay === 500));
  context.transport.close();
});
