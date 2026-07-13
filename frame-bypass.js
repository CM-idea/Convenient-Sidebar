(function () {
  'use strict';

  if (window.top === window.self) return;

  const params = new URLSearchParams(window.name);
  if (!params.has('anything-copilot_webview')) return;

  const ua = params.get('ua');
  const isMobileUa = Boolean(ua && /Mobile/i.test(ua));

  if (ua) {
    try {
      Object.defineProperty(navigator, 'userAgent', {
        get() {
          return ua;
        },
        configurable: true,
      });
    } catch (_) {
      // ignore
    }
  }

  if (isMobileUa) {
    try {
      Object.defineProperty(navigator, 'platform', {
        get() {
          return 'Linux armv81';
        },
        configurable: true,
      });
    } catch (_) {
      // ignore
    }

    try {
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get() {
          return 5;
        },
        configurable: true,
      });
    } catch (_) {
      // ignore
    }

    try {
      const uaData = navigator.userAgentData;
      if (uaData) {
        const mobileBrands = [
          { brand: 'Chromium', version: '131' },
          { brand: 'Google Chrome', version: '131' },
          { brand: 'Not_A Brand', version: '24' },
        ];
        Object.defineProperty(navigator, 'userAgentData', {
          get() {
            return {
              brands: mobileBrands,
              mobile: true,
              platform: 'Android',
              getHighEntropyValues(hints) {
                const values = {
                  brands: mobileBrands,
                  mobile: true,
                  platform: 'Android',
                  platformVersion: '13.0.0',
                  architecture: '',
                  bitness: '',
                  model: 'Pixel 7',
                  uaFullVersion: '131.0.0.0',
                };
                const result = {};
                for (const hint of hints || []) {
                  if (Object.prototype.hasOwnProperty.call(values, hint)) {
                    result[hint] = values[hint];
                  }
                }
                return Promise.resolve(result);
              },
              toJSON() {
                return { brands: mobileBrands, mobile: true, platform: 'Android' };
              },
            };
          },
          configurable: true,
        });
      }
    } catch (_) {
      // ignore
    }
  }

  if (params.get('ssc') === '1') {
    try {
      const getter = document.__lookupGetter__('cookie');
      const setter = document.__lookupSetter__('cookie');
      Object.defineProperty(document, 'cookie', {
        get() {
          return getter.call(document);
        },
        set(value) {
          let parts = String(value).split(/;\s*/);
          parts = parts.filter(
            (part) =>
              !(/SameSite=/i.test(part) || /^Secure$/i.test(part) || /^Partitioned$/i.test(part))
          );
          parts.push('SameSite=None', 'Secure', 'Partitioned');
          setter.call(document, parts.join('; '));
        },
        configurable: true,
      });
    } catch (_) {
      // ignore
    }
  }
})();
