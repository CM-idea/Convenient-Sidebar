const DISPLAY_MODE_KEY = 'panelDisplayMode';
const FLOATING_WINDOWS_KEY = 'floatingWindows';

async function getFloatingWindows() {
  return (await chrome.storage.session.get(FLOATING_WINDOWS_KEY))[FLOATING_WINDOWS_KEY] || {};
}

async function getDisplayMode() {
  return (await chrome.storage.local.get(DISPLAY_MODE_KEY))[DISPLAY_MODE_KEY] === 'floating'
    ? 'floating' : 'docked';
}

async function setDisplayMode(mode) {
  await chrome.storage.local.set({ [DISPLAY_MODE_KEY]: mode });
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: mode === 'docked' });
  await chrome.action.setTitle({ title: mode === 'floating' ? '打开或关闭悬浮边栏' : '打开侧边栏' });
}

function canFloatOn(tab) {
  return Boolean(tab?.id && /^https?:\/\//i.test(tab.url || ''));
}

async function tellFloatingTab(tab, type) {
  if (!canFloatOn(tab)) throw new Error('此页面不支持悬浮模式，请打开普通网页重试');
  try {
    return await chrome.tabs.sendMessage(tab.id, { type });
  } catch (error) {
    if (type !== 'FLOATING_OPEN') throw error;
    // A newly opened tab can receive a click before its content script loads.
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['floating-content.js'] });
    return chrome.tabs.sendMessage(tab.id, { type });
  }
}

async function updateFloatingWindow(windowId, isOpen) {
  const windows = await getFloatingWindows();
  if (isOpen) windows[windowId] = true;
  else delete windows[windowId];
  await chrome.storage.session.set({ [FLOATING_WINDOWS_KEY]: windows });
  if (!isOpen) {
    const tabs = await chrome.tabs.query({ windowId });
    await Promise.allSettled(tabs.filter(canFloatOn).map((tab) =>
      chrome.tabs.sendMessage(tab.id, { type: 'FLOATING_CLOSE' })
    ));
  }
}

function showFloatingError(error) {
  console.warn('[便捷边栏] 悬浮模式不可用:', error);
  chrome.action.setBadgeBackgroundColor({ color: '#bd3b3b' });
  chrome.action.setBadgeText({ text: '!' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3500);
}

async function switchFromSidePanel(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const result = await tellFloatingTab(tab, 'FLOATING_OPEN');
    if (!result?.ok) throw new Error(result?.error || '无法显示悬浮窗口');
    await updateFloatingWindow(tab.windowId, true);
    await setDisplayMode('floating');
    try {
      if (chrome.sidePanel.close) {
        await chrome.sidePanel.close({ windowId: tab.windowId });
      } else {
        // Older Edge versions can hide the native panel by disabling its page.
        await chrome.sidePanel.setOptions({ enabled: false });
        await chrome.sidePanel.setOptions({ path: 'sidepanel.html', enabled: true });
      }
    } catch (error) {
      console.warn('[便捷边栏] 请手动关闭原侧边栏:', error);
    }
    sendResponse({ ok: true });
  } catch (error) {
    sendResponse({ ok: false, error: String(error) });
  }
}

function initFloatingPanelBehavior() {
  getDisplayMode().then(async (mode) => {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: mode === 'docked' });
    await chrome.action.setTitle({ title: mode === 'floating' ? '打开或关闭悬浮边栏' : '打开侧边栏' });
  }).catch(console.warn);
}

chrome.action.onClicked.addListener(async (tab) => {
  if (await getDisplayMode() !== 'floating') return;
  try {
    const windows = await getFloatingWindows();
    if (windows[tab.windowId]) {
      await updateFloatingWindow(tab.windowId, false);
      return;
    }
    const result = await tellFloatingTab(tab, 'FLOATING_OPEN');
    if (!result?.ok) throw new Error(result?.error || '无法显示悬浮窗口');
    await updateFloatingWindow(tab.windowId, true);
  } catch (error) { showFloatingError(error); }
});

chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  try {
    if (await getDisplayMode() !== 'floating') return;
    if (!(await getFloatingWindows())[windowId]) return;
    const tab = await chrome.tabs.get(tabId);
    if (canFloatOn(tab)) await tellFloatingTab(tab, 'FLOATING_OPEN');
  } catch { /* restricted or loading tab; its content script retries at document_idle */ }
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  const windows = await getFloatingWindows();
  if (windows[windowId]) await updateFloatingWindow(windowId, false);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[DISPLAY_MODE_KEY]) return;
  const floating = changes[DISPLAY_MODE_KEY].newValue === 'floating';
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: !floating }).catch(console.warn);
  chrome.action.setTitle({ title: floating ? '打开或关闭悬浮边栏' : '打开侧边栏' });
  if (!floating) {
    (async () => {
      for (const id of Object.keys(await getFloatingWindows())) {
        await updateFloatingWindow(Number(id), false);
      }
    })().catch(console.warn);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'FLOATING_STATE') {
    Promise.all([getDisplayMode(), getFloatingWindows()]).then(([mode, windows]) => {
      sendResponse({ open: mode === 'floating' && Boolean(windows[sender.tab?.windowId]) });
    }).catch(() => sendResponse({ open: false }));
    return true;
  }
  if (message?.type === 'FLOATING_FROM_DOCK') {
    switchFromSidePanel(sendResponse);
    return true;
  }
  if (message?.type === 'FLOATING_DISMISS' && sender.tab) {
    updateFloatingWindow(sender.tab.windowId, false).then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  if (message?.type === 'FLOATING_DOCK' && sender.tab) {
    // Call open immediately in the click event's message chain to preserve user activation.
    chrome.sidePanel.open({ tabId: sender.tab.id }).then(async () => {
      await setDisplayMode('docked');
      await updateFloatingWindow(sender.tab.windowId, false);
      sendResponse({ ok: true });
    }).catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
});
