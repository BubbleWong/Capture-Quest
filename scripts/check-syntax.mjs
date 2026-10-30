import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function check(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) await check(location);
    else if (/\.(?:mjs|js)$/.test(entry.name)) {
      const result = spawnSync(process.execPath, ['--check', location], {
        stdio: 'inherit'
      });
      if (result.status !== 0) process.exit(result.status || 1);
    }
  }
}
for (const name of ['server', 'cloudflare', 'public', 'scripts']) {
  await check(path.join(root, name));
}
console.log('JavaScript syntax checks passed.');
