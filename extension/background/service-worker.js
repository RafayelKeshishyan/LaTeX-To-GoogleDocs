/**
 * service-worker.js — Background service worker (Manifest V3)
 */

const DEFAULT_SHORTCUTS = {
  insert: 'Alt+=',
  commit: 'Alt+Enter',
  editLinear: 'F2',
  toggleSource: 'Ctrl+Shift+L',
  fallbackInsert: 'Ctrl+Alt+M'
};

async function openEditorInTab(tabId, state = {}) {
  await chrome.storage.session.set({
    panelState: {
      mode: state.mode || 'new',
      latex: state.latex || '',
      announce:
        state.announce ||
        'Linear mode.'
    }
  });
  await chrome.tabs.sendMessage(tabId, {
    action: 'showEditorPanel',
    mode: state.mode || 'new',
    latex: state.latex,
    announce: state.announce
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.sync.set({
      shortcuts: DEFAULT_SHORTCUTS,
      announceKeystrokes: true,
      equationNavAnnounce: true
    });
  }
});

chrome.action.onClicked.addListener((tab) => {
  if (!tab?.id || !tab.url?.includes('docs.google.com/document')) return;
  openEditorInTab(tab.id, {
    mode: 'new',
    announce: 'Equation editor opened.'
  }).catch((err) => console.warn('[LaTeX-GDocs] action click', err));
});

chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id) return;

    if (command === 'read-equation') {
      chrome.tabs.sendMessage(tab.id, { action: 'readEquationAtCursor' }).catch((err) =>
        console.warn('[LaTeX-GDocs] read-equation command', err)
      );
      return;
    }

    const state = {
      mode: 'new',
      announce:
        'Linear mode.'
    };

    openEditorInTab(tab.id, state).catch((err) =>
      console.warn('[LaTeX-GDocs] command handler', err)
    );
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getDefaults') {
    sendResponse({ shortcuts: DEFAULT_SHORTCUTS });
    return true;
  }

  if (msg.action === 'openSidePanel') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false, error: 'No active tab.' });
      return true;
    }

    openEditorInTab(tabId, msg)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  }

  return false;
});
