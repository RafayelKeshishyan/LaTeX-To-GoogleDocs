/**
 * options.js — Extension options page
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('settings-form');
  const savedMsg = document.getElementById('saved-msg');
  const announceKeystrokesCheckbox = document.getElementById('announce-keystrokes');
  const equationNavAnnounceCheckbox = document.getElementById('equation-nav-announce');
  const speechModeRadios = form.querySelectorAll('input[name="speech-mode"]');

  const VALID_SPEECH_MODES = ['screenReader', 'extension'];

  function selectedSpeechMode() {
    for (const radio of speechModeRadios) {
      if (radio.checked) return radio.value;
    }
    return 'screenReader';
  }

  chrome.storage.sync.get(['announceKeystrokes', 'equationNavAnnounce', 'speechMode'], (data) => {
    if (announceKeystrokesCheckbox) {
      announceKeystrokesCheckbox.checked = data.announceKeystrokes !== false;
    }
    if (equationNavAnnounceCheckbox) {
      equationNavAnnounceCheckbox.checked = data.equationNavAnnounce !== false;
    }

    const stored = VALID_SPEECH_MODES.includes(data.speechMode) ? data.speechMode : 'screenReader';
    for (const radio of speechModeRadios) {
      radio.checked = radio.value === stored;
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const announceKeystrokes = announceKeystrokesCheckbox?.checked !== false;
    const equationNavAnnounce = equationNavAnnounceCheckbox?.checked !== false;
    const speechMode = selectedSpeechMode();

    chrome.storage.sync.set({ announceKeystrokes, equationNavAnnounce, speechMode }, () => {
      savedMsg.style.display = 'block';
      setTimeout(() => {
        savedMsg.style.display = 'none';
      }, 3000);
    });
  });
});
