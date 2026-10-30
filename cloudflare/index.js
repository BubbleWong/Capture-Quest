import crypto from 'node:crypto';
import { crockfordBase32Alphabet, normalizeGameCode } from '../server/gameEngine.js';
import { json, readJson, secretMatches } from './shared.js';
export { GameRoom } from './gameRoom.js';
export { JobBroker } from './jobBroker.js';
export { TrafficLimits } from './trafficLimits.js';

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  return origin === new URL(request.url).origin;
}
function code() {
  return [...crypto.randomBytes(6)].map((value) => crockfordBase32Alphabet[value & 31]).join('');
}
async function limited(request, env, action) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const key = crypto.createHash('sha256').update(ip).digest('hex');
  const response = await env.LIMITS.getByName(key).fetch('https://limits/check', {
    method: 'POST', body: JSON.stringify({ action })
  });
  await response.body?.cancel();
  return response.ok;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/health' && request.method === 'GET') {
        const status = await env.BROKER.getByName('jobs').fetch('https://broker/status');
        const worker = await status.json();
        return json({ ok: true, mode: 'production', architecture: 'cloudflare-hybrid',
          database: 'local-worker', assetVersion: env.ASSET_VERSION || 'hybrid',
          revision: env.DEPLOYMENT_SHA || 'development',
          workerOnline: worker.workerOnline, pendingJobs: worker.pending });
      }
      if (url.pathname.startsWith('/internal/')) {
        const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
        if (!secretMatches(token, env.WORKER_TOKEN)) return json({ ok: false, error: 'Unauthorized.' }, 401);
        const match = /^\/internal\/worker\/(claim|result)$/.exec(url.pathname);
        if (!match || request.method !== 'POST') return json({ ok: false }, 404);
        // Restrict this capability to the task queue, never arbitrary URLs or SQL.
        const body = await readJson(request, 160000);
        return env.BROKER.getByName('jobs').fetch(`https://broker/${match[1]}`, {
          method: 'POST', body: JSON.stringify(body)
        });
      }
      if (url.pathname === '/api/games' && request.method === 'POST') {
        if (!sameOrigin(request)) return json({ ok: false, error: 'Invalid origin.' }, 403);
        if (!await limited(request, env, 'create')) return json({ ok: false, error: 'Too many games. Please try later.' }, 429);
        const payload = await readJson(request);
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const gameId = code();
          const response = await env.ROOMS.getByName(gameId).fetch('https://room/create', {
            method: 'POST', body: JSON.stringify({ gameId, payload, origin: env.PUBLIC_BASE_URL || url.origin })
          });
          if (response.status !== 409) return response;
        }
        return json({ ok: false, error: 'Please try again.' }, 503);
      }
      const match = /^\/api\/games\/([^/]+)\/(join|rejoin|ws)$/.exec(url.pathname);
      if (match) {
        const gameId = normalizeGameCode(match[1]);
        if (!gameId) return json({ ok: false, error: 'Game code is not valid.' }, 400);
        if (!sameOrigin(request)) return json({ ok: false, error: 'Invalid origin.' }, 403);
        if (!await limited(request, env, 'join')) return json({ ok: false, error: 'Please slow down.' }, 429);
        const room = env.ROOMS.getByName(gameId);
        if (match[2] === 'ws' && request.method === 'GET') return room.fetch(new Request('https://room/ws', request));
        if (match[2] !== 'ws' && request.method === 'POST') {
          const payload = await readJson(request);
          return room.fetch(`https://room/${match[2]}`, {
            method: 'POST', body: JSON.stringify({ payload, origin: env.PUBLIC_BASE_URL || url.origin })
          });
        }
        return json({ ok: false }, 405);
      }
      if (url.pathname.startsWith('/api/')) return json({ ok: false, error: 'Not found.' }, 404);
      if (request.method !== 'GET' && request.method !== 'HEAD') return json({ ok: false }, 405);
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Referrer-Policy', 'same-origin');
      headers.set('Permissions-Policy', 'camera=(self), microphone=()');
      const websocketOrigin = url.origin.replace(/^http/, 'ws');
      headers.set('Content-Security-Policy', `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' https: blob:; connect-src 'self' ${websocketOrigin}; object-src 'none'; frame-ancestors 'none'; base-uri 'self'`);
      if (['/', '/index.html', '/manifest.webmanifest', '/service-worker.js', '/scripts/transport.js'].includes(url.pathname)) headers.set('Cache-Control', 'no-cache');
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      // Parsing/client failures never expose stack traces or provider secrets.
      if (error instanceof SyntaxError || /too large|JSON object/.test(error.message || '')) {
        return json({ ok: false, error: 'Invalid or oversized request.' }, 400);
      }
      console.error(JSON.stringify({ event: 'request_failed', path: url.pathname, name: error.name }));
      return json({ ok: false, error: 'The service is temporarily unavailable.' }, 503);
    }
  }
};
