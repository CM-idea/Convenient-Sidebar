const IconStore = {
  isLocalIcon(iconUrl) {
    return typeof iconUrl === 'string' && iconUrl.startsWith('data:');
  },

  resolveDisplayIcon(iconUrl) {
    if (this.isLocalIcon(iconUrl)) return iconUrl;
    return '';
  },

  buildIconCandidates(siteUrl, remoteIconUrl) {
    const candidates = [];

    if (typeof remoteIconUrl === 'string' && remoteIconUrl.startsWith('data:')) {
      return [remoteIconUrl];
    }

    if (typeof remoteIconUrl === 'string' && /^https?:\/\//i.test(remoteIconUrl)) {
      candidates.push(remoteIconUrl);
    }

    try {
      const parsed = new URL(siteUrl);
      candidates.push(`${parsed.origin}/favicon.ico`);
      candidates.push(`${parsed.origin}/favicon.png`);
      candidates.push(`https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`);
    } catch (_) {
      // ignore invalid url
    }

    return [...new Set(candidates)];
  },

  blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  async readImageFileAsDataUrl(file) {
    const isImageFile =
      (file?.type && file.type.startsWith('image/')) ||
      /\.(png|jpe?g|gif|webp|svg)$/i.test(file?.name || '');

    if (!file || !isImageFile) {
      throw new Error('请选择图片文件');
    }

    if (file.size > 512 * 1024) {
      throw new Error('图片大小不能超过 512KB');
    }

    return this.blobToDataUrl(file);
  },

  async fetchIconAsDataUrl(sourceUrl) {
    if (sourceUrl.startsWith('data:')) return sourceUrl;

    try {
      const response = await fetch(sourceUrl, { credentials: 'omit' });
      if (!response.ok) return '';

      const blob = await response.blob();
      if (!blob.size || blob.size > 512 * 1024) return '';

      return await this.blobToDataUrl(blob);
    } catch (_) {
      return '';
    }
  },

  async downloadShortcutIcon(siteUrl, remoteIconUrl = '') {
    const candidates = this.buildIconCandidates(siteUrl, remoteIconUrl);

    for (const candidate of candidates) {
      const dataUrl = await this.fetchIconAsDataUrl(candidate);
      if (dataUrl) return dataUrl;
    }

    return '';
  },

  async migrateShortcutIcons(shortcuts) {
    let changed = false;
    const next = [];

    for (const item of shortcuts) {
      if (globalThis.SidebarHome?.isHomeUrl?.(item.url)) {
        const iconUrl = globalThis.SidebarHome.getIconUrl();
        if (item.iconUrl !== iconUrl) {
          changed = true;
          next.push({ ...item, iconUrl });
        } else {
          next.push(item);
        }
        continue;
      }

      if (this.isLocalIcon(item.iconUrl)) {
        next.push(item);
        continue;
      }

      const iconUrl = await this.downloadShortcutIcon(item.url, item.iconUrl);
      if (iconUrl && iconUrl !== item.iconUrl) {
        changed = true;
        next.push({ ...item, iconUrl });
      } else {
        next.push(item);
      }
    }

    return { shortcuts: changed ? next : shortcuts, changed };
  },
};

if (typeof globalThis !== 'undefined') {
  globalThis.IconStore = IconStore;
}
