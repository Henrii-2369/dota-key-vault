import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = createHash('sha256');
for (const folder of ['server', 'public']) {
  for (const name of readdirSync(path.join(root, folder)).sort()) {
    hash.update(`${folder}/${name}`);
    hash.update(readFileSync(path.join(root, folder, name)));
  }
}
// Include the installation path to keep separate portable copies independent.
hash.update(root.toLowerCase());
export const buildId = hash.digest('hex');
