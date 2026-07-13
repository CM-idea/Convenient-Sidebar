const SIDEBAR_SESSION_RULE_ID = 100;
const SIDEBAR_DYNAMIC_RULE_ID = 2;

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

function resolveEmbedUserAgent(baseUserAgent, requestMobile) {
  if (requestMobile) return MOBILE_USER_AGENT;
  return baseUserAgent || navigator.userAgent;
}

function buildRequestHeaders(userAgent, requestMobile = false) {
  const headers = [
    { header: 'User-Agent', operation: 'set', value: userAgent },
    { header: 'Sec-Fetch-Dest', operation: 'set', value: 'document' },
    { header: 'Sec-Fetch-Site', operation: 'set', value: 'same-origin' },
    { header: 'If-None-Match', operation: 'remove' },
  ];

  if (requestMobile) {
    headers.push(
      { header: 'Sec-CH-UA-Mobile', operation: 'set', value: '?1' },
      { header: 'Sec-CH-UA-Platform', operation: 'set', value: '"Android"' }
    );
  }

  return headers;
}

const RESPONSE_STRIP_HEADERS = [
  { header: 'X-Frame-Options', operation: 'remove' },
  { header: 'Content-Security-Policy', operation: 'remove' },
  { header: 'Content-Security-Policy-Report-Only', operation: 'remove' },
];

function buildSidebarSessionRules(userAgent, requestMobile = false) {
  return [
    {
      id: SIDEBAR_SESSION_RULE_ID,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: buildRequestHeaders(userAgent, requestMobile),
        responseHeaders: RESPONSE_STRIP_HEADERS,
      },
      condition: {
        initiatorDomains: [chrome.runtime.id],
      },
    },
  ];
}

function buildSidebarDynamicRules(userAgent, requestMobile = false) {
  return [
    {
      id: SIDEBAR_DYNAMIC_RULE_ID,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: buildRequestHeaders(userAgent, requestMobile),
        responseHeaders: RESPONSE_STRIP_HEADERS,
      },
      condition: {
        initiatorDomains: [chrome.runtime.id],
      },
    },
  ];
}

async function registerSidebarSessionRules(userAgent, requestMobile = false) {
  const ua = resolveEmbedUserAgent(userAgent, requestMobile);
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [SIDEBAR_SESSION_RULE_ID],
    addRules: buildSidebarSessionRules(ua, requestMobile),
  });
}

async function registerSidebarDynamicRules(userAgent, requestMobile = false) {
  const ua = resolveEmbedUserAgent(userAgent, requestMobile);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [SIDEBAR_DYNAMIC_RULE_ID],
    addRules: buildSidebarDynamicRules(ua, requestMobile),
  });
}

async function ensureContentScriptsAllFrames() {
  if (!chrome.scripting?.getRegisteredContentScripts) return;

  try {
    const scripts = await chrome.scripting.getRegisteredContentScripts();
    if (scripts.some((script) => !script.allFrames)) {
      await chrome.scripting.updateContentScripts(
        scripts.map((script) => ({ ...script, allFrames: true }))
      );
    }
  } catch (error) {
    console.warn('[便捷边栏] 更新 content scripts 失败:', error);
  }
}

async function initEmbedRules(userAgent) {
  await Promise.all([
    registerSidebarSessionRules(userAgent),
    registerSidebarDynamicRules(userAgent),
  ]);
}

async function registerSidebarEmbedContext(_tabId, _url, userAgent, requestMobile = false) {
  const ua = resolveEmbedUserAgent(userAgent, requestMobile);
  await Promise.all([
    registerSidebarSessionRules(ua, requestMobile),
    registerSidebarDynamicRules(ua, requestMobile),
    ensureContentScriptsAllFrames(),
  ]);
}

async function registerEmbedContentScripts() {
  if (!chrome.scripting?.registerContentScripts) return;

  const scripts = [
    {
      id: 'sidebar-frame-main',
      js: ['frame-bypass.js'],
      matches: ['<all_urls>'],
      runAt: 'document_start',
      allFrames: true,
      world: 'MAIN',
    },
  ];

  try {
    await chrome.scripting.unregisterContentScripts({ ids: ['sidebar-frame-main'] });
  } catch (_) {
    // ignore
  }

  try {
    await chrome.scripting.registerContentScripts(scripts);
  } catch (error) {
    console.warn('[便捷边栏] 注册 content scripts 失败:', error);
  }
}

const SidebarEmbedRules = {
  registerSidebarEmbedContext,
  registerSidebarSessionRules,
  registerSidebarDynamicRules,
  ensureContentScriptsAllFrames,
  resolveEmbedUserAgent,
  MOBILE_USER_AGENT,
};

if (typeof globalThis !== 'undefined') {
  globalThis.SidebarEmbedRules = SidebarEmbedRules;
}
