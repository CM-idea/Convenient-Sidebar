importScripts('icon-theme.js', 'embed-rules.js');

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

const SETTINGS_KEY = 'settings';

async function readSavedIconSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = result[SETTINGS_KEY] || {};
  return {
    iconTheme: normalizeIconTheme(settings.iconTheme),
    iconCustomUrl: settings.iconCustomUrl || '',
  };
}

async function initIconTheme() {
  await applyToolbarIcon(await readSavedIconSettings());
}

function scheduleIconThemeInit() {
  initIconTheme().catch((error) => {
    console.error('[便捷边栏] 初始化工具栏图标失败，稍后重试:', error);
    setTimeout(() => {
      initIconTheme().catch((retryError) => {
        console.error('[便捷边栏] 重试初始化工具栏图标失败:', retryError);
      });
    }, 500);
  });
}

function scheduleEmbedRulesInit() {
  Promise.all([registerEmbedContentScripts(), initEmbedRules()]).catch((error) => {
    console.error('[便捷边栏] 初始化嵌入规则失败，稍后重试:', error);
    setTimeout(() => {
      Promise.all([registerEmbedContentScripts(), initEmbedRules()]).catch((retryError) => {
        console.error('[便捷边栏] 重试初始化嵌入规则失败:', retryError);
      });
    }, 500);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleIconThemeInit();
  scheduleEmbedRulesInit();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleIconThemeInit();
  scheduleEmbedRulesInit();
  chrome.alarms.create('reapply-icon-theme', { when: Date.now() + 3000 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'reapply-icon-theme') return;
  initIconTheme().catch((error) => {
    console.error('[便捷边栏] 延迟重试设置工具栏图标失败:', error);
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[SETTINGS_KEY]) return;
  const settings = changes[SETTINGS_KEY].newValue || {};
  applyToolbarIcon({
    iconTheme: settings.iconTheme,
    iconCustomUrl: settings.iconCustomUrl || '',
  }).catch((error) => {
    console.error('[便捷边栏] 存储变更后设置工具栏图标失败:', error);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'REGISTER_SIDEBAR_EMBED') {
    registerSidebarEmbedContext(message.tabId, message.url, message.userAgent, message.requestMobile)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type !== 'APPLY_ICON_THEME') return;

  applyToolbarIcon({
    iconTheme: message.theme,
    iconCustomUrl: message.iconCustomUrl || '',
  })
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));

  return true;
});

scheduleIconThemeInit();
scheduleEmbedRulesInit();
