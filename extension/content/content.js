/**
 * content.js — Google Docs bridge for equation editor panel
 */

(function () {
  'use strict';

  const FRAME_ID = 'latex-gdocs-editor-frame';
  let initialized = false;
  let addonFocusRequestId = null;
  // The equation F2 opened, so Alt+Enter can overwrite it in place.
  let editTarget = null;

  function openEditorPanel(mode, payload = {}) {
    return EditorPanel.show({
      mode,
      latex: mode === 'edit' ? payload.latex || '' : '',
      clearLatex: mode === 'new',
      focusEditor: payload.focusEditor !== false,
      announce: payload.announce || ''
    });
  }

  function postFocusRequestToFrames(win, message, depth = 0) {
    if (!win || depth > 8) return;
    try {
      win.postMessage(message, '*');
    } catch {
      /* Cross-origin or detached window. */
    }
    let frames;
    try {
      frames = win.document?.querySelectorAll('iframe') || [];
    } catch {
      return;
    }
    frames.forEach((frame) => {
      if (frame.id === FRAME_ID) return;
      try {
        if (frame.contentWindow) {
          postFocusRequestToFrames(frame.contentWindow, message, depth + 1);
        }
      } catch {
        /* Nested cross-origin frame: top-level post above is enough for that window. */
      }
    });
  }

  function findIframeForWindow(win) {
    const search = (doc) => {
      if (!doc) return null;
      for (const iframe of doc.querySelectorAll('iframe')) {
        try {
          if (iframe.contentWindow === win) return iframe;
          const nested = search(iframe.contentDocument);
          if (nested) return nested;
        } catch {
          /* Cross-origin: cannot search inside. */
        }
      }
      return null;
    };
    return search(document);
  }

  function requestAccessibleAddonFocus() {
    if (addonFocusRequestId) return true;
    const requestId = `accessible-addon-${Date.now()}-${Math.random()}`;
    addonFocusRequestId = requestId;
    const message = { type: 'ACCESSIBLE_EQUATIONS_FOCUS_REQUEST', requestId };
    postFocusRequestToFrames(window, message);
    try {
      chrome.runtime.sendMessage({ action: 'broadcastAddonFocus', requestId }, () => {
        void chrome.runtime.lastError;
      });
    } catch {
      /* Context invalidated; iframe broadcast above may still reach a same-tree sidebar. */
    }
    setTimeout(() => {
      if (addonFocusRequestId !== requestId) return;
      addonFocusRequestId = null;
      DocumentBridge.announce(
        'The add-on sidebar did not respond. Keep Accessible Equation Images open, click in the document, then press Alt+Equals again.'
      );
    }, 1200);
    return true;
  }

  function triggerInsertInPanel(options = {}) {
    const frame = document.getElementById(FRAME_ID);
    if (frame?.contentWindow) {
      frame.contentWindow.postMessage(
        { type: 'LATEX_GDOCS_TRIGGER_INSERT', newLine: options.newLine === true },
        '*'
      );
      return true;
    }
    return false;
  }

  function isFocusInPanel() {
    const frame = document.getElementById(FRAME_ID);
    if (!frame?.contentDocument) return false;
    try {
      const doc = frame.contentDocument;
      const input = doc.getElementById('latex-input');
      if (!input) return false;
      const active = doc.activeElement;
      if (!active) return false;
      return active === input || input.contains(active);
    } catch {
      return false;
    }
  }

  function onKeyDown(e) {
    if (!ExtensionContext.isRuntimeAvailable()) {
      ExtensionContext.showReloadBanner();
      return;
    }

    if (DocsUtils.isProgrammaticMove()) return;

    if (EditorPanel.isVisible() && isFocusInPanel() && e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }

    if (EditorPanel.isVisible() && e.altKey && e.key === 'Enter') {
      if (!isFocusInPanel()) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      triggerInsertInPanel({ newLine: e.shiftKey });
      return false;
    }

    const isAltEquals =
      e.altKey &&
      !e.ctrlKey &&
      !e.shiftKey &&
      (e.key === '=' || e.code === 'Equal');

    if (isAltEquals) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      requestAccessibleAddonFocus();
      return false;
    }

    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      e.stopPropagation();
      EquationNavigator.setComposingNew(true);
      openEditorPanel('new');
      return;
    }

    if (e.key === 'F2' && !e.ctrlKey && !e.altKey && !isFocusInPanel()) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      requestAccessibleAddonFocus();
      return false;
    }

    if (e.key === 'Escape' && EditorPanel.isVisible()) {
      e.preventDefault();
      e.stopPropagation();
      editTarget = null;
      EditorPanel.hide();
    }

    if (e.altKey && !e.ctrlKey && e.key.toLowerCase() === 'd' && EditorPanel.isVisible()) {
      e.preventDefault();
      e.stopPropagation();
      focusDocumentFromPanel();
      return false;
    }

    if (e.ctrlKey && e.shiftKey && e.key === 'Delete' && !isFocusInPanel()) {
      e.preventDefault();
      e.stopPropagation();
      DocsUtils.captureCursorPointer();
      blurPanelInput();
      EquationNavigator.deleteCurrentEquation();
      return false;
    }

    // Up/Down are left to Google Docs so the caret moves exactly as it
    // normally would; we only announce whichever equation it lands on.
    if (
      !isFocusInPanel() &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.metaKey &&
      !e.shiftKey &&
      (e.key === 'ArrowDown' || e.key === 'ArrowUp')
    ) {
      EquationNavigator.announceAfterCaretMove();
    }

    if (e.ctrlKey && e.shiftKey && e.key === 'F9') {
      e.preventDefault();
      e.stopPropagation();
      void runDiagnostics();
      return false;
    }

    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      e.stopPropagation();
      DocsUtils.captureCursorPointer();
      if (EditorPanel.isVisible()) {
        DocsUtils.focusEditor();
      }
      EquationNavigator.readEquationAtCursor();
      return false;
    }
  }

  function attachListeners() {
    window.LatexGdocsDiagnostics = runDiagnostics;
    // Zoom or page-setup changes alter the line pitch we measured.
    window.addEventListener('resize', () => DocsUtils.invalidateLineMetrics());
    DocsUtils.attachKeyListeners(onKeyDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('message', (event) => {
      if (
        event.source === window &&
        event.data?.type === 'LATEX_GDOCS_ACCESSIBLE_ADDON_HOTKEY'
      ) {
        requestAccessibleAddonFocus();
        return;
      }
      if (
        event.data?.type === 'ACCESSIBLE_EQUATIONS_FOCUS_READY' &&
        event.data.requestId === addonFocusRequestId
      ) {
        addonFocusRequestId = null;
        const sourceWin = event.source;
        const frame = sourceWin ? findIframeForWindow(sourceWin) : null;
        if (frame) {
          try {
            frame.focus();
          } catch {
            /* Follow-up postMessage still targets the sidebar window. */
          }
        }
        try {
          sourceWin?.focus?.();
        } catch {
          /* Some sandbox frames reject scripted focus. */
        }
        try {
          sourceWin?.postMessage(
            {
              type: 'ACCESSIBLE_EQUATIONS_FOCUS_INPUT',
              requestId: event.data.requestId
            },
            '*'
          );
        } catch {
          if (frame?.contentWindow) {
            frame.contentWindow.postMessage(
              {
                type: 'ACCESSIBLE_EQUATIONS_FOCUS_INPUT',
                requestId: event.data.requestId
              },
              '*'
            );
          }
        }
      }
      if (event.data?.type === 'LATEX_GDOCS_READ_EQUATION') {
        EquationNavigator.readEquationAtCursor();
      }
      if (event.data?.type === 'LATEX_GDOCS_FOCUS_DOCUMENT') {
        focusDocumentFromPanel();
      }
    });
    attachEquationClickHandler();
  }

  async function runDiagnostics() {
    DocumentBridge.announce('Running diagnostics. The cursor will move.', {
      priority: 'assertive'
    });

    try {
      await DocsUtils.ensureLineMetrics();
    } catch {
      /* reported below as missing metrics */
    }

    const report = DocsUtils.collectDiagnostics();
    const text = JSON.stringify(report, null, 2);
    console.log('[LaTeX-GDocs] diagnostics\n' + text);
    window.__latexGdocsDiagnostics = report;

    try {
      await navigator.clipboard.writeText(text);
      DocumentBridge.announce(
        'Diagnostics copied to clipboard and printed to the console.',
        { priority: 'assertive' }
      );
    } catch {
      DocumentBridge.announce('Diagnostics printed to the browser console.', {
        priority: 'assertive'
      });
    }

    return report;
  }

  function focusDocumentFromPanel() {
    blurPanelInput();
    DocsUtils.focusEditor();
  }

  function blurPanelInput() {
    const frame = document.getElementById(FRAME_ID);
    frame?.contentWindow?.postMessage({ type: 'LATEX_GDOCS_BLUR_INPUT' }, '*');
    try {
      frame?.blur();
    } catch {
      /* ignore */
    }
  }

  function focusDocumentFromClick() {
    blurPanelInput();
    DocsUtils.focusEditor();
  }

  function trackDocPointer(e) {
    if (e.target.closest('#latex-gdocs-editor-host')) return;
    if (!e.target.closest('.kix-appview-editor')) return;
    window.__latexGdocsLastPointer = {
      x: e.clientX,
      y: e.clientY,
      t: Date.now()
    };
    window.__latexGdocsDocFocused = true;
    DocsUtils.resetKnownCaretLine();
  }

  function attachEquationClickHandler() {
    const editor = document.querySelector('.kix-appview-editor');
    if (!editor || editor.dataset.latexGdocsClickBound) return;
    editor.dataset.latexGdocsClickBound = '1';

    editor.addEventListener(
      'mousedown',
      (e) => {
        trackDocPointer(e);
        focusDocumentFromClick();
      },
      true
    );
    editor.addEventListener('click', trackDocPointer, true);
    editor.addEventListener(
      'keyup',
      (e) => {
        if (e.target.closest('#latex-gdocs-editor-host')) return;
        const navKeys = new Set([
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          'Home',
          'End',
          'PageUp',
          'PageDown'
        ]);
        if (navKeys.has(e.key)) {
          DocsUtils.captureCursorPointer();
          DocsUtils.resetKnownCaretLine();
        }
      },
      true
    );
  }

  async function init() {
    if (initialized) return;
    if (!location.href.includes('docs.google.com/document')) return;
    if (!DocsUtils.isDocumentEditPage()) return;

    if (!ExtensionContext.isRuntimeAvailable()) {
      ExtensionContext.showReloadBanner();
      return;
    }

    if (DocsUtils.isUnsupportedDocsView()) {
      ExtensionContext.showDesktopRequiredBanner(DocsUtils.getDesktopEditUrl());
      return;
    }

    await ExtensionContext.ensurePageMain();
    initialized = true;
    attachListeners();
    attachEquationClickHandler();
    EquationNavigator.init();
    const clickObserver = new MutationObserver(() => attachEquationClickHandler());
    const editorRoot = document.querySelector('.kix-appview-editor') || document.body;
    clickObserver.observe(editorRoot, { childList: true, subtree: true });
    console.log('[LaTeX-GDocs] Editor panel bridge initialized');
  }

  if (!ExtensionContext.isRuntimeAvailable()) {
    ExtensionContext.showReloadBanner();
  } else {
    try {
      chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (!ExtensionContext.isRuntimeAvailable()) {
          ExtensionContext.showReloadBanner();
          sendResponse({ ok: false, error: 'Extension context invalidated. Refresh the page.' });
          return true;
        }

        if (msg.action === 'insertLatex' && msg.replace && editTarget) {
          DocumentBridge.replaceEquation(editTarget, msg.latex)
            .then((result) => {
              if (result?.ok) {
                editTarget = {
                  ...editTarget,
                  latex: result.latex,
                  fullMatch: result.fullMatch,
                  lineIndex: result.lineIndex ?? editTarget.lineIndex
                };
              }
              sendResponse(result);
            })
            .catch((err) =>
              sendResponse({
                ok: false,
                error: String(err?.message || err || 'Replace failed.')
              })
            );
          return true;
        }

        if (msg.action === 'insertLatex') {
          DocumentBridge.insertLatex(msg.latex, msg.pngDataUrl, {
            skipImage: msg.skipImage !== false,
            skipAnnounce: msg.skipAnnounce === true,
            fastReturn: msg.fastReturn === true,
            newLine: msg.newLine === true,
            safeAuthoring: msg.safeAuthoring === true
          })
            .then(sendResponse)
            .catch((err) =>
              sendResponse({
                ok: false,
                error: String(err?.message || err || 'Insert failed.')
              })
            );
          return true;
        }

        if (msg.action === 'listEquations') {
          DocumentBridge.listEquations()
            .then((equations) => sendResponse({ ok: true, equations }))
            .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
          return true;
        }

        if (msg.action === 'getStatus') {
          sendResponse(DocumentBridge.getPageInfo());
          return true;
        }

        if (
          msg.action === 'showEditorPanel' ||
          msg.action === 'openEquationEditor' ||
          msg.action === 'openSidePanel'
        ) {
          const ok = openEditorPanel(msg.mode || 'new', {
            latex: msg.latex,
            announce: msg.announce
          });
          sendResponse({ ok });
          return true;
        }

        if (msg.action === 'readEquationAtCursor') {
          EquationNavigator.readEquationAtCursor();
          sendResponse({ ok: true });
          return true;
        }

        if (msg.action === 'focusAccessibleAddon') {
          const requested = requestAccessibleAddonFocus();
          sendResponse({ ok: requested });
          return true;
        }

        if (msg.action === 'editNearestEquation') {
          DocumentBridge.findNearestEquation().then((nearest) => {
            const ok = openEditorPanel('edit', {
              latex: nearest?.latex || '',
              announce: nearest?.latex
                ? 'Editing equation near cursor.'
                : 'No equation found near cursor.'
            });
            sendResponse({ ok, latex: nearest?.latex || '' });
          });
          return true;
        }

        return false;
      });
    } catch (err) {
      ExtensionContext.showReloadBanner();
      console.warn('[LaTeX-GDocs] message listener setup failed', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
