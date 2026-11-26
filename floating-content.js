// A browser-page overlay; the extension page inside the frame owns its own data and UI.
if (!globalThis.__convenientSidebarFloating) {
  globalThis.__convenientSidebarFloating = true;

  const WIDTH_KEY = 'floatingWidth';
  let host = null;
  let frame = null;
  let width = 420;

  const clamp = (value) => Math.max(Math.min(280, innerWidth - 24), Math.min(value, 850, innerWidth - 24));

  async function saveWidth() {
    try { await chrome.storage.local.set({ [WIDTH_KEY]: width }); } catch { /* page is closing */ }
  }

  function close() {
    host?.remove();
    host = null;
    frame = null;
  }

  async function open() {
    if (host?.isConnected) return;
    const saved = await chrome.storage.local.get(WIDTH_KEY);
    width = clamp(Number(saved[WIDTH_KEY]) || 420);
    if (host?.isConnected) return;

    host = document.createElement('div');
    host.id = 'convenient-sidebar-floating-host';
    host.style.cssText = 'all:initial!important;position:fixed!important;top:0!important;right:0!important;bottom:0!important;z-index:2147483647!important;display:block!important;pointer-events:auto!important;';
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      *,*::before,*::after{box-sizing:border-box}
      .panel{position:relative;display:flex;flex-direction:column;width:var(--width);height:100%;background:white;color:#202124;font:14px system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:-8px 0 32px rgba(0,0,0,.20);border-left:1px solid #d9dce3}
      .header{display:flex;align-items:center;gap:8px;height:52px;min-height:52px;padding:0 12px 0 18px;border-bottom:1px solid #e6e7ea;background:white}
      .title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px;font-weight:600}
      button{border:0;background:transparent;cursor:pointer;color:#454b55;font:inherit}
      button:hover{background:#f0f3f7}
      button:focus-visible,.handle:focus-visible{outline:2px solid #1673d2;outline-offset:-2px}
      .dock{padding:7px 9px;border-radius:6px;font-size:12px;white-space:nowrap}
      .close{width:32px;height:32px;border-radius:6px;font-size:25px;line-height:28px}
      .handle{position:absolute;z-index:1;left:-5px;top:0;bottom:0;width:10px;cursor:ew-resize;touch-action:none}
      iframe{display:block;flex:1;min-height:0;width:100%;border:0;background:white}
    `;
    shadow.appendChild(style);
    const panel = document.createElement('section');
    panel.className = 'panel';
    panel.style.setProperty('--width', `${width}px`);
    panel.setAttribute('aria-label', '便捷边栏悬浮窗口');
    const header = document.createElement('div');
    header.className = 'header';
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = '便捷边栏';
    const dock = document.createElement('button');
    dock.className = 'dock';
    dock.type = 'button';
    dock.textContent = '停靠侧边栏';
    dock.title = '切换到 Edge 侧边栏';
    dock.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'FLOATING_DOCK' }, (reply) => {
        if (chrome.runtime.lastError || !reply?.ok) {
          console.warn('[便捷边栏] 无法打开 Edge 侧边栏', chrome.runtime.lastError || reply?.error);
        }
      });
    });
    const dismiss = document.createElement('button');
    dismiss.className = 'close';
    dismiss.type = 'button';
    dismiss.textContent = '×';
    dismiss.setAttribute('aria-label', '关闭悬浮窗口');
    dismiss.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'FLOATING_DISMISS' });
      close();
    });
    header.append(title, dock, dismiss);

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
      width = clamp(innerWidth - event.clientX);
      panel.style.setProperty('--width', `${width}px`);
    });
    handle.addEventListener('pointerup', (event) => {
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      saveWidth();
    });
    addEventListener('resize', () => {
      if (!host?.isConnected) return;
      panel.style.setProperty('--width', `${clamp(width)}px`);
    });

    frame = document.createElement('iframe');
    frame.src = chrome.runtime.getURL('sidepanel.html?floating=1');
    frame.title = '便捷边栏';
    panel.append(handle, header, frame);
    shadow.appendChild(panel);
    (document.documentElement || document.body).appendChild(host);
  }

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === 'FLOATING_OPEN') {
      open().then(() => respond({ ok: true })).catch((error) => respond({ ok: false, error: String(error) }));
      return true;
    }
    if (message?.type === 'FLOATING_CLOSE') {
      close();
      respond({ ok: true });
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'session' || !changes.floatingWindows) return;
    chrome.runtime.sendMessage({ type: 'FLOATING_STATE' }, (state) => {
      if (chrome.runtime.lastError) return;
      if (state?.open) open().catch(() => {});
      else close();
    });
  });

  chrome.runtime.sendMessage({ type: 'FLOATING_STATE' }, (state) => {
    if (!chrome.runtime.lastError && state?.open) open().catch(() => {});
  });
}
