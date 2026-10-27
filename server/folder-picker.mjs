import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AppError } from './files.mjs';

const run = promisify(execFile);
let picking = false;

export async function pickSteamFolder(initialPath = '') {
  if (process.platform !== 'win32') throw new AppError('文件夹选择窗口仅支持 Windows。', 400);
  if (picking) throw new AppError('文件夹选择窗口已经打开，请先完成选择。', 409);
  picking = true;
  const initial = Buffer.from(initialPath, 'utf8').toString('base64');
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Application]::EnableVisualStyles()
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.Text = 'DOTA Key Vault'
$owner.Width = 1
$owner.Height = 1
$owner.StartPosition = 'CenterScreen'
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Select Steam folder (contains steam.exe and userdata)'
$dialog.ShowNewFolderButton = $false
$dialog.SelectedPath = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${initial}'))
try {
  $owner.Show()
  $owner.Activate()
  [System.Windows.Forms.Application]::DoEvents()
  if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::Write([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($dialog.SelectedPath)))
  }
} finally { $dialog.Dispose(); $owner.Dispose() }
`;
  try {
    const { stdout } = await run('powershell.exe', ['-NoProfile', '-STA', '-WindowStyle', 'Hidden', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 300000, maxBuffer: 65536 });
    return stdout.trim() ? Buffer.from(stdout.trim(), 'base64').toString('utf8') : null;
  } catch (error) {
    console.error('[Folder picker]', error.stderr || error.message);
    throw new AppError(error.killed ? '文件夹选择已超时，请重新选择。' : '无法打开系统文件夹选择窗口，请检查 Windows PowerShell 是否可用。', 503);
  } finally { picking = false; }
}
