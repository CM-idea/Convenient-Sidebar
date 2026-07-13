const SETTINGS_KEY = 'settings';
const SHORTCUTS_KEY = 'shortcuts';

const DRAG_ICON_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none"><circle cx="5.5" cy="4" r="1.25" fill="currentColor"/><circle cx="10.5" cy="4" r="1.25" fill="currentColor"/><circle cx="5.5" cy="8" r="1.25" fill="currentColor"/><circle cx="10.5" cy="8" r="1.25" fill="currentColor"/><circle cx="5.5" cy="12" r="1.25" fill="currentColor"/><circle cx="10.5" cy="12" r="1.25" fill="currentColor"/></svg>';
const PLUS_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M12 5V19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const CLOSE_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M8 8L16 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16 8L8 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

const DEFAULT_SETTINGS = {
  startupPage: 'quickAccess',
  startupCustomUrl: '',
  loadMode: 'sidebar',
  searchEngine: 'google',
  searchCustomTemplate: '',
  iconTheme: 'light',
  iconCustomUrl: '',
};

const settingsNavItems = document.querySelectorAll('.options-nav__item');
const settingsPanels = document.querySelectorAll('.options-panel');
const startupCustomUrlInput = document.getElementById('startup-custom-url');
const searchCustomTemplateInput = document.getElementById('search-custom-template');
const bookmarkListEl = document.getElementById('bookmark-list');
const bookmarkModalOverlay = document.getElementById('bookmark-edit-modal');
const bookmarkModalDialog = bookmarkModalOverlay.querySelector('.modal');
const bookmarkModalCancel = document.getElementById('bookmark-modal-cancel');
const bookmarkModalSave = document.getElementById('bookmark-modal-save');
const bookmarkModalTitleInput = document.getElementById('bookmark-modal-title');
const bookmarkModalUrlInput = document.getElementById('bookmark-modal-url');
const bookmarkModalMobileInput = document.getElementById('bookmark-modal-mobile');
const bookmarkIconPreview = document.getElementById('bookmark-icon-preview');
const bookmarkIconPreviewImg = document.getElementById('bookmark-icon-preview-img');
const bookmarkIconFileInput = document.getElementById('bookmark-icon-file-input');
const bookmarkIconHint = document.getElementById('bookmark-icon-hint');
const optionsVersionEl = document.getElementById('options-version');
const iconThemeCustomFileInput = document.getElementById('icon-theme-custom-file');
const iconThemeCustomPreviewImg = document.getElementById('icon-theme-custom-preview-img');
const iconThemeCustomPreview = document.getElementById('icon-theme-custom-preview');

if (optionsVersionEl) {
  optionsVersionEl.textContent = `V ${chrome.runtime.getManifest().version}`;
}

function updateCustomIconThemePreview(iconUrl) {
  const placeholder = iconThemeCustomPreview?.querySelector('.options-icon-preview__placeholder');
  if (!iconThemeCustomPreviewImg) return;

  if (iconUrl) {
    iconThemeCustomPreviewImg.src = iconUrl;
    iconThemeCustomPreviewImg.hidden = false;
    placeholder?.setAttribute('hidden', '');
  } else {
    iconThemeCustomPreviewImg.hidden = true;
    iconThemeCustomPreviewImg.removeAttribute('src');
    placeholder?.removeAttribute('hidden');
  }
}

async function applyToolbarIconSettings(settings) {
  await applyToolbarIcon({
    iconTheme: settings.iconTheme,
    iconCustomUrl: settings.iconCustomUrl || '',
  });
}

async function saveCustomToolbarIcon(dataUrl) {
  const settings = await loadSettings();
  settings.iconCustomUrl = dataUrl;
  await saveSettings(settings);
  updateCustomIconThemePreview(dataUrl);

  if (settings.iconTheme === 'custom') {
    await applyToolbarIconSettings(settings);
  }
}

async function handleCustomIconThemeFileSelect(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  try {
    const dataUrl = await IconStore.readImageFileAsDataUrl(file);
    await saveCustomToolbarIcon(dataUrl);
  } catch (error) {
    window.alert(error.message || '图标上传失败，请重试');
  }
}

function openCustomIconThemeFilePicker() {
  iconThemeCustomFileInput?.click();
}

iconThemeCustomFileInput?.addEventListener('change', handleCustomIconThemeFileSelect);

iconThemeCustomPreview?.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  openCustomIconThemeFilePicker();
});

document.getElementById('icon-theme-custom-upload-text')?.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  openCustomIconThemeFilePicker();
});

let bookmarkRows = [];
let bookmarkSaveTimer = null;
let dragSourceIndex = null;
let editingBookmarkIndex = null;
let bookmarkModalMode = 'edit';
let bookmarkModalIconUrl = '';
let bookmarkModalHasCustomIcon = false;

function setBookmarkModalMode(mode) {
  bookmarkModalMode = mode;
  bookmarkModalSave.textContent = mode === 'add' ? '添加' : '修改';
}

function setBookmarkModalIconPreview(iconUrl) {
  bookmarkModalIconUrl = iconUrl || '';
  bookmarkIconPreview.classList.toggle('icon-preview--custom', bookmarkModalHasCustomIcon);
  if (bookmarkModalIconUrl) {
    bookmarkIconPreviewImg.src = bookmarkModalIconUrl;
    bookmarkIconPreviewImg.hidden = false;
  } else {
    bookmarkIconPreviewImg.hidden = true;
    bookmarkIconPreviewImg.removeAttribute('src');
  }
}

function updateBookmarkModalIconHint() {
  if (!bookmarkIconHint) return;
  bookmarkIconHint.textContent = bookmarkModalHasCustomIcon
    ? '已使用自定义图标，点击左侧图标可恢复默认'
    : '支持自定义图标，不上传则使用站点默认';
}

async function refreshBookmarkModalIconFromUrl(url, remoteIconUrl = '') {
  if (!url || bookmarkModalHasCustomIcon) return;

  if (SidebarHome.isHomeInput(url) || SidebarHome.isHomeUrl(url)) {
    setBookmarkModalIconPreview(SidebarHome.getIconUrl());
    return;
  }

  try {
    const normalizedUrl = normalizeUrl(url);
    const iconUrl = await IconStore.downloadShortcutIcon(normalizedUrl, remoteIconUrl);
    setBookmarkModalIconPreview(iconUrl);
  } catch {
    setBookmarkModalIconPreview('');
  }
}

async function handleBookmarkModalIconSelect(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  try {
    const dataUrl = await IconStore.readImageFileAsDataUrl(file);
    bookmarkModalHasCustomIcon = true;
    setBookmarkModalIconPreview(dataUrl);
    updateBookmarkModalIconHint();
  } catch (error) {
    window.alert(error.message || '图标上传失败，请重试');
  }
}

async function resetBookmarkModalIconToDefault() {
  if (!bookmarkModalHasCustomIcon) return;

  bookmarkModalHasCustomIcon = false;
  updateBookmarkModalIconHint();

  const url = bookmarkModalUrlInput.value.trim();
  if (url) {
    await refreshBookmarkModalIconFromUrl(url);
  } else {
    setBookmarkModalIconPreview('');
  }
}

function closeBookmarkEditModal() {
  bookmarkModalOverlay.hidden = true;
  editingBookmarkIndex = null;
  bookmarkModalMode = 'edit';
  bookmarkModalHasCustomIcon = false;
  setBookmarkModalIconPreview('');
  updateBookmarkModalIconHint();
  setBookmarkModalMode('edit');
  if (bookmarkModalMobileInput) bookmarkModalMobileInput.checked = false;
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

async function openBookmarkAddModal() {
  setBookmarkModalMode('add');
  editingBookmarkIndex = null;
  bookmarkModalHasCustomIcon = false;

  bookmarkModalTitleInput.value = '';
  bookmarkModalUrlInput.value = '';
  if (bookmarkModalMobileInput) bookmarkModalMobileInput.checked = false;
  setBookmarkModalIconPreview('');
  updateBookmarkModalIconHint();

  try {
    const tab = await queryActiveBrowserTab();
    const tabUrl = tab?.url || '';
    if (tabUrl && /^https?:\/\//i.test(tabUrl)) {
      bookmarkModalTitleInput.value = tab.title || '';
      bookmarkModalUrlInput.value = tabUrl;
      await refreshBookmarkModalIconFromUrl(tabUrl, tab.favIconUrl);
    }
  } catch {
    // ignore tab query errors
  }

  bookmarkModalOverlay.hidden = false;
  bookmarkModalTitleInput.focus();
}

async function openBookmarkEditModal(index) {
  const row = bookmarkRows[index];
  if (!row) return;

  setBookmarkModalMode('edit');
  editingBookmarkIndex = index;
  bookmarkModalHasCustomIcon = IconStore.isLocalIcon(row.iconUrl);

  bookmarkModalTitleInput.value = row.title;
  bookmarkModalUrlInput.value = SidebarHome.formatUrlForDisplay(row.url);
  if (bookmarkModalMobileInput) bookmarkModalMobileInput.checked = Boolean(row.requestMobile);
  updateBookmarkModalIconHint();

  if (bookmarkModalHasCustomIcon) {
    setBookmarkModalIconPreview(row.iconUrl);
  } else if (row.url.trim()) {
    setBookmarkModalIconPreview('');
    await refreshBookmarkModalIconFromUrl(row.url);
  } else {
    setBookmarkModalIconPreview('');
  }

  bookmarkModalOverlay.hidden = false;
  bookmarkModalTitleInput.focus();
}

async function handleBookmarkModalSave() {
  let title = bookmarkModalTitleInput.value.trim();
  const url = bookmarkModalUrlInput.value.trim();

  if (!url) {
    bookmarkModalUrlInput.focus();
    return;
  }

  let normalizedUrl;
  if (SidebarHome.isHomeInput(url)) {
    normalizedUrl = SidebarHome.URL;
    if (!title) title = SidebarHome.DEFAULT_TITLE;
  } else {
    if (!title) {
      bookmarkModalTitleInput.focus();
      return;
    }

    try {
      normalizedUrl = normalizeUrl(url);
    } catch {
      bookmarkModalUrlInput.focus();
      return;
    }
  }

  bookmarkModalSave.disabled = true;

  try {
    let iconUrl = bookmarkModalIconUrl;
    if (SidebarHome.isHomeUrl(normalizedUrl)) {
      iconUrl = SidebarHome.getIconUrl();
    } else if (!IconStore.isLocalIcon(iconUrl)) {
      iconUrl = await IconStore.downloadShortcutIcon(normalizedUrl, bookmarkModalIconUrl);
    }

    if (bookmarkModalMode === 'add') {
      bookmarkRows.push({
        id: `bm-${Date.now()}`,
        title,
        url: normalizedUrl,
        iconUrl,
        requestMobile: Boolean(bookmarkModalMobileInput?.checked),
        createdAt: Date.now(),
        order: bookmarkRows.length,
      });
    } else if (editingBookmarkIndex != null) {
      bookmarkRows[editingBookmarkIndex] = {
        ...bookmarkRows[editingBookmarkIndex],
        title,
        url: normalizedUrl,
        iconUrl,
        requestMobile: Boolean(bookmarkModalMobileInput?.checked),
      };
    }

    closeBookmarkEditModal();
    renderBookmarkList();
    await persistQuickAccessRows(bookmarkRows);
  } finally {
    bookmarkModalSave.disabled = false;
  }
}

bookmarkModalCancel.addEventListener('click', closeBookmarkEditModal);
bookmarkModalSave.addEventListener('click', handleBookmarkModalSave);
bookmarkIconFileInput.addEventListener('change', handleBookmarkModalIconSelect);
bookmarkIconPreview.addEventListener('click', resetBookmarkModalIconToDefault);

bookmarkModalUrlInput.addEventListener('blur', () => {
  const url = bookmarkModalUrlInput.value.trim();
  if (!url) return;

  if (SidebarHome.isHomeInput(url)) {
    if (!bookmarkModalTitleInput.value.trim()) {
      bookmarkModalTitleInput.value = SidebarHome.DEFAULT_TITLE;
    }
    refreshBookmarkModalIconFromUrl(url);
    return;
  }

  refreshBookmarkModalIconFromUrl(url);
});

bookmarkModalDialog.addEventListener('click', (event) => {
  event.stopPropagation();
});

bookmarkModalOverlay.addEventListener('click', closeBookmarkEditModal);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !bookmarkModalOverlay.hidden) {
    closeBookmarkEditModal();
  }
});

async function loadSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) };
}

async function saveSettings(settings) {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

function applySettingsToForm(settings) {
  document.querySelectorAll('input[name="startup-page"]').forEach((input) => {
    input.checked = input.value === settings.startupPage;
  });
  startupCustomUrlInput.value = settings.startupCustomUrl || '';

  document.querySelectorAll('input[name="load-mode"]').forEach((input) => {
    input.checked = input.value === (settings.loadMode || 'sidebar');
  });

  document.querySelectorAll('input[name="search-engine"]').forEach((input) => {
    input.checked = input.value === settings.searchEngine;
  });
  searchCustomTemplateInput.value = settings.searchCustomTemplate || '';

  document.querySelectorAll('input[name="icon-theme"]').forEach((input) => {
    input.checked = input.value === (settings.iconTheme || 'light');
  });
  updateCustomIconThemePreview(settings.iconCustomUrl || '');
}

async function applyExtensionIconTheme(theme) {
  const settings = await loadSettings();
  settings.iconTheme = normalizeIconTheme(theme);
  await saveSettings(settings);
  updateCustomIconThemePreview(settings.iconCustomUrl || '');

  try {
    await applyToolbarIconSettings(settings);
  } catch (error) {
    console.error('切换工具栏扩展图标失败:', error);
  }
}

async function collectSettingsFromForm() {
  const startupPage = document.querySelector('input[name="startup-page"]:checked')?.value || 'quickAccess';
  const loadMode = document.querySelector('input[name="load-mode"]:checked')?.value || 'sidebar';
  const searchEngine = document.querySelector('input[name="search-engine"]:checked')?.value || 'google';
  const iconTheme = document.querySelector('input[name="icon-theme"]:checked')?.value || 'light';
  const currentSettings = await loadSettings();

  return {
    startupPage,
    startupCustomUrl: startupCustomUrlInput.value.trim(),
    loadMode: loadMode === 'browser' ? 'browser' : 'sidebar',
    searchEngine,
    searchCustomTemplate: searchCustomTemplateInput.value.trim(),
    iconTheme,
    iconCustomUrl: currentSettings.iconCustomUrl || '',
  };
}

async function persistSettingsFromForm() {
  const settings = await collectSettingsFromForm();
  await saveSettings(settings);
}

function switchSettingsTab(tabId) {
  settingsNavItems.forEach((item) => {
    item.classList.toggle('options-nav__item--active', item.dataset.tab === tabId);
  });
  settingsPanels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tabId;
  });

  if (tabId === 'bookmark') {
    loadShortcuts().then((shortcuts) => {
      bookmarkRows = buildBookmarkRowsFromStorage(shortcuts);
      renderBookmarkList();
    });
  }
}

settingsNavItems.forEach((item) => {
  item.addEventListener('click', () => {
    switchSettingsTab(item.dataset.tab);
  });
});

document.querySelectorAll('input[name="startup-page"], input[name="load-mode"], input[name="search-engine"]').forEach((input) => {
  input.addEventListener('change', persistSettingsFromForm);
});

document.querySelectorAll('input[name="icon-theme"]').forEach((input) => {
  input.addEventListener('change', () => {
    if (!input.checked) return;
    void applyExtensionIconTheme(input.value);
  });
});

startupCustomUrlInput.addEventListener('focus', () => {
  document.querySelector('input[name="startup-page"][value="custom"]').checked = true;
});

startupCustomUrlInput.addEventListener('change', () => {
  document.querySelector('input[name="startup-page"][value="custom"]').checked = true;
  persistSettingsFromForm();
});

searchCustomTemplateInput.addEventListener('focus', () => {
  document.querySelector('input[name="search-engine"][value="custom"]').checked = true;
});

searchCustomTemplateInput.addEventListener('change', () => {
  document.querySelector('input[name="search-engine"][value="custom"]').checked = true;
  persistSettingsFromForm();
});

loadSettings().then(async (settings) => {
  applySettingsToForm(settings);
  try {
    await applyToolbarIconSettings(settings);
  } catch (error) {
    console.error('恢复工具栏扩展图标失败:', error);
  }
});
initBookmarkSettings();

function resolveBookmarkIcon(row) {
  if (SidebarHome.isHomeUrl(row?.url)) {
    return SidebarHome.getIconUrl();
  }
  return IconStore.resolveDisplayIcon(row?.iconUrl);
}

async function ensureLocalBookmarkIcon(row) {
  if (SidebarHome.isHomeUrl(row.url)) {
    return SidebarHome.getIconUrl();
  }

  if (!row.url.trim() || IconStore.isLocalIcon(row.iconUrl)) {
    return row.iconUrl || '';
  }

  try {
    const normalizedUrl = normalizeUrl(row.url);
    const iconUrl = await IconStore.downloadShortcutIcon(normalizedUrl, row.iconUrl);
    return iconUrl || '';
  } catch {
    return row.iconUrl || '';
  }
}

async function enrichBookmarkRowsWithLocalIcons(rows) {
  const next = [];

  for (const row of rows) {
    if (isRowEmpty(row)) {
      next.push(row);
      continue;
    }

    const iconUrl = await ensureLocalBookmarkIcon(row);
    next.push({ ...row, iconUrl });
  }

  return next;
}

function createBookmarkRowFromItem(item) {
  return {
    id: item.id,
    title: item.title || '',
    url: item.url || '',
    iconUrl: item.iconUrl || '',
    requestMobile: Boolean(item.requestMobile),
    createdAt: item.createdAt || Date.now(),
    order: item.order ?? 0,
  };
}

function buildBookmarkRowsFromStorage(shortcuts) {
  return sortShortcuts(shortcuts)
    .filter((item) => item.url?.trim())
    .map(createBookmarkRowFromItem);
}

async function loadShortcuts() {
  const result = await chrome.storage.local.get(SHORTCUTS_KEY);
  return result[SHORTCUTS_KEY] || [];
}

async function saveShortcuts(shortcuts) {
  await chrome.storage.local.set({ [SHORTCUTS_KEY]: shortcuts });
}

function normalizeUrl(url) {
  let value = String(url || '').trim();
  if (!value) return '';
  const homeUrl = SidebarHome.resolveUrlInput(value);
  if (homeUrl) return homeUrl;
  if (SidebarHome.isHomeUrl(value)) return SidebarHome.URL;
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  return new URL(value).href;
}

function isRowEmpty(row) {
  return !row.title.trim() && !row.url.trim();
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

function normalizeShortcutOrder(shortcuts) {
  return sortShortcuts(shortcuts).map((item, index) => {
    const entry = { ...item, order: index };
    if (index < TOOLBAR_SLOT_COUNT) {
      entry.slotIndex = index;
    } else {
      delete entry.slotIndex;
    }
    return entry;
  });
}

function serializeBookmarkRows(rows) {
  return rows
    .filter((row) => !isRowEmpty(row))
    .map((row, index) => {
      const title = row.title.trim();
      const url = row.url.trim();
      if (!title || !url) return null;

      try {
        const normalizedUrl = normalizeUrl(url);

        return {
          id: row.id.startsWith('draft-') ? `bm-${Date.now()}-${index}` : row.id,
          title,
          url: normalizedUrl,
          iconUrl: IconStore.isLocalIcon(row.iconUrl) ? row.iconUrl : '',
          requestMobile: Boolean(row.requestMobile),
          createdAt: row.createdAt || Date.now(),
          order: index,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function persistQuickAccessRows(rows) {
  const filledRows = rows.filter((row) => row.url.trim());
  const withIcons = await enrichBookmarkRowsWithLocalIcons(filledRows);
  bookmarkRows = withIcons;
  await saveShortcuts(normalizeShortcutOrder(serializeBookmarkRows(withIcons)));
}

function scheduleBookmarkSave() {
  clearTimeout(bookmarkSaveTimer);
  bookmarkSaveTimer = setTimeout(async () => {
    await persistQuickAccessRows(bookmarkRows);
  }, 300);
}

function renderBookmarkIconCell(cell, row) {
  cell.innerHTML = '';
  const iconUrl = resolveBookmarkIcon(row);

  if (iconUrl) {
    const img = document.createElement('img');
    img.src = iconUrl;
    img.alt = '';
    cell.appendChild(img);
    return;
  }

  cell.textContent = row.title.trim() ? row.title.trim().charAt(0).toUpperCase() : '图标';
}

function renderBookmarkList() {
  bookmarkListEl.innerHTML = '';

  const visibleRows = bookmarkRows.filter((row) => row.url.trim());

  if (visibleRows.length === 0) {
    bookmarkListEl.appendChild(createBookmarkAddButtonRow());
    return;
  }

  visibleRows.forEach((row, index) => {
    const sourceIndex = bookmarkRows.indexOf(row);
    const isLast = index === visibleRows.length - 1;
    const rowEl = document.createElement('div');
    rowEl.className = 'bookmark-row';
    rowEl.dataset.index = String(index);

    const mainEl = document.createElement('div');
    mainEl.className = 'bookmark-row__main';
    mainEl.draggable = true;

    let canDragRow = false;

    const mainElMouseDown = (event) => {
      canDragRow = !event.target.closest(
        'input, .bookmark-row__remove, .bookmark-row__add, .bookmark-row__icon'
      );
    };

    mainEl.addEventListener('mousedown', mainElMouseDown);

    const indexEl = document.createElement('span');
    indexEl.className = 'bookmark-row__index';
    indexEl.textContent = String(index + 1);

    const iconEl = document.createElement('div');
    iconEl.className = 'bookmark-row__icon';
    iconEl.title = '点击修改图标';
    renderBookmarkIconCell(iconEl, row);
    iconEl.addEventListener('click', (event) => {
      event.stopPropagation();
      openBookmarkEditModal(sourceIndex);
    });

    const titleInput = document.createElement('input');
    titleInput.className = 'bookmark-row__title';
    titleInput.type = 'text';
    titleInput.placeholder = '请输入标题';
    titleInput.value = row.title;
    titleInput.addEventListener('mousedown', () => {
      canDragRow = false;
    });
    titleInput.addEventListener('input', () => {
      bookmarkRows[sourceIndex].title = titleInput.value;
      scheduleBookmarkSave();
    });

    const urlWrap = document.createElement('div');
    urlWrap.className = 'bookmark-row__url-wrap';

    const urlInput = document.createElement('input');
    urlInput.className = 'bookmark-row__url';
    urlInput.type = 'text';
    urlInput.placeholder = '请输入网址';
    urlInput.value = SidebarHome.formatUrlForDisplay(row.url);
    urlInput.addEventListener('mousedown', () => {
      canDragRow = false;
    });
    urlInput.addEventListener('input', () => {
      bookmarkRows[sourceIndex].url = urlInput.value;
      renderBookmarkIconCell(iconEl, bookmarkRows[sourceIndex]);
      scheduleBookmarkSave();
    });
    urlInput.addEventListener('blur', async () => {
      const value = urlInput.value.trim();
      if (!value) return;
      try {
        const normalized = normalizeUrl(value);
        bookmarkRows[sourceIndex].url = normalized;
        urlInput.value = SidebarHome.formatUrlForDisplay(normalized);

        if (SidebarHome.isHomeUrl(normalized)) {
          if (!bookmarkRows[sourceIndex].title.trim()) {
            bookmarkRows[sourceIndex].title = SidebarHome.DEFAULT_TITLE;
            titleInput.value = SidebarHome.DEFAULT_TITLE;
          }
          bookmarkRows[sourceIndex].iconUrl = SidebarHome.getIconUrl();
        } else {
          bookmarkRows[sourceIndex].iconUrl = await IconStore.downloadShortcutIcon(
            normalized,
            bookmarkRows[sourceIndex].iconUrl
          );
        }

        renderBookmarkIconCell(iconEl, bookmarkRows[sourceIndex]);
        scheduleBookmarkSave();
      } catch {
        urlInput.focus();
      }
    });

    const dragBtn = document.createElement('button');
    dragBtn.className = 'bookmark-row__drag';
    dragBtn.type = 'button';
    dragBtn.setAttribute('aria-label', '拖拽排序');
    dragBtn.innerHTML = DRAG_ICON_SVG;

    urlWrap.appendChild(urlInput);
    urlWrap.appendChild(dragBtn);

    mainEl.appendChild(indexEl);
    mainEl.appendChild(iconEl);
    mainEl.appendChild(titleInput);
    mainEl.appendChild(urlWrap);
    rowEl.appendChild(mainEl);

    const actionsEl = document.createElement('div');
    actionsEl.className = 'bookmark-row__actions';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'bookmark-row__remove';
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', '删除快捷访问');
    removeBtn.innerHTML = CLOSE_ICON_SVG;
    removeBtn.addEventListener('click', async () => {
      bookmarkRows.splice(sourceIndex, 1);
      renderBookmarkList();
      await persistQuickAccessRows(bookmarkRows);
    });
    actionsEl.appendChild(removeBtn);

    if (isLast) {
      actionsEl.appendChild(createBookmarkAddButton());
    }

    rowEl.appendChild(actionsEl);

    mainEl.addEventListener('dragstart', (event) => {
      if (!canDragRow || event.target.closest('input')) {
        event.preventDefault();
        return;
      }
      dragSourceIndex = sourceIndex;
      rowEl.classList.add('bookmark-row--dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    });

    mainEl.addEventListener('dragend', () => {
      canDragRow = false;
      dragSourceIndex = null;
      rowEl.classList.remove('bookmark-row--dragging');
      bookmarkListEl.querySelectorAll('.bookmark-row--drag-over').forEach((el) => {
        el.classList.remove('bookmark-row--drag-over');
      });
    });

    rowEl.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (dragSourceIndex !== null && dragSourceIndex !== sourceIndex) {
        rowEl.classList.add('bookmark-row--drag-over');
      }
    });

    rowEl.addEventListener('dragleave', () => {
      rowEl.classList.remove('bookmark-row--drag-over');
    });

    rowEl.addEventListener('drop', (event) => {
      event.preventDefault();
      rowEl.classList.remove('bookmark-row--drag-over');
      const fromIndex = dragSourceIndex ?? Number(event.dataTransfer.getData('text/plain'));
      const toIndex = sourceIndex;
      if (Number.isNaN(fromIndex) || fromIndex === toIndex) return;

      const [moved] = bookmarkRows.splice(fromIndex, 1);
      bookmarkRows.splice(toIndex, 0, moved);
      renderBookmarkList();
      persistQuickAccessRows(bookmarkRows);
    });

    bookmarkListEl.appendChild(rowEl);
  });
}

function createBookmarkAddButton() {
  const addBtn = document.createElement('button');
  addBtn.className = 'bookmark-row__add';
  addBtn.type = 'button';
  addBtn.setAttribute('aria-label', '添加快捷访问');
  addBtn.innerHTML = PLUS_ICON_SVG;
  addBtn.addEventListener('click', openBookmarkAddModal);
  return addBtn;
}

function createBookmarkAddButtonRow() {
  const rowEl = document.createElement('div');
  rowEl.className = 'bookmark-row bookmark-row--add-only';

  const actionsEl = document.createElement('div');
  actionsEl.className = 'bookmark-row__actions bookmark-row__actions--add-only';
  actionsEl.appendChild(createBookmarkAddButton());
  rowEl.appendChild(actionsEl);

  return rowEl;
}

async function initBookmarkSettings() {
  let shortcuts = await loadShortcuts();

  const { shortcuts: homeMigrated, changed: homeChanged } = SidebarHome.migrateShortcuts(shortcuts);
  const { shortcuts: withDefault, changed: defaultChanged } =
    SidebarHome.ensureDefaultShortcuts(homeMigrated);
  shortcuts = withDefault;

  if (homeChanged || defaultChanged) {
    await saveShortcuts(normalizeShortcutOrder(shortcuts));
  }

  const migrated = await IconStore.migrateShortcutIcons(shortcuts);
  if (migrated.changed) {
    await saveShortcuts(normalizeShortcutOrder(migrated.shortcuts));
    shortcuts = migrated.shortcuts;
  }

  bookmarkRows = buildBookmarkRowsFromStorage(shortcuts);
  renderBookmarkList();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[SHORTCUTS_KEY]) return;
    const bookmarkPanel = document.querySelector('[data-panel="bookmark"]');
    if (bookmarkPanel?.hidden) return;
    if (bookmarkListEl.contains(document.activeElement)) return;

    bookmarkRows = buildBookmarkRowsFromStorage(changes[SHORTCUTS_KEY].newValue || []);
    renderBookmarkList();
  });
}
