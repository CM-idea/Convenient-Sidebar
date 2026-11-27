const ICON_PATHS = {
  light: {
    16: 'icons/icon-dark16.png',
    48: 'icons/icon-dark48.png',
    128: 'icons/icon-dark128.png',
  },
  dark: {
    16: 'icons/icon16.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
};

const ICON_SIZES = [16, 48, 128];

function normalizeIconTheme(theme) {
  if (theme === 'dark') return 'dark';
  if (theme === 'custom') return 'custom';
  return 'light';
}

function resolveIconSettings(themeOrSettings, customIconUrl) {
  if (typeof themeOrSettings === 'object' && themeOrSettings !== null) {
    return {
      iconTheme: normalizeIconTheme(themeOrSettings.iconTheme),
      iconCustomUrl: themeOrSettings.iconCustomUrl || '',
    };
  }

  return {
    iconTheme: normalizeIconTheme(themeOrSettings),
    iconCustomUrl: customIconUrl || '',
  };
}

async function createImageDataFromDataUrl(dataUrl, size) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob, {
    resizeWidth: size,
    resizeHeight: size,
    resizeQuality: 'high',
  });

  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(size, size)
      : (() => {
          const element = document.createElement('canvas');
          element.width = size;
          element.height = size;
          return element;
        })();

  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, size, size);
  bitmap.close?.();

  return ctx.getImageData(0, 0, size, size);
}

async function buildToolbarImageDataFromDataUrl(dataUrl) {
  const imageData = {};

  for (const size of ICON_SIZES) {
    imageData[size] = await createImageDataFromDataUrl(dataUrl, size);
  }

  return imageData;
}

async function applyToolbarIcon(themeOrSettings, customIconUrl) {
  const { iconTheme, iconCustomUrl } = resolveIconSettings(themeOrSettings, customIconUrl);

  if (iconTheme === 'custom') {
    if (typeof iconCustomUrl === 'string' && iconCustomUrl.startsWith('data:')) {
      await chrome.action.setIcon({
        imageData: await buildToolbarImageDataFromDataUrl(iconCustomUrl),
      });
      return;
    }

    await chrome.action.setIcon({ path: ICON_PATHS.light });
    return;
  }

  await chrome.action.setIcon({ path: ICON_PATHS[iconTheme] });
}

if (typeof globalThis !== 'undefined') {
  globalThis.applyToolbarIcon = applyToolbarIcon;
  globalThis.normalizeIconTheme = normalizeIconTheme;
}
