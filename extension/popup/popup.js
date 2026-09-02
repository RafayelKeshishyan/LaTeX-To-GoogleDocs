/**
 * popup.js — Extension popup UI
 */

document.addEventListener('DOMContentLoaded', () => {
  const btnOpen = document.getElementById('btn-open-panel');
  const linkOptions = document.getElementById('link-options');
  const statusText = document.getElementById('status-text');

  linkOptions.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  async function openPanelForActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab?.id) {
      statusText.textContent = 'No active tab.';
      return;
    }

    if (!tab.url?.includes('docs.google.com/document')) {
      statusText.textContent = 'Open a Google Doc first.';
      return;
    }

    try {
      await chrome.storage.session.set({
        panelState: {
          mode: 'new',
          announce: 'Equation editor opened.'
        }
      });
      await chrome.tabs.sendMessage(tab.id, {
        action: 'showEditorPanel',
        mode: 'new',
        announce: 'Equation editor opened.'
      });
      statusText.textContent = 'Equation editor opened.';
      window.close();
    } catch {
      statusText.textContent = 'Reload the Google Doc tab, then try again.';
    }
  }

  btnOpen.addEventListener('click', openPanelForActiveTab);

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.url?.includes('docs.google.com/document')) {
      statusText.textContent = 'Open a Google Doc to begin.';
      return;
    }
    chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        statusText.textContent = 'Reload the Google Doc tab.';
        return;
      }
      statusText.textContent =
        'Ready. ' + (response.equationCount || 0) + ' equation(s) in document.';
    });
  });
});
