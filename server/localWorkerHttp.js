/** Read provider responses with an explicit byte ceiling before JSON parsing. */
export async function readLimitedBody(response, maximumBytes) {
  const advertised = Number(response.headers.get('content-length'));
  if (Number.isFinite(advertised) && advertised > maximumBytes) {
    await response.body?.cancel();
    throw new Error('Upstream response exceeds the size limit.');
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        throw new Error('Upstream response exceeds the size limit.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readLimitedJson(response, maximumBytes = 131072) {
  return JSON.parse(new TextDecoder().decode(
    await readLimitedBody(response, maximumBytes)
  ));
}

export function requestTimeout(value, fallback = 45000) {
  const number = Number(value);
  return Math.max(1000, Math.min(45000,
    Number.isFinite(number) ? number : fallback
  ));
}
