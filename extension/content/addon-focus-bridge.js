/**
 * addon-focus-bridge.js — Runs in Docs and Apps Script sidebar frames.
 * Relays Alt+= / F2 focus requests into the HtmlService sidebar page.
 */
(function () {
  'use strict';

  if (window.__latexGdocsAddonFocusBridge) return;
  window.__latexGdocsAddonFocusBridge = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.action !== 'addonFocusRequest' || !msg.requestId) return;
    try {
      window.postMessage(
        {
          type: 'ACCESSIBLE_EQUATIONS_FOCUS_REQUEST',
          requestId: msg.requestId
        },
        '*'
      );
      sendResponse({ ok: true });
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
    return true;
  });
})();
