import * as fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AppError, exists, assertNoLinks, parseVdf } from './files.mjs';

// Only expose display names; loginusers.vdf can also contain private login metadata.
export async function readNicknames(root) {
  const names = new Map();
  try {
    const file = path.join(root, 'config', 'loginusers.vdf');
    await assertNoLinks(file);
    if ((await fs.stat(file)).size > 4 * 1024 * 1024) return names;
    const data = parseVdf(await fs.readFile(file, 'utf8'));
    for (const [steamId, profile] of Object.entries(data.users || {})) {
      if (!/^\d{17}$/.test(steamId)) continue;
      const id = BigInt(steamId) - 76561197960265728n;
      if (id < 1n || id > 4294967295n || typeof profile.PersonaName !== 'string') continue;
      const name = profile.PersonaName.trim().slice(0, 128);
      if (name) names.set(String(id), name);
    }
  } catch { /* Missing, unreadable or malformed name cache must not block backups. */ }
  return names;
}

const run = promisify(execFile);

export async function readAvatar(root, accountId) {
  if (!/^[1-9]\d{0,9}$/.test(accountId) || BigInt(accountId) > 4294967295n) return null;
  const steamId = String(76561197960265728n + BigInt(accountId));
  try {
    const file = path.join(root, 'config', 'avatarcache', `${steamId}.png`);
    await assertNoLinks(file);
    const info = await fs.stat(file);
    if (!info.isFile() || info.size > 2 * 1024 * 1024) return null;
    const content = await fs.readFile(file);
    if (!content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return null;
    return `data:image/png;base64,${content.toString('base64')}`;
  } catch { return null; }
}

export async function validateSteam(input) {
  if (typeof input !== 'string' || !input.trim() || input.length > 1024) throw new AppError('请输入 Steam 安装目录。');
  const root = path.resolve(input.trim().replace(/^"|"$/g, ''));
  if (root.startsWith('\\\\')) throw new AppError('请选择本机 Steam 安装目录。');
  await assertNoLinks(root);
  if (!(await exists(path.join(root, 'steam.exe'))) || !(await exists(path.join(root, 'userdata')))) {
    throw new AppError('此目录不是 Steam 安装目录，需要同时包含 steam.exe 和 userdata。');
  }
  await assertNoLinks(path.join(root, 'userdata'));
  if (!(await fs.stat(path.join(root, 'userdata'))).isDirectory()) throw new AppError('userdata 不是文件夹。');
  return root;
}

export async function detectSteam(preferred) {
  const candidates = [];
  if (preferred) candidates.push({ path: preferred, source: '已保存的目录' });
  if (process.env.STEAM_PATH) candidates.push({ path: process.env.STEAM_PATH, source: '环境变量' });
  if (process.platform === 'win32') {
    const queries = [
      ['HKCU\\Software\\Valve\\Steam', 'SteamPath'],
      ['HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'],
      ['HKLM\\SOFTWARE\\Valve\\Steam', 'InstallPath'],
    ];
    const results = await Promise.allSettled(queries.map(async ([key, value]) => {
      const { stdout } = await run('reg.exe', ['query', key, '/v', value], { windowsHide: true, timeout: 5000 });
      const match = stdout.match(/REG_(?:EXPAND_)?SZ\s+([^\r\n]+)/);
      return match?.[1]?.trim();
    }));
    for (const result of results) if (result.status === 'fulfilled' && result.value) candidates.push({ path: result.value, source: 'Windows 注册表' });
  }
  for (const root of ['C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam', 'D:\\steam', 'E:\\Steam']) candidates.push({ path: root, source: '常见安装位置' });
  for (const candidate of candidates) {
    try { return { path: await validateSteam(candidate.path), source: candidate.source }; } catch { /* Try the next candidate. */ }
  }
  return { path: null, source: '未找到 Steam，请手动选择目录' };
}

export async function isGameRunning() {
  if (process.platform !== 'win32') return false;
  try {
    const { stdout } = await run('tasklist.exe', ['/FI', 'IMAGENAME eq dota2.exe', '/FO', 'CSV', '/NH'], { windowsHide: true, timeout: 5000 });
    return /"dota2\.exe"/i.test(stdout);
  } catch { throw new AppError('无法确认 DOTA2 是否已退出。请检查系统进程权限后重试。', 503); }
}
