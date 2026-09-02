/**

 * options.js — Extension options page

 */



const DEFAULT_SHORTCUTS = {

  insert: 'Alt+=',

  commit: 'Alt+Enter',

  editLinear: 'F2',

  toggleSource: 'Ctrl+Shift+L',

  fallbackInsert: 'Ctrl+Alt+M'

};



document.addEventListener('DOMContentLoaded', () => {

  const form = document.getElementById('settings-form');

  const savedMsg = document.getElementById('saved-msg');



  const fields = {

    insert: document.getElementById('shortcut-insert'),

    commit: document.getElementById('shortcut-commit'),

    editLinear: document.getElementById('shortcut-edit'),

    toggleSource: document.getElementById('shortcut-source'),

    fallbackInsert: document.getElementById('shortcut-fallback')

  };

  const announceKeystrokesCheckbox = document.getElementById('announce-keystrokes');
  const equationNavAnnounceCheckbox = document.getElementById('equation-nav-announce');



  chrome.storage.sync.get(
    ['shortcuts', 'announceKeystrokes', 'equationNavAnnounce'],
    (data) => {

    const shortcuts = { ...DEFAULT_SHORTCUTS, ...data.shortcuts };

    fields.insert.value = shortcuts.insert;

    fields.commit.value = shortcuts.commit;

    fields.editLinear.value = shortcuts.editLinear;

    fields.toggleSource.value = shortcuts.toggleSource;

    fields.fallbackInsert.value = shortcuts.fallbackInsert;

    if (announceKeystrokesCheckbox) {
      announceKeystrokesCheckbox.checked = data.announceKeystrokes !== false;
    }
    if (equationNavAnnounceCheckbox) {
      equationNavAnnounceCheckbox.checked = data.equationNavAnnounce !== false;
    }
  });



  form.addEventListener('submit', (e) => {

    e.preventDefault();



    const shortcuts = {

      insert: fields.insert.value.trim(),

      commit: fields.commit.value.trim(),

      editLinear: fields.editLinear.value.trim(),

      toggleSource: fields.toggleSource.value.trim(),

      fallbackInsert: fields.fallbackInsert.value.trim()

    };



    const announceKeystrokes = announceKeystrokesCheckbox?.checked !== false;
    const equationNavAnnounce = equationNavAnnounceCheckbox?.checked !== false;



    chrome.storage.sync.set(
      { shortcuts, announceKeystrokes, equationNavAnnounce },
      () => {

      savedMsg.style.display = 'block';

      setTimeout(() => { savedMsg.style.display = 'none'; }, 3000);

    });

  });

});

