import crypto from 'node:crypto';
import { DurableObject } from 'cloudflare:workers';
import QRCode from 'qrcode/lib/core/qrcode.js';
import SvgRenderer from 'qrcode/lib/renderer/svg-tag.js';
import { DurableGameEngine } from './durableEngine.js';
import { decodeState, encodeState, GAME_CONFIG, json, PHOTO_TTL, readJson, ROOM_TTL, rows } from './shared.js';

const ACTIONS = {
  set_ready: 'setReady', update_player_name: 'updatePlayerName',
  update_game_options: 'updateGameOptions', start_game: 'startGame',
  restart_game: 'restartGame', pause_game: 'pauseGameByOwner',
  resume_game: 'resumeGameByOwner', end_game: 'endGameByOwner',
  leave_game: 'leaveGame', submit_capture: 'submitCapture', skip_round: 'voteSkipRound'
};

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.outgoing = [];
    this.sockets = new Map();
    this.meta = { gameId: null, lastActivity: Date.now(), jobs: {}, recent: {} };
    const sql = ctx.storage.sql;
    this.sql = sql;
    this.ready = ctx.blockConcurrencyWhile(async () => {
      sql.exec('CREATE TABLE IF NOT EXISTS photo (id TEXT PRIMARY KEY, body TEXT NOT NULL, expires INTEGER NOT NULL)');
      sql.exec('CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, body TEXT NOT NULL)');
      const state = await ctx.storage.get('room');
      if (state) this.meta = state.meta;
      const io = {
        sockets: { sockets: this.sockets },
        to: (target) => ({ emit: (event, payload) => this.outgoing.push({ target, event, payload }) })
      };
      this.engine = new DurableGameEngine({
        io,
        config: { game: { ...GAME_CONFIG, ...(env.TEST_GAME_CONFIG ? JSON.parse(env.TEST_GAME_CONFIG) : {}) } },
        llm: {},
        database: { saveGameResult: async (result) => {
          const game = this.game;
          if (game.archivalEpoch === game.epoch) return;
          game.archivalEpoch = game.epoch;
          this.enqueue('saveGameResult', {
            ...result, endedAt: new Date(game.endedAt).toISOString(),
            resultId: `${result.gameId}:${game.epoch}`, gameCode: result.gameId
          }, { purpose: 'result', epoch: game.epoch });
        } },
        jobs: { enqueue: (type, payload, meta) => this.enqueue(type, payload, meta) },
        photos: {
          put: (id, body) => sql.exec('INSERT OR REPLACE INTO photo VALUES (?, ?, ?)', id, body, Date.now() + PHOTO_TTL),
          get: (id) => rows(sql, 'SELECT body FROM photo WHERE id = ? AND expires > ?', id, Date.now())[0]?.body,
          delete: (id) => sql.exec('DELETE FROM photo WHERE id = ?', id)
        }
      });
      if (state?.game) {
        const game = decodeState(state.game);
        for (const player of game.players.values()) player.connected = false;
        this.engine.games.set(game.id, game);
      }
      for (const ws of ctx.getWebSockets()) {
        const attachment = ws.deserializeAttachment();
        if (attachment?.authenticated) {
          const player = this.game?.players.get(attachment.playerId);
          if (!player || player.socketId !== attachment.socketId || ws.readyState !== WebSocket.OPEN) {
            ws.close(4001, 'Session replaced');
            continue;
          }
          const socket = this.socketFor(ws, attachment.socketId);
          player.connected = true;
          this.engine.socketSessions.set(socket.id, { gameId: this.game.id, playerId: player.id });
        }
      }
      ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    });
  }

  get game() { return this.engine?.games.get(this.meta.gameId); }

  socketFor(ws, id = crypto.randomUUID()) {
    if (this.sockets.has(id)) return this.sockets.get(id);
    const socket = {
      id, connected: true, ws,
      join() {}, leave() {},
      emit: (event, payload) => this.outgoing.push({ target: id, event, payload }),
      disconnect: () => {
        socket.connected = false;
        this.outgoing.push({ target: id, close: true });
      }
    };
    this.sockets.set(id, socket);
    return socket;
  }

  enqueue(type, payload, meta) {
    const id = crypto.randomUUID();
    const expiresAt = type === 'saveGameResult' ? Number.MAX_SAFE_INTEGER :
      Date.now() + (type === 'prepareAudio' ? 60000 : PHOTO_TTL);
    const job = { id, type, meta, gameId: this.meta.gameId, createdAt: Date.now(), expiresAt, sent: false };
    this.meta.jobs[id] = job;
    this.sql.exec('INSERT INTO outbox VALUES (?, ?)', id, JSON.stringify(payload));
    return id;
  }

  flush() {
    const outgoing = this.outgoing.splice(0);
    for (const message of outgoing) {
      for (const socket of this.sockets.values()) {
        if (message.target !== this.meta.gameId && message.target !== socket.id) continue;
        try {
          if (message.close) socket.ws.close(4001, 'Session replaced');
          else socket.ws.send(JSON.stringify(message.ack ? { id: message.ack, ack: message.payload } : { event: message.event, payload: message.payload }));
        } catch { /* Disconnect is reconciled by webSocketClose. */ }
      }
    }
  }

  async mutate(callback) {
    await this.ready;
    let result;
    await this.ctx.blockConcurrencyWhile(async () => {
      result = await callback();
      this.sql.exec('DELETE FROM photo WHERE expires <= ?', Date.now());
      if (this.game || Object.keys(this.meta.jobs).length) {
        await this.ctx.storage.put('room', { meta: this.meta, game: this.game ? encodeState(this.game) : null });
      } else await this.ctx.storage.delete('room');
      await this.scheduleAlarm();
    });
    this.flush();
    this.ctx.waitUntil(this.dispatchJobs());
    return result;
  }

  async scheduleAlarm() {
    const game = this.game;
    if (!game && !Object.keys(this.meta.jobs).length && !this.ctx.getWebSockets().length) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    const deadline = this.meta.lastActivity + ROOM_TTL;
    const deadlines = [game ? Math.max(Date.now() + 1000, deadline) : Date.now() + ROOM_TTL];
    if (game?.status === 'running') {
      if (game.currentRound?.status === 'active') deadlines.push(game.currentRound.expiresAt);
      if (game.nextRoundAt) deadlines.push(game.nextRoundAt);
    }
    for (const job of Object.values(this.meta.jobs)) {
      if (!job.sent) deadlines.push(Date.now() + 5000);
      if (job.type !== 'saveGameResult') deadlines.push(job.expiresAt);
    }
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment();
      if (!attachment?.authenticated) deadlines.push(attachment?.authDeadline || Date.now());
    }
    await this.ctx.storage.setAlarm(Math.max(Date.now() + 50, Math.min(...deadlines)));
  }

  async dispatchJobs() {
    await this.ready;
    for (const job of Object.values(this.meta.jobs).filter((entry) => !entry.sent).slice(0, 8)) {
      const payload = rows(this.sql, 'SELECT body FROM outbox WHERE id = ?', job.id)[0]?.body;
      if (!payload) continue;
      try {
        const response = await this.env.BROKER.getByName('jobs').fetch('https://broker/enqueue', {
          method: 'POST', body: JSON.stringify({ ...job, payload: JSON.parse(payload) })
        });
        await response.body?.cancel();
        if (!response.ok) continue;
        await this.ctx.blockConcurrencyWhile(async () => {
          if (this.meta.jobs[job.id]) this.meta.jobs[job.id].sent = true;
          await this.ctx.storage.put('room', { meta: this.meta, game: this.game ? encodeState(this.game) : null });
        });
      } catch { /* Durable outbox retries from the next alarm. */ }
    }
  }

  joinData(player, origin) {
    const url = new URL(origin);
    url.searchParams.set('game', this.meta.gameId);
    const svg = SvgRenderer.render(QRCode.create(url.toString()), { margin: 1, width: 256 });
    return {
      ok: true, gameId: this.meta.gameId, playerId: player.id,
      resumeToken: player.resumeToken, gameUrl: url.toString(),
      qrCode: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    };
  }

  async fetch(request) {
    await this.ready;
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      if (!this.game) return json({ ok: false, error: 'Game not found.' }, 404);
      const unauthenticated = this.ctx.getWebSockets().filter((ws) => !ws.deserializeAttachment()?.authenticated);
      if (unauthenticated.length >= 8) return json({ ok: false, error: 'Too many connections.' }, 429);
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ ok: false }, 426);
      const pair = new WebSocketPair();
      pair[1].serializeAttachment({ socketId: crypto.randomUUID(), authDeadline: Date.now() + 10000 });
      this.ctx.acceptWebSocket(pair[1]);
      await this.scheduleAlarm();
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    const body = await readJson(request, url.pathname === '/job-result' ? 160000 : 32768);
    if (url.pathname === '/job-result') {
      return this.mutate(async () => {
        const job = this.meta.jobs[body.jobId];
        if (!job) return json({ ok: true, ignored: true });
        delete this.meta.jobs[job.id];
        this.sql.exec('DELETE FROM outbox WHERE id = ?', job.id);
        if (this.game) await this.engine.applyJob(this.game, job, body);
        return json({ ok: true });
      });
    }
    if (url.pathname === '/create') {
      return this.mutate(() => {
        if (this.game) return json({ ok: false, error: 'Game already exists.' }, 409);
        const socket = { id: crypto.randomUUID(), join() {}, leave() {} };
        const { game, player } = this.engine.createGame(socket, body.payload || {});
        this.engine.games.delete(game.id);
        game.id = body.gameId;
        game.epoch = crypto.randomUUID();
        player.connected = false;
        this.meta.gameId = game.id;
        this.meta.lastActivity = Date.now();
        this.engine.games.set(game.id, game);
        this.engine.socketSessions.clear();
        return json(this.joinData(player, body.origin));
      });
    }
    if (url.pathname === '/join' || url.pathname === '/rejoin') {
      return this.mutate(() => {
        if (!this.game) return json({ ok: false, error: 'Game not found.' }, 404);
        const payload = { ...body.payload, gameId: this.meta.gameId };
        let result;
        if (url.pathname === '/rejoin') {
          const player = this.engine.authenticatedPlayer(this.game, payload);
          result = player ? { player } : { error: 'Session not found.' };
        } else {
          const socket = { id: crypto.randomUUID(), join() {}, leave() {} };
          result = this.engine.joinGame(socket, payload);
          if (result.player) {
            result.player.connected = false;
            this.engine.socketSessions.delete(socket.id);
          }
        }
        if (result.error) return json({ ok: false, error: result.error }, 400);
        this.meta.lastActivity = Date.now();
        return json(this.joinData(result.player, body.origin));
      });
    }
    return json({ ok: false, error: 'Not found.' }, 404);
  }

  async webSocketMessage(ws, message) {
    await this.ready;
    if (typeof message !== 'string' || message.length > 540000) { ws.close(1009, 'Message too large'); return; }
    let frame;
    try { frame = JSON.parse(message); } catch { ws.close(1003, 'Invalid JSON'); return; }
    if (!frame || typeof frame !== 'object' || !frame.payload || typeof frame.payload !== 'object' || Array.isArray(frame.payload)) {
      ws.close(1003, 'Invalid message'); return;
    }
    const identity = ws.deserializeAttachment();
    if (identity?.authenticated && ['start_game', 'submit_capture'].includes(frame.event)) {
      let available = false;
      try {
        const statusResponse = await this.env.BROKER.getByName('jobs').fetch('https://broker/status');
        available = (await statusResponse.json()).workerOnline === true;
      } catch { /* An unavailable processor never causes an unhandled socket error. */ }
      if (!available) {
        ws.send(JSON.stringify({ id: frame.id, ack: {
          ok: false, error: 'AI processing is temporarily unavailable. Please try again shortly.'
        } }));
        return;
      }
    }
    await this.mutate(async () => {
      const attachment = ws.deserializeAttachment();
      if (!attachment?.authenticated) {
        if (frame.event !== 'authenticate' || Date.now() > attachment?.authDeadline) {
          ws.close(4003, 'Authentication required'); return;
        }
        const player = this.engine.authenticatedPlayer(this.game, frame.payload);
        if (!player) { ws.close(4003, 'Session not found'); return; }
        const socket = this.socketFor(ws, attachment.socketId);
        const joined = this.engine.rejoinGame(socket, { ...frame.payload, gameId: this.meta.gameId });
        if (joined.error) { ws.close(4003, 'Session not found'); return; }
        ws.serializeAttachment({ ...attachment, authenticated: true, playerId: player.id, count: 0, window: Date.now() });
        this.outgoing.unshift({ target: socket.id, event: 'authenticated', payload: { ok: true } });
        this.meta.lastActivity = Date.now();
        return;
      }
      const socket = this.socketFor(ws, attachment.socketId);
      const current = this.game?.players.get(attachment.playerId);
      if (!current || current.socketId !== socket.id) { ws.close(4003, 'Session replaced'); return; }
      const now = Date.now();
      if (now - attachment.window > 5000) { attachment.window = now; attachment.count = 0; }
      attachment.count += 1;
      ws.serializeAttachment(attachment);
      const requestId = typeof frame.id === 'string' ? frame.id.slice(0, 80) : '';
      const reply = (payload) => this.outgoing.push({ target: socket.id, ack: requestId, payload });
      if (!requestId || typeof frame.event !== 'string' || !Object.hasOwn(ACTIONS, frame.event)) { reply({ ok: false, error: 'Unknown action.' }); return; }
      if (attachment.count > 20) { reply({ ok: false, error: 'Please slow down.' }); return; }
      const cacheKey = `${current.id}:${requestId}`;
      if (this.meta.recent[cacheKey]) { reply(this.meta.recent[cacheKey].result); return; }
      if (this.game.status === 'running' && this.game.currentRound?.status === 'active' && now >= this.game.currentRound.expiresAt) {
        await this.engine.expireRound(this.game.id, this.game.currentRound.id);
      }
      this.meta.lastActivity = now;
      const result = await this.engine[ACTIONS[frame.event]](socket, { ...frame.payload, gameId: this.meta.gameId });
      const response = result?.error ? { ok: false, error: result.error } : { ok: true, ignored: Boolean(result?.ignored) };
      this.meta.recent[cacheKey] = { at: now, result: response };
      const keys = Object.keys(this.meta.recent);
      for (const key of keys.slice(0, Math.max(0, keys.length - 200))) delete this.meta.recent[key];
      reply(response);
    });
  }

  async webSocketClose(ws) {
    await this.mutate(() => {
      const attachment = ws.deserializeAttachment();
      const socket = this.sockets.get(attachment?.socketId);
      if (socket && this.game?.players.get(attachment?.playerId)?.socketId === socket.id) this.engine.handleDisconnect(socket);
      this.sockets.delete(attachment?.socketId);
    });
  }

  async webSocketError(ws) { await this.webSocketClose(ws); }

  async alarm() {
    await this.mutate(async () => {
      const now = Date.now();
      for (const ws of this.ctx.getWebSockets()) {
        const attachment = ws.deserializeAttachment();
        if (!attachment?.authenticated && attachment?.authDeadline <= now) ws.close(4003, 'Authentication timed out');
      }
      if (this.game?.status === 'running') {
        if (this.game.currentRound?.status === 'active' && now >= this.game.currentRound.expiresAt) {
          await this.engine.expireRound(this.game.id, this.game.currentRound.id);
        }
        if (this.game.nextRoundAt && now >= this.game.nextRoundAt) await this.engine.startRound(this.game);
      }
      for (const job of Object.values(this.meta.jobs)) {
        if (job.type !== 'saveGameResult' && job.expiresAt <= now) {
          delete this.meta.jobs[job.id];
          this.sql.exec('DELETE FROM outbox WHERE id = ?', job.id);
          if (this.game) await this.engine.applyJob(this.game, job, { ok: false, error: { code: 'EXPIRED' } });
        }
      }
      if (this.game && now - this.meta.lastActivity >= ROOM_TTL) {
        for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'Game expired');
        this.engine.games.clear();
        this.meta.recent = {};
        for (const job of Object.values(this.meta.jobs)) {
          if (job.type !== 'saveGameResult') {
            delete this.meta.jobs[job.id];
            this.sql.exec('DELETE FROM outbox WHERE id=?', job.id);
          }
        }
        this.sql.exec('DELETE FROM photo');
        this.meta.lastActivity = now;
      }
    });
  }
}
