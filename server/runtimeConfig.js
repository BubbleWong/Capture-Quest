import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const defaults = {
  mode: "development",
  port: 3000,
  publicBaseUrl: "",
  game: {
    maxPlayers: 20,
    normalRounds: 5,
    objectTimeoutMs: 120000,
    nextRoundDelayMs: 5000,
    itemBatchSize: 20,
    refillThreshold: 5
  },
  postgres: {
    nodes: "",
    user: "",
    password: "",
    database: "",
    ssl: false
  },
  openRouter: {
    apiKey: "",
    model: "openai/gpt-5.4-mini",
    visionModel: "google/gemini-3.1-flash-lite-preview",
    ttsModel: "google/gemini-3.1-flash-tts-preview",
    ttsVoice: "Kore",
    ttsResponseFormat: "pcm",
    baseUrl: "https://openrouter.ai/api/v1",
    appTitle: "Capture Quest",
    referer: "",
    mockWhenMissingKey: true
  },
  s3: {
    enabled: false,
    endpointUrl: "",
    region: "us-east-1",
    accessKeyId: "",
    secretAccessKey: "",
    bucket: "capture-quest-tts",
    publicBaseUrl: "",
    forcePathStyle: true
  },
  cloudflare: {
    enabled: false,
    token: "",
    domain: "",
    command: "cloudflared",
    url: ""
  },
  logging: {
    gameEvents: false
  }
};

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function mergeDeep(base, override) {
  const output = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    if (isObject(value) && isObject(output[key])) {
      output[key] = mergeDeep(output[key], value);
    } else if (value !== undefined) {
      output[key] = value;
    }
  }
  return output;
}

function boolFromEnv(value, fallback) {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function normalizeMode(value) {
  return String(value || "development").toLowerCase() === "production" ? "production" : "development";
}

async function loadLocalConfig() {
  if (boolFromEnv(process.env.CAPTURE_QUEST_SKIP_LOCAL_CONFIG, false)) return {};

  const localConfigPath = path.join(rootDir, "config.js");
  if (!fs.existsSync(localConfigPath)) return {};

  const url = pathToFileURL(localConfigPath);
  url.searchParams.set("mtime", String(fs.statSync(localConfigPath).mtimeMs));
  const imported = await import(url.href);
  return imported.default || {};
}

function applyEnv(config) {
  const mode = normalizeMode(process.env.CAPTURE_QUEST_MODE || process.env.NODE_ENV || config.mode);
  return mergeDeep(config, {
    mode,
    port: process.env.PORT ? Number(process.env.PORT) : config.port,
    publicBaseUrl: process.env.PUBLIC_BASE_URL || config.publicBaseUrl,
    postgres: {
      nodes: process.env.POSTGRES_NODES || config.postgres.nodes,
      user: process.env.POSTGRES_USER || config.postgres.user,
      password: process.env.POSTGRES_PASSWORD || config.postgres.password,
      database: process.env.POSTGRES_DATABASE || config.postgres.database,
      ssl: boolFromEnv(process.env.POSTGRES_SSL, config.postgres.ssl)
    },
    openRouter: {
      apiKey: process.env.OPENROUTER_API_KEY || config.openRouter.apiKey,
      model: process.env.OPENROUTER_MODEL || config.openRouter.model,
      visionModel: process.env.OPENROUTER_VISION_MODEL || config.openRouter.visionModel,
      ttsModel: process.env.OPENROUTER_TTS_MODEL || config.openRouter.ttsModel,
      ttsVoice: process.env.OPENROUTER_TTS_VOICE || config.openRouter.ttsVoice,
      ttsResponseFormat: process.env.OPENROUTER_TTS_RESPONSE_FORMAT || config.openRouter.ttsResponseFormat,
      baseUrl: process.env.OPENROUTER_BASE_URL || config.openRouter.baseUrl,
      appTitle: process.env.OPENROUTER_APP_TITLE || config.openRouter.appTitle,
      referer: process.env.OPENROUTER_REFERER || config.openRouter.referer,
      mockWhenMissingKey: boolFromEnv(
        process.env.OPENROUTER_MOCK_WHEN_MISSING_KEY,
        config.openRouter.mockWhenMissingKey
      )
    },
    s3: {
      enabled: boolFromEnv(process.env.S3_ENABLED ?? process.env.AWS_S3_ENABLED, config.s3.enabled),
      endpointUrl: process.env.AWS_ENDPOINT_URL || process.env.S3_ENDPOINT_URL || config.s3.endpointUrl,
      region: process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || config.s3.region,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || config.s3.accessKeyId,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || config.s3.secretAccessKey,
      bucket: process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || config.s3.bucket,
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || config.s3.publicBaseUrl,
      forcePathStyle: boolFromEnv(process.env.S3_FORCE_PATH_STYLE, config.s3.forcePathStyle)
    },
    cloudflare: {
      enabled: boolFromEnv(process.env.CLOUDFLARE_TUNNEL_ENABLED, config.cloudflare.enabled),
      token: process.env.CLOUDFLARE_TUNNEL_TOKEN || config.cloudflare.token,
      domain: process.env.CLOUDFLARE_TUNNEL_DOMAIN || config.cloudflare.domain,
      command: process.env.CLOUDFLARED_COMMAND || config.cloudflare.command,
      url: process.env.CLOUDFLARE_TUNNEL_URL || config.cloudflare.url
    },
    logging: {
      gameEvents: boolFromEnv(process.env.CAPTURE_QUEST_LOG_GAME_EVENTS, config.logging.gameEvents)
    }
  });
}

function finalizeConfig(config) {
  const mode = normalizeMode(config.mode);
  const cloudflare = {
    ...config.cloudflare,
    enabled: mode === "development" && Boolean(config.cloudflare.enabled)
  };
  const finalizedConfig = {
    ...config,
    mode,
    cloudflare
  };

  if (!finalizedConfig.publicBaseUrl && finalizedConfig.cloudflare.enabled && finalizedConfig.cloudflare.domain) {
    return {
      ...finalizedConfig,
      publicBaseUrl: `https://${finalizedConfig.cloudflare.domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}`
    };
  }
  return finalizedConfig;
}

export const config = finalizeConfig(applyEnv(mergeDeep(defaults, await loadLocalConfig())));
export const projectRoot = rootDir;
