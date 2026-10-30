import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import {
  cleanupGame, completeGame, createHybridClient, testTarget, timingSummary
} from "./hybrid-smoke.mjs";

const sleep = (ms, signal) => new Promise((resolve) => {
  if (signal.aborted) return resolve();
  const timer = setTimeout(done, ms);
  function done() {
    clearTimeout(timer);
    signal.removeEventListener("abort", done);
    resolve();
  }
  signal.addEventListener("abort", done, { once: true });
});

/** Fake AI/storage only; transport, DO state and job leases remain real. */
export async function runMockWorker(baseUrl, token, signal) {
  testTarget(baseUrl, { load: true });
  assert(typeof token === "string" && token.length >= 32,
    "The mock task consumer needs the local runtime WORKER_TOKEN.");
  const workerId = `load-${crypto.randomUUID()}`;
  let generated = 0;
  const jobs = {};
  async function post(path, body) {
    const response = await fetch(new URL(path, baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`, "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)])
    });
    assert.equal(response.status, 200, "Local task protocol rejected the mock worker.");
    const result = await response.json();
    assert.equal(result.ok, true, "Local task request failed.");
    return result;
  }
  while (!signal.aborted) {
    let claim;
    try {
      claim = await post("/internal/worker/claim", { workerId, limit: 1 });
    } catch (error) {
      if (signal.aborted) break;
      throw error;
    }
    const job = claim.job;
    if (!job) {
      await sleep(75, signal);
      continue;
    }
    jobs[job.type] = (jobs[job.type] || 0) + 1;
    let result;
    switch (job.type) {
      case "prepareInitialItems":
      case "generateItems":
        generated += 1;
        result = Array.from({ length: 20 }, (_, index) =>
          `test object ${generated} ${index + 1}`);
        break;
      case "prepareAudio": result = ""; break;
      case "verifyPhoto":
        result = { match: true, confidence: 1, reason: "Deterministic local fixture." };
        break;
      case "saveGameResult":
        result = { saved: true, resultId: job.payload.resultId };
        break;
      default: throw new Error("Unexpected task type in the bounded load fixture.");
    }
    try {
      await post("/internal/worker/result", {
        workerId, jobId: job.id, leaseToken: job.leaseToken, ok: true, result
      });
    } catch (error) {
      if (signal.aborted) break;
      throw error;
    }
  }
  return jobs;
}

export async function runLoad(options = {}) {
  const baseUrl = testTarget(options.baseUrl, { load: true });
  const clients = [];
  const owner = createHybridClient(baseUrl, "Load host");
  clients.push(owner);
  const startedAt = performance.now();
  let gameId;
  try {
    const created = await owner.action("create_game", { username: "Load Host" });
    assert.equal(created.ok, true, "Load room creation failed.");
    gameId = created.gameId;
    for (let index = 1; index < 50; index += 1) {
      const client = createHybridClient(baseUrl, `Load player ${index}`);
      clients.push(client);
      const joined = await client.action("join_game", {
        gameId, username: `Load Player ${index}`
      });
      assert.equal(joined.ok, true, `Player ${index} could not join.`);
    }
    await Promise.all(clients.map((client) => client.waitForState((game) =>
      game.players.length === 50, 15000)));

    const overflow = createHybridClient(baseUrl, "Overflow player");
    clients.push(overflow);
    const full = await overflow.action("join_game", { gameId, username: "Overflow" });
    assert.equal(full.ok, false, "The 51st player must be rejected.");
    overflow.close();

    const unauthorized = await clients[2].action("start_game", { gameId });
    assert.equal(unauthorized.ok, false, "Only the host may start the game.");
    const unready = await clients[1].action("set_ready", { gameId, ready: false });
    assert.equal(unready.ok, true);
    assert.equal((await owner.action("start_game", { gameId })).ok, false);
    assert.equal((await clients[1].action("set_ready", {
      gameId, ready: true
    })).ok, true);

    const originalGuest = clients[1];
    const resumedGuest = createHybridClient(baseUrl, "Resumed load player");
    clients.push(resumedGuest);
    const resumed = await resumedGuest.action("rejoin_game", {
      gameId, playerId: originalGuest.session.playerId,
      resumeToken: originalGuest.session.resumeToken
    });
    assert.equal(resumed.ok, true);
    await resumedGuest.waitForState((game) => game.players.length === 50);
    assert.equal(resumedGuest.latest.me.id, originalGuest.session.playerId);

    assert.equal((await owner.action("start_game", { gameId })).ok, true);
    const final = await completeGame(owner, {
      timeoutMs: options.timeoutMs || 90000
    });
    await owner.waitForState((game) => game.archivalStatus === "saved", 45000);
    assert.equal(final.players.length, 50);
    assert.equal(final.winner?.id, created.playerId);
    return {
      ok: true, baseUrl, transport: "native-websocket", players: 50,
      overflowRejected: true, ownerAuthorization: true, secureResume: true,
      rounds: final.roundsAwarded,
      elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
      snapshotSamples: clients.reduce((sum, client) => sum + client.states.length, 0),
      acknowledgements: timingSummary(clients.flatMap((client) => client.ackTimes))
    };
  } finally {
    await cleanupGame(owner, clients);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const controller = new AbortController();
  let mock;
  try {
    const baseUrl = testTarget(process.env.TEST_BASE_URL || process.env.BASE_URL,
      { load: true });
    if (process.env.HYBRID_MOCK_WORKER === "1") {
      // Observe errors immediately while the client gate is still executing.
      mock = runMockWorker(baseUrl, process.env.WORKER_TOKEN, controller.signal);
      mock.catch(() => controller.abort());
    }
    const result = await runLoad({ baseUrl });
    controller.abort();
    if (mock) result.mockTaskCounts = await mock;
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    controller.abort();
    await mock?.catch(() => {});
    console.error(`Hybrid 50-player gate failed: ${error.message}`);
    process.exitCode = 1;
  }
}
