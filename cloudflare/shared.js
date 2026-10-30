import crypto from 'node:crypto';

export const GAME_CONFIG = {
  maxPlayers: 50,
  normalRounds: 5,
  objectTimeoutMs: 120000,
  nextRoundDelayMs: 5000,
  itemBatchSize: 20,
  refillThreshold: 5,
  submissionLimitBytes: 524288,
  maxPendingSubmissions: 50,
  maxCapturesPerGame: 500,
  submissionIntervalMs: 1000,
  strictCaptureValidation: true
};
export const JOB_TYPES = new Set([
  'generateItems', 'prepareInitialItems', 'verifyPhoto',
  'prepareAudio', 'saveGameResult'
]);
export const ROOM_TTL = 24 * 60 * 60 * 1000;
export const PHOTO_TTL = 5 * 60 * 1000;
export function json(value, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}
export async function readJson(request, limit = 32768) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > limit) throw new Error('Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) {
      await reader.cancel();
      throw new Error('Request is too large.');
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }
  const result = JSON.parse(new TextDecoder().decode(combined));
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('Expected a JSON object.');
  }
  return result;
}
export function secretMatches(value, expected) {
  const a = Buffer.from(String(value || ''));
  const b = Buffer.from(String(expected || ''));
  return b.length >= 32 && a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function encodeState(game) {
  return JSON.parse(JSON.stringify(game, (key, value) => {
    if (['roundTimer', 'nextRoundTimer', 'loadingItems'].includes(key)) return null;
    if (value instanceof Map) return { __type: 'Map', entries: [...value] };
    if (value instanceof Set) return { __type: 'Set', entries: [...value] };
    return value;
  }));
}
export function decodeState(value) {
  return JSON.parse(JSON.stringify(value), (_key, item) => {
    if (item?.__type === 'Map') return new Map(item.entries);
    if (item?.__type === 'Set') return new Set(item.entries);
    return item;
  });
}
export function rows(sql, query, ...args) {
  return [...sql.exec(query, ...args)];
}
