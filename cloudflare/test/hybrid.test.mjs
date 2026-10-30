import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdir, mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { decodeState, encodeState } from '../shared.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const origin = 'https://game.test';
const token = 'test-worker-secret-'.repeat(3);
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7uQAAAAASUVORK5CYII=';
let folder;
let mf;
let bundle;
const sockets = [];

async function runtime() {
  return new Miniflare({ ...convertV4MiniflareOptions({
    name: 'game',
    modules: true, script: await readFile(bundle, 'utf8'),
    compatibilityDate: '2026-10-30', compatibilityFlags: ['nodejs_compat'],
    durableObjects: {
      ROOMS: { className: 'GameRoom', useSQLite: true },
      BROKER: { className: 'JobBroker', useSQLite: true },
      LIMITS: { className: 'TrafficLimits', useSQLite: true }
    },
    durableObjectsPersist: path.join(folder, 'state'),
    bindings: { WORKER_TOKEN: token, ASSET_VERSION: 'test', TEST_GAME_CONFIG: JSON.stringify({ normalRounds: 1, nextRoundDelayMs: 30, objectTimeoutMs: 10000 }) },
    serviceBindings: { ASSETS: () => new Response('test') }
  }), unsafeInspectDurableObjects: true });
}
before(async () => {
  const artifactRoot = process.env.CAPTURE_QUEST_TEST_ARTIFACT_ROOT || os.tmpdir();
  await mkdir(artifactRoot, { recursive: true });
  folder = await mkdtemp(path.join(artifactRoot, 'capture-quest-runtime-'));
  bundle = path.join(folder, 'worker.mjs');
  await build({ entryPoints: [path.join(root, 'cloudflare/index.js')], outfile: bundle,
    bundle: true, format: 'esm', platform: 'browser', external: ['cloudflare:workers', 'node:*'] });
  mf = await runtime();
}, { timeout: 30000 });
after(async () => {
  for (const socket of sockets) { try { socket.ws.close(); } catch {} }
  await mf?.dispose();
  if (folder) await rm(folder, { recursive: true, force: true });
});
async function post(route, payload, internal = false) {
  const response = await mf.dispatchFetch(`${origin}${route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin,
      ...(internal ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload)
  });
  return { status: response.status, body: await response.json() };
}
async function until(fn, label) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const result = await fn();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error(`Timed out: ${label}`);
}
async function connect(session) {
  const response = await mf.dispatchFetch(`${origin}/api/games/${session.gameId}/ws`, {
    headers: { Upgrade: 'websocket', Origin: origin }
  });
  assert.equal(response.status, 101);
  const ws = response.webSocket;
  const client = { ws, frames: [], session };
  ws.accept();
  ws.addEventListener('message', (event) => client.frames.push(JSON.parse(event.data)));
  sockets.push(client);
  ws.send(JSON.stringify({ event: 'authenticate', payload: { playerId: session.playerId, resumeToken: session.resumeToken } }));
  await until(() => client.frames.find((frame) => frame.event === 'authenticated'), 'authenticate');
  await until(() => client.frames.find((frame) => frame.event === 'game_state'), 'snapshot');
  return client;
}
let seq = 0;
async function action(client, event, payload = {}) {
  const id = `request-${++seq}`;
  client.ws.send(JSON.stringify({ id, event, payload }));
  return until(() => client.frames.find((frame) => frame.id === id)?.ack, event);
}
function latest(client) { return client.frames.filter((frame) => frame.event === 'game_state').at(-1)?.payload; }
async function claim() {
  const claimed = await post('/internal/worker/claim', { workerId: 'test-worker', limit: 1 }, true);
  assert.equal(claimed.status, 200);
  return claimed.body.job;
}
async function complete(job, result, ok = true) {
  return post('/internal/worker/result', {
    workerId: 'test-worker', jobId: job.id, leaseToken: job.leaseToken, ok, result,
    ...(ok ? {} : { error: { code: 'PROVIDER_UNAVAILABLE', retryable: false } })
  }, true);
}
async function nextJob(type) {
  return until(async () => {
    const job = await claim();
    if (!job) return null;
    assert.equal(job.type, type);
    return job;
  }, `claim ${type}`);
}

test('state codec preserves Maps/Sets and discards runtime-only timers', () => {
  const value = { players: new Map([['a', { score: 3 }]]), currentRound: { skipVotes: new Set(['a']) }, roundTimer: { fake: true }, loadingItems: Promise.resolve() };
  const restored = decodeState(encodeState(value));
  assert.equal(restored.players.get('a').score, 3);
  assert(restored.currentRound.skipVotes.has('a'));
  assert.equal(restored.roundTimer, null);
  assert.equal(restored.loadingItems, null);
});

test('actual Workers runtime enforces auth, runs FIFO jobs and archives results', { timeout: 30000 }, async () => {
  assert.equal((await post('/api/games', {}, false)).status, 200);
  const registration = await post('/api/games', { username: 'Owner' });
  assert.equal(registration.status, 200);
  const ownerSession = registration.body;
  assert.match(ownerSession.qrCode, /^data:image\/svg\+xml/);
  const owner = await connect(ownerSession);
  const guestSession = (await post(`/api/games/${ownerSession.gameId}/join`, { username: 'Guest' })).body;
  const guest = await connect(guestSession);
  const theft = await post(`/api/games/${ownerSession.gameId}/rejoin`, { playerId: ownerSession.playerId });
  assert.equal(theft.status, 400);
  assert.equal((await action(guest, 'update_game_options', { challengeLanguage: 'fr' })).ok, false);
  assert.equal((await action(owner, 'constructor')).ok, false);
  assert.equal((await action(owner, '__proto__')).ok, false);
  assert.equal((await action(owner, 'start_game')).ok, false);
  await claim();
  assert.equal((await action(owner, 'start_game')).ok, true);
  await mf.unsafeEvictDurableObject('game', 'GameRoom', { name: ownerSession.gameId, webSockets: 'hibernate' });
  const items = await nextJob('generateItems');
  await complete(items, ['book', 'cup', 'pencil', 'shoe', 'chair', 'towel']);
  const audio = await nextJob('prepareAudio');
  await complete(audio, null, false);
  await until(() => latest(owner)?.currentRound?.status === 'active', 'running round');
  assert.equal((await action(owner, 'pause_game')).ok, true);
  assert.equal((await action(owner, 'resume_game')).ok, true);
  const challengeId = latest(owner).currentRound.id;
  assert.equal((await action(owner, 'submit_capture', { challengeId, imageDataUrl: 'data:image/svg+xml;base64,AAAA' })).ok, false);
  assert.equal((await action(owner, 'submit_capture', { challengeId, imageDataUrl: photo })).ok, true);
  assert.equal((await action(owner, 'submit_capture', { challengeId, imageDataUrl: photo })).ok, false);
  assert.equal((await action(guest, 'submit_capture', { challengeId, imageDataUrl: photo })).ok, true);
  const first = await nextJob('verifyPhoto');
  assert.equal((await action(owner, 'pause_game')).ok, true);
  await complete(first, { match: false, confidence: 0.9, reason: 'Not a book' });
  const brokerSql = await mf.unsafeGetDurableObjectStorage('game', 'JobBroker', { name: 'jobs' });
  await until(async () => (await brokerSql.exec('SELECT delivered FROM jobs WHERE id=?', first.id))[0]?.delivered === 1, 'paused result durably delivered');
  await mf.unsafeEvictDurableObject('game', 'GameRoom', { name: ownerSession.gameId, webSockets: 'hibernate' });
  assert.equal(latest(owner).status, 'paused');
  assert.equal((await action(owner, 'resume_game')).ok, true);
  const second = await nextJob('verifyPhoto');
  assert.notEqual(first.id, second.id);
  const win = await complete(second, { match: true, confidence: 0.99 });
  assert.equal(win.status, 200);
  assert.equal((await complete(second, { match: true, confidence: 0.99 })).body.duplicate, true);
  await until(() => latest(guest)?.roundsAwarded === 1, 'one point only');
  await until(() => latest(guest)?.lastResult?.status === 'ended', 'durable deadline ends game');
  const archive = await nextJob('saveGameResult');
  assert.match(archive.payload.resultId, new RegExp(`^${ownerSession.gameId}:`));
  assert.match(archive.payload.endedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert(Date.now() - Date.parse(archive.payload.endedAt) < 5000);
  assert.equal(archive.payload.players.find((p) => p.id === ownerSession.playerId).score, -1);
  assert.equal(archive.payload.players.find((p) => p.id === guestSession.playerId).score, 1);
  await complete(archive, { saved: true });
  assert.equal((await action(owner, 'end_game')).ok, false);
  const health = await (await mf.dispatchFetch(`${origin}/api/health`)).json();
  assert.equal(health.workerOnline, true);
  assert.equal(health.architecture, 'cloudflare-hybrid');
});

test('cross-origin creates and unauthenticated task consumption fail closed', async () => {
  const denied = await mf.dispatchFetch(`${origin}/api/games`, { method: 'POST', headers: { Origin: 'https://evil.test' }, body: '{}' });
  assert.equal(denied.status, 403);
  const deniedTask = await mf.dispatchFetch(`${origin}/internal/worker/claim`, { method: 'POST', body: '{}' });
  assert.equal(deniedTask.status, 401);
});


test('late AI results cannot award points after a skip and queued photos stay private', { timeout: 15000 }, async () => {
  const session = (await post('/api/games', { username: 'Late result host' })).body;
  const owner = await connect(session);
  const guest = await connect((await post(`/api/games/${session.gameId}/join`, { username: 'Late guest' })).body);
  await claim();
  assert.equal((await action(owner, 'start_game')).ok, true);
  await complete(await nextJob('generateItems'), ['book', 'cup', 'pencil', 'shoe', 'chair', 'towel']);
  await complete(await nextJob('prepareAudio'), '');
  await until(() => latest(owner)?.currentRound?.status === 'active', 'late result round');
  const challengeId = latest(owner).currentRound.id;
  assert.equal((await action(owner, 'submit_capture', { challengeId, imageDataUrl: photo })).ok, true);
  const pending = await nextJob('verifyPhoto');
  const roomSql = await mf.unsafeGetDurableObjectStorage('game', 'GameRoom', { name: session.gameId });
  const stored = await roomSql.exec('SELECT COUNT(*) AS count FROM photo');
  assert.equal(stored[0].count, 1);
  assert.equal(JSON.stringify(latest(guest)).includes(photo), false);
  await action(owner, 'skip_round', { challengeId });
  await action(guest, 'skip_round', { challengeId });
  await complete(pending, { match: true, confidence: 1 });
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(latest(owner).roundsAwarded, 0);
  assert.equal(latest(owner).players.find(p => p.id === session.playerId).score, 0);
  assert.equal((await roomSql.exec('SELECT COUNT(*) AS count FROM photo'))[0].count, 0);
});


test('daily AI cap prevents new paid work while result archival remains available', async () => {
  const brokerSql = await mf.unsafeGetDurableObjectStorage('game', 'JobBroker', { name: 'jobs' });
  const day = Math.floor(Date.now() / 86400000);
  await brokerSql.exec('INSERT OR REPLACE INTO budget VALUES (?,?)', day, 2000);
  const namespace = await mf.getDurableObjectNamespace('BROKER');
  const broker = namespace.get(namespace.idFromName('jobs'));
  const aiId = crypto.randomUUID();
  const archiveId = crypto.randomUUID();
  for (const [id, type] of [[aiId, 'generateItems'], [archiveId, 'saveGameResult']]) {
    const response = await broker.fetch('https://broker/enqueue', { method: 'POST', body: JSON.stringify({
      id, type, gameId: 'QU0TA1', payload: {}, expiresAt: Date.now() + 60000
    }) });
    assert.equal(response.status, 200);
  }
  const ai = (await brokerSql.exec('SELECT status,result,payload FROM jobs WHERE id=?', aiId))[0];
  assert.equal(ai.status, 'completed');
  assert.equal(ai.payload, '{}');
  assert.equal(JSON.parse(ai.result).error.code, 'DAILY_QUOTA');
  assert.equal((await brokerSql.exec('SELECT status FROM jobs WHERE id=?', archiveId))[0].status, 'queued');
});
