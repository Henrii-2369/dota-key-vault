import http from 'node:http';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { execFile } from 'node:child_process';
import { VaultService } from './service.mjs';
import { AppError } from './files.mjs';
import { pickSteamFolder } from './folder-picker.mjs';
import { buildId } from './build.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(projectRoot, 'public');
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/boot.js', ['boot.js', 'text/javascript; charset=utf-8']],
  ['/i18n.js', ['i18n.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/mark.svg', ['mark.svg', 'image/svg+xml']],
]);

async function body(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 32768) throw new AppError('请求内容过大。', 413);
  }
  try { return JSON.parse(text || '{}'); } catch { throw new AppError('请求格式不正确。'); }
}

export function createServer(service, { folderPicker = pickSteamFolder } = {}) {
  const token = randomBytes(32).toString('hex');
  return http.createServer(async (req, res) => {
    if (process.env.DOTA_VAULT_DEBUG_HTTP === '1') {
      const started = Date.now();
      res.once('finish', () => console.log(`[HTTP] ${req.method} ${req.url} -> ${res.statusCode} ${Date.now() - started}ms origin=${req.headers.origin || '-'} site=${req.headers['sec-fetch-site'] || '-'} dest=${req.headers['sec-fetch-dest'] || '-'}`));
    }
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const host = req.headers.host;
      const allowedHosts = [`127.0.0.1:${res.socket.localPort}`, `localhost:${res.socket.localPort}`];
      if (!allowedHosts.includes(host)) throw new AppError('只允许从本机地址访问。', 403);
      const allowedOrigins = allowedHosts.map(h => `http://${h}`);
      // Some browser environments normalize loopback Origin by dropping the port.
      // Accept that exact normalization only when browser-controlled Fetch Metadata
      // confirms same-origin. Cross-port same-site requests still fail, and writes
      // continue to require the session token and JSON content type.
      const normalizedOrigin = `http://${new URL(`http://${host}`).hostname}`;
      const normalizedSameOrigin = req.headers.origin === normalizedOrigin && req.headers['sec-fetch-site'] === 'same-origin';
      if (req.headers.origin && !allowedOrigins.includes(req.headers.origin) && !normalizedSameOrigin) throw new AppError('不允许跨站请求。', 403);
      const url = new URL(req.url, `http://${host}`);
      if (req.method === 'GET' && assets.has(url.pathname)) {
        const [name, type] = assets.get(url.pathname);
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
        res.end(await fs.readFile(path.join(publicRoot, name)));
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/health') return send(200, { app: 'dota-key-vault', version: '1.0.0', buildId });
      if (req.method === 'GET' && url.pathname === '/api/state') return send(200, { ...await service.state(), token });
      if (req.method === 'GET' && url.pathname.startsWith('/api/backups/')) return send(200, { backups: await service.listBackups(decodeURIComponent(url.pathname.slice('/api/backups/'.length))) });
      if (req.method !== 'POST') throw new AppError('找不到此页面。', 404);
      const supplied = Buffer.from(String(req.headers['x-vault-token'] || ''));
      const expected = Buffer.from(token);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new AppError('会话已失效，请刷新页面后重试。', 403);
      if (!String(req.headers['content-type']).startsWith('application/json')) throw new AppError('请使用 JSON 请求。', 415);
      const input = await body(req);
      let result;
      switch (url.pathname) {
        case '/api/choose-steam-path': {
          const selected = await folderPicker(service.steamRoot || '');
          result = selected ? await service.setSteam(selected) : { cancelled: true };
          break;
        }
        case '/api/steam-path': result = await service.setSteam(input.path); break;
        case '/api/main-account': result = await service.setMain(input.accountId); break;
        case '/api/backup': result = await service.backup(input.accountId, input.note); break;
        case '/api/preview': result = await service.preview(input); break;
        case '/api/migrate': result = await service.migrate(input); break;
        case '/api/restore': result = await service.restore(input); break;
        default: throw new AppError('找不到此接口。', 404);
      }
      send(200, result);
    } catch (error) {
      const status = error.status ?? (error.code === 'EACCES' || error.code === 'EPERM' ? 403 : 500);
      const message = error.status ? error.message : status === 403 ? '目录写入权限不足。请检查文件占用或使用有权限的 Windows 账号运行。' : `操作未完成：${error.message}`;
      if (!res.headersSent) send(status, { error: message }); else res.end();
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 5700);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必须是有效端口。');
  const service = await new VaultService({ dataDir: path.join(projectRoot, '.local'), steamRoot: process.env.STEAM_PATH }).init();
  const server = createServer(service);
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被其他程序占用。请设置其他 PORT 后重试。` : error.code === 'EACCES' ? `系统拒绝监听端口 ${port}。请检查端口保留或系统权限，或设置其他 PORT 后重试。` : error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`\n  DOTA KEY VAULT\n  本地地址：http://127.0.0.1:${port}\n  Steam：${service.steamRoot || '等待手动设置'}\n  按 Ctrl+C 停止服务。\n`);
    if (process.platform === 'win32' && process.argv.includes('--open')) {
      execFile('rundll32.exe', ['url.dll,FileProtocolHandler', `http://127.0.0.1:${port}`], { windowsHide: true }, error => {
        if (error) console.log('请在浏览器中手动打开上方本地地址。');
      });
    }
  });
}
