// Isolated browser acceptance environment. Never reads or writes real Steam data.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VaultService } from '../server/service.mjs';
import { createServer } from '../server/index.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const local = path.join(project, '.local');
await fs.mkdir(local, { recursive: true });
const root = await fs.mkdtemp(path.join(local, 'ui-fixture-'));
const steam = path.join(root, 'Steam');
await fs.mkdir(path.join(steam, 'userdata'), { recursive: true });
await fs.writeFile(path.join(steam, 'steam.exe'), 'TEST FIXTURE — not an executable');
for (const [id, keys] of [['11111', ['Q', 'W', 'E', 'D', 'F', 'R']], ['22222', ['1', '2', '3', '4', '5', '6']]]) {
  const cfg = path.join(steam, 'userdata', id, '570', 'remote', 'cfg');
  await fs.mkdir(cfg, { recursive: true });
  const actions = ['AbilityPrimary1', 'AbilityPrimary2', 'AbilityPrimary3', 'AbilitySecondary1', 'AbilitySecondary2', 'AbilityUltimate'];
  await fs.writeFile(path.join(cfg, 'dotakeys_personal.lst'), `"KeyBindings" { "Name" "CUSTOM" "Keys" { ${actions.map((action, i) => `"${action}" { "Key" "${keys[i]}" }`).join(' ')} } }`);
  await fs.writeFile(path.join(cfg, 'test-settings.txt'), `account ${id}`);
}
const service = await new VaultService({ dataDir: path.join(root, 'app-data'), steamRoot: steam, gameProbe: async () => false }).init();
const server = createServer(service);
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(0, '127.0.0.1', () => console.log(`UI 验收环境：http://127.0.0.1:${server.address().port}；仅使用 .local 下的假账号。`));
