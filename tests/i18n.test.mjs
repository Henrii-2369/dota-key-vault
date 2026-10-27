import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');
function locale(browserLanguage, saved, storageFails = false) {
  const context = {
    window: {}, navigator: { language: browserLanguage },
    document: { documentElement: {}, title: '' },
    localStorage: { getItem: () => { if (storageFails) throw Error('disabled'); return saved; }, setItem: (_, value) => { if (storageFails) throw Error('disabled'); saved = value; } },
  };
  vm.runInNewContext(source, context);
  return { api: context.window.vaultI18n, context, saved: () => saved };
}

test('locale follows browser preference and remembers explicit selection', () => {
  const { api, context, saved } = locale('en-US');
  assert.equal(api.t('配置总览'), 'Overview');
  assert.equal(context.document.documentElement.lang, 'en');
  api.setLanguage('zh-CN');
  assert.equal(api.t('配置总览'), '配置总览');
  assert.equal(saved(), 'zh-CN');
  assert.equal(locale('en-US', saved()).api.getLanguage(), 'zh-CN');
  assert.equal(locale('zh-TW').api.getLanguage(), 'zh-CN');
});

test('language switching remains usable without localStorage', () => {
  const { api } = locale('en-US', null, true);
  assert.equal(api.getLanguage(), 'en');
  api.setLanguage('en');
  assert.equal(api.t('重新连接'), 'Reconnect');
});

test('system messages translate numbers while preserving paths and custom notes', () => {
  const { api } = locale('en-US');
  assert.equal(api.systemText('备份完成，42 个文件校验通过。'), 'Backup complete. 42 files verified.');
  assert.equal(api.systemText('操作未完成：D:\\备份档案\\主号.cfg'), 'Operation failed: D:\\备份档案\\主号.cfg');
  assert.equal(api.backupLabel({ note: '我的配置 · 主号' }), '我的配置 · 主号');
  assert.equal(api.backupLabel({ note: '主号' }), '主号');
  assert.equal(api.backupLabel({ note: '从 11111 覆盖前自动备份' }), 'Automatic backup before sync from 11111');
  assert.equal(api.historyLabel({ message: '11111 → 22222，覆盖完成' }), '11111 → 22222 · Settings applied');
  assert.equal(api.t('<small> 个</small>'), '<small> files</small>');
});
