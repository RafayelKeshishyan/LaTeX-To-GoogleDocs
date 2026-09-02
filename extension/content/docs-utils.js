/**
 * docs-utils.js — Google Docs iframe text insertion helpers
 */

const DocsUtils = (() => {
  // ASCII delimiters survive Google Docs better than Unicode ⟦eq⟧
  const EQ_OPEN = '[[eq]]';
  const EQ_CLOSE = '[[/eq]]';
  const EQ_REGEX = /\[\[eq\]\]([\s\S]*?)\[\[\/eq\]\]/g;

  let cachedIframe = null;

  const DOC_ID_RE = /\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/i;

  /** True only on a specific document's desktop /edit URL. */
  function isDocumentEditPage() {
    return DOC_ID_RE.test(location.pathname) && /\/edit\b/i.test(location.pathname);
  }

  /** Mobile/preview/view-only document URLs that cannot use the text-input iframe. */
  function isUnsupportedDocsView() {
    const path = location.pathname;
    if (/\/mobilebasic\b|\/preview\b|\/pub\b/i.test(path)) return true;
    if (DOC_ID_RE.test(path) && !/\/edit\b/i.test(path)) return true;
    return false;
  }

  function getDesktopEditUrl() {
    const match = location.pathname.match(/\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
    if (!match) return 'https://docs.google.com/document/u/0/';
    return `https://docs.google.com/document/d/${match[1]}/edit`;
  }

  function isDesktopEditor() {
    return isDocumentEditPage() && !isUnsupportedDocsView();
  }

  function querySelectorDeep(selector, root = document) {
    const direct = root.querySelector(selector);
    if (direct) return direct;
    const elements = root.querySelectorAll('*');
    for (const el of elements) {
      if (el.shadowRoot) {
        const found = querySelectorDeep(selector, el.shadowRoot);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Find Google Docs' hidden text-input iframe (multiple fallbacks).
   */
  function getEditableIframe() {
    if (cachedIframe?.isConnected) {
      try {
        if (cachedIframe.contentDocument) return cachedIframe;
      } catch {
        cachedIframe = null;
      }
    }

    const selectors = [
      'iframe.docs-texteventtarget-iframe',
      'iframe[class*="texteventtarget"]',
      'iframe.docs-offscreen-z-index'
    ];

    for (const sel of selectors) {
      const frame = querySelectorDeep(sel);
      if (frame) {
        cachedIframe = frame;
        return frame;
      }
    }

    for (const frame of document.querySelectorAll('iframe')) {
      try {
        const doc = frame.contentDocument;
        if (!doc) continue;
        const editable =
          doc.querySelector('[contenteditable="true"]') ||
          doc.querySelector('[role="textbox"]') ||
          doc.body;
        if (editable) {
          cachedIframe = frame;
          return frame;
        }
      } catch {
        /* cross-origin or inaccessible */
      }
    }

    return null;
  }

  function getTextEventTarget() {
    const iframe = getEditableIframe();
    if (!iframe?.contentDocument) return null;

    const doc = iframe.contentDocument;
    return (
      doc.querySelector('[contenteditable="true"]') ||
      doc.querySelector('[role="textbox"]') ||
      doc.activeElement ||
      doc.body
    );
  }

  function getEditorRoot() {
    // Visible document text lives in the kix canvas, not the hidden input iframe.
    const kixEditor = document.querySelector('.kix-appview-editor');
    if (kixEditor) return kixEditor;
    const iframe = getEditableIframe();
    if (iframe?.contentDocument?.body) {
      return iframe.contentDocument.body;
    }
    return document.body;
  }

  /**
   * Focus the hidden text-input iframe only — never click the canvas
   * (clicking .kix-appview-editor selects text and opens Google's toolbar).
   */
  function focusEditor() {
    const iframe = getEditableIframe();
    if (!iframe?.contentWindow) return false;

    try {
      iframe.contentWindow.focus();
      const target = getTextEventTarget();
      if (target?.focus) {
        target.focus();
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function waitForIframe(maxMs = 3000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const frame = getEditableIframe();
        if (frame) {
          resolve(frame);
          return;
        }
        if (Date.now() - start >= maxMs) {
          resolve(null);
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  function insertViaExecCommand(text) {
    const iframe = getEditableIframe();
    if (!iframe?.contentDocument || !iframe.contentWindow) return false;

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    const target = getTextEventTarget();

    focusEditor();
    if (target?.focus) target.focus();

    try {
      if (doc.execCommand('insertText', false, text)) return true;
    } catch {
      /* fall through */
    }

    try {
      const sel = win.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const node = doc.createTextNode(text);
        range.insertNode(node);
        range.setStartAfter(node);
        range.setEndAfter(node);
        sel.removeAllRanges();
        sel.addRange(range);
        target?.dispatchEvent(
          new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text })
        );
        return true;
      }
    } catch {
      /* fall through */
    }

    return false;
  }

  /**
   * Type text by dispatching key events (Google Docs listens on iframe).
   */
  function insertViaKeyEvents(text) {
    const target = getTextEventTarget();
    if (!target) return false;

    focusEditor();
    target.focus();

    const win = target.ownerDocument?.defaultView || window;
    for (const char of text) {
      const opts = {
        key: char,
        code: char === ' ' ? 'Space' : `Key${char.toUpperCase()}`,
        bubbles: true,
        cancelable: true,
        view: win
      };
      target.dispatchEvent(new KeyboardEvent('keydown', opts));
      target.dispatchEvent(new KeyboardEvent('keypress', opts));
      target.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: char
      }));
      target.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: char
      }));
      target.dispatchEvent(new KeyboardEvent('keyup', opts));
    }
    return true;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function clickAtPoint(x, y) {
    const target = document.elementFromPoint(x, y);
    if (!target?.closest?.('.kix-appview-editor')) return false;
    for (const type of ['mousedown', 'mouseup', 'click']) {
      target.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y
        })
      );
    }
    window.__latexGdocsLastPointer = { x, y, t: Date.now() };
    focusEditor();
    return true;
  }

  function clickAtPointViaMainWorld(x, y) {
    return new Promise((resolve) => {
      const id = `clk-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      function onMessage(event) {
        if (event.source !== window) return;
        const data = event.data;
        if (data?.type !== 'LATEX_GDOCS_CLICK_RESULT' || data.id !== id) return;
        window.removeEventListener('message', onMessage);
        if (data.ok) {
          window.__latexGdocsLastPointer = { x, y, t: Date.now() };
        }
        resolve(Boolean(data.ok));
      }

      window.addEventListener('message', onMessage);
      window.postMessage({ type: 'LATEX_GDOCS_CLICK_POINT', id, x, y }, '*');

      setTimeout(() => {
        window.removeEventListener('message', onMessage);
        resolve(false);
      }, 2000);
    });
  }

  async function clickKixLineElement(line) {
    if (!line) return false;
    const textBlock =
      line.querySelector('.kix-lineview-text-block') ||
      line.querySelector('.kix-lineview-content') ||
      line;
    try {
      textBlock.scrollIntoView({ block: 'center', behavior: 'instant' });
    } catch {
      textBlock.scrollIntoView({ block: 'center' });
    }
    await sleep(40);
    const rect = textBlock.getBoundingClientRect();
    const x = rect.left + Math.max(Math.min(rect.width / 2, rect.width - 8), 12);
    const y = rect.top + Math.max(rect.height / 2, 10);
    await ExtensionContext.ensurePageMain();
    const ok = await clickAtPointViaMainWorld(x, y);
    if (!ok) {
      return clickAtPoint(x, y);
    }
    focusEditor();
    return true;
  }

  async function clickEquationLine(equation) {
    const lines = getKixLines();
    if (equation?.lineIndex >= 0 && lines[equation.lineIndex]) {
      return clickKixLineElement(lines[equation.lineIndex]);
    }
    const rect = equation?.rect;
    if (!rect) return false;
    const x = (rect.left || 0) + Math.max((rect.width || 40) / 2, 20);
    const y = (rect.top || 0) + Math.max((rect.height || 20) / 2, 10);
    await ExtensionContext.ensurePageMain();
    const ok = await clickAtPointViaMainWorld(x, y);
    if (!ok) {
      return clickAtPoint(x, y);
    }
    focusEditor();
    return true;
  }

  function scrollLineIntoView(line) {
    if (!line) return;
    const target =
      line.querySelector('.kix-lineview-text-block') ||
      line.querySelector('.kix-lineview-content') ||
      line;
    try {
      target.scrollIntoView({ block: 'center', behavior: 'instant' });
    } catch {
      target.scrollIntoView({ block: 'center' });
    }
  }

  /**
   * Caret line from the rendered caret only. Unlike getCursorLineIndex() this
   * never falls back to the remembered pointer, so callers can tell the
   * difference between "caret is here" and "caret position unknown".
   */
  function getCursorLineIndexStrict() {
    if (isCanvasMode()) return caretLineIndexCanvas();
    const rect = getCursorRect();
    if (!rect) return -1;
    const y = rect.top + Math.max(rect.height, 8) / 2;
    const lines = getKixLines();
    let best = -1;
    let bestDy = Infinity;
    for (let i = 0; i < lines.length; i++) {
      const r = lines[i].getBoundingClientRect();
      if (r.height <= 0) continue;
      const dy = Math.abs(y - (r.top + r.height / 2));
      if (dy < bestDy) {
        bestDy = dy;
        best = i;
      }
    }
    return bestDy <= 40 ? best : -1;
  }

  let knownCaretLine = -1;

  function resetKnownCaretLine() {
    knownCaretLine = -1;
  }

  /**
   * Place the Google Docs caret on a line using arrow keys. Synthetic mouse
   * clicks on the kix canvas do not reliably move the caret, so keyboard
   * movement from a known anchor is the only dependable path.
   */
  async function moveCursorToLineIndex(targetIndex) {
    if (targetIndex < 0) return false;
    if (isCanvasMode()) return moveCursorToLineIndexCanvas(targetIndex);

    const lines = getKixLines();
    if (targetIndex >= lines.length) return false;

    await ExtensionContext.ensurePageMain();
    if (!focusEditor()) {
      await clickKixLineElement(lines[targetIndex]);
    }
    await sleep(120);

    scrollLineIntoView(lines[targetIndex]);

    let from = getCursorLineIndexStrict();
    if (from < 0) from = knownCaretLine;

    if (from < 0) {
      await moveCursor('documentStart', 0);
      await sleep(120);
      from = 0;
    }

    if (from !== targetIndex) {
      const delta = targetIndex - from;
      await moveCursor(delta > 0 ? 'down' : 'up', Math.abs(delta));
      await sleep(140);
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      const actual = getCursorLineIndexStrict();
      if (actual < 0 || actual === targetIndex) break;
      const delta = targetIndex - actual;
      await moveCursor(delta > 0 ? 'down' : 'up', Math.abs(delta));
      await sleep(140);
    }

    await moveCursor('lineStart', 0);
    await sleep(80);

    const verified = getCursorLineIndexStrict();
    knownCaretLine = verified >= 0 ? verified : targetIndex;
    captureCursorPointer();
    scrollLineIntoView(lines[targetIndex]);
    return knownCaretLine === targetIndex;
  }

  async function moveCursorToEquationLine(equation) {
    if (!equation) return false;
    if (equation.lineIndex != null && equation.lineIndex >= 0) {
      return moveCursorToLineIndex(equation.lineIndex);
    }
    await clickEquationLine(equation);
    captureCursorPointer();
    focusEditor();
    return true;
  }

  function lineIsEquationOnly(lineText, fullMatch) {
    const text = normalizeScanText(lineText).trim();
    const match = normalizeScanText(fullMatch || '').trim();
    if (!text || !match) return false;
    if (text === match) return true;
    const zones = findZones(text);
    if (zones.length !== 1) return false;
    const remainder = text.replace(zones[0].fullMatch, '').trim();
    return !remainder;
  }

  function deleteViaMainWorld(options = {}) {
    return new Promise((resolve) => {
      const id = `del-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      function onMessage(event) {
        if (event.source !== window) return;
        const data = event.data;
        if (data?.type !== 'LATEX_GDOCS_DELETE_RESULT' || data.id !== id) return;
        window.removeEventListener('message', onMessage);
        resolve(Boolean(data.ok));
      }

      window.addEventListener('message', onMessage);
      window.postMessage({ type: 'LATEX_GDOCS_DELETE', id, ...options }, '*');

      setTimeout(() => {
        window.removeEventListener('message', onMessage);
        resolve(false);
      }, 3000);
    });
  }

  async function deleteEquationZone(equation) {
    if (!equation?.latex?.trim()) {
      return { ok: false, error: 'No equation to delete.' };
    }

    const fullMatch = equation.fullMatch || zoneText(equation.latex);

    await ExtensionContext.ensurePageMain();
    await moveCursorToEquationLine(equation);
    await sleep(150);
    focusEditor();
    await sleep(120);

    // Never delete a line we have not confirmed the caret is sitting on,
    // otherwise a failed cursor move wipes out an unrelated line.
    const caretLine = getCursorLineIndexStrict();
    const lineText =
      caretLine < 0
        ? ''
        : isCanvasMode()
          ? getModelLineText(caretLine)
          : getLineDisplayText(getKixLines()[caretLine] || document.createElement('div'));

    const onEquation =
      lineText &&
      findZones(lineText).some((zone) => latexMatches(zone.latex, equation.latex));

    if (!onEquation) {
      return {
        ok: false,
        error:
          'Could not put the cursor on that equation. Click the equation line, then press Control Shift Delete.'
      };
    }

    if (!lineIsEquationOnly(lineText, fullMatch)) {
      return {
        ok: false,
        error:
          'Equation shares a line with other text. Select the equation manually, then press Delete.'
      };
    }

    const textBefore = readHiddenModelText();
    const ok = await deleteViaMainWorld({ mode: 'line' });
    if (!ok) {
      return { ok: false, error: 'Could not delete. Click the equation line and try again.' };
    }

    await sleep(250);
    resetKnownCaretLine();

    const textAfter = readHiddenModelText();
    const problem = describeDeleteProblem(textBefore, textAfter, equation, fullMatch);
    if (problem) {
      await moveCursor('undo', 0);
      await sleep(300);
      return { ok: false, error: problem };
    }

    return { ok: true, latex: equation.latex, fullMatch };
  }

  function replaceLineViaMainWorld(text) {
    return new Promise((resolve) => {
      const id = `rep-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      function onMessage(event) {
        if (event.source !== window) return;
        const data = event.data;
        if (data?.type !== 'LATEX_GDOCS_REPLACE_LINE_RESULT' || data.id !== id) return;
        window.removeEventListener('message', onMessage);
        resolve(Boolean(data.ok));
      }

      window.addEventListener('message', onMessage);
      window.postMessage({ type: 'LATEX_GDOCS_REPLACE_LINE', id, text }, '*');

      setTimeout(() => {
        window.removeEventListener('message', onMessage);
        resolve(false);
      }, 4000);
    });
  }

  function caretLineText() {
    const caretLine = getCursorLineIndexStrict();
    if (caretLine < 0) return { caretLine, text: '' };
    if (isCanvasMode()) return { caretLine, text: getModelLineText(caretLine) };
    const el = getKixLines()[caretLine];
    return { caretLine, text: el ? getLineDisplayText(el) : '' };
  }

  /**
   * Overwrite an existing equation in place, keeping its position in the
   * document. Verifies the result against the document text and undoes the
   * change if anything other than that one equation was affected.
   */
  async function replaceEquationZone(equation, newLatex) {
    const nextLatex = (newLatex || '').trim();
    if (!equation?.latex?.trim()) {
      return { ok: false, error: 'No equation selected to edit.' };
    }
    if (!nextLatex) {
      return { ok: false, error: 'Type LaTeX first.' };
    }

    // Re-resolve against the live document so a shifted line still matches.
    const current =
      listEquationsOrdered().find((eq) => latexMatches(eq.latex, equation.latex)) ||
      equation;

    const oldFull = current.fullMatch || zoneText(current.latex);
    const newFull = zoneText(nextLatex);

    await ExtensionContext.ensurePageMain();
    await moveCursorToEquationLine(current);
    await sleep(150);
    focusEditor();
    await sleep(120);

    const { text: lineText } = caretLineText();
    const onEquation =
      lineText &&
      findZones(lineText).some((zone) => latexMatches(zone.latex, current.latex));

    if (!onEquation) {
      return {
        ok: false,
        error:
          'Could not put the cursor on that equation. Click the equation line, then press F2 again.'
      };
    }

    if (!lineIsEquationOnly(lineText, oldFull)) {
      return {
        ok: false,
        error:
          'That equation shares a line with other text, so it cannot be replaced automatically.'
      };
    }

    const textBefore = readHiddenModelText();
    const ok = await replaceLineViaMainWorld(newFull);
    if (!ok) {
      return { ok: false, error: 'Could not replace the equation. Try again.' };
    }

    await sleep(300);
    resetKnownCaretLine();

    const textAfter = readHiddenModelText();
    const problem = describeReplaceProblem(textBefore, textAfter, {
      oldLatex: current.latex,
      newLatex: nextLatex,
      oldFull,
      newFull
    });

    if (problem) {
      await moveCursor('undo', 0);
      await sleep(300);
      return { ok: false, error: problem };
    }

    return {
      ok: true,
      latex: nextLatex,
      fullMatch: newFull,
      lineIndex: current.lineIndex
    };
  }

  function describeReplaceProblem(before, after, parts) {
    if (!before) return null;

    const zones = findZones(after);
    if (!zones.some((zone) => latexMatches(zone.latex, parts.newLatex))) {
      return 'The new equation was not written, so the change was undone.';
    }

    const sameLatex = latexMatches(parts.oldLatex, parts.newLatex);
    if (!sameLatex && zones.some((zone) => latexMatches(zone.latex, parts.oldLatex))) {
      return 'The old equation is still there, so the change was undone.';
    }

    const expectedDelta = parts.newFull.length - parts.oldFull.length;
    const actualDelta = after.length - before.length;
    if (Math.abs(actualDelta - expectedDelta) > 12) {
      return 'Replacing changed more text than expected, so it was undone.';
    }

    return null;
  }

  /**
   * Compare the document before and after a delete. Returns an error message
   * when the wrong content went missing, so the caller can undo.
   */
  function describeDeleteProblem(before, after, equation, fullMatch) {
    if (!before) return null;

    if (after === before) {
      return 'Nothing was deleted. Click the equation line and try again.';
    }

    const stillThere = findZones(after).some((zone) =>
      latexMatches(zone.latex, equation.latex)
    );
    if (stillThere) {
      return 'That equation is still there. Click the equation line and try again.';
    }

    const removed = before.length - after.length;
    const expected = (fullMatch || '').length;
    if (removed > expected + 12) {
      return 'Delete removed more than the equation, so it was undone. Select the equation manually and press Delete.';
    }

    return null;
  }

  function clickAtCursor() {
    const cursor =
      document.querySelector('.docs-text-ui-cursor-blink') ||
      document.querySelector('.kix-cursor-caret') ||
      document.querySelector('.kix-cursor');
    if (cursor) {
      const rect = cursor.getBoundingClientRect();
      const x = rect.left + Math.max(rect.width / 2, 1);
      const y = rect.top + Math.max(rect.height / 2, 1);
      const target = document.elementFromPoint(x, y);
      if (target) {
        for (const type of ['mousedown', 'mouseup', 'click']) {
          target.dispatchEvent(
            new MouseEvent(type, {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: x,
              clientY: y
            })
          );
        }
      }
    }
    focusEditor();
  }

  /** Re-focus the last place the user clicked in the document (best insert target). */
  function focusInsertPoint() {
    const ptr = window.__latexGdocsLastPointer;
    let clicked = false;

    if (ptr && Date.now() - ptr.t < 30 * 60 * 1000) {
      const el = document.elementFromPoint(ptr.x, ptr.y);
      if (el?.closest?.('.kix-appview-editor')) {
        for (const type of ['mousedown', 'mouseup', 'click']) {
          el.dispatchEvent(
            new MouseEvent(type, {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: ptr.x,
              clientY: ptr.y
            })
          );
        }
        clicked = true;
      }
    }

    if (!clicked) {
      return false;
    }

    focusEditor();
    return true;
  }

  function captureCursorPointer() {
    const cursor = getCursorRect();
    if (!cursor) return false;
    window.__latexGdocsLastPointer = {
      x: (cursor.left || 0) + 4,
      y: (cursor.top || 0) + Math.max((cursor.height || 20) / 2, 8),
      t: Date.now()
    };
    return true;
  }

  async function moveCursorToDocumentEnd() {
    return moveCursor('documentEnd', 0);
  }

  async function ensureInsertPoint() {
    if (focusInsertPoint()) {
      return true;
    }
    focusEditor();
    await moveCursorToDocumentEnd();
    await sleep(80);
    updateInsertPointerFromCursor();
    return true;
  }

  function countInlineImages() {
    const root = document.querySelector('.kix-appview-editor');
    if (!root) return 0;
    return root.querySelectorAll(
      'img, .kix-inlineimageview, .kix-embeddedobject, [class*="inlineImage"]'
    ).length;
  }

  async function insertImagePng(dataUrl, imagesBefore) {
    if (!dataUrl || !isDocumentEditPage()) return false;
    await ExtensionContext.ensurePageMain();

    clickAtCursor();
    await sleep(120);
    focusEditor();
    await sleep(80);

    let blob;
    try {
      blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch (err) {
      console.warn('[LaTeX-GDocs] clipboard image write failed', err);
      return false;
    }

    const iframe = getEditableIframe();
    const doc = iframe?.contentDocument;
    const target = getTextEventTarget();

    if (doc && target) {
      try {
        iframe.contentWindow?.focus();
        target.focus?.();
        if (doc.execCommand('paste')) {
          await sleep(800);
          if (countInlineImages() > imagesBefore) return true;
        }
      } catch (err) {
        console.warn('[LaTeX-GDocs] direct paste failed', err);
      }
    }

    const pasted = await insertViaMainWorldPaste();
    if (!pasted) return false;
    await sleep(800);
    return countInlineImages() > imagesBefore;
  }

  function insertViaMainWorldPaste() {
    return new Promise((resolve) => {
      const id = `lp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      function onMessage(event) {
        if (event.source !== window) return;
        const data = event.data;
        if (data?.type !== 'LATEX_GDOCS_PASTE_RESULT' || data.id !== id) return;
        window.removeEventListener('message', onMessage);
        resolve(Boolean(data.ok));
      }

      window.addEventListener('message', onMessage);
      window.postMessage({ type: 'LATEX_GDOCS_PASTE', id }, '*');

      setTimeout(() => {
        window.removeEventListener('message', onMessage);
        resolve(false);
      }, 3000);
    });
  }

  async function pasteImagePng(dataUrl) {
    return insertImagePng(dataUrl);
  }

  function insertViaMainWorld(text, cursorLeft = 0) {
    return new Promise((resolve) => {
      const id = `lg-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      function onMessage(event) {
        if (event.source !== window) return;
        const data = event.data;
        if (data?.type !== 'LATEX_GDOCS_INSERT_RESULT' || data.id !== id) return;
        window.removeEventListener('message', onMessage);
        resolve(Boolean(data.ok));
      }

      window.addEventListener('message', onMessage);
      window.postMessage({ type: 'LATEX_GDOCS_INSERT', id, text, cursorLeft }, '*');

      setTimeout(() => {
        window.removeEventListener('message', onMessage);
        resolve(false);
      }, 3000);
    });
  }

  async function insertText(text, options = {}) {
    const cursorLeft = options.cursorLeft || 0;
    if (!isDocumentEditPage()) {
      console.warn('[LaTeX-GDocs] open a document at a URL ending in /edit');
      return false;
    }
    if (isUnsupportedDocsView()) {
      ExtensionContext.showDesktopRequiredBanner(getDesktopEditUrl());
      console.warn('[LaTeX-GDocs] desktop editor required — current URL is mobile/preview, not /edit');
      return false;
    }

    await ExtensionContext.ensurePageMain();

    let iframe = getEditableIframe();
    if (!iframe) {
      iframe = await waitForIframe(2000);
    }
    if (!iframe) {
      console.warn('[LaTeX-GDocs] editable iframe not found — click in the document body first');
      return false;
    }

    focusEditor();

    const mainOk = await insertViaMainWorld(text, cursorLeft);
    if (mainOk) return true;

    if (insertViaExecCommand(text)) return true;
    if (insertViaInputEventsLocal(text)) return true;

    console.warn('[LaTeX-GDocs] insertText failed after all methods');
    return false;
  }

  function insertViaInputEventsLocal(text) {
    const ctx = getTextEventTarget();
    if (!ctx) return false;
    const doc = ctx.ownerDocument;
    const win = doc.defaultView;
    focusEditor();
    for (const char of text) {
      const input = new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: char
      });
      ctx.dispatchEvent(input);
    }
    return false; // isolated world — don't trust this path
  }

  function emptyZoneText() {
    return EQ_OPEN + EQ_CLOSE;
  }

  function zoneText(latex) {
    return EQ_OPEN + latex + EQ_CLOSE;
  }

  function normalizeScanText(text) {
    if (!text) return '';
    return clearKixText(text).replace(/[\u200B-\u200D\uFEFF\u034F\u00AD\u2060]/g, '');
  }

  function hasEquationMarkup(text) {
    const normalized = normalizeScanText(text);
    if (/(?:\[\[eq\]\]|\u27E6eq\u27E7|⟦eq⟧)/i.test(normalized)) return true;
    if (/\[\[/.test(normalized) && /\/eq\]\]/i.test(normalized)) return true;
    return false;
  }

  function findZones(text) {
    const normalized = normalizeScanText(text);
    const zones = [];
    const patterns = [
      /\[\[eq\]\]([\s\S]*?)\[\[\/eq\]\]/gi,
      /\u27E6eq\u27E7([\s\S]*?)\u27E6\/eq\u27E7/g,
      /\[\s*\[\s*eq\s*\]\s*\]([\s\S]*?)\[\s*\[\s*\/\s*eq\s*\]\s*\]/gi
    ];

    for (const source of patterns) {
      const re = new RegExp(source.source, source.flags.includes('g') ? source.flags : source.flags + 'g');
      let match;
      while ((match = re.exec(normalized)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        const overlaps = zones.some((zone) => start < zone.end && end > zone.start);
        if (!overlaps) {
          zones.push({
            fullMatch: match[0],
            latex: match[1],
            start,
            end
          });
        }
      }
    }

    return zones.sort((a, b) => a.start - b.start);
  }

  function getLineDisplayText(line) {
    const textBlock =
      line.querySelector('.kix-lineview-text-block') ||
      line.querySelector('.kix-lineview-content');
    const raw = textBlock
      ? textBlock.innerText || textBlock.textContent || ''
      : line.innerText || line.textContent || '';
    return normalizeScanText(raw);
  }

  function rectForLine(line) {
    const textBlock =
      line.querySelector('.kix-lineview-text-block') ||
      line.querySelector('.kix-lineview-content') ||
      line;
    const blockRect = textBlock.getBoundingClientRect();
    if (blockRect.width > 0 || blockRect.height > 0) return blockRect;
    return line.getBoundingClientRect();
  }

  function findRectForEquationSnippet(snippet, latex) {
    const lines = getKixLines();
    for (const line of lines) {
      const text = getLineDisplayText(line);
      if (!text) continue;
      if ((snippet && text.includes(snippet)) || (latex && text.includes(latex))) {
        return rectForLine(line);
      }
    }

    const editor = document.querySelector('.kix-appview-editor');
    return editor?.getBoundingClientRect() || { top: 200, left: 200, width: 400, height: 24 };
  }

  function zoneFromMatch(zone, rect, element) {
    return {
      element: element || null,
      textNode: null,
      latex: zone.latex,
      fullMatch: zone.fullMatch,
      start: zone.start,
      end: zone.end,
      rect,
      range: null
    };
  }

  function clearKixText(text) {
    if (!text) return '';
    return text
      .replace(/\u200C/g, '')
      .replace(/\u200B/g, '')
      .replace(/\uFEFF/g, '')
      .replace(/\u034F/g, '')
      .replace(/\u00A0/g, ' ');
  }

  function getCursorRect() {
    const selectors = [
      '.docs-text-ui-cursor-blink',
      '.kix-cursor-caret',
      '.kix-cursor'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height > 0 || rect.width > 0) {
        return {
          top: rect.top,
          left: rect.left,
          width: Math.max(rect.width, 2),
          height: Math.max(rect.height, 20)
        };
      }
    }
    return null;
  }

  function rectForLinearZoneAtCursor(cursorRect) {
    if (!cursorRect) {
      return { top: 200, left: 200, width: 180, height: 24 };
    }
    return {
      top: cursorRect.top,
      left: cursorRect.left - 60,
      width: 180,
      height: Math.max(cursorRect.height, 22)
    };
  }

  function scanDocumentWideZones() {
    const results = [];
    const lines = getKixLines();
    const lineData = [];
    let fullText = '';

    for (const line of lines) {
      const textBlock =
        line.querySelector('.kix-lineview-text-block') ||
        line.querySelector('.kix-lineview-content');
      const text = getLineDisplayText(line);
      lineData.push({ line, textBlock, start: fullText.length, text });
      fullText += text + '\n';
    }

    if (!hasEquationMarkup(fullText)) return results;

    const zones = findZones(fullText);
    for (const zone of zones) {
      let anchor = lineData[0];
      for (const entry of lineData) {
        const entryEnd = entry.start + entry.text.length + 1;
        if (zone.start < entryEnd) {
          anchor = entry;
          break;
        }
      }

      const textBlock = anchor.textBlock;
      const line = anchor.line;
      const blockRect = textBlock?.getBoundingClientRect?.() || { width: 0 };
      const lineRect = line.getBoundingClientRect();
      const rect =
        blockRect.width > 0
          ? blockRect
          : { top: lineRect.top, left: lineRect.left, width: lineRect.width, height: lineRect.height };

      results.push({
        element: textBlock || line,
        textNode: null,
        latex: zone.latex,
        fullMatch: zone.fullMatch,
        start: zone.start,
        end: zone.end,
        rect,
        range: null
      });
    }

    return results;
  }

  function scanKixLineZones() {
    const results = [];
    const lines = document.querySelectorAll('.kix-lineview, .kix-paragraphrenderer');

    for (const line of lines) {
      const textBlock =
        line.querySelector('.kix-lineview-text-block') ||
        line.querySelector('.kix-lineview-content');
      if (!textBlock) continue;

      const text = getLineDisplayText(line);
      if (!hasEquationMarkup(text)) continue;

      const zones = findZones(text);
      for (const zone of zones) {
        const rect = rectForLine(line);
        results.push(zoneFromMatch(zone, rect, textBlock));
      }
    }

    return results;
  }

  function scanTextNodeZones() {
    const results = [];
    const root = getEditorRoot();
    if (!root) return results;

    const nodeMap = [];
    let fullText = '';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);

    let node;
    while ((node = walker.nextNode())) {
      const raw = node.textContent || '';
      if (!raw) continue;
      const text = clearKixText(raw);
      if (!text) continue;
      nodeMap.push({ node, start: fullText.length, text });
      fullText += text;
    }
    if (!hasEquationMarkup(fullText)) return results;

    const zones = findZones(fullText);

    zones.forEach((zone) => {
      let startNode = null;
      let startOff = 0;
      let endNode = null;
      let endOff = 0;

      for (const entry of nodeMap) {
        const entryEnd = entry.start + entry.text.length;
        if (!startNode && zone.start < entryEnd) {
          startNode = entry.node;
          startOff = Math.max(0, zone.start - entry.start);
        }
        if (zone.end <= entryEnd) {
          endNode = entry.node;
          endOff = Math.max(0, zone.end - entry.start);
          break;
        }
      }

      if (!startNode || !endNode) return;

      const el = startNode.parentElement;
      if (!el) return;

      const range = document.createRange();
      try {
        range.setStart(startNode, startOff);
        range.setEnd(endNode, endOff);
        const rect = range.getBoundingClientRect();
        results.push({
          element: el,
          textNode: startNode,
          latex: zone.latex,
          fullMatch: zone.fullMatch,
          start: zone.start,
          end: zone.end,
          rect,
          range
        });
      } catch {
        /* range may fail on complex nodes */
      }
    });

    return results;
  }

  function scanVisibleDocumentZones() {
    const all = [
      ...scanLineByLineZones(),
      ...scanTextNodeZones(),
      ...scanKixLineZones(),
      ...scanDocumentWideZones()
    ];
    return mergeZoneResults(all);
  }

  /**
   * One entry per visual line. `.kix-paragraphrenderer` wraps `.kix-lineview`,
   * so querying both would count every line twice and break arrow-key math.
   */
  function getKixLines() {
    const lineViews = [...document.querySelectorAll('.kix-lineview')];
    if (lineViews.length) return lineViews;
    return [...document.querySelectorAll('.kix-paragraphrenderer')];
  }

  function scanLineByLineZones() {
    const results = [];
    const lines = getKixLines();
    lines.forEach((line, lineIndex) => {
      const candidates = [
        getLineDisplayText(line),
        normalizeScanText(line.innerText || ''),
        normalizeScanText(line.textContent || '')
      ];
      for (const text of candidates) {
        if (!text) continue;
        const zones = findZones(text);
        for (const zone of zones) {
          results.push({
            ...zoneFromMatch(zone, rectForLine(line), line),
            lineIndex
          });
        }
        if (zones.length) break;
      }
    });
    return results;
  }

  function scanModelTextZones() {
    const results = [];
    let modelText = '';
    try {
      const iframe = getEditableIframe();
      const body = iframe?.contentDocument?.body;
      modelText = normalizeScanText(body?.innerText || body?.textContent || '');
    } catch {
      /* ignore */
    }
    if (!modelText || !hasEquationMarkup(modelText)) return results;

    const zones = findZones(modelText);
    const lines = getKixLines();
    const usedLines = new Set();

    zones.forEach((zone, zoneIdx) => {
      let lineIndex = -1;
      let lineEl = null;

      for (let i = 0; i < lines.length; i++) {
        if (usedLines.has(i)) continue;
        const lt = getLineDisplayText(lines[i]);
        const alt = normalizeScanText(lines[i].innerText || '');
        if (
          lt.includes(zone.fullMatch) ||
          lt.includes(zone.latex) ||
          alt.includes(zone.fullMatch) ||
          alt.includes(zone.latex) ||
          findZones(lt).some((z) => latexMatches(z.latex, zone.latex))
        ) {
          lineIndex = i;
          lineEl = lines[i];
          usedLines.add(i);
          break;
        }
      }

      if (!lineEl) {
        for (let i = 0; i < lines.length; i++) {
          if (usedLines.has(i)) continue;
          const lt = getLineDisplayText(lines[i]);
          if (hasEquationMarkup(lt) && findZones(lt).length) {
            lineIndex = i;
            lineEl = lines[i];
            usedLines.add(i);
            break;
          }
        }
      }

      const rect = lineEl
        ? rectForLine(lineEl)
        : { top: 100 + zoneIdx * 28, left: 72, width: 400, height: 24 };

      results.push({
        ...zoneFromMatch(zone, rect, lineEl),
        lineIndex: lineIndex >= 0 ? lineIndex : zoneIdx,
        fromModel: true
      });
    });
    return results;
  }

  function listEquationsOrdered() {
    let items = isCanvasMode() ? listEquationsCanvasMode() : scanVisibleDocumentZones();
    if (!items.length) {
      items = scanModelTextZones();
    }

    items.sort((a, b) => {
      const la = a.lineIndex ?? 99999;
      const lb = b.lineIndex ?? 99999;
      if (la !== lb) return la - lb;
      return (a.rect?.top || 0) - (b.rect?.top || 0);
    });

    const total = items.length;
    return items.map((item, i) => ({
      ...item,
      equationNumber: i + 1,
      total
    }));
  }

  function getCursorLineIndex() {
    if (isCanvasMode()) return caretLineIndexCanvas();
    const point = getCursorPoint();
    if (!point) return -1;
    const lines = getKixLines();
    let best = -1;
    let bestDy = Infinity;
    for (let i = 0; i < lines.length; i++) {
      const r = lines[i].getBoundingClientRect();
      if (r.height <= 0) continue;
      const mid = r.top + r.height / 2;
      const dy = Math.abs(point.y - mid);
      if (dy < bestDy) {
        bestDy = dy;
        best = i;
      }
    }
    return bestDy <= 80 ? best : -1;
  }

  function findEquationOnCursorLineFromList(all) {
    const lineIdx = getCursorLineIndex();
    if (lineIdx < 0) return null;
    const onLine = all.filter((eq) => eq.lineIndex === lineIdx);
    if (!onLine.length) return null;
    if (onLine.length === 1) return onLine[0];

    const point = getCursorPoint();
    if (!point) return onLine[0];
    let best = onLine[0];
    let bestDx = Infinity;
    for (const eq of onLine) {
      const dx = Math.abs(point.x - (eq.rect?.left || 0));
      if (dx < bestDx) {
        bestDx = dx;
        best = eq;
      }
    }
    return best;
  }

  function findEquationForCursor() {
    const all = listEquationsOrdered();
    if (!all.length) return null;
    const onLine = findEquationOnCursorLineFromList(all);
    if (onLine?.latex?.trim()) return onLine;
    return findNearestEquationAtCursor({ maxDistance: 120 });
  }

  function scanHiddenInputZones() {
    const results = [];
    try {
      const iframe = getEditableIframe();
      const body = iframe?.contentDocument?.body;
      if (!body) return results;

      const text = normalizeScanText(body.innerText || body.textContent || '');
      if (!hasEquationMarkup(text)) return results;

      for (const zone of findZones(text)) {
        const rect = findRectForEquationSnippet(zone.fullMatch, zone.latex);
        results.push(zoneFromMatch(zone, rect, body));
      }
    } catch {
      /* hidden iframe may be inaccessible */
    }
    return results;
  }

  function scanEditorInnerTextZones() {
    const results = [];
    const editor = document.querySelector('.kix-appview-editor');
    if (!editor) return results;

    const text = normalizeScanText(editor.innerText || editor.textContent || '');
    if (!hasEquationMarkup(text)) return results;

    for (const zone of findZones(text)) {
      const rect = findRectForEquationSnippet(zone.fullMatch, zone.latex);
      results.push(zoneFromMatch(zone, rect, editor));
    }
    return results;
  }

  function mergeZoneResults(items) {
    const merged = [];
    const seen = new Set();

    for (const item of items) {
      if (!item?.latex && !item?.fullMatch) continue;
      const key =
        (item.latex || '') +
        '|' +
        (item.fullMatch || '') +
        '|' +
        Math.round(item.rect?.top || 0) +
        '|' +
        Math.round(item.rect?.left || 0);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }

    return merged;
  }

  /**
   * Which equation sits on the caret's line. Zones picked up by the fallback
   * scanners can be missing lineIndex, so fall back to reading the caret
   * line's own text and finally to matching rectangles by vertical position.
   */
  function findEquationOnCaretLine(equations) {
    const list = equations?.length ? equations : listEquationsOrdered();
    if (!list.length) return null;

    let lineIndex = getCursorLineIndexStrict();
    if (lineIndex < 0 && !isCanvasMode()) lineIndex = getCursorLineIndex();
    if (lineIndex < 0) return null;

    const byIndex = list.filter((eq) => eq.lineIndex === lineIndex);
    if (byIndex.length) {
      if (byIndex.length === 1) return byIndex[0];
      const point = getCursorPoint();
      if (!point) return byIndex[0];
      return byIndex.reduce((best, eq) =>
        Math.abs(point.x - (eq.rect?.left || 0)) <
        Math.abs(point.x - (best.rect?.left || 0))
          ? eq
          : best
      );
    }

    const lineText = isCanvasMode()
      ? getModelLineText(lineIndex)
      : getLineDisplayText(getKixLines()[lineIndex] || document.createElement('div'));

    for (const zone of findZones(lineText)) {
      const match = list.find((eq) => latexMatches(eq.latex, zone.latex));
      if (match) return match;
    }

    const lineEl = getKixLines()[lineIndex];
    if (!lineEl) return null;

    const lineRect = lineEl.getBoundingClientRect();
    const midY = lineRect.top + lineRect.height / 2;
    for (const eq of list) {
      const r = eq.rect;
      if (!r) continue;
      const eqMid = (r.top || 0) + (r.height || 20) / 2;
      if (Math.abs(midY - eqMid) <= Math.max(lineRect.height, 20) / 2) {
        return eq;
      }
    }

    return null;
  }

  /**
   * Snapshot of everything the caret/equation matching depends on. Google Docs
   * ships several rendering modes and the DOM differs between them, so this
   * reports which structures actually exist in the live document.
   */
  function collectDiagnostics() {
    const count = (sel) => document.querySelectorAll(sel).length;
    const safe = (fn) => {
      try {
        return fn();
      } catch (err) {
        return `error: ${err?.message || err}`;
      }
    };

    const caretRect = getCursorRect();
    const lines = getKixLines();
    const caretLine = getCursorLineIndexStrict();
    const equations = safe(() => listEquationsOrdered());

    return {
      version: chrome.runtime?.getManifest?.().version,
      url: location.pathname,
      dom: {
        kixLineview: count('.kix-lineview'),
        kixParagraphrenderer: count('.kix-paragraphrenderer'),
        kixLineviewTextBlock: count('.kix-lineview-text-block'),
        canvasTiles: count('canvas.kix-canvas-tile-content'),
        anyCanvas: count('.kix-appview-editor canvas'),
        appviewEditor: count('.kix-appview-editor'),
        caretElements:
          count('.docs-text-ui-cursor-blink') +
          count('.kix-cursor-caret') +
          count('.kix-cursor')
      },
      caret: {
        rect: caretRect
          ? { top: Math.round(caretRect.top), left: Math.round(caretRect.left) }
          : null,
        strictLineIndex: caretLine,
        looseLineIndex: safe(() => getCursorLineIndex()),
        lineText:
          caretLine >= 0 && lines[caretLine]
            ? getLineDisplayText(lines[caretLine]).slice(0, 120)
            : null
      },
      scanners: {
        lineByLine: safe(() => scanLineByLineZones().length),
        textNode: safe(() => scanTextNodeZones().length),
        kixLine: safe(() => scanKixLineZones().length),
        documentWide: safe(() => scanDocumentWideZones().length),
        model: safe(() => scanModelTextZones().length),
        hiddenInput: safe(() => scanHiddenInputZones().length)
      },
      equations: Array.isArray(equations)
        ? equations.map((eq) => ({
            n: eq.equationNumber,
            lineIndex: eq.lineIndex,
            fromModel: Boolean(eq.fromModel),
            top: Math.round(eq.rect?.top || 0),
            latex: (eq.latex || '').slice(0, 40)
          }))
        : equations,
      canvasMode: isCanvasMode(),
      lineMetrics,
      caretDocY: caretDocY(),
      caretLineCanvas: caretLineIndexCanvas(),
      modelLines: getModelLines().map((t, i) => `${i}: ${t.slice(0, 60)}`),
      lineCount: lines.length,
      firstLines: lines
        .slice(0, 8)
        .map((line, i) => `${i}: ${getLineDisplayText(line).slice(0, 60)}`)
    };
  }

  function readHiddenModelText() {
    try {
      const body = getEditableIframe()?.contentDocument?.body;
      return normalizeScanText(body?.innerText || body?.textContent || '');
    } catch {
      return '';
    }
  }

  function caretTop() {
    const rect = getCursorRect();
    return rect ? Math.round(rect.top) : null;
  }

  /**
   * Canvas-rendered documents expose no line DOM, so establish empirically
   * whether synthetic keys move the caret and whether the hidden input
   * mirrors the selected line. Moves the caret; diagnostics only.
   */
  async function runCanvasProbe() {
    await ExtensionContext.ensurePageMain();
    focusEditor();
    await sleep(200);

    const start = caretTop();
    const hiddenAtRest = readHiddenModelText();

    await moveCursor('documentStart', 0);
    await sleep(250);
    const afterCtrlHome = caretTop();

    await moveCursor('down', 1);
    await sleep(250);
    const afterArrowDown = caretTop();

    await moveCursor('selectLine', 0);
    await sleep(300);
    const hiddenSelected = readHiddenModelText();

    await moveCursor('lineStart', 0);
    await sleep(150);

    return {
      caretTop: { start, afterCtrlHome, afterArrowDown },
      ctrlHomeMovedCaret:
        start != null && afterCtrlHome != null && start !== afterCtrlHome,
      arrowDownMovedCaret:
        afterCtrlHome != null &&
        afterArrowDown != null &&
        afterCtrlHome !== afterArrowDown,
      hidden: {
        atRestLength: hiddenAtRest.length,
        atRest: hiddenAtRest.slice(0, 200),
        afterSelectLineLength: hiddenSelected.length,
        afterSelectLine: hiddenSelected.slice(0, 200),
        changedWithSelection: hiddenAtRest !== hiddenSelected
      }
    };
  }

  /* ---------------------------------------------------------------
   * Canvas-rendered documents
   *
   * Modern Google Docs paints text to a <canvas>, so there is no per-line
   * DOM to measure. What we can still rely on:
   *   - the caret overlay reports a real pixel position
   *   - synthetic arrow keys move the caret
   *   - Google's offscreen copy holds the full document text
   * So we measure the line pitch once from the caret, then convert between
   * caret position and line number arithmetically.
   * ------------------------------------------------------------- */

  function isCanvasMode() {
    return (
      getKixLines().length === 0 &&
      Boolean(document.querySelector('.kix-appview-editor canvas'))
    );
  }

  function getScrollContainer() {
    return document.querySelector('.kix-appview-editor') || document.scrollingElement;
  }

  /** Caret position relative to the document, immune to scrolling. */
  function caretDocY() {
    const rect = getCursorRect();
    if (!rect) return null;
    return rect.top + (getScrollContainer()?.scrollTop || 0);
  }

  let lineMetrics = null;
  let calibrating = null;

  function invalidateLineMetrics() {
    lineMetrics = null;
  }

  async function calibrateLineMetrics() {
    await ExtensionContext.ensurePageMain();
    focusEditor();
    await sleep(150);

    const startY = caretDocY();

    await moveCursor('documentStart', 0);
    await sleep(220);
    const y0 = caretDocY();
    if (y0 == null) return null;

    await moveCursor('down', 1);
    await sleep(220);
    const y1 = caretDocY();

    const height = getCursorRect()?.height || 0;
    const pitch = y1 != null && y1 > y0 ? y1 - y0 : Math.max(height, 12);
    lineMetrics = { y0, pitch };

    // Put the caret back where the user left it.
    if (startY != null) {
      const target = Math.max(0, Math.round((startY - y0) / pitch));
      const delta = target - (y1 != null && y1 > y0 ? 1 : 0);
      if (delta > 0) await moveCursor('down', delta);
      else if (delta < 0) await moveCursor('up', -delta);
      await sleep(150);
    }

    return lineMetrics;
  }

  function ensureLineMetrics() {
    if (lineMetrics) return Promise.resolve(lineMetrics);
    if (!calibrating) {
      calibrating = calibrateLineMetrics().finally(() => {
        calibrating = null;
      });
    }
    return calibrating;
  }

  function caretLineIndexCanvas() {
    if (!lineMetrics) return -1;
    const y = caretDocY();
    if (y == null) return -1;
    const index = Math.round((y - lineMetrics.y0) / lineMetrics.pitch);
    return index >= 0 ? index : -1;
  }

  /**
   * Document text split into paragraphs. The offscreen copy separates
   * paragraphs with a blank line, so runs of newlines collapse to one break.
   */
  function getModelLines() {
    const raw = readHiddenModelText();
    if (!raw) return [];
    return raw.replace(/\n{2,}/g, '\n').split('\n');
  }

  function rectForModelLine(lineIndex) {
    const pitch = lineMetrics?.pitch || 19;
    const y0 = lineMetrics?.y0 ?? 0;
    const scrollTop = getScrollContainer()?.scrollTop || 0;
    return {
      top: y0 + pitch * lineIndex - scrollTop,
      left: 72,
      width: 400,
      height: pitch
    };
  }

  function listEquationsCanvasMode() {
    const results = [];
    getModelLines().forEach((text, lineIndex) => {
      for (const zone of findZones(text)) {
        results.push({
          ...zoneFromMatch(zone, rectForModelLine(lineIndex), null),
          lineIndex,
          fromModel: true
        });
      }
    });
    return results;
  }

  function getModelLineText(lineIndex) {
    const lines = getModelLines();
    return lineIndex >= 0 && lineIndex < lines.length ? lines[lineIndex] : '';
  }

  async function moveCursorToLineIndexCanvas(targetIndex) {
    await ensureLineMetrics();
    if (!lineMetrics) return false;

    await ExtensionContext.ensurePageMain();
    focusEditor();
    await sleep(120);

    let from = caretLineIndexCanvas();
    if (from < 0) {
      await moveCursor('documentStart', 0);
      await sleep(200);
      from = 0;
    }

    if (from !== targetIndex) {
      const delta = targetIndex - from;
      await moveCursor(delta > 0 ? 'down' : 'up', Math.abs(delta));
      await sleep(200);
    }

    const actual = caretLineIndexCanvas();
    if (actual >= 0 && actual !== targetIndex) {
      const delta = targetIndex - actual;
      await moveCursor(delta > 0 ? 'down' : 'up', Math.abs(delta));
      await sleep(180);
    }

    await moveCursor('lineStart', 0);
    await sleep(100);
    return caretLineIndexCanvas() === targetIndex;
  }

  function getEquationOnCursorLine() {
    const point = getCursorPoint();
    if (!point) return null;

    const lines = getKixLines();
    let bestLine = null;
    let bestScore = Infinity;

    for (const line of lines) {
      const rect = line.getBoundingClientRect();
      if (rect.height <= 0) continue;
      const midY = rect.top + rect.height / 2;
      const dy = Math.abs(point.y - midY);
      const dx =
        point.x < rect.left ? rect.left - point.x : point.x > rect.right ? point.x - rect.right : 0;
      const score = dy + dx * 0.2;
      if (score < bestScore) {
        bestScore = score;
        bestLine = line;
      }
    }

    if (!bestLine || bestScore > 50) return null;

    const text = getLineDisplayText(bestLine);
    if (!hasEquationMarkup(text)) return null;

    const zones = findZones(text);
    if (!zones.length) return null;

    const rect = rectForLine(bestLine);
    const textBlock =
      bestLine.querySelector('.kix-lineview-text-block') ||
      bestLine.querySelector('.kix-lineview-content') ||
      bestLine;

    if (zones.length === 1) {
      return zoneFromMatch(zones[0], rect, textBlock);
    }

    let bestZone = zones[0];
    let bestDx = Infinity;
    for (const zone of zones) {
      const idx = text.indexOf(zone.fullMatch);
      const approxX = rect.left + Math.max(idx, 0) * 6;
      const dx = Math.abs(point.x - approxX);
      if (dx < bestDx) {
        bestDx = dx;
        bestZone = zone;
      }
    }

    return zoneFromMatch(bestZone, rect, textBlock);
  }

  function scanDocumentForZones() {
    const all = [
      ...scanVisibleDocumentZones(),
      ...scanHiddenInputZones(),
      ...scanEditorInnerTextZones()
    ];
    return mergeZoneResults(all);
  }

  function pointInRect(x, y, rect, pad = 24) {
    if (!rect) return false;
    const left = rect.left || 0;
    const top = rect.top || 0;
    const width = Math.max(rect.width || 0, 32);
    const height = Math.max(rect.height || 0, 18);
    return (
      x >= left - pad &&
      x <= left + width + pad &&
      y >= top - pad &&
      y <= top + height + pad
    );
  }

  function distancePointToRect(x, y, rect) {
    if (!rect) return Infinity;
    const left = rect.left || 0;
    const top = rect.top || 0;
    const right = left + Math.max(rect.width || 0, 32);
    const bottom = top + Math.max(rect.height || 0, 18);
    const dx = x < left ? left - x : x > right ? x - right : 0;
    const dy = y < top ? top - y : y > bottom ? y - bottom : 0;
    return dx + dy;
  }

  function getCursorPoint() {
    const cursor = getCursorRect();
    if (cursor) {
      return { x: cursor.left, y: cursor.top };
    }
    const ptr = window.__latexGdocsLastPointer;
    if (ptr && Date.now() - ptr.t < 30 * 60 * 1000) {
      return { x: ptr.x, y: ptr.y };
    }
    return null;
  }

  function findNearestEquationAtCursor(options = {}) {
    const maxDistance = options.maxDistance ?? 120;
    const point = getCursorPoint();

    const onLine = getEquationOnCursorLine();
    if (onLine?.latex?.trim()) return onLine;

    const scanned = scanVisibleDocumentZones();
    if (!scanned.length) return null;
    if (!point) return null;

    const atPoint = findEquationAtPoint(point.x, point.y);
    if (atPoint?.latex?.trim()) return atPoint;

    for (const item of scanned) {
      if (pointInRect(point.x, point.y, item.rect, 20)) {
        return item;
      }
    }

    let best = null;
    let bestDist = Infinity;
    for (const item of scanned) {
      const d = distancePointToRect(point.x, point.y, item.rect);
      if (d < bestDist) {
        bestDist = d;
        best = item;
      }
    }

    if (bestDist <= maxDistance) return best;
    return null;
  }

  function getDocumentPlainText() {
    const lines = getKixLines();
    let fullText = '';
    for (const line of lines) {
      fullText += getLineDisplayText(line) + '\n';
    }

    if (!hasEquationMarkup(fullText)) {
      try {
        const iframe = getEditableIframe();
        const hidden = normalizeScanText(
          iframe?.contentDocument?.body?.innerText ||
            iframe?.contentDocument?.body?.textContent ||
            ''
        );
        if (hidden) fullText += '\n' + hidden;
      } catch {
        /* ignore */
      }
    }

    return fullText;
  }

  function normalizeLatex(latex) {
    return (latex || '')
      .trim()
      .replace(/\s+/g, '')
      .replace(/\\\\/g, '\\');
  }

  function latexMatches(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    return normalizeLatex(a) === normalizeLatex(b);
  }

  function documentContainsEquation(latex) {
    const trimmed = (latex || '').trim();
    if (!trimmed) return false;

    if (scanDocumentForZones().some((zone) => latexMatches(zone.latex, trimmed))) {
      return true;
    }

    const plain = getDocumentPlainText();
    const wrapped = EQ_OPEN + trimmed + EQ_CLOSE;
    if (plain.includes(wrapped)) return true;
    if (plain.includes('\u27E6eq\u27E7' + trimmed + '\u27E6/eq\u27E7')) return true;
    if (plain.includes('⟦eq⟧' + trimmed + '⟦/eq⟧')) return true;

    const compactPlain = plain.replace(/\s+/g, '');
    const compactLatex = normalizeLatex(trimmed);
    if (compactLatex && compactPlain.includes(compactLatex)) return true;

    return false;
  }

  function countEquationsWithLatex(latex) {
    return scanDocumentForZones().filter((zone) => latexMatches(zone.latex, latex)).length;
  }

  function findEquationAtPoint(clientX, clientY) {
    const scanned = scanVisibleDocumentZones();
    let best = null;
    let bestDist = Infinity;

    for (const item of scanned) {
      const rect = item.rect;
      if (!rect) continue;
      const width = Math.max(rect.width || 0, 40);
      const height = Math.max(rect.height || 0, 18);
      const inBox =
        clientX >= rect.left - 16 &&
        clientX <= rect.left + width + 16 &&
        clientY >= rect.top - 16 &&
        clientY <= rect.top + height + 16;
      if (inBox) return item;

      const cx = rect.left + width / 2;
      const cy = rect.top + height / 2;
      const d = Math.abs(clientX - cx) + Math.abs(clientY - cy);
      if (d < bestDist) {
        bestDist = d;
        best = item;
      }
    }

    return bestDist < 120 ? best : null;
  }

  function moveCursorLeft(count) {
    return moveCursor('left', count);
  }

  function moveCursorAfterEquation() {
    return moveCursor('afterEquation', 0);
  }

  let programmaticMoveDepth = 0;

  /**
   * True while we are dispatching synthetic key events. Our own capture-phase
   * key listeners must ignore those events, otherwise they intercept them and
   * Google Docs never sees the keystroke.
   */
  function isProgrammaticMove() {
    return programmaticMoveDepth > 0;
  }

  async function moveCursor(direction, count) {
    programmaticMoveDepth += 1;
    try {
      return await requestCursorMove(direction, count);
    } finally {
      setTimeout(() => {
        programmaticMoveDepth = Math.max(0, programmaticMoveDepth - 1);
      }, 60);
    }
  }

  function requestCursorMove(direction, count) {
    const steps = count || 0;
    const timeout =
      direction === 'up' || direction === 'down'
        ? Math.max(3000, steps * 120 + 800)
        : 1500;

    return new Promise((resolve) => {
      const id = `lc-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      function onMessage(event) {
        if (event.source !== window) return;
        const data = event.data;
        if (data?.type !== 'LATEX_GDOCS_CURSOR_RESULT' || data.id !== id) return;
        window.removeEventListener('message', onMessage);
        resolve(Boolean(data.ok));
      }

      window.addEventListener('message', onMessage);
      window.postMessage(
        { type: 'LATEX_GDOCS_MOVE_CURSOR', id, count: steps, direction, afterEquation: direction === 'afterEquation' },
        '*'
      );

      setTimeout(() => {
        window.removeEventListener('message', onMessage);
        resolve(false);
      }, timeout);
    });
  }

  function updateInsertPointerFromCursor() {
    const cursor = getCursorRect();
    if (!cursor) return;
    window.__latexGdocsLastPointer = {
      x: (cursor.left || 0) + 4,
      y: (cursor.top || 0) + Math.max((cursor.height || 20) / 2, 8),
      t: Date.now()
    };
  }

  function zoneId(item) {
    if (item && item.start != null) {
      return 'eq-pos-' + item.start;
    }
    const latex = item?.latex ?? '';
    const rect = item?.rect ?? { top: 0, left: 0 };
    return (
      'eq-' +
      btoa(unescape(encodeURIComponent(latex + '|' + rect.top + '|' + rect.left)))
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 16)
    );
  }

  const attachedFrames = new WeakSet();

  function attachKeyListeners(handler, useCapture = true) {
    window.addEventListener('keydown', handler, useCapture);

    function attachToFrame(frame) {
      if (!frame?.contentWindow || attachedFrames.has(frame)) return;
      try {
        frame.contentWindow.addEventListener('keydown', handler, useCapture);
        attachedFrames.add(frame);
      } catch {
        /* ignore */
      }
    }

    attachToFrame(getEditableIframe());

    const observer = new MutationObserver(() => {
      attachToFrame(getEditableIframe());
      for (const frame of document.querySelectorAll('iframe[class*="texteventtarget"], iframe.docs-texteventtarget-iframe')) {
        attachToFrame(frame);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return observer;
  }

  return {
    EQ_OPEN,
    EQ_CLOSE,
    EQ_REGEX,
    getDesktopEditUrl,
    isDesktopEditor,
    isDocumentEditPage,
    isUnsupportedDocsView,
    getEditableIframe,
    getTextEventTarget,
    getEditorRoot,
    getCursorRect,
    rectForLinearZoneAtCursor,
    focusEditor,
    clickAtPoint,
    clickAtPointViaMainWorld,
    clickAtCursor,
    clickEquationLine,
    moveCursorToEquationLine,
    moveCursorToLineIndex,
    getCursorLineIndexStrict,
    resetKnownCaretLine,
    isProgrammaticMove,
    findEquationOnCaretLine,
    collectDiagnostics,
    runCanvasProbe,
    readHiddenModelText,
    replaceEquationZone,
    isCanvasMode,
    ensureLineMetrics,
    invalidateLineMetrics,
    getModelLines,
    deleteEquationZone,
    getKixLines,
    focusInsertPoint,
    captureCursorPointer,
    ensureInsertPoint,
    moveCursorToDocumentEnd,
    countInlineImages,
    waitForIframe,
    insertText,
    insertImagePng,
    moveCursorLeft,
    moveCursorAfterEquation,
    emptyZoneText,
    zoneText,
    findZones,
    scanDocumentForZones,
    scanVisibleDocumentZones,
    getDocumentPlainText,
    documentContainsEquation,
    countEquationsWithLatex,
    findEquationAtPoint,
    updateInsertPointerFromCursor,
    findNearestEquationAtCursor,
    findEquationForCursor,
    findEquationOnCursorLineFromList,
    listEquationsOrdered,
    getCursorLineIndex,
    hasEquationMarkup,
    attachKeyListeners
  };
})();

if (typeof window !== 'undefined') {
  window.DocsUtils = DocsUtils;
}
