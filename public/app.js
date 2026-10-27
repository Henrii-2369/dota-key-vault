(async function () {
const { t, getLanguage, setLanguage, systemText, backupLabel, historyLabel } = window.vaultI18n;
const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const ui = { state: null, route: location.hash.slice(1) || 'overview', search: '', sourceId: '', targetId: '', backupAccount: '', backups: [], backupsLoading: false, busy: false, pending: null };
const routes = () => ({ overview: t("配置总览"), accounts: t("账号管理"), backups: t("备份档案"), guide: t("使用指南") });
const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
  archive: '<rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v13h14V8m-10 4h6"/>',
  book: '<path d="M4 3h6a3 3 0 0 1 3 3v15a4 4 0 0 0-4-2H3V3Zm9 3a3 3 0 0 1 3-3h5v16h-4a4 4 0 0 0-4 2"/>',
  search: '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.2 6a8 8 0 0 1 13 2M4.8 16a8 8 0 0 0 13 2"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  folder: '<path d="M3 7V4h6l3 3h9v13H3Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v13h5"/>',
  restore: '<path d="M3 5v6h6"/><path d="M4 10a8 8 0 1 1 1 8"/>',
  warning: '<path d="m12 3 10 18H2Z"/><path d="M12 9v5m0 3v1"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bytes = value => value >= 1048576 ? `${(value / 1048576).toFixed(1)} MB` : `${Math.max(0, value / 1024).toFixed(1)} KB`;
const date = value => value ? new Intl.DateTimeFormat(getLanguage(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : t("暂无备份");
const disabled = condition => condition ? 'disabled' : '';
const account = id => ui.state?.accounts.find(a => a.id === id);
const ready = () => ui.state.accounts.filter(a => a.hasDota && !a.scanError && a.fileCount > 0);
const writable = () => !ui.busy && !ui.state.busy && !ui.state.gameRunning;

async function api(url, payload) {
  const controller = new AbortController();
  // File writes may take longer than a read; timing out a write does not cancel it on the server.
  const timeout = setTimeout(() => controller.abort(), url === '/api/choose-steam-path' ? 310000 : payload === undefined ? 12000 : 120000);
  try {
    const response = await fetch(url, {
      signal: controller.signal, cache: 'no-store',
      ...(payload === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vault-Token': ui.state?.token || '' }, body: JSON.stringify(payload) }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || t("本地服务未完成操作。"));
    return result;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(payload === undefined ? t("本地配置库响应超时。请确认启动窗口仍在运行，再重新连接。") : t("等待操作结果超时，服务端可能仍在处理。请重新扫描确认结果，勿连续重复操作。"));
    throw error;
  } finally { clearTimeout(timeout); }
}

function toast(message, error = false) {
  const item = document.createElement('div');
  item.className = `toast ${error ? 'error' : ''}`;
  item.innerHTML = `${icon(error ? 'warning' : 'check')}<span>${e(systemText(message))}</span>`;
  document.querySelector('#toasts').append(item);
  setTimeout(() => { item.classList.add('out'); setTimeout(() => item.remove(), 220); }, error ? 8500 : 5500);
}

function options(selected = '', exclude = '', placeholder = t("选择账号")) {
  return `<option value="">${placeholder}</option>${ready().filter(a => a.id !== exclude).map(a => `<option value="${a.id}" ${a.id === selected ? 'selected' : ''}>${e(a.nickname ? `${a.nickname} · ${a.id}` : a.id)}${a.id === ui.state.mainAccountId ? t(" · 主号") : ''}</option>`).join('')}`;
}

function sidebar() {
  const state = ui.state;
  return `${t("<aside class=\"sidebar\">\n    <a href=\"#overview\" class=\"brand\"><img src=\"/mark.svg\" alt=\"\"><div><span>DOTA</span><strong>KEY VAULT</strong></div><small>本地版</small></a>\n    <label class=\"search\">")}${icon('search')}<input id="search" type="search" value="${e(ui.search)}${t("\" placeholder=\"搜索昵称或 ID\" aria-label=\"搜索昵称或 ID\"><kbd>/</kbd></label>\n    <div class=\"nav-label\">配置管理</div>\n    <nav>")}${Object.entries(routes()).map(([route, label]) => `<a href="#${route}" class="nav-item ${ui.route === route ? 'active' : ''}" ${ui.route === route ? 'aria-current="page"' : ''}>${icon({ overview: 'grid', accounts: 'users', backups: 'archive', guide: 'book' }[route])}<span>${label}</span>${route === 'accounts' ? `<small>${state.accounts.length}</small>` : ''}</a>`).join('')}</nav>
    <div class="sidebar-note">${icon('shield')}${t("<div>你的配置，保存在本机<span>无需登录 · 无需控制台</span></div></div>\n    <div class=\"steam-panel\"><div><span class=\"status-dot ")}${state.steamPath ? 'green' : ''}"></span><strong>${state.steamPath ? t("STEAM 已连接") : t("等待连接 STEAM")}</strong></div><p title="${e(state.steamPath)}">${e(state.steamPath || t("未找到安装目录"))}</p><button class="text-button" data-action="path">${icon('folder')}${t("设置安装目录</button></div>\n    <div class=\"sidebar-footer\">DOTA KEY VAULT <span>v")}${e(state.version)}</span></div>
  </aside>`;
}

function primaryPanel() {
  const primary = account(ui.state.mainAccountId);
  return `<section class="primary-panel panel">
    <div class="primary-top"><div class="eyebrow">${icon('star')}${t("主号配置</div><span class=\"subtle\">仅在你操作时应用配置</span></div>\n    <div class=\"primary-content\"><div class=\"sigil ")}${primary?.avatar ? 'has-avatar' : ''}"><img src="${e(primary?.avatar || '/mark.svg')}" alt="${primary?.avatar ? e((primary.nickname || primary.id) + t(" 的头像")) : t("DOTA2 标记")}" data-avatar></div>
      <div class="primary-identity"><span class="muted">${primary ? t("当前主号 · STEAM ACCOUNT ID") : t("将常用账号设为配置来源")}</span><h2>${primary ? e(primary.nickname || primary.id) : t("尚未指定主号")}</h2><p>${primary ? `ID ${primary.id} · ${primary.fileCount}${t(" 个配置文件 · ")}${bytes(primary.bytes)}` : t("选定主号，之后便能快速同步到其他账号。")}${t("</p><div class=\"primary-picker\"><label class=\"sr-only\" for=\"main-select\">选择主号</label><select id=\"main-select\" ")}${disabled(ui.busy)}>${options(primary?.id, '', t("选择常用账号"))}</select><button class="button small" data-action="set-main" ${disabled(ui.busy || !ready().length)}>${icon('star')}${t("设为主号</button></div></div>\n    </div>\n  </section>")}`;
}

function transferPanel() {
  return `<section class="transfer panel"><div class="section-heading"><div><h2>${icon('refresh')}${t("跨账号同步</h2><p>将源账号的完整 DOTA2 配置应用到另一个账号。</p></div><span class=\"tag\">自动备份目标配置</span></div>\n    <div class=\"transfer-flow\"><label class=\"field\"><span>配置来源</span><select id=\"source-select\" ")}${disabled(ui.busy)}>${options(ui.sourceId, '', t("选择源账号"))}</select><small>${ui.sourceId === ui.state.mainAccountId && ui.sourceId ? t("当前主号") : t("源账号文件保持不变")}</small></label><div class="flow-arrow">${icon('arrow')}${t("</div><label class=\"field\"><span>应用到</span><select id=\"target-select\" ")}${disabled(ui.busy)}>${options(ui.targetId, ui.sourceId, t("选择目标账号"))}${t("</select><small>覆盖前可查看文件变化</small></label><button class=\"button primary transfer-button\" data-action=\"preview-migration\" ")}${disabled(!writable() || !ui.sourceId || !ui.targetId)}>${icon('arrow')}${t("预览并同步</button></div>\n    <div class=\"panel-footnote\">")}${icon('shield')}${t("范围为完整 570 文件夹，包含键位、画面与其他游戏偏好。")}${ui.state.gameRunning ? t("<strong>请先退出 DOTA2 并等待云同步完成。</strong>") : t("应用完成后，进入目标账号验证。")}</div>
  </section>`;
}

function accountCard(item, index) {
  const isMain = item.id === ui.state.mainAccountId;
  const available = item.hasDota && !item.scanError && item.fileCount > 0;
  return `<article class="account-card ${isMain ? 'is-main' : ''}">
    <div class="account-card-top"><span class="account-sequence">ACCOUNT ${String(index + 1).padStart(2, '0')}</span><button class="star-button ${isMain ? 'chosen' : ''}" data-action="main-direct" data-id="${item.id}" aria-label="${isMain ? t("当前主号") : t("将 ") + item.id + t(" 设为主号")}" title="${isMain ? t("当前主号") : t("设为主号")}" ${disabled(!available || ui.busy || isMain)}>${icon('star')}</button></div>
    <div class="account-name"><h3 title="${e(item.nickname || item.id)}">${e(item.nickname || item.id)}</h3>${isMain ? t("<span class=\"main-badge\">主号</span>") : ''}<button class="copy-button" data-action="copy" data-id="${item.id}${t("\" title=\"复制账号 ID\" aria-label=\"复制账号 ")}${item.id}">${icon('copy')}</button></div>
    <div class="account-id">STEAM ID · ${item.id}</div>
    <div class="account-state"><span class="status-dot ${available ? 'green' : 'amber'}"></span>${item.scanError ? t("读取异常") : available ? t("配置已就绪") : t("尚未初始化 DOTA2")}</div>
    ${item.scanError ? `<p class="account-error">${e(item.scanError)}</p>` : ''}${t("\n    <div class=\"account-data\"><div><span>配置文件</span><strong>")}${item.fileCount}${t("<small> 个</small></strong></div><div><span>已存备份</span><strong>")}${item.backupCount}${t("<small> 份</small></strong></div><div><span>配置大小</span><strong class=\"size\">")}${bytes(item.bytes)}</strong></div></div>
    <div class="last-backup">${icon('clock')}<span>${item.latestBackup ? t("最近备份 ") + date(item.latestBackup) : t("还没有备份，先保存一份吧")}</span></div>
    <div class="account-actions"><button class="button small" data-action="backup" data-id="${item.id}" ${disabled(!writable() || !available)}>${icon('archive')}${t("备份配置</button><button class=\"text-button\" data-action=\"view-backups\" data-id=\"")}${item.id}${t("\">备份 / 还原 ")}${icon('arrow')}</button></div>
  </article>`;
}

function accountGrid(full = false) {
  const filtered = ui.state.accounts.filter(a => `${a.id} ${a.nickname || ''}`.toLowerCase().includes(ui.search.trim().toLowerCase()));
  return `<section class="accounts-section"><div class="section-heading"><div><h2>${full ? t("本机账号") : t("账号配置")} <span class="count">${filtered.length}${t("</span></h2><p>每个账号单独保存，随时找回熟悉的设置。</p></div>")}${!full ? t("<a class=\"text-button\" href=\"#accounts\">全部账号 ") + icon('arrow') + '</a>' : t("<span class=\"subtle\">仅扫描数字 ID 文件夹</span>")}</div><div class="accounts-grid">${filtered.length ? filtered.map(accountCard).join('') : `<div class="empty wide">${icon('users')}<h3>${ui.search ? t("没有匹配的账号") : t("还没有找到账号配置")}</h3><p>${ui.search ? t("试试其他昵称或账号 ID。") : t("在 Steam 中登录账号，启动一次 DOTA2 并正常退出后，点击重新扫描。")}</p></div>`}</div></section>`;
}

function historyPanel() {
  return `<section class="activity panel"><div class="section-heading"><h2>${icon('clock')}${t("最近操作</h2><span class=\"subtle\">仅记录本工具内的操作</span></div>")}${ui.state.history.length ? ui.state.history.slice(0, 5).map(event => `<div class="activity-row"><span class="activity-icon">${icon({ backup: 'archive', migrate: 'refresh', restore: 'restore' }[event.type] || 'check')}</span><span>${e(historyLabel(event))}</span><time>${date(event.at)}${t("</time><span class=\"activity-done\">完成</span></div>")}`).join('') : t("<div class=\"activity-empty\">尚无操作记录。先为你的常用账号创建一份备份。</div>")}</section>`;
}

function backupsView() {
  const filtered = ui.backups.filter(b => `${b.accountId} ${backupLabel(b)} ${b.id}`.toLowerCase().includes(ui.search.trim().toLowerCase()));
  return `<section class="panel backup-panel"><div class="section-heading"><div><h2>${icon('archive')}${t("按账号管理备份</h2><p>还原前会自动保存当前配置，已有备份不会被覆盖。</p></div><label><span class=\"sr-only\">筛选备份账号</span><select id=\"backup-account\"><option value=\"\">全部账号</option>")}${ui.state.accounts.map(a => `<option value="${a.id}" ${ui.backupAccount === a.id ? 'selected' : ''}>${a.id}${a.id === ui.state.mainAccountId ? t(" · 主号") : ''}</option>`).join('')}</select></label></div>
    ${ui.backupsLoading ? t("<div class=\"loading-row\"><span class=\"spinner\"></span>正在读取备份档案…</div>") : filtered.length ? `${t("<div class=\"backup-table\"><div class=\"backup-table-head\"><span>备份方案</span><span>文件 / 大小</span><span>操作</span></div>")}${filtered.map(b => `<article class="backup-row"><div class="backup-description"><span class="backup-glyph">${icon(b.kind === 'before-restore' ? 'restore' : 'archive')}</span><div><h3>${e(backupLabel(b))}</h3><p><strong>${b.accountId}</strong><span>·</span>${date(b.createdAt)}</p><small>${e(b.id)}</small></div></div><div class="backup-size">${b.fileCount}${t(" 个文件<span>")}${bytes(b.bytes)}</span></div><button class="button small" data-action="restore" data-id="${b.accountId}" data-backup="${e(b.id)}" ${disabled(!writable() || !b.available)}>${icon('restore')}${t("还原</button></article>")}`).join('')}</div>` : `<div class="empty">${icon('archive')}<h3>${ui.search ? t("没有匹配的备份") : t("这里还没有备份")}${t("</h3><p>在账号卡片中点击“备份配置”，第一份档案就会出现在这里。</p><a class=\"button\" href=\"#accounts\">前往账号管理 ")}${icon('arrow')}</a></div>`}
    <div class="storage-location">${icon('folder')}${t("<span>备份位置 <code>")}${e(ui.state.backupRoot || t("请先连接 Steam"))}</code></span></div>
  </section>`;
}

function guideView() {
  return `${t("<section class=\"guide-intro panel\"><div class=\"eyebrow\">开始使用</div><h2>保存习惯，只需要几步。</h2><p>先退出 DOTA2，等待 Steam 显示云同步完成。所有操作都只处理本机的游戏配置。</p></section><div class=\"guide-grid\">")}${[
    ['01', t("确认 Steam 目录"), t("工具会从 Windows 注册表自动识别安装目录。如果识别有误，点击左下角“设置安装目录”，在弹出的窗口中选择包含 steam.exe 与 userdata 的文件夹。")],
    ['02', t("指定你的主号"), t("在配置总览或账号卡片上选择主号。主号会成为跨账号同步的默认来源；它不会在切换 Steam 账号时自动覆盖任何文件。")],
    ['03', t("保存一份备份"), t("在账号卡片上点击“备份配置”。每次备份都有独立文件夹和 SHA256 校验清单，也可以在备份档案中找到之前手工创建的备份。")],
    ['04', t("同步或还原"), t("选择源账号和目标账号，查看变化后点击“备份并覆盖”。要找回旧配置，在备份档案中选择还原。完成后进入游戏检查，再重启一次确认。")],
  ].map(([number, title, text]) => `<article class="guide-card"><span>${number}</span><h3>${title}</h3><p>${text}</p></article>`).join('')}</div><section class="panel scope-panel"><h2>${icon('shield')}${t("这次会迁移哪些内容？</h2><p>完整复制账号的 <code>570</code> 文件夹，与实机验证采用相同范围：键位、英雄专属配置、施法偏好，以及画面设置、其他游戏配置和 Steam Cloud 缓存元数据。</p><p>还原会让目标文件夹与备份保持一致；目标独有文件也会在自动备份中保留。其他 Steam 游戏与账号登录文件不在操作范围内。</p><p>文件校验通过代表本地文件已正确写入。Steam 云同步可能影响启动后的结果，请在目标账号中确认实际设置。</p></section>")}`;
}

function renderContent() {
  const main = document.querySelector('#content');
  if (!main) return;
  if (!ui.state.steamPath) {
    main.innerHTML = `<div class="connection-empty panel empty">${icon('folder')}${t("<h2>连接你的 Steam 配置库</h2><p>没有识别到 Steam 安装目录。设置目录后，工具会自动查找本机账号。</p><button class=\"button primary\" data-action=\"path\">设置 Steam 目录 ")}${icon('arrow')}</button></div>`;
    return;
  }
  const count = ui.state.accounts.reduce((sum, a) => sum + a.backupCount, 0);
  main.innerHTML = ui.route === 'accounts' ? accountGrid(true) : ui.route === 'backups' ? backupsView() : ui.route === 'guide' ? guideView() : `${t("<div class=\"overview-intro\"><div><div class=\"eyebrow\">YOUR SETTINGS. EVERY ACCOUNT.</div><h2>配置一次，随账号切换。</h2><p>备份、还原与迁移，让每个账号都保持熟悉的手感。</p></div><div class=\"overview-counts\"><div><strong>")}${ui.state.accounts.length.toString().padStart(2, '0')}${t("</strong><span>本机账号</span></div><div><strong>")}${count.toString().padStart(2, '0')}${t("</strong><span>备份档案</span></div></div></div>")}${primaryPanel()}${transferPanel()}${accountGrid()}${historyPanel()}`;
}

function render() {
  const focused = document.activeElement?.id;
  const selection = focused === 'search' ? document.activeElement.selectionStart : null;
  const state = ui.state;
  app.innerHTML = `<div class="app-shell">${sidebar()}${t("<main class=\"main\"><header class=\"topbar\"><div class=\"breadcrumbs\">本地配置库 <span>/</span> ")}${routes()[ui.route]}</div><div class="topbar-actions"><label class="language-picker"><span class="sr-only">Language / 语言</span><select id="language-select" aria-label="Language / 语言" ${disabled(ui.busy || dialog.open)}><option value="zh-CN" ${getLanguage() === 'zh-CN' ? 'selected' : ''}>简体中文</option><option value="en" ${getLanguage() === 'en' ? 'selected' : ''}>English</option></select></label><span class="game-status ${state.gameRunning ? 'running' : ''}"><span class="status-dot ${state.gameRunning ? 'amber' : 'green'}"></span>${state.gameRunning ? t("DOTA2 正在运行") : t("DOTA2 已退出")}${t("</span><button class=\"icon-button\" data-action=\"refresh\" title=\"重新扫描配置\" aria-label=\"重新扫描配置\" ")}${disabled(ui.busy)}>${icon('refresh', ui.busy ? 'spinning' : '')}</button></div></header><div class="workspace"><div class="page-heading"><h1>${icon({ overview: 'grid', accounts: 'users', backups: 'archive', guide: 'book' }[ui.route])}${routes()[ui.route]}</h1><span class="local-label">${icon('shield')}${t("仅本机访问</span></div>")}${state.gameRunning ? '<div class="game-banner">' + icon('warning') + t("<span>DOTA2 正在运行。退出游戏并等待 Steam 云同步完成后，即可备份、还原和同步配置。</span></div>") : ''}${t("<div id=\"content\" class=\"content\"></div><footer class=\"main-footer\"><span>配置保存在本机，不会上传到云端服务。</span><span>")}${e(systemText(state.detectionSource))}</span></footer></div></main></div>${ui.busy ? t("<div class=\"operation-bar\" role=\"status\"><span class=\"spinner\"></span>正在处理，请保持服务运行…</div>") : ''}`;
  renderContent();
  if (focused === 'search') { const input = document.querySelector('#search'); input?.focus(); if (selection !== null) input?.setSelectionRange(selection, selection); }
}

let backupRequest = 0;
async function loadBackups() {
  const request = ++backupRequest;
  ui.backupsLoading = true;
  renderContent();
  try {
    const ids = ui.backupAccount ? [ui.backupAccount] : ui.state.accounts.map(a => a.id);
    const results = await Promise.all(ids.map(id => api(`/api/backups/${id}`)));
    if (request !== backupRequest) return;
    ui.backups = results.flatMap(r => r.backups).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) { if (request === backupRequest) toast(error.message, true); }
  finally { if (request === backupRequest) { ui.backupsLoading = false; renderContent(); } }
}

async function refresh() {
  const oldMain = ui.state?.mainAccountId;
  ui.state = await api('/api/state');
  if (!account(ui.sourceId) || (ui.state.mainAccountId && oldMain !== ui.state.mainAccountId)) ui.sourceId = ui.state.mainAccountId || ready()[0]?.id || '';
  if (ui.sourceId === ui.targetId || !account(ui.targetId)) ui.targetId = '';
  if (!routes()[ui.route]) ui.route = 'overview';
  render();
  if (ui.route === 'backups') await loadBackups();
}

function openDialog(html) {
  dialog.innerHTML = html;
  dialog.classList.remove('leaving');
  if (!dialog.open) dialog.showModal();
}

function closeDialog() {
  if (ui.busy) return;
  dialog.classList.add('leaving');
  setTimeout(() => { dialog.close(); dialog.innerHTML = ''; ui.pending = null; }, 130);
}

async function pathDialog() {
  ui.busy = true;
  render();
  openDialog(`${t("<h2 id=\"dialog-title\">选择 Steam 安装目录</h2><p class=\"modal-description\">请在弹出的文件夹窗口中选择包含 <code>steam.exe</code> 和 <code>userdata</code> 的 Steam 文件夹。确认后自动扫描；取消则保留当前设置。</p><div class=\"loading-row\"><span class=\"spinner\"></span>等待文件夹选择结果…</div>")}`);
  try {
    const result = await api('/api/choose-steam-path', {});
    if (!result.cancelled) { await refresh(); toast(result.message); }
  } catch (error) { toast(error.message, true); }
  finally { ui.busy = false; dialog.close(); dialog.innerHTML = ''; render(); }
}

async function previewDialog(input) {
  ui.busy = true;
  render();
  try {
    const result = await api('/api/preview', input);
    ui.pending = { input, fingerprint: result.fingerprint };
    const isRestore = input.kind === 'restore';
    const source = isRestore ? t("所选备份") : input.sourceId;
    const target = isRestore ? input.accountId : input.targetId;
    openDialog(`<div class="modal-header"><span class="modal-icon amber">${icon(isRestore ? 'restore' : 'refresh')}${t("</span><button class=\"icon-button\" data-action=\"close-dialog\" aria-label=\"关闭\">")}${icon('close')}</button></div><h2 id="dialog-title">${isRestore ? t("还原账号配置") : t("覆盖目标账号配置")}${t("</h2><p class=\"modal-description\">操作前会自动备份")}${isRestore ? t("当前配置") : t("源账号和目标账号")}${t("。已有备份保持保留。</p><div class=\"confirm-flow\"><div><small>")}${isRestore ? t("还原来源") : t("配置来源")}</small><strong>${e(source)}</strong></div>${icon('arrow')}${t("<div><small>目标账号</small><strong>")}${e(target)}</strong></div></div><div class="diff-summary"><span><b class="green-text">+${result.added}${t("</b>新增</span><span><b class=\"blue-text\">")}${result.changed}${t("</b>修改</span><span><b class=\"amber-text\">−")}${result.removed}${t("</b>移出目标</span><span><b>")}${result.unchanged}${t("</b>相同</span></div><div class=\"diff-files\">")}${result.changes.length ? result.changes.slice(0, 80).map(f => `<div><span class="change-kind ${f.kind}">${{ added: t("新增"), changed: t("修改"), removed: t("移出") }[f.kind]}</span><code>${e(f.path)}</code></div>`).join('') : t("<div class=\"no-difference\">文件内容相同，仍可创建备份后应用。</div>")}</div><div class="modal-note">${icon('shield')}${t("<span>完整 ")}${result.sourceFiles}${t(" 个文件，")}${bytes(result.bytes)}${t("。包含键位、画面与其他游戏配置。目标独有文件会保留在自动备份中。</span></div><div class=\"modal-actions\"><button class=\"button\" data-action=\"close-dialog\">取消</button><button class=\"button primary\" data-action=\"confirm-operation\">")}${icon('shield')}${isRestore ? t("备份并还原") : t("备份并覆盖")}</button></div>`);
  } catch (error) { toast(error.message, true); }
  finally { ui.busy = false; render(); }
}

async function mutate(url, payload) {
  if (ui.busy) return;
  ui.busy = true;
  render();
  const dialogButtons = [...dialog.querySelectorAll('button, input')];
  dialogButtons.forEach(b => { b.disabled = true; });
  try {
    const result = await api(url, payload);
    dialog.close(); dialog.innerHTML = ''; ui.pending = null;
    toast(result.message);
    await refresh();
  } catch (error) { toast(error.message, true); }
  finally { ui.busy = false; dialogButtons.forEach(b => { b.disabled = false; }); render(); }
}

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (ui.busy && action !== 'copy') return;
  try {
    if (action === 'path') await pathDialog();
    if (action === 'close-dialog') closeDialog();
    if (action === 'refresh') { ui.busy = true; render(); await refresh(); ui.busy = false; render(); toast(t("账号与备份已重新扫描。")); }
    if (action === 'copy') { await navigator.clipboard.writeText(button.dataset.id); toast(t("账号 ID 已复制。")); }
    if (action === 'set-main' || action === 'main-direct') {
      const id = action === 'main-direct' ? button.dataset.id : document.querySelector('#main-select').value;
      if (!id) return toast(t("请先选择一个主号。"), true);
      await mutate('/api/main-account', { accountId: id });
    }
    if (action === 'backup') await mutate('/api/backup', { accountId: button.dataset.id });
    if (action === 'view-backups') { ui.backupAccount = button.dataset.id; if (ui.route === 'backups') await loadBackups(); else location.hash = 'backups'; }
    if (action === 'preview-migration') await previewDialog({ kind: 'migrate', sourceId: ui.sourceId, targetId: ui.targetId });
    if (action === 'restore') await previewDialog({ kind: 'restore', accountId: button.dataset.id, backupId: button.dataset.backup });
    if (action === 'confirm-operation' && ui.pending) {
      const payload = { ...ui.pending.input, fingerprint: ui.pending.fingerprint };
      await mutate(payload.kind === 'restore' ? '/api/restore' : '/api/migrate', payload);
    }
  } catch (error) { ui.busy = false; render(); toast(error.message, true); }
});

document.addEventListener('error', event => {
  const image = event.target;
  if (image instanceof HTMLImageElement && image.hasAttribute('data-avatar') && image.getAttribute('src') !== '/mark.svg') {
    image.src = '/mark.svg';
    image.alt = t("DOTA2 标记");
    image.parentElement.classList.remove('has-avatar');
  }
}, true);

document.addEventListener('input', event => {
  if (event.target.id === 'search') { ui.search = event.target.value; renderContent(); }
});
document.addEventListener('change', async event => {
  if (event.target.id === 'language-select') { setLanguage(event.target.value); render(); return; }
  if (event.target.id === 'source-select') { ui.sourceId = event.target.value; if (ui.targetId === ui.sourceId) ui.targetId = ''; renderContent(); }
  if (event.target.id === 'target-select') { ui.targetId = event.target.value; renderContent(); }
  if (event.target.id === 'backup-account') { ui.backupAccount = event.target.value; await loadBackups(); }
});
dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
dialog.addEventListener('click', event => { if (event.target === dialog && !ui.busy) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(); } });
window.addEventListener('hashchange', () => { ui.route = routes()[location.hash.slice(1)] ? location.hash.slice(1) : 'overview'; if (ui.state) { render(); if (ui.route === 'backups') loadBackups(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
document.addEventListener('keydown', event => { if (event.key === '/' && !dialog.open && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) { event.preventDefault(); document.querySelector('#search')?.focus(); } });

try { await refresh(); document.documentElement.dataset.vaultReady = 'true'; }
catch (error) {
  document.documentElement.dataset.vaultReady = 'true';
  app.innerHTML = `<div class="boot boot-error">${icon('warning')}${t("<h1>无法连接本地配置库</h1><p>")}${e(systemText(error.message))}${t("</p><p>请确认启动窗口仍在运行，然后刷新本页。</p><button class=\"button\" data-action=\"reload\">重新连接</button></div>")}`;
  document.querySelector('[data-action="reload"]')?.addEventListener('click', () => location.reload());
}
setInterval(async () => {
  if (!ui.state || ui.busy || dialog.open || document.hidden || document.activeElement?.tagName === 'SELECT' || document.activeElement?.tagName === 'INPUT') return;
  try {
    const next = await api('/api/state');
    if (JSON.stringify(next) !== JSON.stringify(ui.state)) { ui.state = next; render(); if (ui.route === 'backups') await loadBackups(); }
  } catch { /* Manual refresh surfaces connection errors without repeated toasts. */ }
}, 15000);
}());
