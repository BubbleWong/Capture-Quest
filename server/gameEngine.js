import crypto from "node:crypto";

export const crockfordBase32Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const gameCodeLength = 6;

export function encodeCrockfordBase32(value, minLength = 1) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Crockford Base32 values must be non-negative safe integers.");
  }

  let encoded = "";
  let remaining = value;
  do {
    encoded = crockfordBase32Alphabet[remaining % 32] + encoded;
    remaining = Math.floor(remaining / 32);
  } while (remaining > 0);

  return encoded.padStart(minLength, "0");
}

export function normalizeGameCode(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  let normalized = "";
  for (const char of text.toUpperCase()) {
    if (char === "-" || /\s/.test(char)) continue;
    if (char === "O") {
      normalized += "0";
    } else if (char === "I" || char === "L") {
      normalized += "1";
    } else if (crockfordBase32Alphabet.includes(char)) {
      normalized += char;
    } else {
      return null;
    }
  }

  return normalized.length === gameCodeLength ? normalized : null;
}

function createGameId(existingIds) {
  for (;;) {
    const id = encodeCrockfordBase32(crypto.randomInt(0, 32 ** gameCodeLength), gameCodeLength);
    if (!existingIds.has(id)) return id;
  }
}

function cleanUsername(username, fallback = "Player") {
  const cleaned = String(username || "").trim().replace(/\s+/g, " ").slice(0, 24);
  return cleaned || fallback;
}

function publicPlayer(player) {
  return {
    id: player.id,
    username: player.username,
    score: player.score,
    ready: player.ready,
    isOwner: player.isOwner,
    connected: player.connected
  };
}

function topPlayers(players) {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));
  const topScore = sorted[0]?.score ?? 0;
  return sorted.filter((player) => player.score === topScore);
}

export class GameEngine {
  constructor({ io, config, llm, database, logger = console }) {
    this.io = io;
    this.config = config;
    this.llm = llm;
    this.database = database;
    this.logger = logger;
    this.games = new Map();
    this.socketSessions = new Map();
  }

  createGame(socket, payload = {}) {
    this.detachSocket(socket);
    const gameId = createGameId(this.games);
    const player = this.createPlayer(socket, payload.username || "Host", true);
    const game = {
      id: gameId,
      status: "lobby",
      ownerPlayerId: player.id,
      players: new Map([[player.id, player]]),
      itemQueue: [],
      usedItems: [],
      roundNumber: 0,
      roundsAwarded: 0,
      currentRound: null,
      lastResult: null,
      winner: null,
      createdAt: Date.now(),
      startedAt: null,
      endedAt: null,
      roundTimer: null,
      nextRoundTimer: null,
      loadingItems: null
    };
    this.games.set(gameId, game);
    socket.join(gameId);
    this.socketSessions.set(socket.id, { gameId, playerId: player.id });
    this.emitState(game);
    return { game, player };
  }

  joinGame(socket, payload = {}) {
    const gameId = normalizeGameCode(payload.gameId);
    if (!gameId) return { error: "Game code is not valid." };
    const game = this.games.get(gameId);
    if (!game) return { error: "Game not found." };
    if (game.status !== "lobby") return { error: "This game has already started." };
    if (game.players.size >= this.config.game.maxPlayers) return { error: "This game is full." };

    this.detachSocket(socket);
    const player = this.createPlayer(socket, payload.username, false);
    game.players.set(player.id, player);
    socket.join(gameId);
    this.socketSessions.set(socket.id, { gameId, playerId: player.id });
    this.emitNotice(game, `${player.username} joined the quest.`);
    this.emitState(game);
    return { game, player };
  }

  rejoinGame(socket, payload = {}) {
    const gameId = normalizeGameCode(payload.gameId);
    if (!gameId) return { error: "Session not found." };
    const game = this.games.get(gameId);
    const player = game?.players.get(payload.playerId);
    if (!game || !player) return { error: "Session not found." };

    this.detachSocket(socket);
    if (player.socketId && player.socketId !== socket.id) {
      this.socketSessions.delete(player.socketId);
    }
    player.socketId = socket.id;
    player.connected = true;
    socket.join(gameId);
    this.socketSessions.set(socket.id, { gameId, playerId: player.id });
    this.emitState(game);
    return { game, player };
  }

  setReady(socket, payload = {}) {
    const session = this.getSession(socket, payload.gameId);
    if (!session) return { error: "You are not in this game." };
    const { game, player } = session;
    if (game.status !== "lobby") return { error: "Ready can only be changed in the lobby." };
    player.ready = Boolean(payload.ready);
    this.emitState(game);
    return { game, player };
  }

  async startGame(socket, payload = {}) {
    const session = this.getSession(socket, payload.gameId);
    if (!session) return { error: "You are not in this game." };
    const { game, player } = session;
    if (game.ownerPlayerId !== player.id) return { error: "Only the game owner can start." };
    if (game.status !== "lobby") return { error: "The game is not in the lobby." };
    if (!this.allConnectedPlayersReady(game)) return { error: "All connected players must be ready." };

    game.status = "loading";
    game.startedAt = Date.now();
    game.endedAt = null;
    game.winner = null;
    this.emitState(game);
    await this.ensureItemBuffer(game, this.config.game.itemBatchSize);
    this.startRound(game);
    return { game, player };
  }

  async restartGame(socket, payload = {}) {
    const session = this.getSession(socket, payload.gameId);
    if (!session) return { error: "You are not in this game." };
    const { game, player } = session;
    if (game.ownerPlayerId !== player.id) return { error: "Only the game owner can start a new game." };
    if (game.status !== "ended") return { error: "The current game has not ended yet." };

    this.clearTimers(game);
    for (const currentPlayer of game.players.values()) {
      currentPlayer.score = 0;
      currentPlayer.ready = false;
    }
    game.status = "lobby";
    game.roundNumber = 0;
    game.roundsAwarded = 0;
    game.currentRound = null;
    game.lastResult = null;
    game.winner = null;
    game.endedAt = null;
    game.startedAt = null;
    game.itemQueue = [];
    game.usedItems = [];
    this.emitState(game);
    return { game, player };
  }

  submitCapture(socket, payload = {}) {
    const session = this.getSession(socket, payload.gameId);
    if (!session) return { error: "You are not in this game." };
    const { game, player } = session;
    const round = game.currentRound;
    if (game.status !== "running" || !round || round.status !== "active") {
      return { error: "There is no active object right now." };
    }
    if (!payload.imageDataUrl || !String(payload.imageDataUrl).startsWith("data:image/")) {
      return { error: "Photo data was not received." };
    }

    round.submissions.push({
      playerId: player.id,
      imageDataUrl: payload.imageDataUrl,
      receivedAt: Date.now()
    });
    this.io.to(player.socketId).emit("submission_result", {
      status: "checking",
      message: `Checking ${round.item}...`
    });
    this.processSubmissions(game).catch((error) => {
      this.logger.warn(`Submission processing failed: ${error.message}`);
    });
    return { ok: true };
  }

  handleDisconnect(socket) {
    const session = this.socketSessions.get(socket.id);
    if (!session) return;
    const game = this.games.get(session.gameId);
    const player = game?.players.get(session.playerId);
    if (player) {
      player.connected = false;
      this.emitState(game);
    }
    this.socketSessions.delete(socket.id);
  }

  getSnapshot(game, viewerPlayerId) {
    const players = [...game.players.values()].map(publicPlayer);
    const leaders = topPlayers([...game.players.values()]).map((player) => player.id);
    const connectedPlayers = players.filter((player) => player.connected);
    const allReady = connectedPlayers.length > 0 && connectedPlayers.every((player) => player.ready);
    const viewer = game.players.get(viewerPlayerId);

    return {
      id: game.id,
      status: game.status,
      ownerPlayerId: game.ownerPlayerId,
      players,
      maxPlayers: this.config.game.maxPlayers,
      roundNumber: game.roundNumber,
      roundsAwarded: game.roundsAwarded,
      normalRounds: this.config.game.normalRounds,
      leaders,
      allReady,
      itemQueueCount: game.itemQueue.length,
      currentRound: game.currentRound
        ? {
            id: game.currentRound.id,
            item: game.currentRound.item,
            status: game.currentRound.status,
            startedAt: game.currentRound.startedAt,
            expiresAt: game.currentRound.expiresAt
          }
        : null,
      lastResult: game.lastResult,
      winner: game.winner ? publicPlayer(game.winner) : null,
      me: viewer ? publicPlayer(viewer) : null
    };
  }

  createPlayer(socket, username, isOwner) {
    return {
      id: crypto.randomUUID(),
      socketId: socket.id,
      username: cleanUsername(username, isOwner ? "Host" : "Player"),
      score: 0,
      ready: false,
      isOwner,
      connected: true,
      joinedAt: Date.now()
    };
  }

  getSession(socket, gameId) {
    const session = this.socketSessions.get(socket.id);
    const normalizedGameId = gameId ? normalizeGameCode(gameId) : null;
    if (!session || (gameId && session.gameId !== normalizedGameId)) return null;
    const game = this.games.get(session.gameId);
    const player = game?.players.get(session.playerId);
    if (!game || !player) return null;
    return { game, player };
  }

  detachSocket(socket) {
    const session = this.socketSessions.get(socket.id);
    if (!session) return;
    const game = this.games.get(session.gameId);
    const player = game?.players.get(session.playerId);
    if (player) player.connected = false;
    socket.leave(session.gameId);
    this.socketSessions.delete(socket.id);
    if (game) this.emitState(game);
  }

  emitState(game) {
    for (const player of game.players.values()) {
      if (player.connected && player.socketId) {
        this.io.to(player.socketId).emit("game_state", this.getSnapshot(game, player.id));
      }
    }
  }

  emitNotice(game, message) {
    this.io.to(game.id).emit("notice", { message });
  }

  allConnectedPlayersReady(game) {
    const connectedPlayers = [...game.players.values()].filter((player) => player.connected);
    return connectedPlayers.length > 0 && connectedPlayers.every((player) => player.ready);
  }

  async ensureItemBuffer(game, minimumCount) {
    if (game.itemQueue.length >= minimumCount) return;
    if (game.loadingItems) {
      await game.loadingItems;
      return;
    }

    game.loadingItems = this.llm
      .generateItems({
        count: this.config.game.itemBatchSize,
        previousItems: game.usedItems
      })
      .then((items) => {
        const existing = new Set([...game.itemQueue, ...game.usedItems].map((item) => item.toLowerCase()));
        const nextItems = items.filter((item) => !existing.has(item.toLowerCase()));
        game.itemQueue.push(...nextItems);
      })
      .finally(() => {
        game.loadingItems = null;
      });
    await game.loadingItems;
  }

  async startRound(game) {
    this.clearRoundTimer(game);
    if (this.shouldEndGame(game)) {
      await this.endGame(game);
      return;
    }

    if (game.itemQueue.length < 1) {
      game.status = "loading";
      this.emitState(game);
      await this.ensureItemBuffer(game, 1);
    }

    const item = game.itemQueue.shift();
    if (!item) {
      await this.endGame(game);
      return;
    }

    game.usedItems.push(item);
    game.status = "running";
    game.roundNumber += 1;
    game.currentRound = {
      id: crypto.randomUUID(),
      item,
      status: "active",
      submissions: [],
      processing: false,
      startedAt: Date.now(),
      expiresAt: Date.now() + this.config.game.objectTimeoutMs
    };
    game.lastResult = null;

    this.io.to(game.id).emit("round_started", {
      item,
      roundNumber: game.roundNumber,
      expiresAt: game.currentRound.expiresAt
    });
    this.emitState(game);

    game.roundTimer = setTimeout(() => {
      this.expireRound(game.id, game.currentRound?.id).catch((error) => {
        this.logger.warn(`Round timeout failed: ${error.message}`);
      });
    }, this.config.game.objectTimeoutMs);

    if (game.itemQueue.length < this.config.game.refillThreshold) {
      this.ensureItemBuffer(game, this.config.game.refillThreshold).catch((error) => {
        this.logger.warn(`Item refill failed: ${error.message}`);
      });
    }
  }

  async processSubmissions(game) {
    const round = game.currentRound;
    if (!round || round.processing || round.status !== "active") return;
    round.processing = true;

    while (round.submissions.length > 0 && round.status === "active") {
      const submission = round.submissions.shift();
      const player = game.players.get(submission.playerId);
      if (!player || !player.connected) continue;

      const result = await this.llm.verifyPhoto({
        item: round.item,
        imageDataUrl: submission.imageDataUrl
      });

      if (round.status !== "active") break;

      if (result.match) {
        await this.awardPoint(game, player, result);
        break;
      }

      this.io.to(player.socketId).emit("submission_result", {
        status: "miss",
        message: result.reason || "Not a match yet."
      });
    }

    round.processing = false;
  }

  async awardPoint(game, player, result) {
    const round = game.currentRound;
    if (!round || round.status !== "active") return;

    this.clearRoundTimer(game);
    round.status = "found";
    player.score += 1;
    game.roundsAwarded += 1;
    game.lastResult = {
      status: "found",
      item: round.item,
      playerId: player.id,
      username: player.username,
      confidence: result.confidence,
      message: `${player.username} found ${round.item}.`
    };

    this.io.to(game.id).emit("round_result", game.lastResult);
    this.emitState(game);
    this.scheduleNextStep(game);
  }

  async expireRound(gameId, roundId) {
    const game = this.games.get(gameId);
    const round = game?.currentRound;
    if (!game || !round || round.id !== roundId || round.status !== "active") return;

    this.clearRoundTimer(game);
    round.status = "expired";
    game.lastResult = {
      status: "expired",
      item: round.item,
      message: `No one found ${round.item}.`
    };
    this.io.to(game.id).emit("round_result", game.lastResult);
    this.emitState(game);
    this.scheduleNextStep(game);
  }

  scheduleNextStep(game) {
    this.clearNextRoundTimer(game);
    game.nextRoundTimer = setTimeout(() => {
      this.startRound(game).catch((error) => {
        this.logger.warn(`Next round failed: ${error.message}`);
      });
    }, this.config.game.nextRoundDelayMs);
  }

  shouldEndGame(game) {
    if (game.roundsAwarded < this.config.game.normalRounds) return false;
    return topPlayers([...game.players.values()]).length === 1;
  }

  async endGame(game) {
    this.clearTimers(game);
    game.status = "ended";
    game.endedAt = Date.now();
    game.currentRound = null;
    game.winner = topPlayers([...game.players.values()])[0] || null;
    game.lastResult = {
      status: "ended",
      item: null,
      username: game.winner?.username || "",
      message: game.winner ? `${game.winner.username} wins.` : "Game ended."
    };

    const players = [...game.players.values()].map(publicPlayer);
    try {
      await this.database.saveGameResult({
        gameId: game.id,
        roundsPlayed: game.roundsAwarded,
        winner: game.winner ? publicPlayer(game.winner) : null,
        players
      });
    } catch (error) {
      this.logger.warn(`Saving game result failed: ${error.message}`);
    }

    this.io.to(game.id).emit("game_ended", {
      winner: game.winner ? publicPlayer(game.winner) : null,
      players
    });
    this.emitState(game);
  }

  clearRoundTimer(game) {
    if (game.roundTimer) clearTimeout(game.roundTimer);
    game.roundTimer = null;
  }

  clearNextRoundTimer(game) {
    if (game.nextRoundTimer) clearTimeout(game.nextRoundTimer);
    game.nextRoundTimer = null;
  }

  clearTimers(game) {
    this.clearRoundTimer(game);
    this.clearNextRoundTimer(game);
  }
}
