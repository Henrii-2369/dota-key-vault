import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError, exists, within, assertNoLinks, inventory, fingerprint, verify, copyTree, diffTrees } from './files.mjs';
import { detectSteam, validateSteam, isGameRunning, readNicknames, readAvatar } from './steam.mjs';

const validAccount = id => typeof id === 'string' && /^[1-9]\d{0,9}$/.test(id) && Number(id) <= 4294967295;
const snapshotId = () => new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '') + '_' + randomUUID().slice(0, 8);
const rootKey = root => root.toLowerCase();

export class VaultService {
  constructor({ dataDir, steamRoot, gameProbe = isGameRunning } = {}) {
    this.dataDir = dataDir;
    this.initialRoot = steamRoot;
    this.gameProbe = gameProbe;
    this.busy = false;
    this.settings = { steamPath: null, primaryByRoot: {}, history: [] };
  }

  async init() {
    await assertNoLinks(this.dataDir);
    await fs.mkdir(this.dataDir, { recursive: true });
    const settingsFile = path.join(this.dataDir, 'settings.json');
    if (await exists(settingsFile)) {
      try {
        const saved = JSON.parse(await fs.readFile(settingsFile, 'utf8'));
        this.settings = { ...this.settings, ...saved };
        this.settings.primaryByRoot ??= {};
        this.settings.history ??= [];
      } catch { throw new AppError('本地设置文件损坏。请备份 .local/settings.json 后移走该文件，再重新启动。', 500); }
    }
    const found = await detectSteam(this.initialRoot || this.settings.steamPath);
    this.steamRoot = found.path;
    this.detectionSource = found.source;
    return this;
  }

  async persist() {
    const temp = path.join(this.dataDir, `settings-${randomUUID()}.tmp`);
    await fs.writeFile(temp, JSON.stringify(this.settings, null, 2));
    await fs.rename(temp, path.join(this.dataDir, 'settings.json'));
  }

  async event(type, message, extra = {}) {
    this.settings.history.unshift({ id: randomUUID(), type, message, at: new Date().toISOString(), ...extra });
    this.settings.history = this.settings.history.slice(0, 100);
    // File operations have already succeeded; a history write must not report them as failed.
    try { await this.persist(); } catch (e) { console.error('记录操作历史失败：', e.message); }
  }

  async locked(fn) {
    if (this.busy) throw new AppError('另一个操作正在进行，请稍后重试。', 409);
    this.busy = true;
    try { return await fn(); } finally { this.busy = false; }
  }

  async ensureClosed() {
    if (await this.gameProbe()) throw new AppError('请先正常退出 DOTA2，等待 Steam 云同步完成，再执行文件操作。', 409);
  }

  async accountPath(id, requireDota = true) {
    if (!validAccount(id)) throw new AppError('Steam 账号 ID 不合法。');
    if (!this.steamRoot) throw new AppError('请先设置 Steam 安装目录。');
    await validateSteam(this.steamRoot);
    const account = within(path.join(this.steamRoot, 'userdata'), id);
    await assertNoLinks(account);
    if (!(await exists(account)) || !(await fs.stat(account)).isDirectory()) throw new AppError('未找到此账号文件夹。', 404);
    const result = path.join(account, '570');
    await assertNoLinks(result);
    if (requireDota && !(await exists(result))) throw new AppError('此账号尚未生成 DOTA2 配置，请先启动一次游戏并正常退出。');
    return result;
  }

  get backupRoot() { return this.steamRoot ? path.join(this.steamRoot, 'userdata', '备份') : null; }

  async backupAccountRoot(id) {
    await this.accountPath(id, false);
    const root = within(this.backupRoot, id);
    await assertNoLinks(root);
    return root;
  }

  async snapshotInfo(id, backupId) {
    if (typeof backupId !== 'string' || !/^[\w.-]{1,160}$/.test(backupId) || backupId === '..') throw new AppError('备份编号不合法。');
    const root = within(await this.backupAccountRoot(id), backupId);
    await assertNoLinks(root);
    const manifestFile = path.join(root, 'backup-manifest.json');
    const oldFile = path.join(root, 'file-hashes.json');
    let document;
    if (await exists(manifestFile)) document = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
    else if (await exists(oldFile)) document = { Files: JSON.parse(await fs.readFile(oldFile, 'utf8')) };
    else throw new AppError('此备份缺少校验清单，暂不支持自动还原。');
    const records = document.files ?? document.Files;
    if (!Array.isArray(records) || !records.length) throw new AppError('备份清单没有有效文件。');
    const files = records.map(record => {
      const filePath = record.path ?? record.RelativePath;
      within(path.join(root, '570'), filePath);
      const hash = record.sha256 ?? record.SHA256;
      if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/i.test(hash)) throw new AppError('备份校验码不合法。');
      return { path: filePath.replaceAll('\\', '/'), size: record.size ?? record.Length ?? 0, sha256: hash.toUpperCase() };
    }).sort((a, b) => a.path.localeCompare(b.path, 'en'));
    if (new Set(files.map(f => f.path.toLowerCase())).size !== files.length) throw new AppError('备份清单包含重复文件。');
    const stat = await fs.stat(root);
    const created = document.createdAt ?? document.CreatedAtUtc;
    return {
      id: backupId, accountId: id, root, dataRoot: path.join(root, '570'),
      createdAt: created && !Number.isNaN(Date.parse(created)) ? new Date(created).toISOString() : stat.birthtime.toISOString(),
      note: document.note ?? (backupId.includes('before-restore') ? '还原前自动备份' : backupId.includes('before-migration') ? '迁移前备份' : '历史备份'),
      kind: document.kind ?? 'legacy', fileCount: files.length,
      bytes: document.bytes ?? document.TotalBytes ?? files.reduce((sum, f) => sum + f.size, 0),
      files, directories: document.directories ?? [],
    };
  }

  async listBackups(id) {
    const root = await this.backupAccountRoot(id);
    if (!(await exists(root))) return [];
    const backups = [];
    for (const entry of await fs.readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      try {
        const item = await this.snapshotInfo(id, entry.name);
        backups.push({ id: item.id, accountId: id, createdAt: item.createdAt, note: item.note, kind: item.kind, fileCount: item.fileCount, bytes: item.bytes, available: true });
      } catch {
        backups.push({ id: entry.name, accountId: id, createdAt: (await fs.stat(path.join(root, entry.name))).birthtime.toISOString(), note: '清单不完整，无法自动还原', fileCount: 0, bytes: 0, available: false });
      }
    }
    return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async state() {
    const gameRunning = await this.gameProbe();
    const accounts = [];
    if (this.steamRoot) {
      await validateSteam(this.steamRoot);
      const nicknames = await readNicknames(this.steamRoot);
      for (const entry of await fs.readdir(path.join(this.steamRoot, 'userdata'), { withFileTypes: true })) {
        if (!entry.isDirectory() || !validAccount(entry.name)) continue;
        const root = await this.accountPath(entry.name, false);
        const hasDota = await exists(root);
        let tree = { files: [], bytes: 0 }, scanError = null;
        try {
          if (hasDota) tree = await inventory(root);
        } catch (e) { scanError = e.message; }
        const backups = await this.listBackups(entry.name);
        accounts.push({ id: entry.name, nickname: nicknames.get(entry.name) || null, avatar: await readAvatar(this.steamRoot, entry.name), hasDota, fileCount: tree.files.length, bytes: tree.bytes, scanError, backupCount: backups.length, latestBackup: backups[0]?.createdAt ?? null });
      }
    }
    const primary = this.steamRoot ? this.settings.primaryByRoot[rootKey(this.steamRoot)] : null;
    return {
      version: '1.0.0', steamPath: this.steamRoot, detectionSource: this.detectionSource, backupRoot: this.backupRoot,
      gameRunning, busy: this.busy, mainAccountId: accounts.some(a => a.id === primary) ? primary : null,
      accounts: accounts.sort((a, b) => Number(a.id) - Number(b.id)), history: this.settings.history.slice(0, 20),
    };
  }

  async setSteam(input) {
    return this.locked(async () => {
      const root = await validateSteam(input);
      this.steamRoot = root;
      this.detectionSource = '手动设置';
      this.settings.steamPath = root;
      await this.persist();
      return { message: 'Steam 目录已更新。' };
    });
  }

  async setMain(id) {
    return this.locked(async () => {
      await this.accountPath(id);
      this.settings.primaryByRoot[rootKey(this.steamRoot)] = id;
      this.settings.steamPath = this.steamRoot;
      await this.persist();
      return { message: `已将 ${id} 设为主号。` };
    });
  }

  async createSnapshot(id, note, kind = 'manual') {
    const source = await this.accountPath(id);
    const tree = await inventory(source);
    if (!tree.files.length) throw new AppError('此账号配置为空，无法备份。');
    const backupId = snapshotId();
    const root = within(await this.backupAccountRoot(id), backupId);
    await fs.mkdir(root, { recursive: true });
    try {
      await copyTree(source, path.join(root, '570'), tree);
      await verify(source, tree);
      const manifest = { schemaVersion: 1, accountId: id, createdAt: new Date().toISOString(), note: String(note || '手动备份').slice(0, 120), kind, bytes: tree.bytes, files: tree.files, directories: tree.directories, verified: true };
      await fs.writeFile(path.join(root, 'backup-manifest.json'), JSON.stringify(manifest, null, 2));
      return { id: backupId, accountId: id, root, tree };
    } catch (e) {
      await fs.writeFile(path.join(root, 'incomplete.txt'), '备份未通过校验，请勿用于恢复。\n' + e.message).catch(() => {});
      throw e;
    }
  }

  async backup(id, note) {
    return this.locked(async () => {
      await this.ensureClosed();
      const item = await this.createSnapshot(id, note);
      await this.event('backup', `已备份账号 ${id}`, { accountId: id });
      return { message: `备份完成，${item.tree.files.length} 个文件校验通过。`, backupId: item.id };
    });
  }

  async preview({ kind, sourceId, targetId, accountId, backupId }) {
    let source, target;
    if (kind === 'migrate') {
      if (sourceId === targetId) throw new AppError('源账号与目标账号不能相同。');
      source = await inventory(await this.accountPath(sourceId));
      target = await inventory(await this.accountPath(targetId));
    } else if (kind === 'restore') {
      const snapshot = await this.snapshotInfo(accountId, backupId);
      source = await verify(snapshot.dataRoot, snapshot);
      target = await inventory(await this.accountPath(accountId));
    } else throw new AppError('未知的操作类型。');
    if (!source.files.length) throw new AppError('源配置为空，无法应用。');
    return diffTrees(source, target);
  }

  async removeTemporary(accountRoot, folder) {
    const relative = path.relative(accountRoot, folder);
    if (path.dirname(folder) !== accountRoot || !/^\.dota-key-(?:stage|old)-[a-f0-9-]+$/.test(relative)) throw new AppError('临时目录检查失败。');
    await assertNoLinks(folder);
    if (await exists(folder)) {
      await inventory(folder); // Refuse nested links before removing our own temporary directory.
      await fs.rm(folder, { recursive: true });
    }
  }

  async applySnapshot(sourceRoot, tree, targetId, previousTree) {
    const target = await this.accountPath(targetId);
    const accountRoot = path.dirname(target);
    const nonce = randomUUID();
    const stage = within(accountRoot, `.dota-key-stage-${nonce}`);
    const old = within(accountRoot, `.dota-key-old-${nonce}`);
    let displaced = false, installed = false;
    try {
      await copyTree(sourceRoot, stage, tree);
      await verify(target, previousTree);
      await this.ensureClosed();
      await fs.rename(target, old);
      displaced = true;
      await fs.rename(stage, target);
      installed = true;
      await verify(target, tree);
    } catch (e) {
      if (displaced) {
        try {
          if (installed) await fs.rename(target, within(accountRoot, `.dota-key-failed-${nonce}`));
          await fs.rename(old, target);
        } catch { throw new AppError(`应用失败且自动回退未完成。请退出游戏，从“备份档案”恢复目标账号的自动备份。原目录保留在 ${old}`, 500); }
      }
      throw e;
    } finally {
      // Cleanup only generated temporary copies. Verified backups always remain.
      if (await exists(stage)) await this.removeTemporary(accountRoot, stage).catch(() => {});
    }
    if (await exists(old)) await this.removeTemporary(accountRoot, old).catch(e => console.error('临时副本保留：', e.message));
  }

  async migrate(input) {
    return this.locked(async () => {
      await this.ensureClosed();
      const preview = await this.preview({ ...input, kind: 'migrate' });
      if (!input.fingerprint || preview.fingerprint !== input.fingerprint) throw new AppError('配置已变化，请重新查看差异后再覆盖。', 409);
      const sourceBackup = await this.createSnapshot(input.sourceId, `迁移至 ${input.targetId} 前的源账号备份`, 'migration-source');
      const targetBackup = await this.createSnapshot(input.targetId, `从 ${input.sourceId} 覆盖前自动备份`, 'before-migration');
      const current = diffTrees(sourceBackup.tree, targetBackup.tree);
      if (current.fingerprint !== input.fingerprint) throw new AppError('备份期间配置发生变化，请重新预览。两份备份已保留。', 409);
      await this.applySnapshot(path.join(sourceBackup.root, '570'), sourceBackup.tree, input.targetId, targetBackup.tree);
      await this.event('migrate', `${input.sourceId} → ${input.targetId}，覆盖完成`, { accountId: input.targetId });
      return { message: `已覆盖 ${input.targetId}，${sourceBackup.tree.files.length} 个文件校验通过。两边原配置均已备份。`, targetBackupId: targetBackup.id };
    });
  }

  async restore(input) {
    return this.locked(async () => {
      await this.ensureClosed();
      const preview = await this.preview({ ...input, kind: 'restore' });
      if (!input.fingerprint || preview.fingerprint !== input.fingerprint) throw new AppError('配置已变化，请重新预览后再还原。', 409);
      const snapshot = await this.snapshotInfo(input.accountId, input.backupId);
      const sourceTree = await verify(snapshot.dataRoot, snapshot);
      const rollback = await this.createSnapshot(input.accountId, '还原前自动备份', 'before-restore');
      if (diffTrees(sourceTree, rollback.tree).fingerprint !== input.fingerprint) throw new AppError('配置在备份期间变化，请重新预览。', 409);
      await this.applySnapshot(snapshot.dataRoot, sourceTree, input.accountId, rollback.tree);
      await this.event('restore', `已还原账号 ${input.accountId}`, { accountId: input.accountId });
      return { message: `还原完成，${sourceTree.files.length} 个文件校验通过。还原前配置已自动备份。`, rollbackBackupId: rollback.id };
    });
  }
}
