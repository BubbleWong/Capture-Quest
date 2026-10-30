import { DurableObject } from 'cloudflare:workers';
import { json, readJson, rows } from './shared.js';

export class TrafficLimits extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS counters (key TEXT PRIMARY KEY, value INTEGER NOT NULL, expires INTEGER NOT NULL)');
  }
  async fetch(request) {
    const body = await readJson(request, 4096);
    const now = Date.now();
    this.sql.exec('DELETE FROM counters WHERE expires <= ?', now);
    const limits = body.action === 'create' ? [[60000, 5], [3600000, 40], [86400000, 200]] : [[60000, 300]];
    const keys = limits.map(([duration, limit]) => ({ key: `${body.action}:${Math.floor(now / duration)}`, duration, limit }));
    for (const { key, limit } of keys) {
      const count = rows(this.sql, 'SELECT value FROM counters WHERE key=?', key)[0]?.value || 0;
      if (count >= limit) return json({ ok: false }, 429);
    }
    for (const { key, duration } of keys) this.sql.exec('INSERT INTO counters VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=value+1', key, 1, now + duration);
    await this.ctx.storage.setAlarm(now + 86400000);
    return json({ ok: true });
  }
  async alarm() { this.sql.exec('DELETE FROM counters WHERE expires <= ?', Date.now()); }
}
