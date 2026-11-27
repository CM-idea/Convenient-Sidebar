// An always-visible icon rail over normal webpages; the panel opens to its left.
if (!globalThis.__convenientSidebarFloating) {
  globalThis.__convenientSidebarFloating = true;
  const RAIL = 48;
  const HOME_URL = 'sidebar-home://quick-access';
  let host, rail, panel, frame;
  let width = 420;
  let selectedId = null;
  let shortcuts = [];
  let originalPageStyle = null;
  let pageObserver = null;
  let scanTimer = 0;
  const shiftedFixed = new Map();
  const maxWidth = () => Math.max(160, innerWidth - RAIL - 12);
  const clamp = (value) => Math.min(Math.max(value, Math.min(280, maxWidth())), maxWidth());
  const isHome = (item) => item?.url === HOME_URL || item?.url === 'home';

  function resizeHost() {
    if (!host) return;
    const visible = selectedId ? clamp(width) : 0;
    host.style.setProperty('width', `${RAIL + visible}px`, 'important');
    panel.style.setProperty('--panel-width', `${visible}px`);
  }
  function markSelected() {
    rail?.querySelectorAll('[data-shortcut]').forEach((button) => {
      const active = Boolean(selectedId && button.dataset.shortcut === selectedId);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  function hidePanel() {
    selectedId = null;
    frame?.removeAttribute('src');
    if (panel) panel.hidden = true;
    resizeHost();
    markSelected();
  }
  function hideRail() {
    host?.remove();
    host = rail = panel = frame = null;
    selectedId = null;
    restorePageSpace();
  }

  function restoreInline(el, property, old) {
    if (old.value) el.style.setProperty(property, old.value, old.priority);
    else el.style.removeProperty(property);
  }
  function restorePageSpace() {
    pageObserver?.disconnect();
    pageObserver = null;
    clearTimeout(scanTimer);
    scanTimer = 0;
    for (const [el, old] of shiftedFixed) {
      if (el.style.getPropertyValue('right') === old.applied) restoreInline(el, 'right', old);
    }
    shiftedFixed.clear();
    if (!originalPageStyle) return;
    const root = document.documentElement;
    if (root.style.getPropertyValue('width') === originalPageStyle.appliedWidth) {
      restoreInline(root, 'width', originalPageStyle.width);
    }
    if (root.style.getPropertyValue('margin-right') === originalPageStyle.appliedMargin) {
      restoreInline(root, 'margin-right', originalPageStyle.margin);
    }
    originalPageStyle = null;
  }
  function scanFixedAtEdge() {
    if (!host?.isConnected || !document.elementsFromPoint) return;
    const seen = new Set();
    for (let y = 16; y < innerHeight; y += 32) {
      for (const x of [innerWidth - RAIL + 5, innerWidth - RAIL / 2]) {
        for (const hit of document.elementsFromPoint(x, y)) {
          let el = hit;
          while (el && el !== document.body && el !== document.documentElement && el !== host) {
            if (!seen.has(el)) {
              seen.add(el);
              const style = getComputedStyle(el);
              const box = el.getBoundingClientRect();
              if (!shiftedFixed.has(el) && style.position === 'fixed' && style.right !== 'auto' &&
                  box.right > innerWidth - RAIL + 1 && box.right <= innerWidth + 2) {
                const applied = `calc(${style.right} + ${RAIL}px)`;
                shiftedFixed.set(el, {
                  value: el.style.getPropertyValue('right'),
                  priority: el.style.getPropertyPriority('right'),
                  applied,
                });
                el.style.setProperty('right', applied, 'important');
              }
            }
            el = el.parentElement;
          }
        }
      }
    }
  }
  function scheduleFixedScan() {
    if (scanTimer || !host?.isConnected) return;
    scanTimer = setTimeout(() => {
      scanTimer = 0;
      scanFixedAtEdge();
    }, 120);
  }
  function reservePageSpace() {
    if (originalPageStyle) return;
    const root = document.documentElement;
    const appliedWidth = `calc(100% - ${RAIL}px)`;
    const appliedMargin = `${RAIL}px`;
    originalPageStyle = {
      width: { value: root.style.getPropertyValue('width'), priority: root.style.getPropertyPriority('width') },
      margin: { value: root.style.getPropertyValue('margin-right'), priority: root.style.getPropertyPriority('margin-right') },
      appliedWidth,
      appliedMargin,
    };
    root.style.setProperty('width', appliedWidth, 'important');
    root.style.setProperty('margin-right', appliedMargin, 'important');
    pageObserver = new MutationObserver(scheduleFixedScan);
    if (document.body) pageObserver.observe(document.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'],
    });
    scheduleFixedScan();
  }
  function showPanel(id) {
    if (!panel || (id !== '__add__' && id !== 'bm-default-home' &&
      !shortcuts.some((item) => item.id === id))) return;
    if (selectedId === id) { hidePanel(); return; }
    selectedId = id;
    panel.hidden = false;
    resizeHost();
    markSelected();
    frame.src = chrome.runtime.getURL(`sidepanel.html?floating=1&rail=${encodeURIComponent(id)}`);
  }
  function button(label, title, onClick, className = 'rail-button') {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = className;
    el.title = title;
    el.setAttribute('aria-label', title);
    el.textContent = label;
    el.addEventListener('click', onClick);
    return el;
  }
  function renderRail() {
    if (!rail) return;
    const list = rail.querySelector('.rail-list');
    list.replaceChildren();
    const home = shortcuts.find(isHome) || { id: 'bm-default-home', title: '主页', url: HOME_URL };
    for (const item of [home, ...shortcuts.filter((entry) => !isHome(entry))]) {
      const el = button('', item.title, () => showPanel(item.id));
      el.dataset.shortcut = item.id;
      const iconUrl = isHome(item) ? chrome.runtime.getURL('icons/home.svg') : item.iconUrl;
      if (typeof iconUrl === 'string' && /^(?:https?:\/\/|data:image\/|chrome-extension:\/\/)/i.test(iconUrl)) {
        const img = document.createElement('img');
        img.src = iconUrl;
        img.alt = '';
        img.onerror = () => {
          img.remove();
          el.textContent = (item.title || '?').slice(0, 1).toUpperCase();
        };
        el.appendChild(img);
      } else {
        el.textContent = (item.title || '?').slice(0, 1).toUpperCase();
      }
      list.appendChild(el);
    }
    markSelected();
  }
  async function refreshShortcuts() {
    const { shortcuts: stored } = await chrome.storage.local.get('shortcuts');
    shortcuts = (Array.isArray(stored) ? stored : [])
      .filter((item) => item && typeof item.id === 'string' &&
        typeof item.title === 'string' && typeof item.url === 'string')
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    renderRail();
    if (selectedId && selectedId !== '__add__' && !shortcuts.some((item) => item.id === selectedId)) hidePanel();
  }

  async function showRail() {
    if (host?.isConnected) return;
    const saved = await chrome.storage.local.get('floatingWidth');
    width = clamp(Number(saved.floatingWidth) || 420);
    if (host?.isConnected) return;
    host = document.createElement('div');
    host.id = 'convenient-sidebar-floating-host';
    host.style.cssText = 'all:initial!important;position:fixed!important;top:0!important;right:0!important;bottom:0!important;width:48px!important;z-index:2147483647!important;display:block!important;pointer-events:auto!important';
    const shadow = host.attachShadow({ mode: 'closed' });
    const css = document.createElement('style');
    css.textContent = `
      *,*::before,*::after{box-sizing:border-box}
      .rail{position:absolute;right:0;top:0;bottom:0;display:flex;flex-direction:column;width:${RAIL}px;background:#f9fafb;border-left:1px solid #e3e5e8;box-shadow:-2px 0 10px #0000000d;font:14px system-ui,-apple-system,"Segoe UI",sans-serif}
      .rail-list{display:flex;flex:1;flex-direction:column;align-items:center;gap:7px;min-height:0;overflow-y:auto;overflow-x:hidden;padding:10px 3px;scrollbar-width:thin}
      .rail-footer{display:flex;flex-direction:column;align-items:center;gap:5px;padding:9px 3px;border-top:1px solid #e3e5e8}
      button{border:0;color:#5c6778;background:transparent;cursor:pointer;font:inherit}
      button:focus-visible,.handle:focus-visible{outline:2px solid #1673d2;outline-offset:-2px}
      .rail-button{display:flex;flex:none;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;font-size:22px;line-height:1}
      .rail-button:hover,.rail-button.active{background:#e8f1ff;color:#1164b0}
      .rail-button.active{box-shadow:inset 2px 0 #1673d2}
      .rail-button img{width:24px;height:24px;object-fit:contain;border-radius:5px}
      .panel{position:absolute;top:8px;bottom:8px;right:${RAIL}px;display:flex;flex-direction:column;width:var(--panel-width);overflow:visible;background:#fff;color:#202124;font:14px system-ui,-apple-system,"Segoe UI",sans-serif;border:1px solid #d5d9e0;border-radius:12px 0 0 12px;box-shadow:-9px 4px 26px #0003}
      .panel[hidden]{display:none}
      .header{display:flex;align-items:center;gap:8px;height:48px;min-height:48px;padding:0 9px 0 16px;border-bottom:1px solid #e5e7eb}
      .title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:600}
      .dock{padding:6px;border-radius:6px;font-size:12px;white-space:nowrap}
      .refresh{width:30px;height:30px;border-radius:6px;font-size:23px;line-height:1}
      .close{width:30px;height:30px;border-radius:6px;font-size:24px;line-height:1}
      .header button:hover{background:#eef3f8}
      .handle{position:absolute;z-index:2;left:-6px;top:0;bottom:0;width:11px;cursor:ew-resize;touch-action:none}
      iframe{display:block;flex:1;min-height:0;width:100%;border:0;border-radius:0 0 0 12px;background:#fff}
    `;
    shadow.appendChild(css);
    panel = document.createElement('section');
    panel.className = 'panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', '便捷边栏悬浮窗口');
    const header = document.createElement('div');
    header.className = 'header';
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = '便捷边栏';
    const dock = button('停靠', '切换到 Edge 原生侧边栏', () => {
      chrome.runtime.sendMessage({ type: 'FLOATING_DOCK' }, (reply) => {
        if (chrome.runtime.lastError || !reply?.ok) console.warn('[便捷边栏] 停靠失败', chrome.runtime.lastError || reply?.error);
      });
    }, 'dock');
    const reload = button('↻', '刷新悬浮窗口', () => {
      if (frame?.src) frame.src = frame.src;
    }, 'refresh');
    header.append(title, reload, dock, button('×', '关闭悬浮窗口', hidePanel, 'close'));
    const handle = document.createElement('div');
    handle.className = 'handle';
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-label', '拖动调整面板宽度');
    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', (event) => {
      if (!handle.hasPointerCapture(event.pointerId)) return;
      width = clamp(innerWidth - event.clientX - RAIL);
      resizeHost();
    });
    handle.addEventListener('pointerup', (event) => {
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      chrome.storage.local.set({ floatingWidth: width }).catch(() => {});
    });
    frame = document.createElement('iframe');
    frame.title = '便捷边栏';
    panel.append(handle, header, frame);
    rail = document.createElement('aside');
    rail.className = 'rail';
    rail.setAttribute('aria-label', '便捷边栏图标栏');
    const list = document.createElement('div');
    list.className = 'rail-list';
    const footer = document.createElement('div');
    footer.className = 'rail-footer';
    footer.append(
      button('+', '添加快捷访问', () => showPanel('__add__')),
      button('▣', '切换到 Edge 原生侧边栏', () => dock.click()),
      button('×', '隐藏图标栏（点击扩展图标重新打开）', () => {
        chrome.runtime.sendMessage({ type: 'FLOATING_DISMISS' });
        hideRail();
      })
    );
    rail.append(list, footer);
    shadow.append(panel, rail);
    (document.documentElement || document.body).appendChild(host);
    reservePageSpace();
    try { await refreshShortcuts(); }
    catch (error) { hideRail(); throw error; }
  }

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === 'FLOATING_OPEN') {
      showRail().then(() => respond({ ok: true })).catch((error) => respond({ ok: false, error: String(error) }));
      return true;
    }
    if (message?.type === 'FLOATING_CLOSE') {
      hideRail();
      respond({ ok: true });
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.shortcuts) refreshShortcuts().catch(() => {});
    if (area === 'local' && changes.panelDisplayMode) {
      if (changes.panelDisplayMode.newValue !== 'floating') hideRail();
      else chrome.runtime.sendMessage({ type: 'FLOATING_STATE' }, (state) => {
        if (!chrome.runtime.lastError && state?.open) showRail().catch(() => {});
      });
    }
    if (area !== 'session' || !changes.floatingWindows) return;
    chrome.runtime.sendMessage({ type: 'FLOATING_STATE' }, (state) => {
      if (chrome.runtime.lastError) return;
      if (state?.open) showRail().catch(() => {});
      else hideRail();
    });
  });
  chrome.runtime.sendMessage({ type: 'FLOATING_STATE' }, (state) => {
    if (!chrome.runtime.lastError && state?.open) showRail().catch(() => {});
  });
  addEventListener('resize', () => {
    if (host?.isConnected) { resizeHost(); scheduleFixedScan(); }
  });
  addEventListener('scroll', scheduleFixedScan, true);
}
