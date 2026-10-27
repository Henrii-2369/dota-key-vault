(function () {
  'use strict';
  // Translate application-owned strings only. Never translate account nicknames,
  // filesystem paths, custom backup notes, IDs, or configuration contents.
  const en = {
    '配置总览': 'Overview', '账号管理': 'Accounts', '备份档案': 'Backups', '使用指南': 'Guide',
    '暂无备份': 'No backups yet', '选择账号': 'Select account', '主号': 'Main',
    '本地版': 'LOCAL', '搜索昵称或 ID': 'Search nickname or ID', '配置管理': 'CONFIGURATION',
    '你的配置，保存在本机': 'Your settings stay on this PC', '无需登录 · 无需控制台': 'No sign-in · No console commands',
    'STEAM 已连接': 'STEAM CONNECTED', '等待连接 STEAM': 'STEAM NOT CONNECTED',
    '未找到安装目录': 'Installation folder not found', '设置安装目录': 'Choose Steam folder',
    '主号配置': 'Main account', '仅在你操作时应用配置': 'Applied only when you choose',
    ' 的头像': ' avatar', 'DOTA2 标记': 'DOTA2 logo',
    '当前主号 · STEAM ACCOUNT ID': 'MAIN ACCOUNT · STEAM ACCOUNT ID',
    '将常用账号设为配置来源': 'Use your regular account as the source', '尚未指定主号': 'No main account selected',
    ' 个配置文件 · ': ' config files · ', '选定主号，之后便能快速同步到其他账号。': 'Choose a main account to sync its settings to other accounts.',
    '选择常用账号': 'Choose main account', '选择主号': 'Choose main account', '设为主号': 'Set as main',
    '跨账号同步': 'Sync accounts', '将源账号的完整 DOTA2 配置应用到另一个账号。': 'Apply the source account’s complete DOTA2 settings to another account.',
    '自动备份目标配置': 'Target backed up automatically', '配置来源': 'Source', '选择源账号': 'Select source account',
    '当前主号': 'Main account', '源账号文件保持不变': 'Source files stay unchanged', '应用到': 'Apply to',
    '选择目标账号': 'Select target account', '覆盖前可查看文件变化': 'Review file changes before applying',
    '预览并同步': 'Preview & sync', '范围为完整 570 文件夹，包含键位、画面与其他游戏偏好。': 'Scope: the entire 570 folder, including hotkeys, video and other preferences. ',
    '请先退出 DOTA2 并等待云同步完成。': 'Exit DOTA2 and wait for Steam Cloud to finish syncing.',
    '应用完成后，进入目标账号验证。': 'Verify the result in-game on the target account.',
    '将 ': 'Set ', ' 设为主号': ' as main', '读取异常': 'Read error', '配置已就绪': 'Settings ready',
    '尚未初始化 DOTA2': 'DOTA2 not initialized', '复制账号 ID': 'Copy account ID', '复制账号 ': 'Copy account ',
    '配置文件': 'Config files', '已存备份': 'Backups', '配置大小': 'Total size',
    '<small> 个</small>': '<small> files</small>', '<small> 份</small>': '<small> saved</small>',
    '最近备份 ': 'Last backup: ', '还没有备份，先保存一份吧': 'No backup yet. Save your first snapshot.',
    '备份配置': 'Back up', '备份 / 还原': 'Backups / restore', '本机账号': 'Local accounts', '账号配置': 'Account settings',
    '全部账号': 'All accounts', '仅扫描数字 ID 文件夹': 'Scanning numeric account folders only',
    '每个账号单独保存，随时找回熟悉的设置。': 'Keep separate snapshots for each account and restore your familiar settings.',
    '没有匹配的账号': 'No matching accounts', '还没有找到账号配置': 'No account settings found',
    '试试其他昵称或账号 ID。': 'Try another nickname or account ID.',
    '在 Steam 中登录账号，启动一次 DOTA2 并正常退出后，点击重新扫描。': 'Sign in to Steam, launch DOTA2 once, exit normally, then rescan.',
    '最近操作': 'Recent activity', '仅记录本工具内的操作': 'Actions performed in this tool only', '完成': 'Done',
    '尚无操作记录。先为你的常用账号创建一份备份。': 'No activity yet. Start by backing up your regular account.',
    '按账号管理备份': 'Backups by account', '还原前会自动保存当前配置，已有备份不会被覆盖。': 'Current settings are backed up before restoring. Existing backups are kept.',
    '筛选备份账号': 'Filter by account', '正在读取备份档案…': 'Loading backups…', '备份方案': 'Snapshot',
    '文件 / 大小': 'Files / size', '操作': 'Actions', ' 个文件': ' files', '还原': 'Restore',
    '没有匹配的备份': 'No matching backups', '这里还没有备份': 'No backups yet',
    '在账号卡片中点击“备份配置”，第一份档案就会出现在这里。': 'Click “Back up” on an account card to create your first snapshot.',
    '前往账号管理': 'Go to accounts', '备份位置 ': 'Backup location ', '请先连接 Steam': 'Connect Steam first',
    '开始使用': 'GETTING STARTED', '保存习惯，只需要几步。': 'Keep your settings in a few steps.',
    '先退出 DOTA2，等待 Steam 显示云同步完成。所有操作都只处理本机的游戏配置。': 'Exit DOTA2 and wait for Steam Cloud to finish syncing. All operations use local game settings.',
    '确认 Steam 目录': 'Check the Steam folder',
    '工具会从 Windows 注册表自动识别安装目录。如果识别有误，点击左下角“设置安装目录”，在弹出的窗口中选择包含 steam.exe 与 userdata 的文件夹。': 'The tool detects Steam through the Windows registry. If needed, click “Choose Steam folder” at the bottom left and select the folder containing steam.exe and userdata.',
    '指定你的主号': 'Choose your main account',
    '在配置总览或账号卡片上选择主号。主号会成为跨账号同步的默认来源；它不会在切换 Steam 账号时自动覆盖任何文件。': 'Choose a main account in Overview or on an account card. It becomes the default sync source. Switching Steam accounts does not apply settings automatically.',
    '保存一份备份': 'Save a backup',
    '在账号卡片上点击“备份配置”。每次备份都有独立文件夹和 SHA256 校验清单，也可以在备份档案中找到之前手工创建的备份。': 'Click “Back up” on an account card. Each snapshot has its own folder and SHA256 manifest. Supported older backups also appear in Backups.',
    '同步或还原': 'Sync or restore',
    '选择源账号和目标账号，查看变化后点击“备份并覆盖”。要找回旧配置，在备份档案中选择还原。完成后进入游戏检查，再重启一次确认。': 'Select the source and target, review changes, then click “Back up & apply”. To recover older settings, restore a snapshot in Backups. Verify in-game and restart once to confirm.',
    '这次会迁移哪些内容？': 'What will be copied?', '完整复制账号的 ': 'Copies the entire account ',
    ' 文件夹，与实机验证采用相同范围：键位、英雄专属配置、施法偏好，以及画面设置、其他游戏配置和 Steam Cloud 缓存元数据。': ' folder: hotkeys, per-hero settings, casting preferences, video settings, other game preferences, and Steam Cloud cache metadata. This matches the scope tested in-game.',
    '还原会让目标文件夹与备份保持一致；目标独有文件也会在自动备份中保留。其他 Steam 游戏与账号登录文件不在操作范围内。': 'Restoring makes the target folder match the snapshot. Target-only files are preserved in the automatic backup. Other Steam games and sign-in files are outside the scope.',
    '文件校验通过代表本地文件已正确写入。Steam 云同步可能影响启动后的结果，请在目标账号中确认实际设置。': 'Verification confirms the local files were written correctly. Steam Cloud may affect settings at launch; check the result on the target account.',
    '连接你的 Steam 配置库': 'Connect your Steam settings',
    '没有识别到 Steam 安装目录。设置目录后，工具会自动查找本机账号。': 'Steam was not detected. Choose its installation folder to scan local accounts.',
    '设置 Steam 目录': 'Choose Steam folder', '配置一次，随账号切换。': 'Your settings. Every account.',
    '备份、还原与迁移，让每个账号都保持熟悉的手感。': 'Back up, restore and sync your familiar settings across accounts.',
    '本地配置库': 'Local vault', 'DOTA2 正在运行': 'DOTA2 is running', 'DOTA2 已退出': 'DOTA2 is closed',
    '重新扫描配置': 'Rescan settings', '仅本机访问': 'Local access only',
    'DOTA2 正在运行。退出游戏并等待 Steam 云同步完成后，即可备份、还原和同步配置。': 'DOTA2 is running. Exit the game and wait for Steam Cloud to finish syncing before backing up, restoring or syncing settings.',
    '配置保存在本机，不会上传到云端服务。': 'Settings stay on this PC and are not uploaded to a cloud service.',
    '正在处理，请保持服务运行…': 'Working… Keep the service running.',
    '选择 Steam 安装目录': 'Choose the Steam folder',
    '请在弹出的文件夹窗口中选择包含 ': 'In the folder picker, select the Steam folder containing ',
    ' 和 ': ' and ', ' 的 Steam 文件夹。确认后自动扫描；取消则保留当前设置。': '. Confirm to scan automatically, or cancel to keep the current folder.',
    '等待文件夹选择结果…': 'Waiting for your folder selection…',
    '所选备份': 'Selected snapshot', '还原账号配置': 'Restore account settings', '覆盖目标账号配置': 'Replace target settings',
    '当前配置': 'current settings', '源账号和目标账号': 'both source and target settings', '还原来源': 'Restore from', '目标账号': 'Target account',
    '操作前会自动备份': 'Before applying, the tool will back up ', '。已有备份保持保留。': '. Existing backups will be kept.',
    '新增': 'Added', '修改': 'Changed', '移出目标': 'Removed from target', '移出': 'Removed', '相同': 'Unchanged',
    '文件内容相同，仍可创建备份后应用。': 'The files already match. You can still back up and apply this snapshot.',
    '完整 ': 'Total: ', ' 个文件，': ' files, ',
    '。包含键位、画面与其他游戏配置。目标独有文件会保留在自动备份中。': '. Includes hotkeys, video and other settings. Target-only files are kept in the automatic backup.',
    '备份并还原': 'Back up & restore', '备份并覆盖': 'Back up & apply', '取消': 'Cancel', '关闭': 'Close',
    '账号与备份已重新扫描。': 'Accounts and backups rescanned.', '账号 ID 已复制。': 'Account ID copied.', '请先选择一个主号。': 'Choose a main account first.',
    '无法连接本地配置库': 'Cannot connect to the local vault', '请确认启动窗口仍在运行，然后刷新本页。': 'Keep the launcher window open, then refresh this page.',
    '重新连接': 'Reconnect', '本地服务未完成操作。': 'The local service could not complete the operation.',
    '本地配置库响应超时。请确认启动窗口仍在运行，再重新连接。': 'The local vault timed out. Keep the launcher window open, then reconnect.',
    '等待操作结果超时，服务端可能仍在处理。请重新扫描确认结果，勿连续重复操作。': 'The request timed out, but the operation may still be running. Rescan to check the result before trying again.',
    '正在连接本地配置库…': 'Connecting to the local vault…', '配置库连接未完成': 'Vault connection incomplete',
    '请保持启动窗口运行，再点击重新连接。': 'Keep the launcher window open, then click Reconnect.',
    '界面脚本未能加载，请刷新页面；如使用了脚本拦截扩展，请允许本机地址运行。': 'The interface script could not load. Refresh and allow scripts for this local address.',
    '界面初始化错误：': 'Interface initialization error: ', '加载已超过 15 秒。可能是脚本加载或本地请求未完成，请重试。': 'Loading has taken more than 15 seconds. A script or local request may be stuck. Please retry.',
    '已保存的目录': 'Saved folder', '环境变量': 'Environment variable', 'Windows 注册表': 'Windows registry', '常见安装位置': 'Common installation location',
    '未找到 Steam，请手动选择目录': 'Steam not found; choose a folder', '手动设置': 'Selected folder',
    '主号设置': 'Main account updated', '手动备份': 'Manual backup', '还原前自动备份': 'Automatic backup before restore',
    '迁移前备份': 'Backup before migration', '历史备份': 'Legacy backup', '迁移源账号备份': 'Source backup before sync',
    '清单不完整，无法自动还原': 'Incomplete manifest; automatic restore unavailable',
    'Steam 目录已更新。': 'Steam folder updated.',
    '请先正常退出 DOTA2，等待 Steam 云同步完成，再执行文件操作。': 'Exit DOTA2 normally and wait for Steam Cloud to finish syncing before changing files.',
    '另一个操作正在进行，请稍后重试。': 'Another operation is in progress. Please try again later.',
    'Steam 账号 ID 不合法。': 'Invalid Steam account ID.', '请先设置 Steam 安装目录。': 'Choose the Steam installation folder first.',
    '未找到此账号文件夹。': 'Account folder not found.', '此账号尚未生成 DOTA2 配置，请先启动一次游戏并正常退出。': 'This account has no DOTA2 settings yet. Launch the game once and exit normally.',
    '此账号配置为空，无法备份。': 'This account has no settings to back up.', '源账号与目标账号不能相同。': 'Source and target accounts must be different.',
    '源配置为空，无法应用。': 'The source configuration is empty.', '未知的操作类型。': 'Unknown operation type.',
    '配置已变化，请重新查看差异后再覆盖。': 'Settings changed. Preview the differences again before applying.',
    '配置已变化，请重新预览后再还原。': 'Settings changed. Preview again before restoring.',
    '备份期间配置发生变化，请重新预览。两份备份已保留。': 'Settings changed during backup. Preview again. Both backups have been kept.',
    '配置在备份期间变化，请重新预览。': 'Settings changed during backup. Preview again.',
    '文件校验不一致，已停止操作。请保留备份并重新扫描。': 'File verification failed. The operation was stopped. Keep the backup and rescan.',
    '请输入 Steam 安装目录。': 'Choose the Steam installation folder.', '请选择本机 Steam 安装目录。': 'Choose a local Steam installation folder.',
    '此目录不是 Steam 安装目录，需要同时包含 steam.exe 和 userdata。': 'This is not a Steam installation folder. It must contain both steam.exe and userdata.',
    'userdata 不是文件夹。': 'userdata is not a folder.', '无法确认 DOTA2 是否已退出。请检查系统进程权限后重试。': 'Could not check whether DOTA2 is closed. Check process permissions and retry.',
    '备份编号不合法。': 'Invalid backup ID.', '此备份缺少校验清单，暂不支持自动还原。': 'This backup has no verification manifest and cannot be restored automatically.',
    '备份清单没有有效文件。': 'No valid files in the backup manifest.', '备份校验码不合法。': 'Invalid backup checksum.', '备份清单包含重复文件。': 'Duplicate files in the backup manifest.',
    '文件路径不合法。': 'Invalid file path.', '文件路径超出允许目录。': 'File path is outside the allowed folder.',
    '目录包含链接或联接，已停止操作。': 'The folder contains a link or junction. Operation stopped.',
    '配置包含链接或联接，已停止操作。': 'Settings contain a link or junction. Operation stopped.',
    '配置路径不是文件夹。': 'The settings path is not a folder.', '配置包含不支持的文件类型。': 'Settings contain an unsupported file type.',
    '配置嵌套过深。': 'Settings are nested too deeply.', '临时目录检查失败。': 'Temporary folder validation failed.',
    '文件夹选择窗口仅支持 Windows。': 'The folder picker requires Windows.', '文件夹选择窗口已经打开，请先完成选择。': 'The folder picker is already open. Complete or cancel it first.',
    '文件夹选择已超时，请重新选择。': 'Folder selection timed out. Please try again.',
    '无法打开系统文件夹选择窗口，请检查 Windows PowerShell 是否可用。': 'Could not open the folder picker. Check that Windows PowerShell is available.',
    '目录写入权限不足。请检查文件占用或使用有权限的 Windows 账号运行。': 'Cannot write to the folder. Check for locked files and use a Windows account with write permission.',
    '会话已失效，请刷新页面后重试。': 'Your session expired. Refresh and retry.', '不允许跨站请求。': 'Cross-site requests are not allowed.',
    '只允许从本机地址访问。': 'Local access only.', '找不到此页面。': 'Page not found.', '找不到此接口。': 'Endpoint not found.',
    '请求内容过大。': 'Request too large.', '请求格式不正确。': 'Invalid request format.', '请使用 JSON 请求。': 'Use a JSON request.',
    '本地设置文件损坏。请备份 .local/settings.json 后移走该文件，再重新启动。': 'Local settings are damaged. Back up and move .local/settings.json, then restart.',
    '操作未完成：': 'Operation failed: ',
    '应用失败且自动回退未完成。请退出游戏，从“备份档案”恢复目标账号的自动备份。原目录保留在 ': 'Apply failed and automatic rollback could not finish. Exit the game and restore the target account’s automatic backup from Backups. The original folder is kept at ',
  };
  let language = navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
  try { language = localStorage.getItem('vault-language') || language; } catch { /* Keep browser language when storage is unavailable. */ }
  if (language !== 'en') language = 'zh-CN';
  const escape = value => Array.from(value, char => '\\^$.*+?()[]{}|'.includes(char) ? '\\' + char : char).join('');
  const matcher = new RegExp(Object.keys(en).sort((a, b) => b.length - a.length).map(escape).join('|'), 'g');
  function t(value) { return language === 'en' ? String(value ?? '').replace(matcher, match => en[match]) : String(value ?? ''); }
  function setLanguage(value) {
    language = value === 'en' ? 'en' : 'zh-CN';
    try { localStorage.setItem('vault-language', language); } catch { /* Keep session preference. */ }
    document.documentElement.lang = language;
    document.title = language === 'en' ? 'DOTA Key Vault · Settings manager' : 'DOTA Key Vault · 配置管理';
  }
  function systemText(value) {
    if (language !== 'en') return value;
    const text = String(value ?? '');
    const patterns = [
      [/^已将 (\d+) 设为主号。$/, id => `Account ${id} is now the main account.`],
      [/^备份完成，(\d+) 个文件校验通过。$/, n => `Backup complete. ${n} files verified.`],
      [/^已覆盖 (\d+)，(\d+) 个文件校验通过。两边原配置均已备份。$/, (id, n) => `Settings applied to ${id}. ${n} files verified. Both accounts were backed up.`],
      [/^还原完成，(\d+) 个文件校验通过。还原前配置已自动备份。$/, n => `Restore complete. ${n} files verified. Previous settings were backed up.`],
    ];
    for (const [pattern, format] of patterns) { const match = text.match(pattern); if (match) return format(...match.slice(1)); }
    // Preserve paths and low-level OS error details, translating only the message prefix.
    for (const prefix of ['操作未完成：', '应用失败且自动回退未完成。请退出游戏，从“备份档案”恢复目标账号的自动备份。原目录保留在 ']) {
      if (text.startsWith(prefix)) return t(prefix) + text.slice(prefix.length);
    }
    return en[text] || text;
  }
  function backupLabel(backup) {
    if (language !== 'en') return backup.note;
    if (/^从 \d+ 覆盖前自动备份$/.test(backup.note)) return `Automatic backup before sync from ${backup.note.match(/\d+/)[0]}`;
    if (/^迁移至 \d+ 前的源账号备份$/.test(backup.note)) return `Source backup before sync to ${backup.note.match(/\d+/)[0]}`;
    const standardNotes = ['手动备份', '还原前自动备份', '迁移前备份', '历史备份', '清单不完整，无法自动还原'];
    return standardNotes.includes(backup.note) ? en[backup.note] : backup.note;
  }
  function historyLabel(event) {
    if (language !== 'en') return event.message;
    let match;
    if ((match = event.message.match(/^已备份账号 (\d+)$/))) return `Backed up account ${match[1]}`;
    if ((match = event.message.match(/^已还原账号 (\d+)$/))) return `Restored account ${match[1]}`;
    if ((match = event.message.match(/^(\d+) → (\d+)，覆盖完成$/))) return `${match[1]} → ${match[2]} · Settings applied`;
    return en[event.message] || event.message;
  }
  setLanguage(language);
  window.vaultI18n = { t, getLanguage: () => language, setLanguage, systemText, backupLabel, historyLabel };
}());
