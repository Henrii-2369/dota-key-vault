import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export async function exists(file) {
  try { await fs.lstat(file); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}

export function within(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || path.win32.isAbsolute(relative)
    || relative.includes('\0') || relative.includes(':') || relative.split(/[\\/]/).some(p => p === '..' || p === '')) {
    throw new AppError('文件路径不合法。');
  }
  const result = path.resolve(root, ...relative.split(/[\\/]/));
  const rel = path.relative(path.resolve(root), result);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new AppError('文件路径超出允许目录。');
  return result;
}

export async function assertNoLinks(file) {
  const absolute = path.resolve(file);
  const { root } = path.parse(absolute);
  let current = root;
  for (const part of absolute.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      if ((await fs.lstat(current)).isSymbolicLink()) throw new AppError('目录包含链接或联接，已停止操作。');
    } catch (e) { if (e.code === 'ENOENT') break; throw e; }
  }
}

export const digest = data => createHash('sha256').update(data).digest('hex').toUpperCase();

export async function inventory(root) {
  await assertNoLinks(root);
  if (!(await fs.stat(root)).isDirectory()) throw new AppError('配置路径不是文件夹。');
  const files = [], directories = [];
  async function walk(folder) {
    for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      const info = await fs.lstat(file);
      if (info.isSymbolicLink()) throw new AppError('配置包含链接或联接，已停止操作。');
      const relative = path.relative(root, file).split(path.sep).join('/');
      within(root, relative);
      if (info.isDirectory()) { directories.push(relative); await walk(file); }
      else if (info.isFile()) {
        const content = await fs.readFile(file);
        files.push({ path: relative, size: content.length, sha256: digest(content) });
      } else throw new AppError('配置包含不支持的文件类型。');
    }
  }
  await walk(root);
  files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  directories.sort();
  return { files, directories, bytes: files.reduce((sum, f) => sum + f.size, 0) };
}

export function fingerprint(tree) {
  return digest(JSON.stringify(tree.files.map(f => [f.path, f.sha256])));
}

export async function verify(root, expected) {
  const actual = await inventory(root);
  if (fingerprint(actual) !== fingerprint(expected)) throw new AppError('文件校验不一致，已停止操作。请保留备份并重新扫描。', 409);
  return actual;
}

export async function copyTree(source, target, tree) {
  await assertNoLinks(source);
  await assertNoLinks(target);
  await fs.mkdir(target, { recursive: true });
  for (const directory of tree.directories ?? []) await fs.mkdir(within(target, directory), { recursive: true });
  for (const file of tree.files) {
    const from = within(source, file.path), to = within(target, file.path);
    await assertNoLinks(from);
    await assertNoLinks(to);
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.copyFile(from, to);
  }
  await verify(target, tree);
}

export function diffTrees(source, target) {
  const before = new Map(target.files.map(f => [f.path, f.sha256]));
  const after = new Map(source.files.map(f => [f.path, f.sha256]));
  const changes = [];
  for (const file of source.files) {
    if (!before.has(file.path)) changes.push({ path: file.path, kind: 'added' });
    else if (before.get(file.path) !== file.sha256) changes.push({ path: file.path, kind: 'changed' });
  }
  for (const file of target.files) if (!after.has(file.path)) changes.push({ path: file.path, kind: 'removed' });
  return {
    added: changes.filter(f => f.kind === 'added').length,
    changed: changes.filter(f => f.kind === 'changed').length,
    removed: changes.filter(f => f.kind === 'removed').length,
    unchanged: source.files.length - changes.filter(f => f.kind !== 'removed').length,
    sourceFiles: source.files.length, targetFiles: target.files.length, bytes: source.bytes, changes,
    fingerprint: digest(fingerprint(source) + ':' + fingerprint(target)),
  };
}

export function parseVdf(text) {
  const tokens = text.match(/\/\/[^\r\n]*|"(?:\\.|[^"\\])*"|[{}]|[^\s{}"]+/g) ?? [];
  let cursor = 0;
  const clean = token => token.startsWith('"') ? token.slice(1, -1).replace(/\\(["\\])/g, '$1') : token;
  function object(depth = 0) {
    if (depth > 64) throw new AppError('配置嵌套过深。');
    const result = {};
    while (cursor < tokens.length) {
      const key = tokens[cursor++];
      if (key.startsWith('//')) continue;
      if (key === '}') return result;
      if (key === '{') continue;
      let value = tokens[cursor++];
      while (value?.startsWith('//')) value = tokens[cursor++];
      if (!value) break;
      const name = clean(key);
      if (['__proto__', 'constructor', 'prototype'].includes(name)) continue;
      result[name] = value === '{' ? object(depth + 1) : clean(value);
    }
    return result;
  }
  return object();
}

