import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { createLocalWorker, ResultSpool } from '../../server/localWorker.js';
import { createJobHandlers, executeJob, validatePhoto } from '../../server/localWorkerJobs.js';
import { createDatabase } from '../../server/database.js';
import { createLlm } from '../../server/llm.js';
import { readLimitedBody } from '../../server/localWorkerHttp.js';

const token = 'a'.repeat(48);
const quiet = { info() {}, warn() {} };

async function directory(t) {
  const location = await fs.mkdtemp(path.join(
    process.env.CAPTURE_QUEST_TEST_DIRECTORY || os.tmpdir(), 'cq-worker-'
  ));
  t.after(() => fs.rm(location, { recursive: true, force: true }));
  return location;
}

function settings(spoolDirectory) {
  return { mode: 'production', localWorker: {
    baseUrl: 'https://game.example', token, workerId: 'local-test', spoolDirectory
  } };
}

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}

function job(type = 'generateItems', payload = {}) {
  return { id: 'job-test', type, payload, leaseToken: 'lease-secret',
    expiresAt: Date.now() + 120000 };
}

test('only fixed task types are executable; arbitrary fetch is rejected', async () => {
  let called = false;
  const handlers = { generateItems() { called = true; } };
  await assert.rejects(executeJob(job('fetch', { url: 'http://private' }), handlers));
  await assert.rejects(executeJob(job('toString'), handlers));
  assert.equal(called, false);
});

test('photos are decoded, downscaled and stripped before vision calls', async () => {
  const png = await sharp({ create: { width: 800, height: 400,
    channels: 3, background: '#ff0000' } }).png().toBuffer();
  const encoded = await validatePhoto(`data:image/png;base64,${png.toString('base64')}`);
  assert(encoded.startsWith('data:image/jpeg;base64,'));
  const clean = await sharp(Buffer.from(encoded.split(',')[1], 'base64')).metadata();
  assert.equal(clean.width, 640);
  assert.equal(clean.height, 320);
  assert.equal(clean.exif, undefined);
});

test('invalid, remote, oversized and decompression-heavy photos are rejected', async () => {
  await assert.rejects(validatePhoto('https://example.com/photo.jpg'));
  await assert.rejects(validatePhoto('data:image/jpeg;base64,AAAA'));
  await assert.rejects(validatePhoto(`data:image/png;base64,${'A'.repeat(700004)}`));
  const png = await sharp({ create: { width: 3000, height: 10,
    channels: 3, background: '#fff' } }).png().toBuffer();
  await assert.rejects(validatePhoto(`data:image/png;base64,${png.toString('base64')}`));
  await assert.rejects(validatePhoto(`data:image/jpeg;base64,${png.toString('base64')}`));
});

test('result is fsynced locally and retried without repeating paid work', async (t) => {
  const location = await directory(t);
  let invocations = 0;
  let claims = 0;
  let resultAttempts = 0;
  const sent = [];
  const worker = createLocalWorker({ config: settings(location), logger: quiet,
    handlers: { generateItems() { invocations++; return ['book']; } },
    async fetchImpl(url, options) {
      assert.equal(options.headers.Authorization, `Bearer ${token}`);
      assert.equal(options.redirect, 'error');
      if (url.endsWith('/claim')) return response({ job: claims++ ? null : job() });
      const record = JSON.parse(options.body);
      sent.push(record);
      return ++resultAttempts === 1 ? response({}, 503) : response({ ok: true });
    }
  });
  await worker.initialize();
  await assert.rejects(worker.runOnce(), /503/);
  assert.equal((await new ResultSpool(location).pending()).length, 1);
  assert.equal((await fs.stat(location)).mode & 0o777, 0o700);
  const [file] = (await fs.readdir(location)).filter((name) => name.endsWith('.json'));
  assert.equal((await fs.stat(path.join(location, file))).mode & 0o777, 0o600);
  await worker.runOnce();
  assert.equal(invocations, 1);
  assert.deepEqual(sent[0], sent[1]);
  assert.equal((await new ResultSpool(location).pending()).length, 0);
});

test('operational vision failure is an error, never a negative match', async (t) => {
  const location = await directory(t);
  let completion;
  const worker = createLocalWorker({ config: settings(location), logger: quiet,
    handlers: { verifyPhoto() { throw new Error('SECRET PROVIDER RESPONSE'); } },
    async fetchImpl(url, options) {
      if (url.endsWith('/claim')) return response({ job: job('verifyPhoto') });
      completion = JSON.parse(options.body);
      return response({ ok: true });
    }
  });
  await worker.initialize();
  await worker.runOnce();
  assert.equal(completion.ok, false);
  assert.equal(completion.error.retryable, true);
  assert(!JSON.stringify(completion).includes('SECRET'));
  assert(!Object.hasOwn(completion, 'result'));
});

test('lost lease is terminal locally and does not block the next task', async (t) => {
  const location = await directory(t);
  const spool = new ResultSpool(location);
  await spool.initialize();
  await spool.save({ workerId: 'test', jobId: 'old', leaseToken: 'old', ok: true });
  const worker = createLocalWorker({ config: settings(location), logger: quiet,
    handlers: {}, spool,
    async fetchImpl(url) {
      return url.endsWith('/result') ? response({}, 409) : response({ job: null });
    }
  });
  assert.equal(await worker.runOnce(), false);
  assert.equal((await spool.pending()).length, 0);
});

test('outbound processor rejects plaintext public origins and URL credentials', () => {
  for (const baseUrl of ['http://game.example', 'https://user:secret@example.com',
    'https://game.example/arbitrary-path']) {
    assert.throws(() => createLocalWorker({
      config: { localWorker: { baseUrl, token } }, handlers: {}
    }));
  }
});

test('provider response byte limit covers streamed bodies', async () => {
  const source = new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(11)); controller.close();
  } });
  await assert.rejects(readLimitedBody(new Response(source), 10));
});

test('production cannot silently fall back to memory persistence', async () => {
  await assert.rejects(createDatabase({ mode: 'production', postgres: {} }, quiet));
  let closed = false;
  await assert.rejects(createDatabase({ mode: 'production', postgres: {
    nodes: 'database.local:5432', user: 'worker'
  } }, quiet, { poolFactory() { return {
    async query() { throw new Error('secret connection detail'); },
    async end() { closed = true; }
  }; } }), /PostgreSQL persistence is unavailable/);
  assert.equal(closed, true);
});

test('runtime database validates TLS, avoids DDL and deduplicates completion', async () => {
  const commands = [];
  let options;
  let committed = false;
  const client = {
    async query(sql) {
      commands.push(sql);
      if (sql.includes('RETURNING id')) {
        const rowCount = committed ? 0 : 1;
        committed = true;
        return { rowCount };
      }
      return { rowCount: 0 };
    }, release() {}
  };
  const db = await createDatabase({ mode: 'production', postgres: {
    nodes: 'database.local:5432', user: 'worker', ssl: true, sslCa: 'trusted-ca',
    sslServerName: 'verified-database.example'
  } }, quiet, { poolFactory(value) { options = value; return {
    query: client.query, async connect() { return client; }, async end() {}
  }; } });
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(options.ssl.ca, 'trusted-ca');
  assert.equal(options.ssl.servername, 'verified-database.example');
  const result = { gameId: 'ABC123', resultId: 'ABC123:run-1',
    roundsPlayed: 1, players: [{ id: 'player', username: 'Player', score: 1 }] };
  await db.saveGameResult(result);
  await db.saveGameResult(result);
  assert.equal(commands.filter((sql) => sql.includes('INSERT INTO game_scores')).length, 1);
  assert(!commands.some((sql) => /CREATE TABLE|ALTER TABLE/.test(sql)));
});

test('result validation rejects duplicate players before touching storage', async () => {
  let written = false;
  const handlers = createJobHandlers({ database: {
    enabled: true, async saveGameResult() { written = true; }
  } });
  const player = { id: 'same', username: 'Name', score: 0 };
  await assert.rejects(handlers.saveGameResult({ gameId: 'ABC123',
    resultId: 'ABC123:run-1', roundsPlayed: 1, players: [player, player] }));
  assert.equal(written, false);
});

test('production missing vision credentials cannot accept a mock match', async () => {
  const llm = createLlm({ mode: 'production', openRouter: {
    mockWhenMissingKey: true
  } }, quiet);
  await assert.rejects(llm.verifyPhoto({ item: 'book', imageDataUrl: 'data:image/jpeg;base64,AAAA' }));
});

test('concurrent task slots share one safe result delivery spool', async (t) => {
  const location = await directory(t);
  const spool = new ResultSpool(location);
  await spool.initialize();
  let claimed = 0;
  let active = 0;
  let maximumActive = 0;
  let deliveries = 0;
  let maximumDeliveries = 0;
  const delivered = new Set();
  let release;
  const bothActive = new Promise((resolve) => { release = resolve; });
  const handlers = { async generateItems() {
    active++;
    maximumActive = Math.max(active, maximumActive);
    if (active === 2) release();
    await bothActive;
    active--;
    return ['book'];
  } };
  async function fetchImpl(url, options) {
    if (url.endsWith('/claim')) {
      return response({ job: { ...job(), id: `concurrent-${++claimed}` } });
    }
    deliveries++;
    maximumDeliveries = Math.max(maximumDeliveries, deliveries);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const record = JSON.parse(options.body);
    assert(!delivered.has(record.jobId));
    delivered.add(record.jobId);
    deliveries--;
    return response({ ok: true });
  }
  const workers = ['slot-1', 'slot-2'].map((workerId) => createLocalWorker({
    config: { localWorker: { ...settings(location).localWorker, workerId } },
    handlers, spool, fetchImpl, logger: quiet
  }));
  await Promise.all(workers.map((worker) => worker.runOnce()));
  assert.equal(maximumActive, 2);
  assert.equal(maximumDeliveries, 1);
  assert.equal(delivered.size, 2);
  assert.equal((await spool.pending()).length, 0);
});
