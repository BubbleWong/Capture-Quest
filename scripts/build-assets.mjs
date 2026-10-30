import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public');
const destination = path.join(root, 'dist/public');

async function files(directory, prefix = '') {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const name = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      result.push(...await files(path.join(directory, entry.name), name));
    } else if (entry.isFile()) {
      result.push(name);
    } else {
      throw new Error('Public assets must be ordinary files or directories.');
    }
  }
  return result.sort();
}

const names = await files(source);
const hash = crypto.createHash('sha256');
for (const name of names) {
  hash.update(name).update('\0');
  hash.update(await fs.readFile(path.join(source, name))).update('\0');
}
const version = hash.digest('hex').slice(0, 16);
await fs.rm(destination, { recursive: true, force: true });
await fs.mkdir(destination, { recursive: true });
await fs.cp(source, destination, { recursive: true });
for (const name of names) {
  if (!/\.(?:html|webmanifest|js)$/.test(name)) continue;
  const location = path.join(destination, name);
  const text = await fs.readFile(location, 'utf8');
  await fs.writeFile(location, text.replaceAll('__ASSET_VERSION__', version));
}
console.log(`Built ${names.length} public assets (${version}).`);
await fs.writeFile(path.join(root, 'dist/asset-manifest.json'),
  JSON.stringify({ version, count: names.length }) + '\n');
