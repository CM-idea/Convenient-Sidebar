const SidebarBackup = {
  FORMAT: 'convenient-sidebar-backup',
  VERSION: 1,

  create(settings, shortcuts, display = {}) {
    const { shortcuts: protectedShortcuts } = SidebarHome.ensureDefaultShortcuts(shortcuts);
    return {
      format: this.FORMAT,
      version: this.VERSION,
      exportedAt: new Date().toISOString(),
      settings,
      shortcuts: protectedShortcuts,
      display: {
        mode: display.mode === 'floating' ? 'floating' : 'docked',
        width: Number.isFinite(display.width) ? Math.max(160, Math.min(4096, display.width)) : 420,
      },
    };
  },

  parse(text, defaults) {
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('文件不是有效的 JSON。'); }
    if (data?.format !== this.FORMAT || data.version !== this.VERSION ||
        !data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings) ||
        !Array.isArray(data.shortcuts)) {
      throw new Error('不是本扩展支持的备份文件。');
    }
    if (data.shortcuts.length > 500) throw new Error('备份中的快捷访问数量过多。');

    const source = data.settings;
    const string = (key) => typeof source[key] === 'string' ? source[key] : defaults[key];
    const oneOf = (key, choices) => choices.includes(source[key]) ? source[key] : defaults[key];
    const settings = {
      startupPage: oneOf('startupPage', ['quickAccess', 'custom']),
      startupCustomUrl: string('startupCustomUrl'),
      loadMode: oneOf('loadMode', ['sidebar', 'browser']),
      searchEngine: oneOf('searchEngine', ['google', 'bing', 'baidu', 'custom']),
      searchCustomTemplate: string('searchCustomTemplate'),
      iconTheme: oneOf('iconTheme', ['light', 'dark', 'custom']),
      iconCustomUrl: this.safeImage(source.iconCustomUrl),
    };

    const ids = new Set(['bm-default-home']);
    const shortcuts = data.shortcuts.map((item, index) => {
      if (!item || typeof item !== 'object' ||
          typeof item.title !== 'string' || !item.title.trim() ||
          typeof item.url !== 'string') {
        throw new Error(`第 ${index + 1} 条快捷访问无效。`);
      }
      if (SidebarHome.isHomeUrl(item.url)) {
        return { ...SidebarHome.createDefaultShortcut(),
          order: Number.isFinite(item.order) ? item.order : index };
      }

      let url;
      try { url = new URL(item.url); } catch { throw new Error(`第 ${index + 1} 条网址无效。`); }
      if (!['https:', 'http:'].includes(url.protocol)) {
        throw new Error(`第 ${index + 1} 条网址需要使用 HTTP 或 HTTPS。`);
      }
      let id = typeof item.id === 'string' && item.id ? item.id : `bm-import-${index}`;
      if (ids.has(id)) id = `bm-import-${index}`;
      ids.add(id);
      return {
        id,
        title: item.title.trim(),
        url: url.href,
        iconUrl: this.safeShortcutIcon(item.iconUrl),
        requestMobile: item.requestMobile === true,
        createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
        order: Number.isFinite(item.order) ? item.order : index,
      };
    });

    const display = data.display && typeof data.display === 'object' && !Array.isArray(data.display)
      ? {
          mode: data.display.mode === 'floating' ? 'floating' : 'docked',
          width: Number.isFinite(data.display.width)
            ? Math.max(160, Math.min(4096, data.display.width)) : 420,
        }
      : null; // Previous backups keep the current display preference.
    return { settings, shortcuts: SidebarHome.ensureDefaultShortcuts(shortcuts).shortcuts, display };
  },

  safeImage(value) {
    return typeof value === 'string' &&
      /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(value) &&
      value.length <= 750000 ? value : '';
  },

  safeShortcutIcon(value) {
    const embedded = this.safeImage(value);
    if (embedded) return embedded;
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  },
};

globalThis.SidebarBackup = SidebarBackup;
