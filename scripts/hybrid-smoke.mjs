import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import WebSocket from "ws";
import { createGameTransport } from "../public/scripts/transport.js";

export const testPhoto = "data:image/png;base64," +
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1" +
  "e1JrAAAAD0lEQVQImWP4jwQYiOMAANuQL9HsugRzAAAAAElFTkSuQmCC";

const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** Remote checks require deliberate opt-in; load tests always stay local. */
export function testTarget(value, { load = false, env = process.env } = {}) {
  const url = new URL(value || "http://127.0.0.1:19131");
  assert(["http:", "https:"].includes(url.protocol), "Use HTTP or HTTPS.");
  assert(!url.username && !url.password && !url.search && !url.hash &&
    url.pathname === "/", "Use an origin without credentials or a path.");
  const local = loopbackHosts.has(url.hostname);
  if (load) assert(local, "The 50-player load gate is restricted to loopback.");
  if (!local) {
    assert.equal(url.protocol, "https:", "Remote checks require HTTPS.");
    assert.equal(env.HYBRID_ALLOW_REMOTE, "1",
      "Remote smoke requires HYBRID_ALLOW_REMOTE=1.");
    if (url.hostname === "cq.bubbleh.com") {
      assert.equal(env.HYBRID_ALLOW_PRODUCTION, "1",
        "Production smoke needs explicit HYBRID_ALLOW_PRODUCTION=1.");
    }
  }
  return url.origin;
}

export async function requestJson(baseUrl, path, payload) {
  const response = await fetch(new URL(path, baseUrl), {
    method: payload === undefined ? "GET" : "POST",
    headers: {
      Origin: baseUrl,
      Accept: "application/json",
      ...(payload === undefined ? {} : { "Content-Type": "application/json" })
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    signal: AbortSignal.timeout(15000)
  });
  const body = await response.json();
  return { status: response.status, body };
}

export function createHybridClient(baseUrl, label = "Hybrid player") {
  const states = [];
  const watchers = new Set();
  const events = new Map();
  const ackTimes = [];
  class BrowserSocket extends WebSocket {
    constructor(url) { super(url, { origin: baseUrl }); }
  }
  const transport = createGameTransport({
    origin: baseUrl,
    autoStart: false,
    WebSocket: BrowserSocket,
    fetch(url, options) {
      return fetch(url, {
        ...options, headers: { ...options.headers, Origin: baseUrl }
      });
    }
  });
  const client = {
    label, transport, states, events, ackTimes, session: null,
    latest: null,
    async action(event, payload = {}, timeoutMs = 20000) {
      const startedAt = performance.now();
      return new Promise((resolve, reject) => {
        transport.timeout(timeoutMs).emit(event, payload, (error, result) => {
          ackTimes.push(performance.now() - startedAt);
          if (error) reject(new Error(`${label}: ${event}: ${error.message}`));
          else resolve(result);
        });
      });
    },
    waitForState(predicate, timeoutMs = 45000) {
      if (client.latest && predicate(client.latest)) {
        return Promise.resolve(client.latest);
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          watchers.delete(watch);
          reject(new Error(`${label}: expected game state did not arrive.`));
        }, timeoutMs);
        function watch(value) {
          if (!predicate(value)) return;
          clearTimeout(timer);
          watchers.delete(watch);
          resolve(value);
        }
        watch.cancel = () => {
          clearTimeout(timer);
          watchers.delete(watch);
          reject(new Error(`${label}: the client closed while awaiting state.`));
        };
        watchers.add(watch);
      });
    },
    close() {
      for (const watch of [...watchers]) watch.cancel();
      transport.close();
    }
  };
  transport.on("session", (value) => { client.session = value; });
  transport.on("game_state", (value) => {
    client.latest = value;
    states.push(value);
    if (states.length > 80) states.shift();
    for (const watch of [...watchers]) watch(value);
  });
  for (const event of ["round_started", "round_result", "submission_result",
    "game_ended", "left_game", "session_lost"]) {
    transport.on(event, (payload) => {
      const history = events.get(event) || [];
      history.push(payload);
      if (history.length > 40) history.shift();
      events.set(event, history);
    });
  }
  return client;
}

export function timingSummary(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50Ms: Number((sorted[Math.floor(sorted.length * 0.5)] || 0).toFixed(2)),
    p95Ms: Number((sorted[Math.min(sorted.length - 1,
      Math.floor(sorted.length * 0.95))] || 0).toFixed(2))
  };
}

export async function completeGame(owner, { timeoutMs = 45000 } = {}) {
  const seenRounds = new Set();
  let lastSubmissionAt = 0;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const game = await owner.waitForState((value) =>
      value.lastResult?.status === "ended" ||
      value.currentRound?.status === "active" &&
        !seenRounds.has(value.currentRound.id), timeoutMs);
    if (game.lastResult?.status === "ended") {
      assert(game.roundsAwarded >= game.normalRounds,
        "The game ended before the configured winning rounds.");
      return game;
    }
    const round = game.currentRound;
    seenRounds.add(round.id);
    const previous = game.roundsAwarded;
    const delay = 1100 - (Date.now() - lastSubmissionAt);
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    lastSubmissionAt = Date.now();
    const result = await owner.action("submit_capture", {
      gameId: game.id, challengeId: round.id, imageDataUrl: testPhoto
    });
    assert.equal(result.ok, true, "A valid local test capture was rejected.");
    await owner.waitForState((value) => value.roundsAwarded > previous,
      timeoutMs);
    const late = await owner.action("submit_capture", {
      gameId: game.id, challengeId: round.id, imageDataUrl: testPhoto
    });
    assert.equal(late.ok, true);
    assert.equal(late.ignored, true, "A solved challenge must ignore late photos.");
  }
  throw new Error("The game exceeded the bounded round limit.");
}

export async function cleanupGame(owner, clients) {
  if (owner?.latest && ["running", "loading", "paused"].includes(
    owner.latest.status
  )) {
    await owner.action("end_game", { gameId: owner.latest.id }).catch(() => {});
  }
  for (const client of [...clients].reverse()) {
    if (client.transport.connected && client.session) {
      await client.action("leave_game", {
        gameId: client.session.gameId
      }, 3000).catch(() => {});
    }
    client.close();
  }
}

/** This gate creates only its own two-player room and never prints secrets. */
export async function runSmoke(options = {}) {
  const baseUrl = testTarget(options.baseUrl);
  const verifyCaptures = options.verifyCaptures === true;
  const timeoutMs = options.timeoutMs || 90000;
  const health = await requestJson(baseUrl, "/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);
  const clients = [];
  const owner = createHybridClient(baseUrl, "Smoke owner");
  clients.push(owner);
  const milestones = [];
  try {
    const created = await owner.action("create_game", { username: "Smoke Owner" });
    assert.equal(created.ok, true, "Owner registration failed.");
    assert.match(created.gameId, /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
    assert.equal(typeof created.resumeToken, "string");
    assert(created.resumeToken.length >= 32, "Resume credentials are too short.");
    assert(created.qrCode.startsWith("data:image/"));
    assert.equal(new URL(created.gameUrl).searchParams.get("game"), created.gameId);
    await owner.waitForState((game) => game.status === "lobby");
    milestones.push("native registration and authenticated snapshot");

    const forged = await requestJson(baseUrl,
      `/api/games/${created.gameId}/rejoin`, {
        playerId: created.playerId, clientId: crypto.randomUUID()
      });
    assert.equal(forged.body.ok, false,
      "A public player ID must not authorize a reconnect.");
    milestones.push("public-ID owner impersonation rejected");

    const guest = createHybridClient(baseUrl, "Smoke guest");
    clients.push(guest);
    const joined = await guest.action("join_game", {
      gameId: created.gameId, username: "Smoke Guest"
    });
    assert.equal(joined.ok, true, "Guest registration failed.");
    await guest.waitForState((game) => game.players.length === 2);
    const denied = await guest.action("update_game_options", {
      gameId: created.gameId, challengeLanguage: "fr"
    });
    assert.equal(denied.ok, false, "A guest must not control host settings.");

    const replacement = createHybridClient(baseUrl, "Resumed guest");
    clients.push(replacement);
    const resumed = await replacement.action("rejoin_game", {
      gameId: joined.gameId, playerId: joined.playerId,
      resumeToken: joined.resumeToken
    });
    assert.equal(resumed.ok, true);
    assert.equal(resumed.playerId, joined.playerId);
    await replacement.waitForState((game) => game.me?.id === joined.playerId);
    milestones.push("host authorization and secret-authenticated resume");

    assert.equal((await replacement.action("set_ready", {
      gameId: created.gameId, ready: false
    })).ok, true);
    assert.equal((await owner.action("start_game", {
      gameId: created.gameId
    })).ok, false, "An unready player must block game start.");
    assert.equal((await replacement.action("set_ready", {
      gameId: created.gameId, ready: true
    })).ok, true);
    assert.equal((await owner.action("start_game", {
      gameId: created.gameId
    })).ok, true);
    const active = await owner.waitForState((game) =>
      game.currentRound?.status === "active", timeoutMs);
    const malformed = await owner.action("submit_capture", {
      gameId: created.gameId, challengeId: active.currentRound.id,
      imageDataUrl: "data:image/jpeg;base64,AAAA"
    });
    assert.equal(malformed.ok, false, "Malformed image data must be rejected.");
    assert.equal((await owner.action("pause_game", {
      gameId: created.gameId
    })).ok, true);
    await owner.waitForState((game) => game.status === "paused");
    assert.equal((await owner.action("resume_game", {
      gameId: created.gameId
    })).ok, true);
    await owner.waitForState((game) => game.status === "running");
    milestones.push("ready gate, malformed photo rejection, pause and resume");
    if (verifyCaptures) {
      const ended = await completeGame(owner, { timeoutMs });
      await owner.waitForState((game) => game.archivalStatus === "saved",
        timeoutMs);
      milestones.push(`complete ${ended.roundsAwarded}-round game and archive`);
    }
    return {
      ok: true, baseUrl, players: 2, verifyCaptures, milestones,
      acknowledgements: timingSummary(clients.flatMap((client) => client.ackTimes))
    };
  } finally {
    await cleanupGame(owner, clients);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(await runSmoke({
      baseUrl: process.env.TEST_BASE_URL || process.env.BASE_URL,
      verifyCaptures: process.env.HYBRID_VERIFY_CAPTURES === "1"
    }), null, 2));
  } catch (error) {
    console.error(`Hybrid smoke failed: ${error.message}`);
    process.exitCode = 1;
  }
}
