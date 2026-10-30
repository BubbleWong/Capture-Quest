import crypto from 'node:crypto';
import { DurableObject } from 'cloudflare:workers';
import { JOB_TYPES, json, readJson, ROOM_TTL, rows } from './shared.js';

// A small durable dispatch queue. Its only consumers are authenticated local
// workers. Payloads never enter logs; photo jobs expire after a few minutes.
export class JobBroker extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.delivering = false;
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, game_id TEXT NOT NULL,
      payload TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL,
      status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
      available INTEGER NOT NULL, worker_id TEXT, lease TEXT, lease_until INTEGER,
      result TEXT, delivered INTEGER NOT NULL DEFAULT 0
    )`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS jobs_claim ON jobs(status, available, created)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS budget (day INTEGER PRIMARY KEY, count INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS worker_status (id TEXT PRIMARY KEY, seen INTEGER NOT NULL)');
  }

  async schedule() {
    const now = Date.now();
    const deadlines = rows(this.sql, `SELECT MIN(expires) AS expiry,
      MIN(CASE WHEN status = 'leased' THEN lease_until ELSE available END) AS pending
      FROM jobs WHERE status IN ('queued','leased')`)[0];
    const completed = rows(this.sql, `SELECT MIN(available + ?) AS cleanup,
      SUM(CASE WHEN delivered=0 THEN 1 ELSE 0 END) AS undelivered
      FROM jobs WHERE status='completed'`, ROOM_TTL)[0];
    const choices = [now + ROOM_TTL];
    if (deadlines?.expiry) choices.push(deadlines.expiry);
    // Polling local workers drive queued jobs; alarms only handle deadlines and
    // leases, not an always-due queued 'available' timestamp.
    const leased = rows(this.sql, "SELECT MIN(lease_until) AS deadline FROM jobs WHERE status='leased'")[0]?.deadline;
    if (leased) choices.push(leased);
    if (completed?.cleanup) choices.push(completed.cleanup);
    if (completed?.undelivered) choices.push(now + 5000);
    await this.ctx.storage.setAlarm(Math.max(now + 1000, Math.min(...choices)));
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/status') {
      const lastSeen = rows(this.sql, 'SELECT MAX(seen) AS last_seen FROM worker_status')[0]?.last_seen || null;
      const pending = rows(this.sql, "SELECT COUNT(*) AS count FROM jobs WHERE status <> 'completed'")[0]?.count || 0;
      return json({ workerOnline: Boolean(lastSeen && Date.now() - lastSeen < 180000), lastSeen, pending });
    }
    const body = await readJson(request, url.pathname === '/enqueue' ? 620000 : 160000);
    let result;
    await this.ctx.blockConcurrencyWhile(async () => {
      if (url.pathname === '/enqueue') {
        if (!JOB_TYPES.has(body.type) || typeof body.id !== 'string' || !/^[0-9A-Z]{6}$/.test(body.gameId || '')) {
          result = json({ ok: false, error: 'Invalid job.' }, 400); return;
        }
        const existing = rows(this.sql, 'SELECT id FROM jobs WHERE id = ?', body.id)[0];
        if (existing) { result = json({ ok: true }); return; }
        const queued = rows(this.sql, "SELECT COUNT(*) AS count FROM jobs WHERE status <> 'completed'")[0]?.count;
        if (queued >= 1000) { result = json({ ok: false, error: 'Queue is full.' }, 429); return; }
        const now = Date.now();
        const expiry = body.type === 'saveGameResult' ? Number.MAX_SAFE_INTEGER :
          Math.min(Number(body.expiresAt) || now + 300000, now + 300000);
        const day = Math.floor(now / ROOM_TTL);
        const used = rows(this.sql, 'SELECT count FROM budget WHERE day=?', day)[0]?.count || 0;
        const dailyLimit = Math.max(1, Math.min(10000, Number(this.env.DAILY_AI_JOB_LIMIT) || 2000));
        const capped = body.type !== 'saveGameResult' && used >= dailyLimit;
        this.sql.exec('INSERT INTO jobs (id,type,game_id,payload,created,expires,status,available,result) VALUES (?,?,?,?,?,?,?,?,?)',
          body.id, body.type, body.gameId, capped ? '{}' : JSON.stringify(body.payload), now, expiry,
          capped ? 'completed' : 'queued', now,
          capped ? JSON.stringify({ ok: false, result: null, error: { code: 'DAILY_QUOTA' } }) : null);
        if (body.type !== 'saveGameResult' && !capped) this.sql.exec(
          'INSERT INTO budget VALUES (?,1) ON CONFLICT(day) DO UPDATE SET count=count+1', day);
        this.sql.exec('DELETE FROM budget WHERE day < ?', day - 2);
        result = json({ ok: true });
      } else if (url.pathname === '/claim') {
        const workerId = String(body.workerId || '').slice(0, 100);
        if (!/^[a-zA-Z0-9._:-]{1,100}$/.test(workerId)) {
          result = json({ ok: false, error: 'Invalid worker.' }, 400); return;
        }
        const now = Date.now();
        this.sql.exec('INSERT OR REPLACE INTO worker_status VALUES (?,?)', workerId, now);
        this.expire(now);
        const job = rows(this.sql, "SELECT * FROM jobs WHERE status = 'queued' AND available <= ? AND expires > ? ORDER BY created,id LIMIT 1", now, now)[0];
        if (!job) { result = json({ ok: true, job: null }); return; }
        const leaseToken = crypto.randomBytes(32).toString('base64url');
        this.sql.exec("UPDATE jobs SET status='leased',worker_id=?,lease=?,lease_until=?,attempts=attempts+1 WHERE id=?",
          workerId, leaseToken, now + 120000, job.id);
        result = json({ ok: true, job: {
          id: job.id, type: job.type, gameId: job.game_id,
          payload: JSON.parse(job.payload), leaseToken,
          expiresAt: job.expires, leaseExpiresAt: now + 120000
        } });
      } else if (url.pathname === '/result') {
        const job = rows(this.sql, 'SELECT * FROM jobs WHERE id = ?', String(body.jobId || ''))[0];
        if (!job || job.worker_id !== body.workerId || job.lease !== body.leaseToken) {
          result = json({ ok: false, error: 'Lease is no longer valid.' }, 409); return;
        }
        this.sql.exec('INSERT OR REPLACE INTO worker_status VALUES (?,?)', body.workerId, Date.now());
        if (job.status === 'completed') { result = json({ ok: true, duplicate: true }); return; }
        if (job.status !== 'leased' || job.lease_until < Date.now()) {
          result = json({ ok: false, error: 'Lease expired.' }, 409); return;
        }
        if (typeof body.ok !== 'boolean') { result = json({ ok: false, error: 'Invalid result.' }, 400); return; }
        const retryable = !body.ok && body.error?.retryable === true;
        const shouldRetry = !body.ok && job.type === 'saveGameResult' ||
          retryable && job.attempts < 3;
        if (shouldRetry && job.expires > Date.now() + 5000) {
          const delay = Math.min(60000, 1000 * 2 ** Math.min(job.attempts, 6));
          this.sql.exec("UPDATE jobs SET status='queued',available=?,lease_until=NULL WHERE id=?", Date.now() + delay, job.id);
        } else {
          const outcome = {
            ok: body.ok, result: body.result ?? null,
            error: body.ok ? undefined : { code: String(body.error?.code || 'FAILED').slice(0, 60) }
          };
          this.sql.exec("UPDATE jobs SET status='completed',result=?,payload='{}',available=? WHERE id=?", JSON.stringify(outcome), Date.now(), job.id);
        }
        result = json({ ok: true });
      } else result = json({ ok: false, error: 'Not found.' }, 404);
      await this.schedule();
    });
    this.ctx.waitUntil(this.deliver());
    return result;
  }

  expire(now) {
    // A lost local worker releases its lease. Permanent result archives remain
    // retryable; transient photos and AI tasks have a strict retention bound.
    this.sql.exec("UPDATE jobs SET status='queued',available=?,lease_until=NULL WHERE status='leased' AND lease_until <= ? AND expires > ?", now, now, now);
    const expired = rows(this.sql, "SELECT id FROM jobs WHERE status <> 'completed' AND expires <= ?", now);
    for (const job of expired) this.sql.exec("UPDATE jobs SET status='completed',result=?,payload='{}',available=? WHERE id=?",
      JSON.stringify({ ok: false, result: null, error: { code: 'EXPIRED' } }), now, job.id);
    this.sql.exec("DELETE FROM jobs WHERE status='completed' AND delivered=1 AND available < ?", now - ROOM_TTL);
    this.sql.exec('DELETE FROM worker_status WHERE seen < ?', now - ROOM_TTL);
  }

  async deliver() {
    if (this.delivering) return;
    this.delivering = true;
    try {
      for (const job of rows(this.sql, "SELECT id,game_id,result FROM jobs WHERE status='completed' AND delivered=0 ORDER BY created LIMIT 10")) {
        try {
          const response = await this.env.ROOMS.getByName(job.game_id).fetch('https://room/job-result', {
            method: 'POST', body: JSON.stringify({ jobId: job.id, ...JSON.parse(job.result) })
          });
          await response.body?.cancel();
          if (response.ok) this.sql.exec('UPDATE jobs SET delivered=1 WHERE id=?', job.id);
        } catch { /* Durable completed result will be delivered on the next alarm. */ }
      }
    } finally { this.delivering = false; }
  }

  async alarm() {
    this.expire(Date.now());
    await this.deliver();
    await this.schedule();
  }
}
