/**
 * sidepanel.js — Accessible LaTeX equation editor (primary UI)
 */

(function () {
  'use strict';

  const TEMPLATES = [
    {
      title: 'Tutorial 1 — Exponents',
      examples: [
        { label: 'x squared', latex: 'x^2' },
        { label: '2 to the 10th', latex: '2^{10}' },
        { label: 'Pythagorean', latex: 'a^2 + b^2 = c^2' }
      ]
    },
    {
      title: 'Tutorial 2 — Fractions',
      examples: [
        { label: 'Three fourths', latex: '\\frac{3}{4}' },
        { label: 'a over b', latex: '\\frac{a}{b}' },
        { label: 'Complex fraction', latex: '\\frac{x+1}{x-1}' }
      ]
    },
    {
      title: 'Tutorial 3 — Square Roots',
      examples: [
        { label: 'Acceptance test', latex: 'y=\\sqrt{x + 3}' },
        { label: 'Square root of 16', latex: '\\sqrt{16}' },
        { label: 'Distance', latex: '\\sqrt{x^2 + y^2}' }
      ]
    },
    {
      title: 'Tutorial 4 — Quadratic Formula',
      examples: [
        { label: 'Quadratic formula', latex: 'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}' },
        { label: 'Discriminant', latex: 'b^2 - 4ac' },
        { label: 'Simple quadratic', latex: 'x^2 + 5x + 6 = 0' }
      ]
    }
  ];

  const latexInput = document.getElementById('latex-input');
  const preview = document.getElementById('preview');
  const previewSpeech = document.getElementById('preview-speech');
  const statusEl = document.getElementById('status');
  const equationList = document.getElementById('equation-list');
  const srKeystroke = document.getElementById('sr-keystroke');
  const srPreview = document.getElementById('sr-preview');
  const srStatus = document.getElementById('sr-status');
  const speechOutputEl = document.getElementById('speech-output');
  const templateList = document.getElementById('template-list');

  let announceKeystrokes = true;
  let previewDebounce = null;
  let currentMode = 'new';

  function setStatus(text, type = '') {
    statusEl.textContent = text;
    statusEl.className = 'status' + (type ? ' ' + type : '');
  }

  function announceToUser(text, options = {}) {
    const message = (text || '').trim();
    if (!message) return;

    if (typeof SpeechOutput !== 'undefined') {
      if (options.immediate && SpeechOutput.speakNow) {
        SpeechOutput.speakNow(message);
      } else {
        SpeechOutput.speak(message);
      }
    }

    if (speechOutputEl) {
      speechOutputEl.textContent = message;
    }

    statusEl.textContent = message;
    if (options.priority === 'assertive') {
      statusEl.className = 'status alert';
    }

    srStatus.textContent = message;

    const focusTarget = options.focusEl || (options.skipFocus ? null : speechOutputEl || statusEl);
    if (focusTarget) {
      focusTarget.setAttribute('tabindex', '-1');
      focusTarget.focus({ preventScroll: true });
    }
  }

  function announceStatus(text) {
    announceToUser(text, { priority: 'assertive' });
  }

  function announceKeystroke(char) {
    if (!announceKeystrokes || !char || char.length !== 1) return;
    const spoken = LatexSpeech.keystroke(char);
    srKeystroke.textContent = spoken;
    if (typeof SpeechOutput !== 'undefined' && SpeechOutput.speakKeystroke) {
      SpeechOutput.speakKeystroke(spoken);
    }
  }

  function announceEditingKey(key) {
    if (!announceKeystrokes) return;
    const spoken = LatexSpeech.editingKey(key);
    if (!spoken) return;
    srKeystroke.textContent = spoken;
    if (typeof SpeechOutput !== 'undefined' && SpeechOutput.speakKeystroke) {
      SpeechOutput.speakKeystroke(spoken);
    }
  }

  function focusLatexInput(mode) {
    latexInput.focus();
    const end = latexInput.value.length;
    latexInput.setSelectionRange(end, end);
  }

  async function getActiveDocTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id || !tab.url?.includes('docs.google.com/document')) {
      return null;
    }
    return tab;
  }

  function sendToDoc(action, payload = {}) {
    return getActiveDocTab().then((tab) => {
      if (!tab) {
        return { ok: false, error: 'Open a Google Doc (desktop /edit URL) first.' };
      }
      return new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action, ...payload }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              ok: false,
              error: 'Reload the Google Doc tab, then try again.'
            });
            return;
          }
          resolve(response || { ok: false, error: 'No response from document.' });
        });
      });
    });
  }

  function updatePreview() {
    const latex = latexInput.value;

    if (!latex.trim()) {
      preview.innerHTML = '<span class="preview-placeholder">Preview appears here</span>';
      preview.setAttribute('aria-label', 'Equation preview, empty');
      return;
    }

    try {
      preview.innerHTML = '';
      window.katex.render(latex, preview, {
        throwOnError: true,
        displayMode: false
      });
      const speech = LatexSpeech.toNaturalSpeech(latex);
      preview.setAttribute('aria-label', 'Equation preview: ' + speech);
    } catch (err) {
      preview.innerHTML = '<span class="preview-error">' + err.message + '</span>';
      preview.setAttribute('aria-label', 'Equation preview error: ' + err.message);
    }
  }

  function schedulePreview() {
    clearTimeout(previewDebounce);
    previewDebounce = setTimeout(updatePreview, 120);
  }

  async function latexToPngDataUrl(latex) {
    await document.fonts.ready;

    const mount = document.createElement('div');
    mount.style.cssText =
      'position:fixed;left:-9999px;top:0;padding:10px 14px;background:#fff;display:inline-block;';
    document.body.appendChild(mount);

    window.katex.render(latex, mount, { throwOnError: true, displayMode: false });

    const w = Math.max(mount.offsetWidth + 12, 32);
    const h = Math.max(mount.offsetHeight + 12, 32);
    const html = mount.innerHTML;

    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      w +
      '" height="' +
      h +
      '">' +
      '<foreignObject width="100%" height="100%">' +
      '<div xmlns="http://www.w3.org/1999/xhtml" style="font-size:1.21em;padding:6px;background:#fff;">' +
      html +
      '</div></foreignObject></svg>';

    const dataUrl = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = 3;
        canvas.width = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0);
        mount.remove();
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => {
        mount.remove();
        reject(new Error('Could not render equation image'));
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });

    return dataUrl;
  }

  async function insertEquation() {
    const rawLatex = latexInput.value;
    if (!rawLatex.trim()) {
      setStatus('Type LaTeX first.', 'error');
      announceStatus('Type LaTeX first.');
      latexInput.focus();
      return;
    }

    const speech = LatexSpeech.toNaturalSpeech(rawLatex.trim());

    previewSpeech.textContent = speech;

    const replacing = currentMode === 'edit';
    setStatus(replacing ? 'Replacing...' : 'Inserting...');

    const result = await sendToDoc('insertLatex', {
      latex: rawLatex,
      replace: replacing,
      skipImage: true,
      skipAnnounce: true,
      fastReturn: true
    });

    if (!result?.ok) {
      const err = result?.error || 'Insert failed.';
      setStatus(err, 'error');
      announceToUser(err, { priority: 'assertive', skipFocus: true });
      return;
    }

    setStatus(replacing ? 'Replaced.' : 'Inserted.', 'ok');
    refreshEquationList();
  }

  function closePanel() {
    window.parent.postMessage({ type: 'LATEX_GDOCS_CLOSE_PANEL' }, '*');
  }

  async function refreshEquationList() {
    const result = await sendToDoc('listEquations');
    equationList.innerHTML = '';

    if (!result.ok) {
      const li = document.createElement('li');
      li.className = 'equation-empty';
      li.textContent = result.error || 'Could not read document.';
      equationList.appendChild(li);
      return;
    }

    const equations = result.equations || [];
    if (equations.length === 0) {
      const li = document.createElement('li');
      li.className = 'equation-empty';
      li.textContent = 'No equations yet. Insert one with Alt+Enter or the Insert button.';
      equationList.appendChild(li);
      return;
    }

    equations.forEach((eq, index) => {
      const li = document.createElement('li');
      li.className = 'equation-item';
      li.setAttribute('role', 'option');
      li.setAttribute('tabindex', '0');
      li.setAttribute('aria-selected', 'false');
      li.dataset.latex = eq.latex;
      const listSpeech = eq.latex?.trim()
        ? LatexSpeech.toNaturalSpeech(eq.latex)
        : 'empty equation';
      li.setAttribute('aria-label', `Equation ${index + 1}: ${listSpeech}`);

      const label = document.createElement('span');
      label.textContent = `Equation ${index + 1}`;
      const code = document.createElement('code');
      code.textContent = eq.latex || '(empty)';
      li.appendChild(label);
      li.appendChild(code);

      function selectEquation() {
        latexInput.value = eq.latex || '';
        updatePreview();
        latexInput.focus();
        equationList.querySelectorAll('.equation-item').forEach((item) => {
          item.setAttribute('aria-selected', 'false');
        });
        li.setAttribute('aria-selected', 'true');
        announceStatus('Loaded equation ' + (index + 1) + ' for editing.');
        setStatus('Loaded equation ' + (index + 1) + '.', 'ok');
      }

      li.addEventListener('click', selectEquation);
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectEquation();
        }
      });

      equationList.appendChild(li);
    });
  }

  function renderTemplates() {
    templateList.innerHTML = '';
    TEMPLATES.forEach((group) => {
      const div = document.createElement('div');
      div.className = 'template-group';
      const h3 = document.createElement('h3');
      h3.textContent = group.title;
      div.appendChild(h3);

      group.examples.forEach((ex) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'template-btn';
        btn.innerHTML = ex.label + ' <code>' + ex.latex + '</code>';
        btn.addEventListener('click', () => {
          latexInput.value = ex.latex;
          updatePreview();
          latexInput.focus();
          announceStatus('Template loaded: ' + ex.label);
        });
        div.appendChild(btn);
      });

      templateList.appendChild(div);
    });
  }

  async function applyPanelState(state) {
    const panelState =
      state ||
      (await chrome.storage.session.get(['panelState'])).panelState;
    if (!panelState) return;

    currentMode = panelState.mode === 'edit' ? 'edit' : 'new';

    if (panelState.mode === 'new' || panelState.clearLatex) {
      latexInput.value = '';
      updatePreview();
    } else if (panelState.latex != null) {
      latexInput.value = panelState.latex;
      updatePreview();
    }

    if (panelState.focusEditor !== false) {
      requestAnimationFrame(() => {
        focusLatexInput(panelState.mode);
      });
    }
  }

  window.addEventListener('message', (event) => {
    if (event.data?.type === 'LATEX_GDOCS_PANEL_STATE') {
      applyPanelState(event.data.state);
      return;
    }
    if (event.data?.type === 'LATEX_GDOCS_TRIGGER_INSERT') {
      insertEquation();
      return;
    }
    if (event.data?.type === 'LATEX_GDOCS_NEW_EQUATION') {
      currentMode = 'new';
      latexInput.value = '';
      updatePreview();
      setStatus('');
      focusLatexInput('new');
      return;
    }
    if (event.data?.type === 'LATEX_GDOCS_BLUR_INPUT') {
      latexInput.blur();
      return;
    }
    if (event.data?.type === 'LATEX_GDOCS_FOCUS_INPUT') {
      focusLatexInput('edit');
    }
  });

  window.addEventListener(
    'keydown',
    (e) => {
      if (e.altKey && !e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        e.stopPropagation();
        window.parent.postMessage({ type: 'LATEX_GDOCS_FOCUS_DOCUMENT' }, '*');
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        e.stopPropagation();
        window.parent.postMessage({ type: 'LATEX_GDOCS_READ_EQUATION' }, '*');
      }
    },
    true
  );

  function readAloud() {
    const latex = latexInput.value.trim();
    if (!latex) {
      announceToUser('No equation to read.');
      return;
    }
    const speech = LatexSpeech.toNaturalSpeech(latex);
    previewSpeech.textContent = speech;
    preview.setAttribute('aria-label', 'Equation preview: ' + speech);
    announceToUser(speech, { priority: 'assertive', focusEl: previewSpeech });
  }

  latexInput.addEventListener('input', () => {
    schedulePreview();
  });

  latexInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closePanel();
      return;
    }

    if (e.altKey && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      insertEquation();
      return;
    }

    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (
      !e.ctrlKey &&
      !e.altKey &&
      !e.metaKey &&
      (e.key === 'Backspace' ||
        e.key === 'Delete' ||
        e.key === 'Enter' ||
        e.key === 'Tab' ||
        e.key.startsWith('Arrow') ||
        e.key === 'Home' ||
        e.key === 'End')
    ) {
      announceEditingKey(e.key);
      return;
    }

    if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
      announceKeystroke(e.key);
    }
  });

  document.getElementById('btn-insert').addEventListener('click', insertEquation);
  document.getElementById('btn-close-panel').addEventListener('click', closePanel);
  document.getElementById('btn-clear').addEventListener('click', () => {
    latexInput.value = '';
    updatePreview();
    setStatus('');
    latexInput.focus();
    announceStatus('Editor cleared.');
  });
  document.getElementById('btn-refresh').addEventListener('click', refreshEquationList);
  document.getElementById('btn-read').addEventListener('click', readAloud);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'session' || !changes.panelState?.newValue) return;
    const next = changes.panelState.newValue;
    if (next.mode === 'new' || next.clearLatex) {
      applyPanelState(next);
    }
  });

  async function boot() {
    const data = await chrome.storage.sync.get(['announceKeystrokes']);
    announceKeystrokes = data.announceKeystrokes !== false;

    renderTemplates();
    await refreshEquationList();
  }

  boot();
})();
