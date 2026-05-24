import { spawn } from "node:child_process";

function redact(value, secret) {
  if (!secret) return value;
  return value.replaceAll(secret, "[redacted]");
}

export function createCloudflareTunnel(config, logger = console) {
  const tunnelConfig = config.cloudflare || {};
  const token = tunnelConfig.token || "";
  const domain = tunnelConfig.domain || "";
  const command = tunnelConfig.command || "cloudflared";
  const originUrl = tunnelConfig.url || `http://127.0.0.1:${config.port}`;
  let child = null;
  let stopPromise = null;
  let stopping = false;

  function logChunk(chunk, level = "info") {
    for (const line of String(chunk).split(/\r?\n/)) {
      if (line.trim()) logger[level](`[cloudflared] ${redact(line, token)}`);
    }
  }

  function start() {
    if (!tunnelConfig.enabled) return;
    if (!token) {
      logger.warn("Cloudflare tunnel is enabled, but no tunnel token is configured.");
      return;
    }
    if (child) return;

    stopping = false;
    child = spawn(command, ["tunnel", "--no-autoupdate", "run"], {
      env: {
        ...process.env,
        TUNNEL_TOKEN: token,
        TUNNEL_URL: originUrl
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    logger.info(`Cloudflare tunnel starting${domain ? ` for https://${domain}` : ""}.`);
    child.stdout.on("data", (chunk) => logChunk(chunk, "info"));
    child.stderr.on("data", (chunk) => logChunk(chunk, "warn"));
    child.on("error", (error) => {
      logger.error(`Could not start cloudflared: ${error.message}`);
      child = null;
      stopPromise = null;
    });
    child.on("exit", (code, signal) => {
      const expected = stopping;
      child = null;
      stopPromise = null;
      if (expected) {
        logger.info("Cloudflare tunnel stopped.");
      } else {
        logger.error(`Cloudflare tunnel exited unexpectedly with ${signal || `code ${code}`}.`);
      }
    });
  }

  function stop() {
    if (!child) return Promise.resolve();
    if (stopPromise) return stopPromise;
    stopping = true;
    const target = child;
    stopPromise = new Promise((resolve) => {
      target.once("exit", resolve);
      target.kill("SIGINT");
      setTimeout(() => {
        if (child === target) target.kill("SIGTERM");
      }, 5000).unref();
    });
    return stopPromise;
  }

  return {
    start,
    stop
  };
}
