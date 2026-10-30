import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const status = execFileSync('git', ['status', '--porcelain'], {
  cwd: root, encoding: 'utf8'
});
if (status.trim()) throw new Error('Commit the reviewed source before deployment.');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root, encoding: 'utf8'
}).trim();
execFileSync(process.execPath, [path.join(root, 'scripts/build-assets.mjs')], {
  cwd: root, stdio: 'inherit'
});
const { version } = JSON.parse(fs.readFileSync(
  path.join(root, 'dist/asset-manifest.json'), 'utf8'
));
const result = spawnSync(process.execPath, [
  path.join(root, 'node_modules/wrangler/bin/wrangler.js'), 'deploy',
  '--config', path.join(root, 'cloudflare/wrangler.jsonc'),
  '--var', `ASSET_VERSION:${version}`,
  '--var', `DEPLOYMENT_SHA:${revision}`
], { cwd: root, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
