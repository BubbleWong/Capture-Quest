const maximumPhotoBytes = 512 * 1024;
const maximumPixels = 4 * 1024 * 1024;

export class JobError extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

function invalid(message = 'The job payload is invalid.') {
  return new JobError('INVALID_JOB', message);
}

function text(value, maximum, required = true) {
  if (typeof value !== 'string' || value.length > maximum ||
      (required && !value.trim())) throw invalid();
  return value.trim();
}

function optionalText(value, maximum, fallback = '') {
  return value === undefined ? fallback : text(value, maximum, false);
}

function list(value, maximum = 500) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maximum) throw invalid();
  return value.map((item) => text(item, 160));
}

function count(value) {
  const number = value === undefined ? 20 : value;
  if (!Number.isInteger(number) || number < 1 || number > 40) throw invalid();
  return number;
}

/** Decode only inline photos; no attacker-controlled URL is ever fetched. */
export async function validatePhoto(dataUrl, imageFactory) {
  if (typeof dataUrl !== 'string' || dataUrl.length > 700000) {
    throw new JobError('INVALID_PHOTO', 'The photo exceeds the size limit.');
  }
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || match[2].length % 4 !== 0) {
    throw new JobError('INVALID_PHOTO', 'The photo format is unsupported.');
  }
  const bytes = Buffer.from(match[2], 'base64');
  const png = bytes.subarray(0, 8).equals(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  );
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (bytes.length < 16 || bytes.length > maximumPhotoBytes ||
      bytes.toString('base64') !== match[2] ||
      (match[1] === 'jpeg' ? !jpeg : !png)) {
    throw new JobError('INVALID_PHOTO', 'The photo contents are invalid.');
  }
  try {
    const createImage = imageFactory || (await import('sharp')).default;
    const image = createImage(bytes, {
      limitInputPixels: maximumPixels,
      failOn: 'error',
      animated: false
    });
    const metadata = await image.metadata();
    if (!['jpeg', 'png'].includes(metadata.format) ||
        !metadata.width || !metadata.height ||
        metadata.width > 2048 || metadata.height > 2048 ||
        metadata.width * metadata.height > maximumPixels ||
        (metadata.pages || 1) > 1) {
      throw new Error('Invalid dimensions.');
    }
    // Re-encoding fully decodes the image and removes embedded metadata before
    // it reaches the vision provider. The client-side checks are not trusted.
    const safe = await image.rotate().resize({
      width: 640, height: 640, fit: 'inside', withoutEnlargement: true
    }).jpeg({ quality: 70 }).toBuffer();
    if (safe.length > maximumPhotoBytes) throw new Error('Invalid image size.');
    return `data:image/jpeg;base64,${safe.toString('base64')}`;
  } catch {
    throw new JobError('INVALID_PHOTO', 'The photo cannot be decoded safely.');
  }
}

export function createJobHandlers({ llm, audioCache, database, imageFactory }) {
  return {
    async generateItems(payload) {
      return llm.generateItems({
        count: count(payload.count),
        language: optionalText(payload.language, 80, 'English'),
        previousItems: list(payload.previousItems),
        queuedItems: list(payload.queuedItems)
      });
    },
    async prepareInitialItems(payload) {
      return llm.prepareInitialItems({
        input: text(payload.input, 1600),
        count: count(payload.count),
        language: optionalText(payload.language, 80, 'English'),
        previousItems: list(payload.previousItems),
        queuedItems: list(payload.queuedItems)
      });
    },
    async verifyPhoto(payload) {
      const imageDataUrl = await validatePhoto(payload.imageDataUrl, imageFactory);
      return llm.verifyPhoto({
        item: text(payload.item, 160),
        language: optionalText(payload.language, 80, 'English'),
        imageDataUrl
      });
    },
    async prepareAudio(payload) {
      return audioCache.prepareAudio({
        item: text(payload.item, 160),
        languageCode: text(payload.languageCode, 40),
        languageName: optionalText(payload.languageName, 80)
      });
    },
    async saveGameResult(payload) {
      const resultId = text(payload.resultId, 160);
      const gameId = text(payload.gameId, 80);
      if (!Array.isArray(payload.players) || payload.players.length > 50 ||
          !Number.isInteger(payload.roundsPlayed) || payload.roundsPlayed < 0 ||
          payload.roundsPlayed > 1000) throw invalid();
      const players = payload.players.map((player) => {
        if (!Number.isInteger(player.score) || Math.abs(player.score) > 10000) {
          throw invalid();
        }
        return {
          id: text(player.id, 80),
          username: text(player.username, 80),
          score: player.score,
          teamId: optionalText(player.teamId ?? undefined, 80) || null,
          teamName: optionalText(player.teamName ?? undefined, 80) || null,
          isOwner: player.isOwner === true
        };
      });
      const winner = payload.winner ? {
        id: text(payload.winner.id, 80),
        username: optionalText(payload.winner.username, 80),
        name: optionalText(payload.winner.name, 80)
      } : null;
      const endDate = payload.endedAt ? new Date(payload.endedAt) : new Date();
      if (!Number.isFinite(endDate.getTime())) throw invalid();
      const endedAt = endDate.toISOString();
      if (new Set(players.map((player) => player.id)).size !== players.length) {
        throw invalid();
      }
      if (!database.enabled) {
        throw new JobError('STORAGE_UNAVAILABLE', 'Result storage is unavailable.', true);
      }
      await database.saveGameResult({
        resultId, gameId, roundsPlayed: payload.roundsPlayed,
        players, winner, endedAt
      });
      return { saved: true, resultId };
    }
  };
}

export async function executeJob(job, handlers) {
  if (!job || typeof job !== 'object' ||
      typeof job.type !== 'string' ||
      !Object.hasOwn(handlers, job.type) ||
      !job.payload || typeof job.payload !== 'object' ||
      Array.isArray(job.payload)) throw invalid('The job type is unsupported.');
  return handlers[job.type](job.payload);
}
