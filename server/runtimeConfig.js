import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const defaults = {
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
    baseUrl: "https://openrouter.ai/api/v1",
    appTitle: "Capture Quest",
    referer: "",
    mockWhenMissingKey: true
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

async function loadLocalConfig() {
  const localConfigPath = path.join(rootDir, "config.js");
  if (!fs.existsSync(localConfigPath)) return {};

  const url = pathToFileURL(localConfigPath);
  url.searchParams.set("mtime", String(fs.statSync(localConfigPath).mtimeMs));
  const imported = await import(url.href);
  return imported.default || {};
}

function applyEnv(config) {
  return mergeDeep(config, {
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
      baseUrl: process.env.OPENROUTER_BASE_URL || config.openRouter.baseUrl,
      appTitle: process.env.OPENROUTER_APP_TITLE || config.openRouter.appTitle,
      referer: process.env.OPENROUTER_REFERER || config.openRouter.referer,
      mockWhenMissingKey: boolFromEnv(
        process.env.OPENROUTER_MOCK_WHEN_MISSING_KEY,
        config.openRouter.mockWhenMissingKey
      )
    }
  });
}

export const config = applyEnv(mergeDeep(defaults, await loadLocalConfig()));
export const projectRoot = rootDir;
