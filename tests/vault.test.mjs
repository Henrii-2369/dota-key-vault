import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { VaultService } from '../server/service.mjs';
import { createServer } from '../server/index.mjs';
import { inventory, fingerprint, within, parseVdf } from '../server/files.mjs';
import { readAvatar } from '../server/steam.mjs';

async function fixture(t, gameProbe = async () => false) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dota-vault-test-'));
  t.after(async () => {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved).toLowerCase(), path.resolve(os.tmpdir()).toLowerCase());
    assert.ok(path.basename(resolved).startsWith('dota-vault-test-'));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  const steam = path.join(root, 'Steam');
  await fs.mkdir(path.join(steam, 'userdata'), { recursive: true });
  await fs.writeFile(path.join(steam, 'steam.exe'), 'fixture only');
  const dota = id => path.join(steam, 'userdata', id, '570');
  for (const id of ['11111', '22222']) {
    await fs.mkdir(path.join(dota(id), 'remote', 'cfg'), { recursive: true });
    await fs.mkdir(path.join(dota(id), 'local', 'cfg'), { recursive: true });
    await fs.writeFile(path.join(dota(id), 'remote', 'cfg', 'dotakeys_personal.lst'), `"KeyBindings" { "Name" "ARROW" "Keys" { "AbilityPrimary1" { "Key" "${id === '11111' ? 'Q' : 'P'}" } } }`);
    await fs.writeFile(path.join(dota(id), 'local', 'cfg', 'user_keys.vcfg'), `account=${id}`);
  }
  await fs.mkdir(path.join(steam, 'userdata', 'not-an-account'));
  await fs.mkdir(path.join(steam, 'userdata', '33333'));
  const service = await new VaultService({ dataDir: path.join(root, 'app-data'), steamRoot: steam, gameProbe }).init();
  return { root, steam, dota, service };
}

test('scans numeric IDs and persists the main account per Steam root', async t => {
  const { service, steam, root } = await fixture(t);
  const initial = await service.state();
  assert.deepEqual(initial.accounts.map(a => a.id), ['11111', '22222', '33333']);
  assert.equal(initial.accounts[0].nickname, null);
  assert.equal(initial.accounts[2].hasDota, false);
  await service.setMain('11111');
  const restarted = await new VaultService({ dataDir: path.join(root, 'app-data'), steamRoot: steam, gameProbe: async () => false }).init();
  assert.equal((await restarted.state()).mainAccountId, '11111');
  await assert.rejects(() => service.setMain('33333'), /尚未生成/);
});

test('loads only cached persona names and tolerates missing or invalid caches', async t => {
  const { service, steam } = await fixture(t);
  await fs.mkdir(path.join(steam, 'config'));
  const file = path.join(steam, 'config', 'loginusers.vdf');
  const steamId = String(76561197960265728n + 11111n);
  await fs.writeFile(file, `"users" { "${steamId}" { "PersonaName" "中文 <昵称>" "AccountName" "private-login" } "invalid" { "PersonaName" "ignored" } }`);
  const state = await service.state();
  assert.equal(state.accounts[0].nickname, '中文 <昵称>');
  assert.equal(state.accounts[1].nickname, null);
  assert.ok(!JSON.stringify(state).includes('private-login'));
  assert.ok(!('preview' in state.accounts[0]));
  await fs.writeFile(file, 'invalid');
  assert.equal((await service.state()).accounts[0].nickname, null);
});

test('reads account-matched local avatar cache and tolerates missing or corrupt files', async t => {
  const { steam, service } = await fixture(t);
  const cache = path.join(steam, 'config', 'avatarcache');
  await fs.mkdir(cache, { recursive: true });
  const file = path.join(cache, `${76561197960265728n + 11111n}.png`);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX2kAAAAASUVORK5CYII=', 'base64');
  await fs.writeFile(file, png);
  assert.equal(await readAvatar(steam, '11111'), `data:image/png;base64,${png.toString('base64')}`);
  assert.equal((await service.state()).accounts[0].avatar, await readAvatar(steam, '11111'));
  assert.equal(await readAvatar(steam, '22222'), null);
  assert.equal(await readAvatar(steam, '../11111'), null);
  await fs.writeFile(file, '<svg>invalid</svg>');
  assert.equal(await readAvatar(steam, '11111'), null);
  await fs.writeFile(file, Buffer.alloc(2 * 1024 * 1024 + 1));
  assert.equal(await readAvatar(steam, '11111'), null);
});

test('backups are immutable snapshots, each is separate, and restore removes later files with a rollback snapshot', async t => {
  const { service, dota } = await fixture(t);
  const original = await inventory(dota('11111'));
  const first = await service.backup('11111', '我的方案');
  const second = await service.backup('11111');
  assert.notEqual(first.backupId, second.backupId);
  await fs.writeFile(path.join(dota('11111'), 'extra.txt'), 'keep this in rollback');
  await fs.writeFile(path.join(dota('11111'), 'local', 'cfg', 'user_keys.vcfg'), 'changed');
  const changed = await inventory(dota('11111'));
  const input = { kind: 'restore', accountId: '11111', backupId: first.backupId };
  const preview = await service.preview(input);
  assert.equal(preview.removed, 1);
  const restored = await service.restore({ ...input, fingerprint: preview.fingerprint });
  assert.equal(fingerprint(await inventory(dota('11111'))), fingerprint(original));
  const rollback = await service.snapshotInfo('11111', restored.rollbackBackupId);
  assert.equal(fingerprint(await inventory(rollback.dataRoot)), fingerprint(changed));
});

test('migration backs up both accounts, exactly replaces only the target, and supports undo', async t => {
  const { service, dota } = await fixture(t);
  await fs.writeFile(path.join(dota('22222'), 'target-only.txt'), 'target original');
  const sourceBefore = await inventory(dota('11111'));
  const targetBefore = await inventory(dota('22222'));
  const input = { kind: 'migrate', sourceId: '11111', targetId: '22222' };
  const preview = await service.preview(input);
  assert.equal(preview.removed, 1);
  const result = await service.migrate({ ...input, fingerprint: preview.fingerprint });
  assert.equal(fingerprint(await inventory(dota('11111'))), fingerprint(sourceBefore));
  assert.equal(fingerprint(await inventory(dota('22222'))), fingerprint(sourceBefore));
  assert.equal((await service.listBackups('11111')).length, 1);
  const undo = { kind: 'restore', accountId: '22222', backupId: result.targetBackupId };
  const undoPreview = await service.preview(undo);
  await service.restore({ ...undo, fingerprint: undoPreview.fingerprint });
  assert.equal(fingerprint(await inventory(dota('22222'))), fingerprint(targetBefore));
});

test('game running, same-account migration, and stale previews never overwrite settings', async t => {
  let running = false;
  const { service, dota } = await fixture(t, async () => running);
  const before = await inventory(dota('22222'));
  running = true;
  await assert.rejects(() => service.backup('11111'), /退出 DOTA2/);
  running = false;
  await assert.rejects(() => service.preview({ kind: 'migrate', sourceId: '11111', targetId: '11111' }), /不能相同/);
  const input = { kind: 'migrate', sourceId: '11111', targetId: '22222' };
  const preview = await service.preview(input);
  await fs.writeFile(path.join(dota('11111'), 'changed-after-preview.txt'), 'new');
  await assert.rejects(() => service.migrate({ ...input, fingerprint: preview.fingerprint }), /配置已变化/);
  assert.equal(fingerprint(await inventory(dota('22222'))), fingerprint(before));
});

test('rejects modified backup content and traversal inside legacy manifests', async t => {
  const { service, dota, steam } = await fixture(t);
  const saved = await service.backup('11111');
  const snapshot = await service.snapshotInfo('11111', saved.backupId);
  await fs.writeFile(path.join(snapshot.dataRoot, 'local', 'cfg', 'user_keys.vcfg'), 'tampered');
  const targetBefore = fingerprint(await inventory(dota('11111')));
  await assert.rejects(() => service.preview({ kind: 'restore', accountId: '11111', backupId: saved.backupId }), /校验不一致/);
  assert.equal(fingerprint(await inventory(dota('11111'))), targetBefore);
  const malicious = path.join(steam, 'userdata', '备份', '11111', 'malicious');
  await fs.mkdir(malicious);
  await fs.writeFile(path.join(malicious, 'backup-manifest.json'), JSON.stringify({ Files: [{ RelativePath: '../../escape', SHA256: 'A'.repeat(64) }] }));
  await assert.rejects(() => service.snapshotInfo('11111', 'malicious'), /不合法/);
  await assert.rejects(() => service.accountPath('../11111'), /不合法/);
  assert.throws(() => within(dota('11111'), 'C:\\escape'), /不合法/);
});

test('imports the existing PowerShell backup format without changing it', async t => {
  const { service, steam, dota } = await fixture(t);
  const tree = await inventory(dota('11111'));
  const legacyRoot = path.join(steam, 'userdata', '备份', '11111', '20261027-003941-129-before-migration');
  await fs.mkdir(legacyRoot, { recursive: true });
  await fs.cp(dota('11111'), path.join(legacyRoot, '570'), { recursive: true });
  await fs.writeFile(path.join(legacyRoot, 'backup-manifest.json'), JSON.stringify({ Account: '11111', FileCount: tree.files.length, TotalBytes: tree.bytes, Files: tree.files.map(f => ({ RelativePath: f.path.replaceAll('/', '\\'), SHA256: f.sha256, Length: f.size })) }));
  const backups = await service.listBackups('11111');
  assert.equal(backups[0].available, true);
  assert.equal(backups[0].fileCount, tree.files.length);
  const preview = await service.preview({ kind: 'restore', accountId: '11111', backupId: backups[0].id });
  assert.equal(preview.changed, 0);
});

test('rejects directory junctions rather than following them into other folders', async t => {
  const { root, dota, service } = await fixture(t);
  const external = path.join(root, 'unrelated');
  await fs.mkdir(external);
  await fs.writeFile(path.join(external, 'untouched.txt'), 'untouched');
  await fs.symlink(external, path.join(dota('11111'), 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(() => service.backup('11111'), /链接或联接/);
  assert.equal(await fs.readFile(path.join(external, 'untouched.txt'), 'utf8'), 'untouched');
});

test('rejects concurrent mutations while an operation is waiting for process detection', async t => {
  const { service } = await fixture(t);
  let release;
  service.gameProbe = () => new Promise(resolve => { release = resolve; });
  const pending = service.backup('11111');
  await assert.rejects(() => service.setMain('22222'), /另一个操作/);
  release(false);
  await pending;
});

test('HTTP serves the app and protects mutation endpoints against foreign origins and missing tokens', async t => {
  const { service } = await fixture(t);
  const server = createServer(service);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const health = await (await fetch(origin + '/api/health')).json();
  assert.equal(health.app, 'dota-key-vault');
  const index = await fetch(origin);
  assert.equal(index.status, 200);
  assert.match(await index.text(), /DOTA Key Vault/);
  const state = await (await fetch(origin + '/api/state')).json();
  const normalizedHeaders = { Origin: 'http://127.0.0.1', 'Sec-Fetch-Site': 'same-origin' };
  const normalizedScript = await fetch(origin + '/app.js', { headers: normalizedHeaders });
  assert.equal(normalizedScript.status, 200);
  const normalizedStyle = await fetch(origin + '/style.css', { headers: normalizedHeaders });
  assert.equal(normalizedStyle.status, 200);
  const missingMetadata = await fetch(origin + '/api/state', { headers: { Origin: 'http://127.0.0.1' } });
  assert.equal(missingMetadata.status, 403);
  const crossPort = await fetch(origin + '/api/state', { headers: { Origin: 'http://127.0.0.1:12345', 'Sec-Fetch-Site': 'same-site' } });
  assert.equal(crossPort.status, 403);
  const unauthorized = await fetch(origin + '/api/main-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: '11111' }) });
  assert.equal(unauthorized.status, 403);
  const foreign = await fetch(origin + '/api/main-account', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vault-Token': state.token, Origin: 'https://example.com' }, body: JSON.stringify({ accountId: '11111' }) });
  assert.equal(foreign.status, 403);
  const valid = await fetch(origin + '/api/main-account', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vault-Token': state.token, Origin: origin }, body: JSON.stringify({ accountId: '11111' }) });
  assert.equal(valid.status, 200);
  assert.equal((await service.state()).mainAccountId, '11111');
  const normalizedWrite = await fetch(origin + '/api/main-account', { method: 'POST', headers: { ...normalizedHeaders, 'Content-Type': 'application/json', 'X-Vault-Token': state.token }, body: JSON.stringify({ accountId: '22222' }) });
  assert.equal(normalizedWrite.status, 200);
  const untrustedWrite = await fetch(origin + '/api/main-account', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vault-Token': state.token, Origin: 'http://127.0.0.1', 'Sec-Fetch-Site': 'same-site' }, body: JSON.stringify({ accountId: '11111' }) });
  assert.equal(untrustedWrite.status, 403);
  assert.equal((await fetch(origin + '/api/no-such-file')).status, 404);
});

test('folder selection requires authorization, preserves cancellation, and validates selection', async t => {
  const { service, steam } = await fixture(t);
  let selected = null, calls = 0;
  const server = createServer(service, { folderPicker: async () => { calls++; return selected; } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const state = await (await fetch(origin + '/api/state')).json();
  const choose = token => fetch(origin + '/api/choose-steam-path', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vault-Token': token }, body: '{}' });
  assert.equal((await choose('invalid')).status, 403);
  assert.equal(calls, 0);
  assert.equal((await (await choose(state.token)).json()).cancelled, true);
  assert.equal(service.steamRoot, steam);
  selected = path.join(steam, 'userdata');
  assert.equal((await choose(state.token)).status, 400);
  assert.equal(service.steamRoot, steam);
  selected = steam;
  assert.equal((await choose(state.token)).status, 200);
});

test('parses Valve key-value comments and escaped strings', () => {
  const parsed = parseVdf('// comment\n"root" { "name" "hello\\"world" "path" "D:\\\\steam" "nested" { "Key" "Q" } }');
  assert.equal(parsed.root.name, 'hello"world');
  assert.equal(parsed.root.path, 'D:\\steam');
  assert.equal(parsed.root.nested.Key, 'Q');
});
