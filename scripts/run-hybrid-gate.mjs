import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.HYBRID_GATE_PORT || 3199);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('HYBRID_GATE_PORT must be an unprivileged local port.');
}
const scratch = path.join(root, '.wrangler');
await fs.mkdir(scratch, { recursive: true });
const fixture = await fs.mkdtemp(path.join(scratch, 'hybrid-gate-'));
const configuration = JSON.parse(await fs.readFile(
  path.join(root, 'cloudflare/wrangler.jsonc'), 'utf8'
));
const token = crypto.randomBytes(32).toString('base64url');
configuration.main = path.join(root, 'cloudflare/index.js');
configuration.assets.directory = path.join(root, 'dist/public');
delete configuration.routes;
configuration.vars = {
  ...configuration.vars,
  ASSET_VERSION: `gate-${crypto.randomUUID()}`,
  TEST_GAME_CONFIG: JSON.stringify({
    normalRounds: 1, nextRoundDelayMs: 30, objectTimeoutMs: 30000
  })
};
await fs.writeFile(path.join(fixture, 'wrangler.json'),
  JSON.stringify(configuration), { mode: 0o600 });
await fs.writeFile(path.join(fixture, '.dev.vars'),
  `WORKER_TOKEN=${token}\n`, { mode: 0o600 });
const child = spawn(process.execPath, [
  path.join(root, 'node_modules/wrangler/bin/wrangler.js'), 'dev',
  '--config', path.join(fixture, 'wrangler.json'), '--local',
  '--ip', '127.0.0.1', '--port', String(port)
], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let diagnostics = '';
for (const stream of [child.stdout, child.stderr]) {
  stream.on('data', (chunk) => {
    diagnostics = (diagnostics + chunk.toString()).slice(-12000);
  });
}
const baseUrl = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(500)
      });
      const health = response.ok ? await response.json() : null;
      ready = health?.assetVersion === configuration.vars.ASSET_VERSION;
      if (ready) break;
    } catch { /* Wait for the owned development runtime. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error(`Local runtime did not start.\n${diagnostics}`);
  const result = await new Promise((resolve, reject) => {
    const gate = spawn(process.execPath, [
      path.join(root, 'scripts/hybrid-load-50.mjs')
    ], {
      cwd: root, stdio: 'inherit',
      env: { ...process.env, TEST_BASE_URL: baseUrl,
        HYBRID_MOCK_WORKER: '1', WORKER_TOKEN: token },
      timeout: 120000
    });
    gate.once('error', reject);
    gate.once('exit', (code) => resolve(code ?? 1));
  });
  process.exitCode = result;
} finally {
  child.kill('SIGTERM');
  if (child.exitCode === null) {
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 5000))
    ]);
  }
  if (child.exitCode === null) child.kill('SIGKILL');
  await fs.rm(fixture, { recursive: true, force: true });
}
