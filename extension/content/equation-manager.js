/**
 * equation-manager.js — Equation zone lifecycle (Linear / Professional)
 */

const EquationManager = (() => {
  const MODE_LINEAR = 'linear';
  const MODE_PROFESSIONAL = 'professional';

  /** @type {Map<string, object>} */
  const zones = new Map();

  let activeZoneId = null;
  let showLatexSource = false;
  let overlayContainer = null;
  let ariaLiveRegion = null;
  let nextInsertSeq = 0;

  function loadKatex() {
    ensureKatexStyles();
    return Promise.resolve(window.katex || null);
  }

  function ensureKatexStyles() {
    if (document.getElementById('latex-gdocs-katex-css')) return;
    try {
      const link = document.createElement('link');
      link.id = 'latex-gdocs-katex-css';
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL('lib/katex/katex.min.css');
      document.head.appendChild(link);
    } catch (err) {
      console.warn('[LaTeX-GDocs] KaTeX CSS load failed — refresh the page after reloading the extension', err);
    }
  }

  function showReloadBanner() {
    ExtensionContext.showReloadBanner();
  }

  function initUI() {
    ensureKatexStyles();
    if (!overlayContainer) {
      overlayContainer = document.createElement('div');
      overlayContainer.id = 'latex-gdocs-overlays';
      overlayContainer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(overlayContainer);
    }
    if (!ariaLiveRegion) {
      ariaLiveRegion = document.createElement('div');
      ariaLiveRegion.id = 'latex-gdocs-aria-live';
      ariaLiveRegion.setAttribute('role', 'status');
      ariaLiveRegion.setAttribute('aria-live', 'polite');
      ariaLiveRegion.setAttribute('aria-atomic', 'true');
      ariaLiveRegion.className = 'latex-gdocs-sr-only';
      document.body.appendChild(ariaLiveRegion);
    }
  }

  function announce(text) {
    if (!ariaLiveRegion) initUI();
    ariaLiveRegion.textContent = '';
    requestAnimationFrame(() => {
      ariaLiveRegion.textContent = text;
    });
  }

  function applySettings(settings) {
    if (settings && typeof settings.showLatexSource === 'boolean') {
      showLatexSource = settings.showLatexSource;
    }
    refreshOverlays();
  }

  function toggleShowSource() {
    showLatexSource = !showLatexSource;
    announce(showLatexSource ? 'LaTeX source shown' : 'LaTeX source hidden');
    refreshOverlays();
    return showLatexSource;
  }

  function getShowSource() {
    return showLatexSource;
  }

  function coverZoneSourceText(zone) {
    if (zone.element) {
      const line =
        zone.element.closest?.('.kix-lineview') ||
        zone.element.closest?.('.kix-paragraphrenderer') ||
        zone.element;
      zone._coveredLine = line;
      line?.classList.add('latex-gdocs-source-covered');
      zone.element.classList.add('latex-gdocs-source-covered');
      return;
    }

    const cursor = DocsUtils.getCursorRect();
    if (!cursor) return;
    for (const line of document.querySelectorAll('.kix-lineview, .kix-paragraphrenderer')) {
      const lineRect = line.getBoundingClientRect();
      if (Math.abs(lineRect.top - cursor.top) > 40) continue;
      const textBlock =
        line.querySelector('.kix-lineview-text-block') ||
        line.querySelector('.kix-lineview-content');
      if (textBlock) {
        zone._coveredLine = textBlock;
        textBlock.classList.add('latex-gdocs-source-covered');
        zone.element = textBlock;
        return;
      }
    }
  }

  function uncoverZoneSourceText(zone) {
    zone._coveredLine?.classList.remove('latex-gdocs-source-covered');
    zone.element?.classList.remove('latex-gdocs-source-covered');
    zone._coveredLine = null;
  }

  function overlaySizeForZone(zone) {
    const rect = zone.rect || { width: 100, height: 24 };
    const sourceLen = (zone.fullMatch || zone.latex || '').length + 10;
    return {
      width: Math.max(rect.width || 0, sourceLen * 7.5, 120),
      height: Math.max(rect.height || 0, 28)
    };
  }

  function createPendingId() {
    nextInsertSeq += 1;
    return 'eq-pending-' + Date.now() + '-' + nextInsertSeq;
  }

  function registerZoneAtCursor(id) {
    initUI();
    const rect = DocsUtils.rectForLinearZoneAtCursor(DocsUtils.getCursorRect());
    const zone = {
      id,
      latex: '',
      mode: MODE_LINEAR,
      rect,
      element: null,
      virtual: true,
      pending: true,
      start: null,
      editInOverlay: false,
      overlayEl: null
    };
    zones.set(id, zone);
    setActiveZone(id);
    renderOverlay(zone, id);
    coverZoneSourceText(zone);
    return zone;
  }

  function rectDistance(a, b) {
    if (!a || !b) return Infinity;
    return Math.abs((a.top || 0) - (b.top || 0)) + Math.abs((a.left || 0) - (b.left || 0));
  }

  function findScanForZone(zone, scanned) {
    if (!scanned?.length) return null;
    if (zone.start != null) {
      const exact = scanned.find((s) => s.start === zone.start);
      if (exact) return exact;
    }
    let best = null;
    let bestDist = Infinity;
    for (const item of scanned) {
      const d = rectDistance(zone.rect, item.rect);
      if (d < bestDist) {
        bestDist = d;
        best = item;
      }
    }
    return bestDist < 200 ? best : null;
  }

  function findExistingZoneForScanItem(item) {
    let best = null;
    let bestDist = Infinity;

    for (const [, z] of zones) {
      if (z.pending) continue;

      if (z.start != null && item.start != null && z.start === item.start) {
        return z;
      }
    }

    for (const [, z] of zones) {
      if (z.pending) continue;

      if (z.committed) {
        const d = rectDistance(z.rect, item.rect);
        if (d < 150) return z;
      }

      if (z.latex === item.latex && z.latex.trim()) {
        const d = rectDistance(z.rect, item.rect);
        if (d < bestDist) {
          bestDist = d;
          best = z;
        }
      }
    }

    if (best && bestDist < 200) return best;

    for (const [, z] of zones) {
      if (z.pending) continue;
      const d = rectDistance(z.rect, item.rect);
      if (d < 60) return z;
    }

    return null;
  }

  function applyScanItem(zone, item) {
    const preserveMode = zone.mode;
    const preserveLatex = (zone.latex || '').trim();
    const isCommitted = Boolean(zone.committed) || preserveMode === MODE_PROFESSIONAL;
    const scannedLatex = (item.latex || '').trim();

    zone.latex = item.latex;
    zone.rect = item.rect;
    zone.element = item.element;
    zone.range = item.range;
    zone.fullMatch = item.fullMatch;
    zone.start = item.start;
    zone.end = item.end;
    zone.virtual = false;
    zone.pending = false;

    if (isCommitted) {
      if (!scannedLatex && preserveLatex) {
        zone.latex = preserveLatex;
      } else if (scannedLatex) {
        zone.latex = scannedLatex;
      }
      zone.mode = MODE_PROFESSIONAL;
      zone.editInOverlay = false;
      zone.committed = true;
    } else {
      zone.mode = preserveMode;
    }

    if (zone.element) {
      zone.element.classList.add('latex-gdocs-delimiter-hidden');
    }
  }

  function syncZoneFromScan(zone, scanned) {
    const item = findScanForZone(zone, scanned);
    if (!item) return false;
    applyScanItem(zone, item);
    return true;
  }

  function syncActiveZoneFromScan(scanned) {
    const active = getActiveZone();
    if (!active) return;
    syncZoneFromScan(active, scanned);
    updateLinearOverlayText(active);
  }

  function updateLinearDisplay(zone) {
    if (!zone || zone.mode !== MODE_LINEAR || zone.editInOverlay) return;
    coverZoneSourceText(zone);

    if (!zone.overlayEl) return;

    const size = overlaySizeForZone(zone);
    zone.overlayEl.style.minWidth = size.width + 'px';
    zone.overlayEl.style.width = size.width + 'px';
    zone.overlayEl.style.minHeight = size.height + 'px';

    updateLinearOverlayText(zone);
  }

  function updateLinearOverlayText(zone) {
    if (!zone?.overlayEl || zone.mode !== MODE_LINEAR || zone.editInOverlay) return;
    const hint = zone.overlayEl.querySelector('.latex-gdocs-linear-hint, .latex-gdocs-linear-latex');
    if (!hint) return;
    const text = zone.latex.trim();
    hint.textContent = text || 'Type LaTeX, press Enter';
    hint.className = text ? 'latex-gdocs-linear-latex' : 'latex-gdocs-linear-hint';
  }

  function insertEquationZone() {
    const pendingId = createPendingId();
    const text = DocsUtils.emptyZoneText();
    announce('Equation editor, linear mode. Type LaTeX, then press Enter.');
    return DocsUtils.insertText(text, { cursorLeft: DocsUtils.EQ_CLOSE.length }).then((ok) => {
      if (!ok) {
        zones.delete(pendingId);
        announce('Could not insert equation. Click in the document, then try Alt equals again.');
        return false;
      }

      registerZoneAtCursor(pendingId);
      DocsUtils.focusEditor();

      const rescan = () => {
        const scanned = DocsUtils.scanDocumentForZones();
        const active = zones.get(pendingId);
        if (active) {
          syncZoneFromScan(active, scanned);
          coverZoneSourceText(active);
          renderOverlay(active, active.id);
          updateLinearDisplay(active);
        }
      };

      setTimeout(rescan, 200);
      setTimeout(rescan, 600);
      setTimeout(() => scanAndActivate().catch(() => {}), 800);
      return true;
    });
  }

  function getActiveZone() {
    if (activeZoneId && zones.has(activeZoneId)) {
      return zones.get(activeZoneId);
    }
    return null;
  }

  function setActiveZone(id) {
    zones.forEach((z) => {
      z.overlayEl?.classList.remove('latex-gdocs-zone-active');
      z.element?.classList.remove('latex-gdocs-zone-active');
    });
    activeZoneId = id;
    const zone = zones.get(id);
    if (zone) {
      zone.overlayEl?.classList.add('latex-gdocs-zone-active');
      zone.element?.classList.add('latex-gdocs-zone-active');
    }
  }

  function renderActiveZone() {
    if (!activeZoneId) return;
    const zone = zones.get(activeZoneId);
    if (!zone) return;
    updateLinearOverlayText(zone);
  }

  function commitToProfessional() {
    let zone = getActiveZone();
    if (!zone) {
      focusNearestZone();
      zone = getActiveZone();
    }
    if (!zone) {
      announce('No equation zone found.');
      return false;
    }

    const scanned = DocsUtils.scanDocumentForZones();
    syncZoneFromScan(zone, scanned);

    const input = zone.overlayEl?.querySelector('.latex-gdocs-linear-edit');
    if (input) {
      zone.latex = input.value.trim();
    }

    const item = findScanForZone(zone, scanned);
    const latex = (zone.latex || item?.latex || '').trim();

    if (!latex) {
      announce('Type LaTeX first, then press Enter.');
      return false;
    }

    zone.latex = latex;
    zone.mode = MODE_PROFESSIONAL;
    zone.committed = true;
    zone.editInOverlay = false;
    zone._missedScans = 0;
    setActiveZone(zone.id);
    coverZoneSourceText(zone);
    renderOverlay(zone, zone.id);

    announce(LatexSpeech.toNaturalSpeech(latex));

    activeZoneId = null;
    DocsUtils.focusEditor();
    DocsUtils.moveCursorAfterEquation();

    setTimeout(() => {
      scanAndActivate().catch(() => {});
    }, 400);
    return true;
  }

  function switchToLinear() {
    let zone = getActiveZone();
    if (!zone) {
      for (const [, z] of zones) {
        if (z.mode === MODE_PROFESSIONAL && z.latex.trim()) {
          setActiveZone(z.id);
          zone = z;
          break;
        }
      }
    }
    if (!zone || !zone.latex.trim()) {
      announce('Click an equation, then press F2 to edit.');
      return false;
    }

    zone.mode = MODE_LINEAR;
    zone.committed = false;
    zone.editInOverlay = true;
    renderOverlay(zone, zone.id);
    announce('Editing LaTeX. Press Enter when done.');
    return true;
  }

  function renderOverlay(zone, id) {
    if (!overlayContainer) initUI();

    let el = document.getElementById('latex-overlay-' + id);
    if (!el) {
      el = document.createElement('div');
      el.id = 'latex-overlay-' + id;
      el.className = 'latex-gdocs-overlay';
      el.setAttribute('data-zone-id', id);
      el.tabIndex = 0;
      el.addEventListener('focus', () => setActiveZone(id));
      el.addEventListener('click', () => setActiveZone(id));
      el.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveZone(id);
        const z = zones.get(id);
        if (z && z.mode === MODE_PROFESSIONAL) {
          switchToLinear();
        }
      });
      overlayContainer.appendChild(el);
    }

    const rect = zone.rect || zone.range?.getBoundingClientRect?.() || { top: 0, left: 0, width: 100, height: 24 };
    const size = overlaySizeForZone(zone);

    el.style.top = rect.top + 'px';
    el.style.left = rect.left + 'px';
    el.style.minWidth = size.width + 'px';
    el.style.minHeight = size.height + 'px';
    el.style.width = size.width + 'px';

    if (zone.mode === MODE_PROFESSIONAL && zone.latex.trim()) {
      el.classList.remove('latex-gdocs-hidden', 'latex-gdocs-linear');
      el.classList.add('latex-gdocs-professional');
      el.innerHTML = '';

      const mathEl = document.createElement('span');
      mathEl.className = 'latex-gdocs-math';
      el.appendChild(mathEl);

      if (window.katex) {
        try {
          window.katex.render(zone.latex, mathEl, {
            throwOnError: false,
            displayMode: false
          });
        } catch {
          mathEl.textContent = zone.latex;
        }
      } else {
        mathEl.textContent = zone.latex;
      }

      if (showLatexSource) {
        const src = document.createElement('div');
        src.className = 'latex-gdocs-source';
        src.textContent = zone.latex;
        el.appendChild(src);
      }

      el.setAttribute('aria-label', LatexSpeech.toNaturalSpeech(zone.latex));
    } else if (zone.mode === MODE_LINEAR) {
      el.classList.remove('latex-gdocs-hidden', 'latex-gdocs-professional');
      el.classList.add('latex-gdocs-linear');
      el.classList.toggle('latex-gdocs-editing', Boolean(zone.editInOverlay));
      el.tabIndex = zone.editInOverlay ? 0 : -1;
      coverZoneSourceText(zone);

      if (zone.editInOverlay && zone.latex.trim()) {
        let input = el.querySelector('.latex-gdocs-linear-edit');
        if (!input) {
          el.innerHTML = '';
          input = document.createElement('textarea');
          input.className = 'latex-gdocs-linear-edit';
          input.setAttribute('aria-label', 'Edit LaTeX equation');
          input.rows = 1;
          input.spellcheck = false;
          input.addEventListener('input', () => {
            zone.latex = input.value;
          });
          input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' && !ev.shiftKey) {
              ev.preventDefault();
              ev.stopPropagation();
              zone.latex = input.value;
              commitToProfessional();
            }
          });
          el.appendChild(input);
          requestAnimationFrame(() => {
            input.focus();
            input.select();
          });
        }
        input.value = zone.latex;
        el.setAttribute('aria-label', `Editing linear equation, ${zone.latex}`);
      } else {
        if (!el.querySelector('.latex-gdocs-linear-hint, .latex-gdocs-linear-latex')) {
          el.innerHTML = '';
          const hint = document.createElement('span');
          hint.className = zone.latex.trim() ? 'latex-gdocs-linear-latex' : 'latex-gdocs-linear-hint';
          hint.textContent = zone.latex.trim() || 'Type LaTeX, press Enter';
          el.appendChild(hint);
        } else {
          updateLinearOverlayText(zone);
        }
        el.setAttribute(
          'aria-label',
          zone.latex.trim()
            ? `Linear equation, ${zone.latex}`
            : 'Linear equation editor, type LaTeX'
        );
      }
    } else {
      el.classList.add('latex-gdocs-hidden');
      el.classList.remove('latex-gdocs-linear', 'latex-gdocs-professional');
    }

    zone.overlayEl = el;
  }

  function removeZone(id) {
    const zone = zones.get(id);
    if (!zone) return;
    uncoverZoneSourceText(zone);
    zone.overlayEl?.remove();
    zones.delete(id);
    if (activeZoneId === id) {
      activeZoneId = null;
    }
  }

  async function scanAndActivate() {
    try {
      initUI();
      await loadKatex();

      const scanned = DocsUtils.scanDocumentForZones();
      const matchedIds = new Set();

      scanned.forEach((item) => {
        let zone = findExistingZoneForScanItem(item);

        if (!zone) {
          for (const [, z] of zones) {
            if (z.pending && z.id === activeZoneId) {
              zone = z;
              break;
            }
          }
        }

        if (!zone) {
          const id = createPendingId();
          zone = {
            id,
            latex: item.latex,
            fullMatch: item.fullMatch,
            start: item.start,
            end: item.end,
            mode: item.latex.trim() ? MODE_PROFESSIONAL : MODE_LINEAR,
            committed: Boolean(item.latex.trim()),
            element: item.element,
            textNode: item.textNode,
            rect: item.rect,
            range: item.range,
            overlayEl: null,
            editInOverlay: false,
            pending: false
          };
          zones.set(id, zone);
        } else {
          applyScanItem(zone, item);
          if (!zone.committed && !item.latex.trim() && zone.mode !== MODE_PROFESSIONAL) {
            zone.mode = MODE_LINEAR;
            zone.editInOverlay = false;
          }
        }

        if (zone.mode === MODE_PROFESSIONAL && zone.latex.trim()) {
          coverZoneSourceText(zone);
        }

        matchedIds.add(zone.id);
        renderOverlay(zone, zone.id);
      });

      zones.forEach((zone, id) => {
        if (matchedIds.has(id)) return;
        if (zone.pending && id === activeZoneId) return;

        const stillInDoc = zoneStillInDocument(zone, scanned);

        if (!stillInDoc) {
          if (zone.committed) {
            zone._missedScans = (zone._missedScans || 0) + 1;
            if (zone._missedScans <= 20) {
              renderOverlay(zone, id);
              coverZoneSourceText(zone);
              return;
            }
          }
          removeZone(id);
        } else {
          zone._missedScans = 0;
        }
      });
    } catch (err) {
      console.warn('[LaTeX-GDocs] scan failed', err);
    }
  }

  function refreshZoneRect(zone) {
    if (zone.element?.isConnected) {
      const blockRect = zone.element.getBoundingClientRect();
      if (blockRect.width > 0 || blockRect.height > 0) {
        zone.rect = {
          top: blockRect.top,
          left: blockRect.left,
          width: blockRect.width,
          height: blockRect.height
        };
        return true;
      }
    }
    if (zone.range) {
      try {
        const rangeRect = zone.range.getBoundingClientRect();
        if (rangeRect.width > 0 || rangeRect.height > 0) {
          zone.rect = {
            top: rangeRect.top,
            left: rangeRect.left,
            width: rangeRect.width,
            height: rangeRect.height
          };
          return true;
        }
      } catch {
        /* range may be invalid after kix re-render */
      }
    }
    return false;
  }

  function repositionOverlays() {
    if (!overlayContainer) return;
    for (const [, zone] of zones) {
      if (!zone.overlayEl) continue;
      const hasLiveRect = refreshZoneRect(zone);
      if (!hasLiveRect && zone.committed) {
        // Off-screen (virtualized) — hide overlay until scrolled back
        zone.overlayEl.classList.add('latex-gdocs-hidden');
        continue;
      }
      if (hasLiveRect) {
        renderOverlay(zone, zone.id);
        if (zone.mode === MODE_PROFESSIONAL && zone.latex.trim()) {
          coverZoneSourceText(zone);
        }
      }
    }
  }

  function zoneStillInDocument(zone, scanned) {
    if (!scanned?.length) return zone.committed;
    return scanned.some((item) => {
      if (zone.latex?.trim() && item.latex === zone.latex) return true;
      if (zone.start != null && item.start != null && zone.start === item.start) return true;
      return false;
    });
  }

  function refreshOverlays() {
    scanAndActivate().catch((err) => console.warn('[LaTeX-GDocs] refresh failed', err));
  }

  function focusNearestZone() {
    const scanned = DocsUtils.scanDocumentForZones();
    if (scanned.length === 0) return null;

    const cursor = DocsUtils.getCursorRect();
    let best = scanned[scanned.length - 1];
    if (cursor) {
      let bestDist = Infinity;
      for (const item of scanned) {
        const d = rectDistance(cursor, item.rect);
        if (d < bestDist) {
          bestDist = d;
          best = item;
        }
      }
    }

    let zone = findExistingZoneForScanItem(best);
    if (!zone) {
      const id = createPendingId();
      zone = {
        id,
        latex: best.latex,
        fullMatch: best.fullMatch,
        start: best.start,
        end: best.end,
        mode: best.latex.trim() ? MODE_PROFESSIONAL : MODE_LINEAR,
        element: best.element,
        rect: best.rect,
        range: best.range,
        overlayEl: null,
        editInOverlay: false
      };
      zones.set(id, zone);
    }
    setActiveZone(zone.id);
    return zone;
  }

  function onDocumentEdited() {
    const active = getActiveZone();
    if (!active || active.mode !== MODE_LINEAR || active.editInOverlay) return;

    const scanned = DocsUtils.scanDocumentForZones();
    if (syncZoneFromScan(active, scanned)) {
      active._missedScans = 0;
    } else {
      active._missedScans = (active._missedScans || 0) + 1;
      if (!active.pending && active._missedScans > 5) {
        removeZone(active.id);
        announce('Equation removed.');
        return;
      }
    }
    updateLinearDisplay(active);
  }

  function onLinearKeystroke(key) {
    const active = getActiveZone();
    if (!active || active.mode !== MODE_LINEAR || active.editInOverlay) return;

    if (key === 'Backspace') {
      active.latex = (active.latex || '').slice(0, -1);
    } else if (key && key.length === 1) {
      active.latex = (active.latex || '') + key;
    } else {
      return;
    }

    updateLinearDisplay(active);
  }

  return {
    MODE_LINEAR,
    MODE_PROFESSIONAL,
    initUI,
    loadKatex,
    showReloadBanner,
    announce,
    applySettings,
    toggleShowSource,
    getShowSource,
    insertEquationZone,
    getActiveZone,
    setActiveZone,
    commitToProfessional,
    switchToLinear,
    scanAndActivate,
    refreshOverlays,
    repositionOverlays,
    renderActiveZone,
    focusNearestZone,
    syncActiveZoneFromScan,
    onDocumentEdited,
    onLinearKeystroke,
    updateLinearDisplay,
    registerZoneAtCursor
  };
})();

if (typeof window !== 'undefined') {
  window.EquationManager = EquationManager;
}
