import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readLimitedJson } from './localWorkerHttp.js';
import { executeJob, JobError } from './localWorkerJobs.js';

const maximumSpoolBytes = 131072;
const maximumJobBytes = 800000;

function endpointOrigin(baseUrl) {
  const url = new URL(baseUrl);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.username || url.password || url.search || url.hash ||
      !['', '/'].includes(url.pathname)) {
    throw new Error('The cloud worker URL must be an HTTPS origin.');
  }
  return url.origin;
}

function validJob(job) {
  return job && typeof job.id === 'string' && job.id.length <= 160 &&
    typeof job.leaseToken === 'string' && job.leaseToken.length <= 256 &&
    Number.isFinite(Number(job.expiresAt)) &&
    Number(job.expiresAt) > Date.now();
}

function safeError(error, type) {
  if (error instanceof JobError) {
    return { code: error.code, message: error.message, retryable: error.retryable };
  }
  return {
    code: type === 'saveGameResult' ? 'STORAGE_UNAVAILABLE' : 'PROVIDER_UNAVAILABLE',
    message: type === 'saveGameResult'
      ? 'Result storage is temporarily unavailable.'
      : 'The task provider is temporarily unavailable.',
    retryable: true
  };
}

/** Results are fsynced before delivery. No photos or provider secrets are saved. */
export class ResultSpool {
  constructor(directory) {
    this.directory = directory;
    this.deliveryTail = Promise.resolve();
  }

  async withDeliveryLock(action) {
    const previous = this.deliveryTail;
    let release;
    this.deliveryTail = new Promise((resolve) => { release = resolve; });
    await previous;
    try { return await action(); } finally { release(); }
  }

  async initialize() {
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    await fs.chmod(this.directory, 0o700);
  }

  recordPath(jobId) {
    const hash = crypto.createHash('sha256').update(jobId).digest('hex');
    return path.join(this.directory, `${hash}.json`);
  }

  async save(record) {
    const contents = JSON.stringify(record);
    if (Buffer.byteLength(contents) > maximumSpoolBytes) {
      throw new Error('Task result exceeds the spool limit.');
    }
    const destination = this.recordPath(record.jobId);
    const temporary = `${destination}.${crypto.randomUUID()}.tmp`;
    const file = await fs.open(temporary, 'wx', 0o600);
    try {
      await file.writeFile(contents);
      await file.sync();
    } finally {
      await file.close();
    }
    await fs.rename(temporary, destination);
    const directory = await fs.open(this.directory, 'r');
    try { await directory.sync(); } finally { await directory.close(); }
  }

  async pending() {
    const names = (await fs.readdir(this.directory))
      .filter((name) => /^[0-9a-f]{64}\.json$/.test(name)).sort();
    if (names.length > 100) throw new Error('The local result spool is full.');
    const records = [];
    for (const name of names) {
      const location = path.join(this.directory, name);
      const metadata = await fs.lstat(location);
      if (!metadata.isFile() || metadata.size > maximumSpoolBytes) {
        throw new Error('The local result spool contains an invalid record.');
      }
      const record = JSON.parse(await fs.readFile(location, 'utf8'));
      if (typeof record.jobId !== 'string' ||
          this.recordPath(record.jobId) !== location) {
        throw new Error('The local result spool contains an invalid identity.');
      }
      records.push(record);
    }
    return records;
  }

  async remove(jobId) { await fs.unlink(this.recordPath(jobId)); }
}

export function createLocalWorker({
  config, handlers, fetchImpl = fetch, logger = console, spool,
  signal
}) {
  const settings = config.localWorker || {};
  const origin = endpointOrigin(settings.baseUrl);
  const token = String(settings.token || '');
  const workerId = String(settings.workerId || os.hostname());
  if (token.length < 32 || !/^[A-Za-z0-9._-]{1,80}$/.test(workerId)) {
    throw new Error('A worker token and valid worker ID are required.');
  }
  const timeoutMs = Math.max(1000, Math.min(30000,
    Number(settings.requestTimeoutMs) || 15000
  ));
  const resultSpool = spool || new ResultSpool(settings.spoolDirectory ||
    path.join(os.homedir(), '.local/state/capture-quest/worker/results'));

  async function post(endpoint, body, maximumBytes) {
    const requestSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs);
    const response = await fetchImpl(`${origin}${endpoint}`, {
      method: 'POST', redirect: 'error', signal: requestSignal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      await response.body?.cancel();
      const error = new Error(`Cloud task endpoint returned HTTP ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    return readLimitedJson(response, maximumBytes);
  }

  async function flush() {
    return resultSpool.withDeliveryLock(async () => {
      for (const record of await resultSpool.pending()) {
        try {
          const response = await post('/internal/worker/result', record, 16384);
          if (response.ok === false) throw new Error('The task result was not accepted.');
        } catch (error) {
          // An expired/reassigned lease cannot deliver a second completion.
          // saveGameResult is already committed locally and safe to replay.
          if (![404, 409, 410].includes(error.status)) throw error;
          logger.warn('Discarding a result whose task lease is no longer current.');
        }
        await resultSpool.remove(record.jobId);
      }
    });
  }

  return {
    async initialize() { await resultSpool.initialize(); },
    async runOnce() {
      await flush();
      if (signal?.aborted) return false;
      const response = await post('/internal/worker/claim', {
        workerId, limit: 1
      }, maximumJobBytes);
      const job = response.job;
      if (!job) return false;
      if (!validJob(job)) throw new Error('The cloud returned an invalid task lease.');
      let record;
      try {
        const result = await executeJob(job, handlers);
        record = { workerId, jobId: job.id, leaseToken: job.leaseToken,
          ok: true, result: result ?? null };
      } catch (error) {
        record = { workerId, jobId: job.id, leaseToken: job.leaseToken,
          ok: false, error: safeError(error, job.type) };
      }
      await resultSpool.save(record);
      await flush();
      logger.info(JSON.stringify({ event: 'task_completed', type: job.type,
        ok: record.ok }));
      return true;
    }
  };
}

function sleep(ms, signal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
  });
}

export async function main() {
  const [{ config }, { createDatabase }, { createLlm },
    { createChallengeAudioCache }, { createJobHandlers }] = await Promise.all([
    import('./runtimeConfig.js'), import('./database.js'), import('./llm.js'),
    import('./challengeAudio.js'), import('./localWorkerJobs.js')
  ]);
  const migrating = process.argv.includes('--migrate');
  const database = await createDatabase(config, console, { migrate: migrating });
  if (migrating) {
    await database.close();
    console.info('Capture Quest database schema is ready.');
    return;
  }
  if (config.mode === 'production' && !config.openRouter.apiKey) {
    await database.close();
    throw new Error('The production AI provider is not configured.');
  }
  const controller = new AbortController();
  const shutdown = () => controller.abort();
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  const localSettings = config.localWorker || {};
  const concurrency = Math.max(1, Math.min(4,
    Math.floor(Number(localSettings.concurrency)) || 2
  ));
  const spool = new ResultSpool(localSettings.spoolDirectory ||
    path.join(os.homedir(), '.local/state/capture-quest/worker/results'));
  const handlers = createJobHandlers({
    database, llm: createLlm(config),
    audioCache: createChallengeAudioCache(config)
  });
  const workers = Array.from({ length: concurrency }, (_, index) =>
    createLocalWorker({
      config: { ...config, localWorker: {
        ...localSettings,
        workerId: `${localSettings.workerId || os.hostname()}-${index + 1}`
      } },
      signal: controller.signal, handlers, spool
    })
  );
  try {
    await spool.initialize();
    console.info(JSON.stringify({ event: 'outbound_processor_ready', concurrency }));
    await Promise.all(workers.map(async (worker) => {
      while (!controller.signal.aborted) {
        try {
          const worked = await worker.runOnce();
          if (!worked) await sleep(Math.max(1000,
            Number(localSettings.pollIntervalMs) || 3000), controller.signal);
        } catch (error) {
          if (controller.signal.aborted) break;
          console.warn(JSON.stringify({ event: 'worker_retry',
            status: error.status || null }));
          await sleep(error.status === 401 || error.status === 403 ? 60000 : 10000,
            controller.signal);
        }
      }
    }));
  } finally {
    process.removeListener('SIGINT', shutdown);
    process.removeListener('SIGTERM', shutdown);
    await database.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(JSON.stringify({ event: 'worker_startup_failed',
      code: error.cause?.code || error.code || 'CONFIGURATION_ERROR' }));
    process.exitCode = 1;
  });
}
