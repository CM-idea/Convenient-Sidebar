const STORAGE_KEY = 'shortcuts';
const SETTINGS_KEY = 'settings';

const DEFAULT_SETTINGS = {
  startupPage: 'quickAccess',
  startupCustomUrl: '',
  loadMode: 'sidebar',
  searchEngine: 'google',
  searchCustomTemplate: '',
};

const SEARCH_TEMPLATES = {
  google: 'https://www.google.com/search?q=%s',
  bing: 'https://www.bing.com/search?q=%s',
  baidu: 'https://www.baidu.com/s?wd=%s',
};

const modalOverlay = document.getElementById('add-modal');
const modalDialog = modalOverlay.querySelector('.modal');
const modalCancel = document.getElementById('modal-cancel');
const modalSave = document.getElementById('modal-save');
const siteTitleInput = document.getElementById('site-title');
const siteUrlInput = document.getElementById('site-url');
const siteMobileInput = document.getElementById('site-mobile');
const iconPreviewImg = document.getElementById('icon-preview-img');
const iconPreview = document.getElementById('icon-preview');
const iconFileInput = document.getElementById('icon-file-input');
const iconHint = document.getElementById('icon-hint');
const shortcutsGrid = document.getElementById('shortcuts-grid');
const homeView = document.getElementById('home-view');
const pageView = document.getElementById('page-view');
const startupFrame = document.getElementById('startup-frame');
const pageLoading = document.getElementById('page-loading');
const embedFallback = document.getElementById('embed-fallback');
const embedFallbackOpenTab = document.getElementById('embed-fallback-open-tab');
const searchInput = document.getElementById('search-input');
const dropdownBtn = document.getElementById('toolbar-dropdown-btn');
const dropdownMenu = document.getElementById('toolbar-dropdown');
const slotButtons = document.querySelectorAll('.toolbar-btn[data-slot]');

let activeSlotIndex = null;
let currentIconUrl = '';
let hasCustomIcon = false;

function setModalIconPreview(iconUrl) {
  currentIconUrl = iconUrl || '';
  iconPreview.classList.toggle('icon-preview--custom', hasCustomIcon);
  if (currentIconUrl) {
    iconPreviewImg.src = currentIconUrl;
    iconPreviewImg.hidden = false;
  } else {
    iconPreviewImg.hidden = true;
    iconPreviewImg.removeAttribute('src');
  }
}

function updateIconHint() {
  if (!iconHint) return;
  iconHint.textContent = hasCustomIcon
    ? '已使用自定义图标，点击左侧图标可恢复默认'
    : '支持自定义图标，不上传则使用站点默认';
}

async function refreshModalIconFromUrl(url, remoteIconUrl = '') {
  if (!url || hasCustomIcon) return;

  try {
    const normalizedUrl = normalizeUrl(url);
    const iconUrl = await IconStore.downloadShortcutIcon(normalizedUrl, remoteIconUrl);
    setModalIconPreview(iconUrl);
  } catch (error) {
    console.warn('[便捷边栏] 下载站点图标失败:', error);
    setModalIconPreview('');
  }
}

async function handleCustomIconSelect(event) {
  const file = event.target.files?.[0];
  event.target.value = '';

  if (!file) return;

  try {
    const dataUrl = await IconStore.readImageFileAsDataUrl(file);
    hasCustomIcon = true;
    setModalIconPreview(dataUrl);
    updateIconHint();
  } catch (error) {
    window.alert(error.message || '图标上传失败，请重试');
  }
}

async function resetModalIconToDefault() {
  if (!hasCustomIcon) return;

  hasCustomIcon = false;
  updateIconHint();

  const url = siteUrlInput.value.trim();
  if (url) {
    await refreshModalIconFromUrl(url);
  } else {
    setModalIconPreview('');
  }
}
let currentSettings = { ...DEFAULT_SETTINGS };
let frameLoadGeneration = 0;
let embedFallbackUrl = '';

function setEmbedFallback(visible, url = '') {
  embedFallbackUrl = url || embedFallbackUrl;
  embedFallback.hidden = !visible;
  startupFrame.hidden = visible;
  if (visible) {
    startupFrame.removeAttribute('src');
  }
}

function resolveShortcutIcon(item) {
  if (SidebarHome.isHomeUrl(item?.url)) {
    return SidebarHome.getIconUrl();
  }
  if (IconStore.isLocalIcon(item?.iconUrl)) {
    return item.iconUrl;
  }
  if (typeof item?.iconUrl === 'string' && /^https?:\/\//i.test(item.iconUrl)) {
    return item.iconUrl;
  }
  return '';
}

function getGridShortcuts(items) {
  return getValidShortcuts(items).filter((item) => !SidebarHome.isHomeUrl(item.url));
}

function migrateHomeShortcuts(shortcuts) {
  return SidebarHome.migrateShortcuts(shortcuts);
}

function createIconFallback(label, className) {
  const fallback = document.createElement('span');
  fallback.className = className;
  fallback.textContent = String(label || '?').charAt(0).toUpperCase();
  return fallback;
}

function normalizeUrl(url) {
  let value = String(url || '').trim();
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  return new URL(value).href;
}

function resolveSidebarUserAgent(requestMobile = false) {
  const base = navigator.userAgent;
  if (globalThis.SidebarEmbedRules?.resolveEmbedUserAgent) {
    return globalThis.SidebarEmbedRules.resolveEmbedUserAgent(base, requestMobile);
  }
  return requestMobile
    ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
    : base;
}

async function getRequestMobileForUrl(url) {
  if (SidebarHome.isHomeUrl(url)) return false;

  try {
    const normalized = normalizeUrl(url);
    const shortcuts = getValidShortcuts(await loadShortcuts());
    const match = shortcuts.find((item) => {
      try {
        return normalizeUrl(item.url) === normalized;
      } catch {
        return false;
      }
    });
    return Boolean(match?.requestMobile);
  } catch {
    return false;
  }
}

function prepareSidebarFrame(requestMobile = false) {
  const params = new URLSearchParams();
  params.set('anything-copilot_webview', '');
  params.set('ua', resolveSidebarUserAgent(requestMobile));
  params.set('ssc', '1');
  startupFrame.name = params.toString();
}

function setPageLoading(visible) {
  pageLoading.hidden = !visible;
  pageLoading.setAttribute('aria-busy', visible ? 'true' : 'false');
}

function waitForFrameLoad(frame, timeoutMs = 12000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      frame.onload = null;
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    frame.onload = finish;
  });
}

async function loadUrlInSidebarFrame(url, requestMobile = false) {
  const target = normalizeUrl(url);
  frameLoadGeneration += 1;
  const generation = frameLoadGeneration;

  homeView.hidden = true;
  pageView.hidden = false;
  setEmbedFallback(false);
  startupFrame.hidden = false;
  setPageLoading(true);

  await registerSidebarEmbedContext(target, requestMobile);

  if (generation !== frameLoadGeneration) return;

  prepareSidebarFrame(requestMobile);
  startupFrame.src = target;
  await waitForFrameLoad(startupFrame, 40000);

  if (generation === frameLoadGeneration) {
    setPageLoading(false);
  }
}

async function openUrlInSidebar(url, requestMobile = false) {
  await loadUrlInSidebarFrame(url, requestMobile);
}

async function navigateToUrl(url) {
  const target = normalizeUrl(url);
  window.open(target, '_blank', 'noopener,noreferrer');
}

async function queryActiveBrowserTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.url || /^(chrome|edge|about):/i.test(tab.url)) return null;
    if (tab.url.startsWith(chrome.runtime.getURL(''))) return null;
    return tab;
  } catch {
    return null;
  }
}

function isBrowserLoadMode(settings = currentSettings) {
  return settings.loadMode === 'browser';
}

async function openUrl(url, options = {}) {
  if (SidebarHome.isHomeUrl(url)) {
    showQuickAccessHome();
    return;
  }

  let requestMobile = options.requestMobile;
  if (requestMobile === undefined) {
    requestMobile = await getRequestMobileForUrl(url);
  }

  if (isBrowserLoadMode()) {
    await navigateToUrl(url);
    return;
  }
  await openUrlInSidebar(url, requestMobile);
}

function showQuickAccessHome() {
  frameLoadGeneration += 1;
  startupFrame.removeAttribute('src');
  setEmbedFallback(false);
  setPageLoading(false);
  pageView.hidden = true;
  homeView.hidden = false;
  updateActiveToolbarSlot(-1);
}

async function getCurrentTab() {
  return queryActiveBrowserTab();
}

async function loadAppState() {
  const result = await chrome.storage.local.get([SETTINGS_KEY, STORAGE_KEY]);
  return {
    settings: { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) },
    shortcuts: result[STORAGE_KEY] || [],
  };
}

function buildSearchUrl(query, settings) {
  const encoded = encodeURIComponent(query.trim());
  if (!encoded) return '';

  if (settings.searchEngine === 'custom') {
    const template = settings.searchCustomTemplate || '';
    if (template.includes('%s')) {
      return template.replace(/%s/g, encoded);
    }
    return '';
  }

  const template = SEARCH_TEMPLATES[settings.searchEngine] || SEARCH_TEMPLATES.google;
  return template.replace('%s', encoded);
}

async function applyStartupView(settings) {
  if (settings.startupPage === 'custom' && settings.startupCustomUrl.trim()) {
    try {
      if (isBrowserLoadMode(settings)) {
        await navigateToUrl(settings.startupCustomUrl);
      } else {
        const requestMobile = await getRequestMobileForUrl(settings.startupCustomUrl);
        await loadUrlInSidebarFrame(settings.startupCustomUrl, requestMobile);
        return;
      }
    } catch {
      // fall through to quick access
    }
  }

  showQuickAccessHome();
}

async function handleSearchSubmit() {
  const query = searchInput.value.trim();
  if (!query) return;

  const url = buildSearchUrl(query, currentSettings);
  if (!url) {
    searchInput.focus();
    return;
  }

  await openUrl(url);
  searchInput.value = '';
}

async function loadShortcuts() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

async function saveShortcuts(shortcuts) {
  await chrome.storage.local.set({ [STORAGE_KEY]: shortcuts });
}

const TOOLBAR_SLOT_COUNT = 7;

function sortShortcuts(items) {
  return [...items].sort((a, b) => {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
    const orderDiff = orderA - orderB;
    if (orderDiff !== 0) return orderDiff;
    return (a.createdAt ?? 0) - (b.createdAt ?? 0);
  });
}

function isValidShortcut(item) {
  return Boolean(item?.title?.trim() && item?.url?.trim());
}

function getValidShortcuts(items) {
  return sortShortcuts(items).filter(isValidShortcut);
}

function normalizeShortcutOrder(shortcuts) {
  return getValidShortcuts(shortcuts).map((item, index) => {
    const entry = { ...item, order: index };
    if (index < TOOLBAR_SLOT_COUNT) {
      entry.slotIndex = index;
    } else {
      delete entry.slotIndex;
    }
    return entry;
  });
}

function updateActiveToolbarSlot(slotIndex) {
  slotButtons.forEach((btn) => {
    btn.classList.toggle('toolbar-btn--active', Number(btn.dataset.slot) === slotIndex);
  });
}

function createDropdownMenuItem({ title, iconUrl, isHome = false, onClick }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'toolbar-dropdown__item';
  btn.setAttribute('role', 'menuitem');
  btn.title = title;

  if (isHome) {
    SidebarHome.appendHomeIcon(btn);
  } else if (iconUrl) {
    const img = document.createElement('img');
    img.className = 'toolbar-dropdown__icon';
    img.src = iconUrl;
    img.alt = '';
    btn.appendChild(img);
  } else {
    const fallback = document.createElement('span');
    fallback.className = 'toolbar-dropdown__icon toolbar-dropdown__icon--fallback';
    fallback.textContent = title.charAt(0).toUpperCase();
    btn.appendChild(fallback);
  }

  const titleEl = document.createElement('span');
  titleEl.className = 'toolbar-dropdown__title';
  titleEl.textContent = title;
  btn.appendChild(titleEl);

  btn.addEventListener('click', () => {
    closeDropdown();
    onClick();
  });

  return btn;
}

async function openModal(slotIndex, tab) {
  activeSlotIndex = slotIndex;
  const title = tab?.title || '';
  const url = tab?.url || '';
  hasCustomIcon = false;

  siteTitleInput.value = title;
  siteUrlInput.value = url;
  if (siteMobileInput) siteMobileInput.checked = false;

  setModalIconPreview('');
  updateIconHint();

  if (url) {
    await refreshModalIconFromUrl(url, tab?.favIconUrl);
  }

  modalOverlay.hidden = false;
  siteTitleInput.focus();
}

function closeModal() {
  modalOverlay.hidden = true;
  activeSlotIndex = null;
  hasCustomIcon = false;
  setModalIconPreview('');
  updateIconHint();
}

function renderToolbarSlot(btn, shortcut) {
  const plusIcon = btn.querySelector('.icon--plus');
  btn.querySelectorAll('.toolbar-btn__icon, .toolbar-btn__icon--fallback').forEach((el) => el.remove());

  if (shortcut) {
    btn.classList.add('toolbar-btn--filled');
    btn.setAttribute('aria-label', shortcut.title);

    const iconUrl = resolveShortcutIcon(shortcut);
    if (iconUrl) {
      const img = document.createElement('img');
      img.className = 'toolbar-btn__icon';
      img.alt = '';
      img.src = iconUrl;
      btn.appendChild(img);
    } else {
      btn.appendChild(createIconFallback(shortcut.title, 'toolbar-btn__icon toolbar-btn__icon--fallback'));
    }

    if (plusIcon) plusIcon.style.display = 'none';
  } else {
    btn.classList.remove('toolbar-btn--filled');
    btn.setAttribute('aria-label', `快捷访问 ${Number(btn.dataset.slot) + 1}`);
    if (plusIcon) plusIcon.style.display = '';
  }
}

function closeDropdown() {
  dropdownMenu.hidden = true;
  dropdownBtn.setAttribute('aria-expanded', 'false');
}

function openDropdown() {
  dropdownMenu.hidden = false;
  dropdownBtn.setAttribute('aria-expanded', 'true');
}

function renderDropdownMenu(shortcuts) {
  dropdownMenu.innerHTML = '';

  const overflowItems = getValidShortcuts(shortcuts).slice(TOOLBAR_SLOT_COUNT);

  if (overflowItems.length === 0) {
    closeDropdown();
    dropdownBtn.classList.add('toolbar-btn--dropdown-empty');
    return;
  }

  dropdownBtn.classList.remove('toolbar-btn--dropdown-empty');

  overflowItems.forEach((item) => {
    dropdownMenu.appendChild(
      createDropdownMenuItem({
        title: item.title,
        iconUrl: resolveShortcutIcon(item),
        isHome: SidebarHome.isHomeUrl(item.url),
        onClick: () => openUrl(item.url, { requestMobile: item.requestMobile }),
      })
    );
  });
}

function areToolbarSlotsFull(shortcuts) {
  return getValidShortcuts(shortcuts).length >= TOOLBAR_SLOT_COUNT;
}

function createGridAddButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'shortcut-item shortcut-item--add';
  btn.title = '添加快捷访问';
  btn.setAttribute('aria-label', '添加快捷访问');

  const icon = document.createElement('div');
  icon.className = 'shortcut-item__icon shortcut-item__icon--add';
  icon.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M12 5V19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  btn.appendChild(icon);

  const title = document.createElement('span');
  title.className = 'shortcut-item__title';
  title.textContent = '添加';
  btn.appendChild(title);

  btn.addEventListener('click', () => {
    handleGridAddClick();
  });

  return btn;
}

async function handleGridAddClick() {
  const tab = await getCurrentTab();
  if (
    !tab?.url ||
    tab.url.startsWith('chrome://') ||
    tab.url.startsWith('edge://') ||
    tab.url.startsWith('about:')
  ) {
    alert('无法获取当前页面信息，请切换到普通网页后再试。');
    return;
  }

  openModal(null, tab);
}

function renderShortcutsGrid(shortcuts) {
  shortcutsGrid.innerHTML = '';

  const items = getGridShortcuts(shortcuts);

  items.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'shortcut-item';
    btn.title = item.title;

    const iconUrl = resolveShortcutIcon(item);
    if (iconUrl) {
      const img = document.createElement('img');
      img.className = 'shortcut-item__icon';
      img.src = iconUrl;
      img.alt = '';
      img.draggable = false;
      btn.appendChild(img);
    } else {
      const fallback = document.createElement('div');
      fallback.className = 'shortcut-item__icon shortcut-item__icon--fallback';
      fallback.textContent = item.title.charAt(0).toUpperCase();
      btn.appendChild(fallback);
    }

    const title = document.createElement('span');
    title.className = 'shortcut-item__title';
    title.textContent = item.title;
    btn.appendChild(title);

    btn.addEventListener('click', () => openUrl(item.url, { requestMobile: item.requestMobile }));
    shortcutsGrid.appendChild(btn);
  });

  if (areToolbarSlotsFull(shortcuts)) {
    shortcutsGrid.appendChild(createGridAddButton());
  }
}

function renderUI(shortcuts) {
  const sorted = getValidShortcuts(shortcuts);

  slotButtons.forEach((btn) => {
    const slotIndex = Number(btn.dataset.slot);
    renderToolbarSlot(btn, sorted[slotIndex]);
  });

  renderDropdownMenu(shortcuts);
  renderShortcutsGrid(shortcuts);
}

async function refreshUI() {
  renderUI(await loadShortcuts());
}

async function migrateLegacyShortcutIcons(shortcuts) {
  const { shortcuts: next, changed } = await IconStore.migrateShortcutIcons(shortcuts);
  if (changed) {
    await saveShortcuts(next);
  }
  return next;
}

async function handleSlotClick(slotIndex) {
  const sorted = getValidShortcuts(await loadShortcuts());
  const existing = sorted[slotIndex];

  if (existing) {
    updateActiveToolbarSlot(slotIndex);
    openUrl(existing.url, { requestMobile: existing.requestMobile });
    return;
  }

  const tab = await getCurrentTab();
  if (!tab?.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
    alert('无法获取当前页面信息，请切换到普通网页后再试。');
    return;
  }

  openModal(slotIndex, tab);
}

async function handleSave() {
  const title = siteTitleInput.value.trim();
  const url = siteUrlInput.value.trim();

  if (!title) {
    siteTitleInput.focus();
    return;
  }

  if (!url) {
    siteUrlInput.focus();
    return;
  }

  let normalizedUrl;
  try {
    normalizedUrl = normalizeUrl(url);
  } catch {
    siteUrlInput.focus();
    return;
  }

  modalSave.disabled = true;

  try {
    let iconUrl = currentIconUrl;
    if (!IconStore.isLocalIcon(iconUrl)) {
      iconUrl = await IconStore.downloadShortcutIcon(normalizedUrl, currentIconUrl);
    }

    const sorted = getValidShortcuts(await loadShortcuts());
    const entry = {
      id: Date.now().toString(),
      title,
      url: normalizedUrl,
      iconUrl,
      requestMobile: Boolean(siteMobileInput?.checked),
      createdAt: Date.now(),
      order: sorted.length,
    };

    const normalized = normalizeShortcutOrder([...sorted, entry]);
    const shouldOpenAfterSave = activeSlotIndex != null;
    await saveShortcuts(normalized);
    closeModal();
    await refreshUI();

    const newIndex = normalized.findIndex((item) => item.id === entry.id);
    if (newIndex >= 0 && newIndex < TOOLBAR_SLOT_COUNT) {
      updateActiveToolbarSlot(newIndex);
    }

    if (shouldOpenAfterSave) {
      openUrl(normalizedUrl, { requestMobile: entry.requestMobile });
    }
  } finally {
    modalSave.disabled = false;
  }
}

slotButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    closeDropdown();
    handleSlotClick(Number(btn.dataset.slot));
  });
});

dropdownBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  if (dropdownBtn.classList.contains('toolbar-btn--dropdown-empty')) return;

  if (dropdownMenu.hidden) {
    openDropdown();
  } else {
    closeDropdown();
  }
});

document.addEventListener('click', () => {
  if (!dropdownMenu.hidden) {
    closeDropdown();
  }
});

dropdownMenu.addEventListener('click', (event) => {
  event.stopPropagation();
});

modalCancel.addEventListener('click', closeModal);
modalSave.addEventListener('click', handleSave);
iconFileInput.addEventListener('change', handleCustomIconSelect);
iconPreview.addEventListener('click', resetModalIconToDefault);

siteUrlInput.addEventListener('blur', () => {
  const url = siteUrlInput.value.trim();
  if (url) {
    refreshModalIconFromUrl(url);
  }
});

modalDialog.addEventListener('click', (event) => {
  event.stopPropagation();
});

modalOverlay.addEventListener('click', closeModal);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (!modalOverlay.hidden) {
      closeModal();
    } else if (!dropdownMenu.hidden) {
      closeDropdown();
    }
  }
});

async function registerSidebarEmbedContext(url, requestMobile = false) {
  const ua = navigator.userAgent;

  try {
    const rules = globalThis.SidebarEmbedRules;

    if (rules?.registerSidebarEmbedContext) {
      await rules.registerSidebarEmbedContext(-1, url || '', ua, requestMobile);
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: 'REGISTER_SIDEBAR_EMBED',
      tabId: -1,
      url: url || '',
      userAgent: ua,
      requestMobile,
    });
    if (response && !response.ok) {
      console.warn('[便捷边栏] 注册嵌入规则失败:', response.error);
    }
  } catch (error) {
    console.warn('[便捷边栏] 注册嵌入规则失败:', error);
  }
}

async function init() {
  const { settings, shortcuts } = await loadAppState();
  currentSettings = settings;

  const { shortcuts: homeMigrated, changed: homeChanged } = migrateHomeShortcuts(shortcuts);
  const { shortcuts: withDefault, changed: defaultChanged } =
    SidebarHome.ensureDefaultShortcuts(homeMigrated);
  const workingShortcuts = withDefault;

  const normalized = normalizeShortcutOrder(workingShortcuts);
  renderUI(normalized);

  if (homeChanged || defaultChanged) {
    await saveShortcuts(normalized);
  }

  migrateLegacyShortcutIcons(workingShortcuts)
    .then(async ({ shortcuts: migrated, changed }) => {
      if (!changed) return;
      const next = normalizeShortcutOrder(migrated);
      await saveShortcuts(next);
      renderUI(next);
    })
    .catch((error) => {
      console.warn('[便捷边栏] 迁移快捷访问图标失败:', error);
    });

  registerSidebarEmbedContext().catch((error) => {
    console.warn('[便捷边栏] 初始化嵌入规则失败:', error);
  });
  applyToolbarIcon(currentSettings).catch(() => {});

  await applyStartupView(currentSettings);
}

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    handleSearchSubmit();
  }
});

embedFallbackOpenTab.addEventListener('click', () => {
  if (embedFallbackUrl) {
    navigateToUrl(embedFallbackUrl);
  }
});

init();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    refreshUI();
  }
  if (area === 'local' && changes[SETTINGS_KEY]) {
    currentSettings = { ...DEFAULT_SETTINGS, ...(changes[SETTINGS_KEY].newValue || {}) };
    applyStartupView(currentSettings).catch(() => {});
  }
});
