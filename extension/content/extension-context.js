/**
 * extension-context.js — Safe chrome API wrappers (no port-based invalidation).
 */

const ExtensionContext = (() => {
  function isRuntimeAvailable() {
    try {
      return Boolean(chrome.runtime?.id);
    } catch {
      return false;
    }
  }

  function showBanner(id, html, background = '#1a73e8') {
    if (document.getElementById(id)) return;
    const banner = document.createElement('div');
    banner.id = id;
    banner.setAttribute('role', 'alert');
    banner.innerHTML = html;
    banner.style.cssText =
      `position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:12px 16px;` +
      `background:${background};color:#fff;font:14px/1.4 system-ui,sans-serif;text-align:center;`;
    (document.body || document.documentElement).appendChild(banner);
  }

  function showReloadBanner() {
    showBanner(
      'latex-gdocs-reload-banner',
      'LaTeX for Google Docs was updated. Please refresh this page (F5).'
    );
  }

  function showDesktopRequiredBanner(desktopUrl) {
    showBanner(
      'latex-gdocs-desktop-banner',
      'LaTeX for Google Docs requires the <strong>desktop editor</strong>. ' +
        `<a href="${desktopUrl}" style="color:#fff;text-decoration:underline;">Open desktop version</a>`,
      '#c5221f'
    );
  }

  function safeStorageGet(keys, callback) {
    if (!isRuntimeAvailable()) {
      showReloadBanner();
      return;
    }
    try {
      chrome.storage.sync.get(keys, (data) => {
        if (chrome.runtime.lastError) return;
        callback(data || {});
      });
    } catch {
      showReloadBanner();
    }
  }

  function safeStorageSet(values) {
    if (!isRuntimeAvailable()) return;
    try {
      chrome.storage.sync.set(values);
    } catch {
      /* ignore */
    }
  }

  function isContextInvalidatedError(message) {
    return /invalidated|extension context/i.test(message || '');
  }

  /**
   * Send a message to the extension service worker.
   * Returns a promise; never throws on invalidated extension context.
   */
  function sendMessage(message) {
    return new Promise((resolve) => {
      if (!isRuntimeAvailable()) {
        showReloadBanner();
        resolve({ ok: false, error: 'Extension context invalidated.', invalidated: true });
        return;
      }

      try {
        chrome.runtime.sendMessage(message, (response) => {
          const err = chrome.runtime.lastError;
          if (err) {
            const msg = err.message || String(err);
            if (isContextInvalidatedError(msg)) {
              showReloadBanner();
            }
            resolve({ ok: false, error: msg, invalidated: isContextInvalidatedError(msg) });
            return;
          }
          resolve(response || { ok: true });
        });
      } catch (err) {
        const msg = err?.message || String(err);
        if (isContextInvalidatedError(msg)) {
          showReloadBanner();
        }
        resolve({ ok: false, error: msg, invalidated: isContextInvalidatedError(msg) });
      }
    });
  }

  let pageMainPromise = null;

  /**
   * Inject page-main.js into the PAGE context (MAIN world).
   * Manifest "world":"MAIN" is not reliable on all Chrome builds;
   * a <script src="chrome-extension://..."> tag always runs in page context.
   */
  function ensurePageMain() {
    if (pageMainPromise) return pageMainPromise;

    pageMainPromise = new Promise((resolve) => {
      function pongHandler(event) {
        if (event.source !== window) return;
        if (event.data?.type === 'LATEX_GDOCS_PONG') {
          window.removeEventListener('message', pongHandler);
          resolve(true);
        }
      }

      window.addEventListener('message', pongHandler);

      function inject() {
        if (document.documentElement?.getAttribute('data-latex-gdocs-main') === '1') {
          resolve(true);
          return;
        }
        if (document.querySelector('script[data-latex-gdocs-main]')) return;

        try {
          const script = document.createElement('script');
          script.src = chrome.runtime.getURL('content/page-main.js');
          script.dataset.latexGdocsMain = '1';
          script.onload = () => script.remove();
          script.onerror = () => {
            script.remove();
            window.removeEventListener('message', pongHandler);
            resolve(false);
          };
          (document.documentElement || document.head || document.body).appendChild(script);
        } catch {
          window.removeEventListener('message', pongHandler);
          resolve(false);
          return;
        }

        window.postMessage({ type: 'LATEX_GDOCS_PING' }, '*');
        setTimeout(() => {
          window.removeEventListener('message', pongHandler);
          const loaded =
            document.documentElement?.getAttribute('data-latex-gdocs-main') === '1';
          resolve(loaded);
        }, 2000);
      }

      if (document.documentElement) {
        inject();
      } else {
        document.addEventListener('DOMContentLoaded', inject, { once: true });
      }
    });

    return pageMainPromise;
  }

  return {
    isAlive: isRuntimeAvailable,
    isRuntimeAvailable,
    onTeardown: () => {},
    connect: () => {},
    ensurePageMain,
    showReloadBanner,
    showDesktopRequiredBanner,
    safeStorageGet,
    safeStorageSet,
    sendMessage
  };
})();

if (typeof window !== 'undefined') {
  window.ExtensionContext = ExtensionContext;
  ExtensionContext.ensurePageMain();
}
