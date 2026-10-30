import crypto from 'node:crypto';
import { GameEngine } from '../server/gameEngine.js';

// All slow work becomes an explicit durable job. No game transition depends on
// an in-memory Promise surviving eviction or a runtime deployment.
export class DurableGameEngine extends GameEngine {
  constructor(options) {
    super({ ...options, useTimers: false });
    this.jobs = options.jobs;
    this.photos = options.photos;
  }

  async startGame(socket, payload = {}) {
    const session = this.getSession(socket, payload.gameId);
    if (!session) return { error: 'You are not in this game.' };
    const { game, player } = session;
    if (game.ownerPlayerId !== player.id) return { error: 'Only the game owner can start.' };
    if (game.status !== 'lobby') return { error: 'The game is not in the lobby.' };
    if (!this.allPlayersReady(game)) return { error: 'Every player must be ready before the game can start.' };
    this.resetCompletedLobbyForStart(game);
    this.assignBalancedTeams(game);
    game.epoch = crypto.randomUUID();
    game.status = 'loading';
    game.startedAt = Date.now();
    game.endedAt = null;
    game.winner = null;
    game.captureCount = 0;
    game.initialChallengePrepared = true;
    this.queueItems(game, Boolean(game.initialChallengeInput));
    this.emitState(game);
    return { game, player };
  }

  queueItems(game, initial = false) {
    if (game.itemJobId) return;
    const snapshot = this.getSnapshot(game, game.ownerPlayerId);
    game.itemJobId = this.jobs.enqueue(initial ? 'prepareInitialItems' : 'generateItems', {
      ...(initial ? { input: game.initialChallengeInput } : {}),
      count: this.config.game.itemBatchSize,
      language: snapshot.challengeLanguageName,
      previousItems: [...game.usedItems],
      queuedItems: [...game.itemQueue]
    }, { purpose: 'items', epoch: game.epoch });
  }

  async startRound(game) {
    game.nextRoundAt = null;
    game.nextRoundStartedAt = null;
    if (this.shouldEndGame(game)) return this.endGame(game);
    const item = this.takeNextChallengeItem(game);
    if (!item) {
      game.status = 'loading';
      this.queueItems(game);
      this.emitState(game);
      return;
    }
    const snapshot = this.getSnapshot(game, game.ownerPlayerId);
    game.pendingRound = {
      item,
      languageCode: game.challengeLanguage,
      languageName: snapshot.challengeLanguageName
    };
    game.status = 'loading';
    game.audioJobId = this.jobs.enqueue('prepareAudio', {
      item,
      languageCode: game.challengeLanguage,
      languageName: snapshot.challengeLanguageName
    }, { purpose: 'audio', epoch: game.epoch });
    this.emitState(game);
  }

  beginPreparedRound(game, audioUrl = '') {
    const pending = game.pendingRound;
    if (!pending) return;
    game.pendingRound = null;
    game.audioJobId = null;
    this.rememberPresentedChallenge(game, pending.item);
    game.status = 'running';
    game.roundNumber += 1;
    game.currentRound = {
      id: crypto.randomUUID(), ...pending, audioUrl,
      status: 'active', startedAt: Date.now(),
      expiresAt: Date.now() + this.config.game.objectTimeoutMs,
      skipVotes: new Set()
    };
    game.lastResult = null;
    this.io.to(game.id).emit('round_started', {
      challengeId: game.currentRound.id,
      ...pending,
      audioUrl,
      roundNumber: game.roundNumber,
      expiresAt: game.currentRound.expiresAt
    });
    this.emitState(game);
    if (game.itemQueue.length < this.config.game.refillThreshold) this.queueItems(game);
  }

  async processSubmissionQueue(game) {
    // Photo bodies live in separate bounded SQL rows, never in the room snapshot.
    for (const entry of game.submissionQueue) {
      if (entry.imageDataUrl) {
        entry.captureId = crypto.randomUUID();
        this.photos.put(entry.captureId, entry.imageDataUrl);
        delete entry.imageDataUrl;
      }
    }
    if (game.verificationJobId) return;
    for (;;) {
      const submission = game.submissionQueue[0];
      const round = game.currentRound;
      if (!submission) return;
      if (game.status !== 'running' || !round || round.status !== 'active' ||
          submission.challengeId !== round.id) {
        this.photos.delete(submission.captureId);
        game.submissionQueue.shift();
        continue;
      }
      const photo = this.photos.get(submission.captureId);
      if (!photo) {
        const player = game.players.get(submission.playerId);
        if (player) this.io.to(player.socketId).emit('submission_result', {
          status: 'error', message: 'This photo has expired. Please take another photo.'
        });
        game.submissionQueue.shift();
        continue;
      }
      const snapshot = this.getSnapshot(game, game.ownerPlayerId);
      game.verificationJobId = this.jobs.enqueue('verifyPhoto', {
        item: round.item, language: snapshot.challengeLanguageName,
        imageDataUrl: photo
      }, {
        purpose: 'photo', epoch: game.epoch,
        challengeId: round.id, captureId: submission.captureId,
        playerId: submission.playerId, queueEpoch: game.submissionQueueEpoch
      });
      return;
    }
  }

  dropQueuedSubmissionsForChallenge(game, challengeId) {
    for (const entry of game.submissionQueue) {
      if (entry.challengeId === challengeId && entry.captureId) this.photos.delete(entry.captureId);
    }
    super.dropQueuedSubmissionsForChallenge(game, challengeId);
    game.verificationJobId = null;
  }

  async applyJob(game, job, outcome) {
    if (job.meta.epoch !== game.epoch && job.type !== 'saveGameResult') return;
    if (job.meta.purpose === 'items') {
      if (game.itemJobId !== job.id) return;
      game.itemJobId = null;
      const items = outcome.ok && Array.isArray(outcome.result) ? outcome.result : [];
      game.itemQueue.push(...this.filterNewChallengeItems(game, items.slice(0, 50)));
      if (game.status === 'loading' && !game.pendingRound) {
        if (!game.itemQueue.length) {
          // Curated local fallback avoids stranding a live game when AI is down.
          game.itemQueue.push(...this.filterNewChallengeItems(game,
            ['book', 'cup', 'pencil', 'shoe', 'chair', 'towel', 'bottle', 'spoon']));
        }
        if (game.itemQueue.length) await this.startRound(game);
        else await this.endGame(game, { forced: true, message: 'No more challenges are available.' });
      }
    } else if (job.meta.purpose === 'audio') {
      if (game.audioJobId !== job.id) return;
      const audioUrl = outcome.ok && typeof outcome.result === 'string' &&
        /^https:\/\//.test(outcome.result) ? outcome.result.slice(0, 2048) : '';
      this.beginPreparedRound(game, audioUrl);
    } else if (job.meta.purpose === 'photo') {
      if (game.verificationJobId !== job.id) return;
      if (game.status === 'paused' && game.currentRound?.id === job.meta.challengeId) {
        game.pausedPhotoResult = { job, outcome };
        return;
      }
      game.verificationJobId = null;
      const submission = game.submissionQueue[0];
      const round = game.currentRound;
      if (!submission || submission.captureId !== job.meta.captureId) return;
      game.submissionQueue.shift();
      this.photos.delete(submission.captureId);
      const player = game.players.get(job.meta.playerId);
      if (player && game.status === 'running' && round?.status === 'active' &&
          round.id === job.meta.challengeId && game.submissionQueueEpoch === job.meta.queueEpoch &&
          Date.now() < round.expiresAt) {
        if (!outcome.ok) {
          this.io.to(player.socketId).emit('submission_result', {
            status: 'error', message: 'This photo could not be verified. Please try again.'
          });
        } else if (typeof outcome.result?.match === 'boolean') {
          if (outcome.result.match) await this.awardPoint(game, player, {
            match: true, confidence: Math.max(0, Math.min(1, Number(outcome.result.confidence) || 0))
          });
          else this.penalizeMiss(game, player, {
            match: false, reason: String(outcome.result.reason || '').slice(0, 240)
          });
        }
      }
      await this.processSubmissionQueue(game);
    } else if (job.meta.purpose === 'result' && job.meta.epoch === game.epoch) {
      game.archivalStatus = outcome.ok ? 'saved' : 'pending';
      this.emitState(game);
    }
  }

  async resumeGameByOwner(socket, payload = {}) {
    const result = super.resumeGameByOwner(socket, payload);
    if (!result.error && result.game.pausedPhotoResult) {
      const pending = result.game.pausedPhotoResult;
      result.game.pausedPhotoResult = null;
      await this.applyJob(result.game, pending.job, pending.outcome);
    }
    return result;
  }

  async endGame(game, options = {}) {
    game.pausedPhotoResult = null;
    game.itemJobId = null;
    game.audioJobId = null;
    game.pendingRound = null;
    game.verificationJobId = null;
    game.archivalStatus = 'pending';
    await super.endGame(game, options);
  }
}
