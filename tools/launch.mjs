import * as fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { buildId } from '../server/build.mjs';
import { fileURLToPath } from 'node:url';
import { spawn, execFile } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, '.local');
fs.mkdirSync(dataDir, { recursive: true });
const logFile = path.join(dataDir, 'launcher.log');
function log(text, error = false) {
  const line = text.endsWith('\n') ? text : text + '\n';
  (error ? process.stderr : process.stdout).write(line);
  fs.appendFileSync(logFile, line, 'utf8');
}

function health(url) {
  return new Promise(resolve => {
    const request = http.get(url + '/api/health', response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { text += chunk; if (text.length > 4096) request.destroy(); });
      response.on('end', () => {
        try { const info = JSON.parse(text); resolve(response.statusCode === 200 && info.app === 'dota-key-vault' ? info : null); }
        catch { resolve(false); }
      });
      response.on('error', () => resolve(false));
    });
    request.setTimeout(1500, () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

function openBrowser(url) {
  log(`打开工具：${url}`);
  if (process.env.DOTA_VAULT_NO_OPEN === '1') return;
  if (process.platform === 'win32') {
    execFile('rundll32.exe', ['url.dll,FileProtocolHandler', url], { windowsHide: true }, error => {
      if (error) log(`浏览器未能自动打开。请手动访问 ${url}\n${error.message}`, true);
    });
  } else log('请在浏览器中打开上方地址。');
}

async function main() {
  log(`\n[${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}] 启动 DOTA Key Vault`);
  log(`Node ${process.versions.node} · ${process.execPath}`);
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('需要 Node.js 22 或更新版本。请更新 Node.js 后重试。');
  let port = Number(process.env.PORT || 5700);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必须为有效端口。');
  let url;
  const firstPort = port;
  for (; port <= Math.min(firstPort + 20, 65535); port++) {
    url = `http://127.0.0.1:${port}`;
    const existing = await health(url);
    if (existing?.buildId === buildId) {
      log('当前版本工具已在运行，直接打开现有页面。');
      openBrowser(url);
      return;
    }
    const available = await new Promise(resolve => {
      const probe = net.createServer();
      probe.once('error', () => resolve(false));
      probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
    });
    if (available) break;
    log(`端口 ${port} 有旧版本或其他服务，尝试新端口。`);
  }
  if (port > Math.min(firstPort + 20, 65535)) throw new Error('没有可用端口，请关闭旧启动窗口后重试。');
  log('正在启动本地服务，请保持此窗口运行。');
  const child = spawn(process.execPath, [path.join(root, 'server', 'index.mjs')], {
    cwd: root, env: { ...process.env, PORT: String(port) }, windowsHide: true, stdio: ['inherit', 'pipe', 'pipe'],
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  let opened = false, interrupted = false, output = '';
  child.stdout.on('data', text => {
    log(text);
    output = (output + text).slice(-8192);
    if (!opened && output.includes(`本地地址：${url}`)) { opened = true; openBrowser(url); }
  });
  child.stderr.on('data', text => log(text, true));
  const stop = () => { interrupted = true; child.kill(); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(interrupted || signal === 'SIGINT' ? 0 : code ?? 1));
  });
  if (code !== 0) throw new Error(`本地服务未能启动或意外退出（退出码 ${code}）。请查看上方信息及 ${logFile}`);
}

main().catch(error => {
  log(error.message, true);
  process.exitCode = 1;
});
