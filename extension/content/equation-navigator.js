/**
 * equation-navigator.js — Navigate and announce equations (Word-style for blind students)
 */

const EquationNavigator = (() => {
  let lastAnnouncedLatex = null;
  let debounceTimer = null;
  let enabled = true;
  let navIndex = 0;
  let announceSuppressedUntil = 0;
  let composingNew = false;

  function isAnnounceSuppressed() {
    return Date.now() < announceSuppressedUntil;
  }

  function suppressAnnounce(ms = 1500) {
    announceSuppressedUntil = Date.now() + ms;
    clearTimeout(debounceTimer);
  }

  function setComposingNew(value) {
    composingNew = !!value;
    if (composingNew) {
      clearTimeout(debounceTimer);
    }
  }

  function beginInsert() {
    suppressAnnounce(2000);
    composingNew = false;
  }

  function latexMatches(a, b) {
    if (!a || !b) return false;
    const norm = (s) =>
      (s || '')
        .trim()
        .replace(/\s+/g, '')
        .replace(/\\\\/g, '\\');
    return a === b || norm(a) === norm(b);
  }

  function getEquationList() {
    return DocsUtils.listEquationsOrdered();
  }

  function findEquationIndex(all, match) {
    if (!match) return -1;
    let idx = all.findIndex((eq) => eq === match);
    if (idx >= 0) return idx;

    if (match.lineIndex != null) {
      idx = all.findIndex(
        (eq) =>
          eq.lineIndex === match.lineIndex && latexMatches(eq.latex, match.latex)
      );
      if (idx >= 0) return idx;
    }

    if (match.start != null) {
      idx = all.findIndex(
        (eq) => eq.start === match.start && latexMatches(eq.latex, match.latex)
      );
      if (idx >= 0) return idx;
    }

    return all.findIndex((eq) => latexMatches(eq.latex, match.latex));
  }

  function syncNavToCursor() {
    const all = getEquationList();
    if (!all.length) {
      navIndex = 0;
      return null;
    }
    const onLine = DocsUtils.findEquationOnCursorLineFromList(all);
    const match = onLine || DocsUtils.findEquationForCursor();
    if (match) {
      const idx = findEquationIndex(all, match);
      if (idx >= 0) navIndex = idx;
      return all[navIndex];
    }
    return null;
  }

  async function focusCursorOnEquation(eq) {
    if (!eq) return;
    await DocsUtils.moveCursorToEquationLine(eq);
  }

  /**
   * Pick the next/previous equation relative to where the caret actually is.
   * Falls back to the remembered index only when the caret cannot be located.
   */
  function pickTargetIndex(all, step) {
    const caretLine = DocsUtils.getCursorLineIndexStrict();
    if (caretLine >= 0) {
      if (step > 0) {
        const next = all.findIndex((eq) => eq.lineIndex > caretLine);
        return next >= 0 ? next : all.length - 1;
      }
      for (let i = all.length - 1; i >= 0; i--) {
        if (all[i].lineIndex < caretLine) return i;
      }
      return 0;
    }
    return Math.min(Math.max(navIndex + step, 0), all.length - 1);
  }

  function announceEquationEntry(eq, prefix) {
    if (!eq?.latex?.trim()) return;
    const speech = LatexSpeech.toNaturalSpeech(eq.latex);
    const n = eq.equationNumber;
    const total = eq.total;
    const position =
      prefix ||
      (total > 1 && n ? `${n} of ${total}. ` : '');
    DocumentBridge.announce(position, {
      priority: 'assertive',
      interrupt: true,
      latex: eq.latex,
      speech: position + speech
    });
    lastAnnouncedLatex = eq.latex;
  }

  function getCurrentEquation() {
    const all = getEquationList();
    if (!all.length) return null;
    if (navIndex < 0 || navIndex >= all.length) navIndex = 0;
    return all[navIndex];
  }

  function announceAtCursor(force) {
    if (!enabled || isAnnounceSuppressed()) return;
    if (composingNew && !force) return;

    const all = getEquationList();
    if (!all.length) {
      if (force) {
        DocumentBridge.announce('No equations in document.');
      }
      lastAnnouncedLatex = null;
      return;
    }

    const synced = syncNavToCursor();
    const eq = synced || getCurrentEquation();

    if (!eq?.latex?.trim()) {
      if (force) {
        DocumentBridge.announce(
          `${all.length} equation${all.length === 1 ? '' : 's'} in document. ` +
            'Use Up or Down arrow to hear each one.'
        );
      }
      return;
    }

    if (!force && latexMatches(eq.latex, lastAnnouncedLatex)) return;
    announceEquationEntry(eq, '');
  }

  function readEquationAtCursor() {
    clearTimeout(debounceTimer);
    DocsUtils.captureCursorPointer();
    DocsUtils.focusEditor();
    requestAnimationFrame(() => {
      setTimeout(() => announceAtCursor(true), 120);
    });
  }

  async function readNextEquation() {
    const all = getEquationList();
    if (!all.length) {
      DocumentBridge.announce('No equations in document.');
      return null;
    }
    navIndex = pickTargetIndex(all, 1);
    const eq = all[navIndex];
    await focusCursorOnEquation(eq);
    announceEquationEntry(eq, '');
    return eq;
  }

  async function readPreviousEquation() {
    const all = getEquationList();
    if (!all.length) {
      DocumentBridge.announce('No equations in document.');
      return null;
    }
    navIndex = pickTargetIndex(all, -1);
    const eq = all[navIndex];
    await focusCursorOnEquation(eq);
    announceEquationEntry(eq, '');
    return eq;
  }

  function getEquationForEdit() {
    const all = getEquationList();
    if (!all.length) return null;
    const synced = syncNavToCursor();
    if (synced) return synced;
    return getCurrentEquation();
  }

  /**
   * Called after Google Docs has moved the caret itself. Waits for the caret
   * to settle, then reads whatever equation now sits on the caret's line.
   */
  function announceAfterCaretMove() {
    if (!enabled || isAnnounceSuppressed()) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      DocsUtils.captureCursorPointer();

      const all = getEquationList();
      if (!all.length) {
        lastAnnouncedLatex = null;
        return;
      }

      const eq = DocsUtils.findEquationOnCaretLine(all);
      if (!eq?.latex?.trim()) {
        lastAnnouncedLatex = null;
        return;
      }

      const idx = findEquationIndex(all, eq);
      if (idx >= 0) navIndex = idx;
      announceEquationEntry(idx >= 0 ? all[idx] : eq);
    }, 40);
  }

  function scheduleAnnounce(force) {
    if (isAnnounceSuppressed()) return;
    if (composingNew && !force) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => announceAtCursor(force), 180);
  }

  function reset() {
    lastAnnouncedLatex = null;
    navIndex = 0;
  }

  function onInserted(latex, options = {}) {
    const trimmed = (latex || '').trim();
    if (!trimmed) return;

    suppressAnnounce(2000);
    clearTimeout(debounceTimer);
    composingNew = false;

    const speech = LatexSpeech.toNaturalSpeech(trimmed);
    lastAnnouncedLatex = trimmed;

    const all = getEquationList();
    let idx = -1;
    for (let i = all.length - 1; i >= 0; i--) {
      if (latexMatches(all[i].latex, trimmed)) {
        idx = i;
        break;
      }
    }
    if (idx < 0 && all.length) idx = all.length - 1;
    if (idx >= 0) navIndex = idx;

    if (!options.skipAnnounce) {
      const total = all.length;
      const n = idx >= 0 ? idx + 1 : 0;
      const position =
        options.prefix || (total > 1 && n ? `${n} of ${total}. ` : '');
      DocumentBridge.announce(position, {
        priority: 'assertive',
        interrupt: true,
        latex: trimmed,
        speech: position + speech
      });
    }
  }

  function onNavigationKey(e) {
    if (!enabled || isAnnounceSuppressed()) return;
    if (DocsUtils.isProgrammaticMove()) return;
    if (EditorPanel.isVisible()) {
      const frame = document.getElementById('latex-gdocs-editor-frame');
      if (frame && e.target?.ownerDocument === frame.contentDocument) return;
    }

    const navKeys = new Set([
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
      'PageUp',
      'PageDown'
    ]);

    if (navKeys.has(e.key)) {
      scheduleAnnounce(false);
    }
  }

  function onDocumentClick(e) {
    if (!enabled || isAnnounceSuppressed()) return;
    if (e.target.closest('#latex-gdocs-editor-host')) return;
    if (!e.target.closest('.kix-appview-editor')) return;
    scheduleAnnounce(false);
  }

  async function deleteCurrentEquation() {
    suppressAnnounce(2500);
    clearTimeout(debounceTimer);

    const eq = getEquationForEdit();
    if (!eq?.latex?.trim()) {
      DocumentBridge.announce(
        'No equation selected. Use Up or Down arrow to hear each equation, then try again.'
      );
      return { ok: false };
    }

    const speech = LatexSpeech.toNaturalSpeech(eq.latex);
    const label =
      eq.total > 1 ? `Equation ${eq.equationNumber} of ${eq.total}` : 'Equation';

    const frame = document.getElementById('latex-gdocs-editor-frame');
    frame?.contentWindow?.postMessage({ type: 'LATEX_GDOCS_BLUR_INPUT' }, '*');
    DocsUtils.focusEditor();

    const result = await DocumentBridge.deleteEquation(eq);
    if (!result?.ok) {
      DocumentBridge.announce(result.error || 'Could not delete equation.');
      return result;
    }

    lastAnnouncedLatex = null;
    const remaining = getEquationList();
    if (navIndex >= remaining.length) {
      navIndex = Math.max(0, remaining.length - 1);
    }
    if (remaining.length) {
      await focusCursorOnEquation(remaining[navIndex]);
    }

    DocumentBridge.announce(`Deleted ${label}. `, {
      priority: 'assertive',
      latex: eq.latex,
      speech: `Deleted ${label}. ${speech}`
    });
    return result;
  }

  function init() {
    // Canvas documents need the line pitch measured before any lookup works.
    if (DocsUtils.isCanvasMode()) {
      setTimeout(() => {
        DocsUtils.ensureLineMetrics();
      }, 1500);
    }

    window.addEventListener('keyup', onNavigationKey, true);
    document.addEventListener('click', onDocumentClick, true);

    const editor = document.querySelector('.kix-appview-editor');
    if (editor) {
      editor.addEventListener('keyup', onNavigationKey, true);
    }

    try {
      chrome.storage.sync.get(['equationNavAnnounce'], (data) => {
        enabled = data.equationNavAnnounce !== false;
      });
    } catch {
      enabled = true;
    }
  }

  return {
    init,
    reset,
    beginInsert,
    onInserted,
    setComposingNew,
    announceAtCursor,
    readEquationAtCursor,
    announceAfterCaretMove,
    readNextEquation,
    readPreviousEquation,
    deleteCurrentEquation,
    getEquationForEdit,
    getEquationList,
    setEnabled(value) {
      enabled = value;
    }
  };
})();

if (typeof window !== 'undefined') {
  window.EquationNavigator = EquationNavigator;
}
