const SIDEBAR_HOME_URL = 'sidebar-home://quick-access';
const SIDEBAR_HOME_INPUT = 'home';
const SIDEBAR_HOME_DEFAULT_TITLE = '主页';

const SidebarHome = {
  URL: SIDEBAR_HOME_URL,
  INPUT: SIDEBAR_HOME_INPUT,
  DEFAULT_TITLE: SIDEBAR_HOME_DEFAULT_TITLE,

  isHomeInput(value) {
    return String(value || '').trim().toLowerCase() === SIDEBAR_HOME_INPUT;
  },

  isHomeUrl(url) {
    const value = String(url || '').trim();
    if (!value) return false;
    if (value === SIDEBAR_HOME_URL || this.isHomeInput(value)) return true;

    try {
      const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      const parsed = new URL(href);
      return parsed.hostname === 'home' && (parsed.pathname === '/' || parsed.pathname === '');
    } catch {
      return false;
    }
  },

  canonicalizeHomeUrl(url) {
    return this.isHomeUrl(url) ? SIDEBAR_HOME_URL : url;
  },

  resolveUrlInput(value) {
    if (this.isHomeInput(value)) return SIDEBAR_HOME_URL;
    return null;
  },

  formatUrlForDisplay(url) {
    return this.isHomeUrl(url) ? SIDEBAR_HOME_INPUT : String(url || '');
  },

  getIconUrl() {
    return chrome.runtime.getURL('icons/home.svg');
  },

  createHomeIconElement(className = 'toolbar-btn__icon toolbar-btn__icon--home') {
    const img = document.createElement('img');
    img.className = className;
    img.src = this.getIconUrl();
    img.alt = '';
    return img;
  },

  appendHomeIcon(parent, className = 'toolbar-dropdown__icon toolbar-dropdown__icon--home') {
    parent.appendChild(this.createHomeIconElement(className));
  },

  createDefaultShortcut() {
    return {
      id: 'bm-default-home',
      title: SIDEBAR_HOME_DEFAULT_TITLE,
      url: SIDEBAR_HOME_URL,
      iconUrl: this.getIconUrl(),
      createdAt: 0,
      order: 0,
    };
  },

  ensureDefaultShortcuts(shortcuts) {
    const list = Array.isArray(shortcuts) ? shortcuts : [];
    if (list.length > 0) {
      return { shortcuts: list, changed: false };
    }

    return {
      shortcuts: [this.createDefaultShortcut()],
      changed: true,
    };
  },

  migrateShortcuts(shortcuts) {
    let changed = false;
    const list = Array.isArray(shortcuts) ? shortcuts : [];
    const next = list.map((item) => {
      if (!this.isHomeUrl(item.url)) return item;

      const canonical = {
        ...item,
        url: SIDEBAR_HOME_URL,
        title: item.title?.trim() || SIDEBAR_HOME_DEFAULT_TITLE,
        iconUrl: this.getIconUrl(),
      };

      if (
        item.url !== canonical.url ||
        item.title !== canonical.title ||
        item.iconUrl !== canonical.iconUrl
      ) {
        changed = true;
      }

      return canonical;
    });

    return { shortcuts: changed ? next : list, changed };
  },
};

if (typeof globalThis !== 'undefined') {
  globalThis.SidebarHome = SidebarHome;
}
