/**
 * editor-panel.js — In-page equation editor (opens on Alt+= without Chrome sidePanel gesture limits)
 */

const EditorPanel = (() => {
  const HOST_ID = 'latex-gdocs-editor-host';
  const FRAME_ID = 'latex-gdocs-editor-frame';
  let closeListenerBound = false;
  let pendingPanelState = null;

  function ensureHost() {
    let host = document.getElementById(HOST_ID);
    if (host) return host;

    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('data-latex-gdocs-panel', '1');
    host.hidden = true;
    host.style.cssText =
      'position:fixed;top:0;right:0;width:400px;max-width:96vw;height:100vh;z-index:2147483647;' +
      'display:flex;flex-direction:column;background:#fff;box-shadow:-4px 0 16px rgba(0,0,0,.15);' +
      'pointer-events:auto;';

    const header = document.createElement('div');
    header.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;gap:8px;' +
      'padding:10px 12px;border-bottom:1px solid #dadce0;background:#f8f9fa;flex-shrink:0;' +
      'position:relative;z-index:2;pointer-events:auto;';

    const title = document.createElement('span');
    title.textContent = 'LaTeX Equation Editor';
    title.setAttribute('aria-hidden', 'true');
    title.style.cssText = 'font:600 14px system-ui,sans-serif;color:#202124;';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.id = 'latex-gdocs-panel-close';
    closeBtn.textContent = 'Close';
    closeBtn.setAttribute('aria-label', 'Close equation editor');
    closeBtn.setAttribute('tabindex', '-1');
    closeBtn.style.cssText =
      'padding:6px 12px;border:1px solid #dadce0;border-radius:4px;background:#fff;' +
      'font:500 13px system-ui,sans-serif;cursor:pointer;position:relative;z-index:3;pointer-events:auto;';

    function handleClose(event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      hide();
    }

    closeBtn.addEventListener('mousedown', handleClose, true);
    closeBtn.addEventListener('click', handleClose, true);

    header.appendChild(title);
    header.appendChild(closeBtn);

    const frame = document.createElement('iframe');
    frame.id = FRAME_ID;
    frame.title = 'LaTeX';
    frame.src = chrome.runtime.getURL('sidepanel/sidepanel.html');
    frame.style.cssText =
      'flex:1;width:100%;border:none;min-height:0;position:relative;z-index:1;pointer-events:auto;';

    frame.addEventListener('load', () => {
      if (pendingPanelState) {
        pushStateToFrame(pendingPanelState);
      }
    });

    host.appendChild(header);
    host.appendChild(frame);
    document.body.appendChild(host);

    if (!closeListenerBound) {
      closeListenerBound = true;
      window.addEventListener('message', (event) => {
        if (event.data?.type === 'LATEX_GDOCS_CLOSE_PANEL') {
          hide();
        }
      });
    }

    return host;
  }

  function pushStateToFrame(state) {
    const frame = document.getElementById(FRAME_ID);
    if (!frame?.contentWindow) return;
    frame.contentWindow.postMessage({ type: 'LATEX_GDOCS_PANEL_STATE', state }, '*');
  }

  function savePanelState(state) {
    try {
      chrome.storage.session.set({ panelState: state });
    } catch {
      /* extension context may be invalid */
    }
  }

  function show(state = {}) {
    if (!ExtensionContext.isRuntimeAvailable()) {
      ExtensionContext.showReloadBanner();
      return false;
    }

    const panelState = {
      mode: state.mode || 'new',
      latex: state.mode === 'edit' ? state.latex || '' : '',
      clearLatex: state.mode === 'new' || state.clearLatex === true,
      focusEditor: state.focusEditor !== false,
      announce: state.announce || ''
    };

    pendingPanelState = panelState;
    savePanelState(panelState);
    const host = ensureHost();
    host.hidden = false;
    host.style.display = 'flex';
    host.removeAttribute('aria-hidden');
    pushStateToFrame(panelState);
    setTimeout(() => focusInput(), 80);

    return true;
  }

  function hide() {
    const host = document.getElementById(HOST_ID);
    if (!host) return;

    // Move focus out before hiding the panel. Hiding an ancestor while a
    // descendant retains focus triggers Chrome's blocked-aria-hidden error
    // and leaves assistive technology pointing at an unavailable control.
    const frame = document.getElementById(FRAME_ID);
    frame?.contentWindow?.postMessage({ type: 'LATEX_GDOCS_BLUR_INPUT' }, '*');
    try {
      frame?.blur();
    } catch {
      /* ignore */
    }
    DocsUtils.focusEditor();
    host.hidden = true;
    host.style.display = 'none';
    host.removeAttribute('aria-hidden');
  }

  function isVisible() {
    const host = document.getElementById(HOST_ID);
    return Boolean(host && !host.hidden);
  }

  function focusInput(options = {}) {
    const frame = document.getElementById(FRAME_ID);
    if (!frame || !isVisible()) return false;
    try {
      const input = frame.contentDocument?.getElementById('latex-input');
      if (input) {
        input.focus();
        if (options.selectAll === true) input.select();
        return true;
      }
      frame.contentWindow?.postMessage(
        {
          type: 'LATEX_GDOCS_FOCUS_INPUT',
          selectAll: options.selectAll === true
        },
        '*'
      );
      return true;
    } catch {
      return false;
    }
  }

  return { show, hide, isVisible, focusInput };
})();

if (typeof window !== 'undefined') {
  window.EditorPanel = EditorPanel;
}
