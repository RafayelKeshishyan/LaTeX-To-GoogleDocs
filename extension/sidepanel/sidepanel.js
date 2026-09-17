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

  /**
   * Say something exactly once.
   *
   * A screen reader announces an element when focus lands on it, so moving
   * focus *and* writing a live region reads the same text twice. Callers that
   * pass focusEl want the user parked on that text so they can review it word
   * by word; everyone else gets the live region and keeps their place in the
   * editor.
   */
  function announceToUser(text, options = {}) {
    const message = (text || '').trim();
    if (!message && !options.latex) return;

    setStatus(options.speech || message, options.statusClass || (options.priority === 'assertive' ? 'alert' : ''));
    if (speechOutputEl) {
      speechOutputEl.textContent = message;
    }

    if (options.focusEl) {
      options.focusEl.setAttribute('tabindex', '-1');
      options.focusEl.focus({ preventScroll: true });
    } else {
      SpeechOutput.announceInRegion(srStatus, message, {
        latex: options.latex,
        fallback: options.speech
      });
    }

    if (options.immediate) {
      SpeechOutput.speakNow(options.speech || message);
    } else {
      SpeechOutput.speak(options.speech || message);
    }
  }

  function announceStatus(text) {
    announceToUser(text, { priority: 'assertive' });
  }

  /**
   * NVDA, JAWS and Narrator all echo typed characters in a text box by
   * default, so this only drives the extension's own voice. In screen reader
   * mode SpeechOutput stays quiet and the native echo is the only one heard.
   */
  function announceKeystroke(char) {
    if (!announceKeystrokes || !char || char.length !== 1) return;
    SpeechOutput.speakKeystroke(LatexSpeech.keystroke(char));
  }

  function announceEditingKey(key) {
    if (!announceKeystrokes) return;
    const spoken = LatexSpeech.editingKey(key);
    if (spoken) SpeechOutput.speakKeystroke(spoken);
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
        let settled = false;
        let timeoutId = null;
        const finish = (result) => {
          if (settled) return;
          settled = true;
          if (timeoutId) clearTimeout(timeoutId);
          resolve(result);
        };
        timeoutId = setTimeout(() => {
          finish({
            ok: false,
            error:
              'Google Docs did not respond. Check the document before trying again.'
          });
        }, 12000);

        chrome.tabs.sendMessage(tab.id, { action, ...payload }, (response) => {
          if (chrome.runtime.lastError) {
            finish({
              ok: false,
              error: 'Reload the Google Doc tab, then try again.'
            });
            return;
          }
          finish(response || { ok: false, error: 'No response from document.' });
        });
      });
    });
  }

  function updatePreview() {
    const latex = latexInput.value;

    if (!latex.trim()) {
      preview.removeAttribute('role');
      preview.removeAttribute('aria-label');
      preview.innerHTML = '<span class="preview-placeholder">Preview appears here</span>';
      return;
    }

    try {
      preview.removeAttribute('aria-label');
      preview.removeAttribute('role');
      preview.innerHTML = '';
      window.katex.render(latex, preview, {
        throwOnError: true,
        displayMode: false
      });
    } catch (err) {
      preview.removeAttribute('role');
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

  async function insertEquation(options = {}) {
    const rawLatex = latexInput.value;
    if (!rawLatex.trim()) {
      announceStatus('Type LaTeX first.');
      latexInput.focus();
      return;
    }

    const speech = LatexSpeech.toNaturalSpeech(rawLatex.trim());

    previewSpeech.textContent = speech;

    // Asking for a new line always means a new equation, never a replacement.
    const newLine = options.newLine === true;
    const replacing = currentMode === 'edit' && !newLine;
    setStatus(replacing ? 'Replacing...' : 'Inserting...');

    let result;
    try {
      result = await sendToDoc('insertLatex', {
        latex: rawLatex,
        replace: replacing,
        newLine,
        safeAuthoring: !replacing,
        skipImage: true,
        skipAnnounce: true,
        fastReturn: true
      });
    } catch (err) {
      result = {
        ok: false,
        error: String(err?.message || err || 'Insert failed.')
      };
    }

    // Google Docs must receive focus briefly to accept the insertion. Always
    // take it back before reporting the result so the student's next key
    // cannot alter or delete document text. Selecting the completed source
    // also makes typing the next equation replace it instead of appending.
    focusLatexInput(currentMode);
    if (result?.ok && !replacing) {
      latexInput.select();
    }

    if (!result?.ok) {
      announceToUser(result?.error || 'Insert failed.', {
        priority: 'assertive',
        statusClass: 'error'
      });
      return;
    }

    if (result.verified === false) {
      const warning =
        result.warning ||
        'Equation entered. Google Docs did not expose it to the equation list.';
      announceToUser(
        warning,
        {
          priority: 'assertive',
          statusClass: 'ok',
          latex: rawLatex.trim(),
          speech: `${warning} ${speech}`
        }
      );
      return;
    }

    setStatus(replacing ? 'Replaced.' : newLine ? 'Inserted on a new line.' : 'Inserted.', 'ok');
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
      li.removeAttribute('aria-label');
      const label = document.createElement('span');
      label.textContent = `Equation ${index + 1}`;
      const math = document.createElement('span');
      math.setAttribute('role', 'math');
      math.style.cssText =
        'position:absolute;width:1px;height:1px;overflow:hidden;white-space:nowrap;';
      const mathml = typeof LatexMathML !== 'undefined' ? LatexMathML.fromLatex(eq.latex) : '';
      if (mathml) {
        math.innerHTML = mathml;
      } else {
        math.textContent = listSpeech;
      }
      const code = document.createElement('code');
      code.textContent = eq.latex || '(empty)';
      code.setAttribute('aria-hidden', 'true');
      li.appendChild(label);
      li.appendChild(math);
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
        btn.textContent = '';
        btn.appendChild(document.createTextNode(ex.label + ' '));
        const code = document.createElement('code');
        code.textContent = ex.latex;
        code.setAttribute('aria-hidden', 'true');
        btn.appendChild(code);
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
      insertEquation({ newLine: event.data.newLine === true });
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
      if (event.data.selectAll === true) latexInput.select();
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
    announceToUser('', {
      priority: 'assertive',
      latex,
      speech
    });
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
      insertEquation({ newLine: e.shiftKey });
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
  document.getElementById('btn-close-panel')?.addEventListener('click', closePanel);
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
