/**
 * page-main.js — Runs in the PAGE (MAIN) world.
 * Text insertion follows google-docs-utils: dispatch keypress events to
 * iframe.contentDocument (not execCommand on a child element).
 */
(function () {
  'use strict';

  if (window.__latexGdocsMainLoaded) return;
  window.__latexGdocsMainLoaded = true;

  const TEXT_EVENT_SELECTORS = [
    'iframe.docs-texteventtarget-iframe',
    'iframe[class*="texteventtarget"]',
    '.docs-texteventtarget-iframe'
  ];

  function querySelectorDeep(selectors, root = document) {
    for (const selector of selectors) {
      const found = root.querySelector(selector);
      if (found) return found;
    }
    const elements = root.querySelectorAll('*');
    for (const el of elements) {
      if (el.shadowRoot) {
        const found = querySelectorDeep(selectors, el.shadowRoot);
        if (found) return found;
      }
    }
    return null;
  }

  /** @returns {Document | null} */
  function getTextEventTarget() {
    const iframe = querySelectorDeep(TEXT_EVENT_SELECTORS);
    if (!iframe?.contentDocument) return null;
    return iframe.contentDocument;
  }

  function isDocumentActive() {
    return Boolean(
      document.querySelector('.docs-text-ui-cursor-blink') ||
        document.querySelector('.kix-cursor')
    );
  }

  function focusDocument(target, options = {}) {
    try {
      const iframe = querySelectorDeep(TEXT_EVENT_SELECTORS);
      iframe?.contentWindow?.focus();
      if (target?.focus) target.focus();
    } catch {
      /* ignore */
    }

    if (options.wake === false || isDocumentActive()) return;

    // Wake the editor for text insertion only (not image paste).
    dispatchKeypress(target, '?');
    dispatchKeydown(target, 'Backspace', 'Backspace', 8);
  }

  function createKeyboardEvent(name, key, code, keyCode, extra = {}) {
    if (code == null) {
      code = /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : 'Unidentified';
    }
    if (keyCode == null) {
      keyCode = key.codePointAt(0);
    }

    return new KeyboardEvent(name, {
      repeat: false,
      isComposing: false,
      bubbles: true,
      cancelable: true,
      composed: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      key,
      code,
      keyCode,
      charCode: keyCode,
      which: keyCode,
      ...extra
    });
  }

  function dispatchKeypress(target, key, code = null, keyCode = null) {
    target.dispatchEvent(createKeyboardEvent('keypress', key, code, keyCode));
  }

  function dispatchKeydown(target, key, code = null, keyCode = null, extra = {}) {
    target.dispatchEvent(createKeyboardEvent('keydown', key, code, keyCode, extra));
  }

  function dispatchKeyup(target, key, code = null, keyCode = null, extra = {}) {
    target.dispatchEvent(createKeyboardEvent('keyup', key, code, keyCode, extra));
  }

  function dispatchArrowKey(target, direction) {
    const isDown = direction === 'down';
    const key = isDown ? 'ArrowDown' : 'ArrowUp';
    const code = isDown ? 'ArrowDown' : 'ArrowUp';
    const keyCode = isDown ? 40 : 38;
    dispatchKeydown(target, key, code, keyCode);
    dispatchKeyup(target, key, code, keyCode);
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function typeCharacter(target, char) {
    if (char === ' ') {
      dispatchKeypress(target, '\u0020', 'Space', 32);
    } else if (char === '\n') {
      dispatchKeydown(target, 'Enter', 'Enter', 13);
    } else if (char === '\t') {
      dispatchKeydown(target, 'Tab', 'Tab', 9);
    } else {
      dispatchKeypress(target, char);
    }
  }

  function insertViaExecCommand(target, text) {
    try {
      return target.execCommand('insertText', false, text);
    } catch {
      return false;
    }
  }

  function insertViaTypeText(target, text) {
    for (const char of text) {
      typeCharacter(target, char);
    }
    return true;
  }

  function moveCursorLeft(target, count) {
    for (let i = 0; i < count; i++) {
      dispatchKeydown(target, 'ArrowLeft', 'ArrowLeft', 37);
    }
    return true;
  }

  function moveCursorRight(target, count) {
    for (let i = 0; i < count; i++) {
      dispatchKeydown(target, 'ArrowRight', 'ArrowRight', 39);
    }
    return true;
  }

  async function moveCursorVertical(target, direction, count) {
    focusDocument(target, { wake: false });
    const steps = Math.max(0, count || 0);
    for (let i = 0; i < steps; i++) {
      dispatchArrowKey(target, direction);
      if (i < steps - 1) {
        await delay(30);
      }
    }
    return true;
  }

  function moveCursorAfterEquation(target) {
    moveCursorRight(target, 2);
    return true;
  }

  function pasteIntoGoogleDocs(target) {
    if (!target) return false;
    focusDocument(target, { wake: false });

    try {
      if (target.execCommand('paste')) return true;
    } catch {
      /* ignore */
    }

    dispatchKeydown(target, 'v', 'KeyV', 86, { ctrlKey: true });
    return true;
  }

  function insertIntoGoogleDocs(text, cursorLeft) {
    if (!text) return false;

    const target = getTextEventTarget();
    if (!target) return false;

    focusDocument(target);

    let ok = false;
    if (insertViaExecCommand(target, text)) {
      ok = true;
    } else {
      ok = insertViaTypeText(target, text);
    }

    if (ok && cursorLeft > 0) {
      moveCursorLeft(target, cursorLeft);
    }

    return ok;
  }

  function moveCursorToDocumentEnd(target) {
    dispatchKeydown(target, 'End', 'End', 35, { ctrlKey: true });
    dispatchKeyup(target, 'End', 'End', 35, { ctrlKey: true });
    return true;
  }

  function moveCursorToDocumentStart(target) {
    dispatchKeydown(target, 'Home', 'Home', 36, { ctrlKey: true });
    dispatchKeyup(target, 'Home', 'Home', 36, { ctrlKey: true });
    return true;
  }

  function moveCursorToLineStart(target) {
    focusDocument(target, { wake: false });
    dispatchKeydown(target, 'Home', 'Home', 36);
    dispatchKeyup(target, 'Home', 'Home', 36);
    return true;
  }

  function moveCursorToLineEnd(target) {
    focusDocument(target, { wake: false });
    dispatchKeydown(target, 'End', 'End', 35);
    dispatchKeyup(target, 'End', 'End', 35);
    return true;
  }

  /** Select the caret's line and overwrite it in one step. */
  function replaceCurrentLine(target, text) {
    focusDocument(target, { wake: false });
    dispatchKeydown(target, 'Home', 'Home', 36);
    dispatchKeyup(target, 'Home', 'Home', 36);
    dispatchKeydown(target, 'End', 'End', 35, { shiftKey: true });
    dispatchKeyup(target, 'End', 'End', 35, { shiftKey: true });

    if (insertViaExecCommand(target, text)) return true;
    return insertViaTypeText(target, text);
  }

  function undoLastEdit(target) {
    focusDocument(target, { wake: false });
    dispatchKeydown(target, 'z', 'KeyZ', 90, { ctrlKey: true });
    dispatchKeyup(target, 'z', 'KeyZ', 90, { ctrlKey: true });
    return true;
  }

  function selectCurrentLine(target) {
    focusDocument(target, { wake: false });
    dispatchKeydown(target, 'Home', 'Home', 36);
    dispatchKeyup(target, 'Home', 'Home', 36);
    dispatchKeydown(target, 'End', 'End', 35, { shiftKey: true });
    dispatchKeyup(target, 'End', 'End', 35, { shiftKey: true });
    return true;
  }

  function clickAtPointMain(x, y) {
    const target = getTextEventTarget();
    focusDocument(target, { wake: false });

    const el = document.elementFromPoint(x, y);
    if (!el?.closest?.('.kix-appview-editor')) return false;

    for (const type of ['mousedown', 'mouseup', 'click']) {
      el.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y
        })
      );
    }

    try {
      const iframe = querySelectorDeep(TEXT_EVENT_SELECTORS);
      iframe?.contentWindow?.focus();
      target?.focus?.();
    } catch {
      /* ignore */
    }

    return true;
  }

  function deleteCurrentLine(target) {
    focusDocument(target, { wake: false });
    dispatchKeydown(target, 'Home', 'Home', 36);
    dispatchKeydown(target, 'End', 'End', 35, { shiftKey: true });
    dispatchKeydown(target, 'Backspace', 'Backspace', 8);
    return true;
  }

  function deleteInGoogleDocs(mode) {
    const target = getTextEventTarget();
    if (!target) return false;
    if (mode === 'line') {
      return deleteCurrentLine(target);
    }
    return false;
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data) return;

    if (data.type === 'LATEX_GDOCS_PING') {
      window.postMessage({ type: 'LATEX_GDOCS_PONG', id: data.id }, '*');
      return;
    }

    if (data.type === 'LATEX_GDOCS_MOVE_CURSOR') {
      const target = getTextEventTarget();
      (async () => {
        let ok = false;
        if (target) {
          if (data.direction === 'right') {
            ok = moveCursorRight(target, data.count || 0);
          } else if (data.direction === 'down') {
            ok = await moveCursorVertical(target, 'down', data.count || 1);
          } else if (data.direction === 'up') {
            ok = await moveCursorVertical(target, 'up', data.count || 1);
          } else if (data.direction === 'documentEnd') {
            ok = moveCursorToDocumentEnd(target);
          } else if (data.direction === 'documentStart') {
            ok = moveCursorToDocumentStart(target);
          } else if (data.direction === 'lineStart') {
            ok = moveCursorToLineStart(target);
          } else if (data.direction === 'lineEnd') {
            ok = moveCursorToLineEnd(target);
          } else if (data.direction === 'selectLine') {
            ok = selectCurrentLine(target);
          } else if (data.direction === 'undo') {
            ok = undoLastEdit(target);
          } else if (data.afterEquation) {
            ok = moveCursorAfterEquation(target);
          } else {
            ok = moveCursorLeft(target, data.count || 0);
          }
        }
        window.postMessage({ type: 'LATEX_GDOCS_CURSOR_RESULT', id: data.id, ok }, '*');
      })();
      return;
    }

    if (data.type === 'LATEX_GDOCS_CLICK_POINT') {
      const ok = clickAtPointMain(data.x, data.y);
      window.postMessage({ type: 'LATEX_GDOCS_CLICK_RESULT', id: data.id, ok }, '*');
      return;
    }

    if (data.type === 'LATEX_GDOCS_PASTE') {
      const target = getTextEventTarget();
      const ok = pasteIntoGoogleDocs(target);
      window.postMessage({ type: 'LATEX_GDOCS_PASTE_RESULT', id: data.id, ok }, '*');
      return;
    }

    if (data.type === 'LATEX_GDOCS_REPLACE_LINE') {
      const target = getTextEventTarget();
      const ok = target ? replaceCurrentLine(target, data.text || '') : false;
      window.postMessage(
        { type: 'LATEX_GDOCS_REPLACE_LINE_RESULT', id: data.id, ok },
        '*'
      );
      return;
    }

    if (data.type === 'LATEX_GDOCS_DELETE') {
      const ok = deleteInGoogleDocs(data.mode || 'line');
      window.postMessage({ type: 'LATEX_GDOCS_DELETE_RESULT', id: data.id, ok }, '*');
      return;
    }

    if (data.type !== 'LATEX_GDOCS_INSERT') return;

    const ok = insertIntoGoogleDocs(data.text || '', data.cursorLeft || 0);
    window.postMessage(
      { type: 'LATEX_GDOCS_INSERT_RESULT', id: data.id, ok },
      '*'
    );
  });

  window.__latexGdocsInsert = insertIntoGoogleDocs;
  window.__latexGdocsGetTarget = getTextEventTarget;
  document.documentElement.setAttribute('data-latex-gdocs-main', '1');
})();
