import crypto from "node:crypto";
import { readLimitedBody, requestTimeout } from "./localWorkerHttp.js";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";

const languageSpeechCodes = new Map([
  ["ar", "ar-SA"],
  ["zh-hans-yue", "yue-HK"],
  ["zh-hans-cmn", "cmn-CN"],
  ["zh-hant-yue", "yue-HK"],
  ["zh-hant-cmn", "cmn-TW"],
  ["en", "en-US"],
  ["fr", "fr-FR"],
  ["de", "de-DE"],
  ["hi", "hi-IN"],
  ["it", "it-IT"],
  ["ja", "ja-JP"],
  ["ko", "ko-KR"],
  ["pt", "pt-BR"],
  ["ru", "ru-RU"],
  ["es", "es-ES"],
  ["zh", "cmn-CN"],
  ["zh-hant", "cmn-TW"],
  ["zh-hans-cn-cmn", "cmn-CN"],
  ["zh-hans-cn-yue", "yue-HK"],
  ["zh-hant-tw-cmn", "cmn-TW"],
  ["zh-hant-hk-yue", "yue-HK"]
]);

function cleanLanguageCode(value) {
  return String(value || "en").trim().toLowerCase();
}

export function speechLanguageCode(value) {
  return languageSpeechCodes.get(cleanLanguageCode(value)) || "en-US";
}

function cleanResponseFormat(value) {
  return String(value || "mp3").trim().toLowerCase() === "pcm" ? "pcm" : "mp3";
}

function contentTypeForFormat(format) {
  return format === "pcm" ? "audio/wav" : "audio/mpeg";
}

function extensionForFormat(format) {
  return format === "pcm" ? "wav" : "mp3";
}

export function speechPromptForItem({ item, languageCode, languageName }) {
  const cleanItem = String(item || "").trim();
  const cleanLanguageName = String(languageName || "").trim();
  const fallbackLanguage = speechLanguageCode(languageCode);
  const spokenLanguage = cleanLanguageName || fallbackLanguage || "the selected language";
  return [
    `Pronounce this object phrase in ${spokenLanguage}.`,
    "Say only the object phrase. Do not translate it, spell it, or add extra words.",
    `Object phrase: ${cleanItem}`
  ].join(" ");
}

export function speechRequestBody({ openRouter, item, languageCode, languageName, responseFormat }) {
  return {
    model: openRouter.ttsModel,
    input: speechPromptForItem({ item, languageCode, languageName }),
    voice: openRouter.ttsVoice || "Kore",
    response_format: responseFormat
  };
}

function wavFromPcm(pcmBuffer, { sampleRate = 24000, channels = 1, bitsPerSample = 16 } = {}) {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([header, pcmBuffer]);
}

function modelPathPart(model) {
  return String(model || "tts")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "tts";
}

function slugPart(value) {
  const slug = String(value || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\p{M} -]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return slug || "object";
}

function encodeKey(key) {
  return key.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function publicObjectUrl(storage, key) {
  const bucket = String(storage.bucket || "").trim();
  const publicBaseUrl = String(storage.publicBaseUrl || "").trim();
  if (publicBaseUrl) return `${publicBaseUrl.replace(/\/$/, "")}/${encodeKey(key)}`;
  return `${String(storage.endpointUrl || "").replace(/\/$/, "")}/${encodeURIComponent(bucket)}/${encodeKey(key)}`;
}

function isNotFound(error) {
  return (
    error?.$metadata?.httpStatusCode === 404 ||
    error?.name === "NotFound" ||
    error?.name === "NoSuchKey" ||
    error?.name === "NoSuchBucket"
  );
}

function isForbidden(error) {
  return error?.$metadata?.httpStatusCode === 403 || error?.name === "Forbidden" || error?.name === "AccessDenied";
}

function isBucketAlreadyOwned(error) {
  return error?.name === "BucketAlreadyOwnedByYou" || error?.name === "BucketAlreadyExists";
}

function isAclUnsupported(error) {
  return (
    error?.name === "AccessControlListNotSupported" ||
    error?.name === "NotImplemented" ||
    /acl/i.test(String(error?.message || "")) && /not|unsupported|disabled/i.test(String(error?.message || ""))
  );
}

export function createChallengeAudioCache(config, { s3Client: suppliedS3Client } = {}) {
  const openRouter = config.openRouter || {};
  const storage = config.s3 || {};
  const responseFormat = cleanResponseFormat(openRouter.ttsResponseFormat);
  const enabled = Boolean(
    openRouter.apiKey &&
      openRouter.ttsModel &&
      storage.enabled &&
      storage.endpointUrl &&
      storage.accessKeyId &&
      storage.secretAccessKey &&
      storage.bucket
  );

  if (!enabled) {
    return {
      enabled: false,
      async prepareAudio() {
        return "";
      }
    };
  }

  const s3Client = suppliedS3Client || new S3Client({
    maxAttempts: 2,
    requestHandler: { connectionTimeout: 3000, requestTimeout: 8000 },
    region: storage.region || "us-east-1",
    endpoint: storage.endpointUrl,
    forcePathStyle: storage.forcePathStyle !== false,
    credentials: {
      accessKeyId: storage.accessKeyId,
      secretAccessKey: storage.secretAccessKey
    }
  });
  const sendS3 = (command) => s3Client.send(command, {
    abortSignal: AbortSignal.timeout(10000)
  });
  let ensureBucketPromise = null;

  async function ensureBucket() {
    if (ensureBucketPromise) return ensureBucketPromise;
    ensureBucketPromise = (async () => {
      try {
        await sendS3(new HeadBucketCommand({ Bucket: storage.bucket }));
        return;
      } catch (error) {
        if (isForbidden(error)) return;
        if (!isNotFound(error)) throw error;
      }
      if (config.mode === "production" || storage.createBucket !== true) {
        throw new Error("The configured audio bucket does not exist.");
      }

      const createInput = { Bucket: storage.bucket };
      if (storage.region && storage.region !== "us-east-1") {
        createInput.CreateBucketConfiguration = { LocationConstraint: storage.region };
      }

      try {
        await sendS3(new CreateBucketCommand(createInput));
      } catch (error) {
        if (!isBucketAlreadyOwned(error)) throw error;
      }
    })().catch((error) => {
      ensureBucketPromise = null;
      throw error;
    });
    return ensureBucketPromise;
  }

  async function publicObjectExists(url) {
    try {
      const response = await fetch(url, {
        method: "HEAD", signal: AbortSignal.timeout(5000)
      });
      if (response.ok) return true;
      if (response.status === 403 || response.status === 404) return false;
    } catch {
      return false;
    }
    return false;
  }

  async function objectExists(key, url) {
    await ensureBucket();
    try {
      await sendS3(new HeadObjectCommand({ Bucket: storage.bucket, Key: key }));
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      if (isForbidden(error)) return publicObjectExists(url);
      throw error;
    }
  }

  async function uploadObject(key, body, contentType) {
    await ensureBucket();
    const input = {
      Bucket: storage.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
      ACL: storage.acl || "public-read"
    };

    try {
      await sendS3(new PutObjectCommand(input));
    } catch (error) {
      if (!isAclUnsupported(error)) throw error;
      const { ACL: _acl, ...inputWithoutAcl } = input;
      await sendS3(new PutObjectCommand(inputWithoutAcl));
    }
  }

  async function requestSpeech({ item, languageCode, languageName }) {
    const baseUrl = String(openRouter.baseUrl || "https://openrouter.ai/api/v1").replace(/\/$/, "");
    const body = speechRequestBody({ openRouter, item, languageCode, languageName, responseFormat });
    const response = await fetch(`${baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouter.apiKey}`,
        "Content-Type": "application/json",
        // The speech route rejects HTTP-Referer; retain X-Title attribution.
        "X-Title": openRouter.appTitle || "Capture Quest"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(requestTimeout(openRouter.requestTimeoutMs))
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`OpenRouter TTS request failed: HTTP ${response.status}.`);
    }

    if (responseFormat === "pcm") {
      const [mime, ...parameters] = String(response.headers.get("content-type") || "")
        .toLowerCase().split(";").map((part) => part.trim());
      const attributes = new Map(parameters.map((part) => {
        const [name, value] = part.split("=");
        return [name?.trim(), value?.trim().replace(/^"|"$/g, "")];
      }));
      if (mime !== "audio/pcm" || attributes.get("rate") !== "24000" ||
          attributes.get("channels") !== "1") {
        await response.body?.cancel();
        throw new Error("OpenRouter TTS returned an unsupported PCM format.");
      }
    }
    let buffer = Buffer.from(await readLimitedBody(response, 8 * 1024 * 1024));
    if (buffer.length < 16) throw new Error("OpenRouter TTS returned an empty audio file.");
    if (responseFormat === "pcm") {
      if (buffer.length % 2 !== 0) throw new Error("OpenRouter TTS returned invalid PCM samples.");
      buffer = wavFromPcm(buffer);
    }
    return {
      buffer,
      contentType: contentTypeForFormat(responseFormat)
    };
  }

  return {
    enabled: true,
    async prepareAudio({ item, languageCode, languageName }) {
      const cleanItem = String(item || "").trim();
      if (!cleanItem) return "";

      const code = cleanLanguageCode(languageCode);
      const hash = crypto
        .createHash("sha1")
        .update(`${openRouter.ttsModel}|${openRouter.ttsVoice}|${responseFormat}|${code}|${cleanItem}`)
        .digest("hex")
        .slice(0, 12);
      const key = [
        "tts",
        modelPathPart(openRouter.ttsModel),
        code.toUpperCase(),
        `${slugPart(cleanItem)}-${hash}.${extensionForFormat(responseFormat)}`
      ].join("/");
      const url = publicObjectUrl(storage, key);

      if (await objectExists(key, url)) return url;

      const audio = await requestSpeech({ item: cleanItem, languageCode: code, languageName });
      await uploadObject(key, audio.buffer, audio.contentType);
      return url;
    }
  };
}
