/**

 * document-bridge.js — Document operations for side panel (no overlays)

 */



const DocumentBridge = (() => {

  let ariaLiveRegion = null;

  let ariaLiveAssertive = null;



  function initAnnounce() {
    if (typeof SpeechOutput === 'undefined') return;

    if (!ariaLiveRegion) {
      ariaLiveRegion = SpeechOutput.createLiveRegion(
        document,
        'latex-gdocs-aria-live',
        'polite'
      );
    }

    if (!ariaLiveAssertive) {
      ariaLiveAssertive = SpeechOutput.createLiveRegion(
        document,
        'latex-gdocs-aria-live-assertive',
        'assertive'
      );
    }
  }

  function announce(text, options = {}) {
    if (typeof SpeechOutput === 'undefined') return;
    initAnnounce();
    const pageEl = options.priority === 'assertive' ? ariaLiveAssertive : ariaLiveRegion;
    SpeechOutput.announceInRegion(pageEl, text, {
      interrupt: options.interrupt === true,
      latex: options.latex,
      fallback: options.speech
    });
    SpeechOutput.speak(options.speech || text);
  }



  function sleep(ms) {

    return new Promise((resolve) => setTimeout(resolve, ms));

  }



  function rectDistance(a, b) {

    if (!a || !b) return Infinity;

    return Math.abs((a.top || 0) - (b.top || 0)) + Math.abs((a.left || 0) - (b.left || 0));

  }



  function captureInsertionState(latex) {
    return {
      text: DocsUtils.readHiddenModelText(),
      zoneCount: DocsUtils.scanDocumentForZones().length,
      latexCount: DocsUtils.countEquationsWithLatex(latex),
      containsEquation: DocsUtils.documentContainsEquation(latex)
    };
  }

  function hasInsertionEvidence(before, after, zoneText) {
    if (
      typeof InsertionVerification !== 'undefined' &&
      InsertionVerification.insertedTextCountIncreased(
        before.text,
        after.text,
        zoneText
      )
    ) {
      return true;
    }

    return (
      (!before.containsEquation && after.containsEquation) ||
      after.latexCount > before.latexCount ||
      after.zoneCount > before.zoneCount
    );
  }

  async function waitForInsertionEvidence(
    latex,
    zoneText,
    before,
    maxMs = 6000
  ) {
    const start = Date.now();
    let after = captureInsertionState(latex);

    while (Date.now() - start < maxMs) {
      if (hasInsertionEvidence(before, after, zoneText)) {
        return { verified: true, after };
      }
      await sleep(200);
      after = captureInsertionState(latex);
    }

    return {
      verified: hasInsertionEvidence(before, after, zoneText),
      after
    };
  }



  async function listEquations() {
    return DocsUtils.listEquationsOrdered().map((item) => ({
      id: 'eq-' + (item.equationNumber || item.start || 0),
      latex: item.latex || '',
      start: item.start,
      equationNumber: item.equationNumber,
      total: item.total,
      source: 'document',
      preview: item.latex?.trim()
        ? LatexSpeech.toNaturalSpeech(item.latex)
        : 'empty equation'
    }));
  }

  async function findNearestEquation() {
    return DocsUtils.findEquationForCursor();
  }



  function findEquationAtClick(clientX, clientY) {

    const atPoint = DocsUtils.findEquationAtPoint(clientX, clientY);

    if (atPoint?.latex?.trim()) return atPoint;

    return null;

  }



  async function prepareDocumentForInsert(options = {}) {
    await ExtensionContext.ensurePageMain();
    await DocsUtils.ensureInsertPoint();
    DocsUtils.focusEditor();
    await sleep(options.fast ? 40 : 100);
  }



  /**
   * Leave the writer on a fresh line ready for the next equation, but only
   * when the insert landed at the end of the document. In the middle of a
   * document the next line break already exists, so adding one would strand a
   * blank line — the case you hit after deleting an equation and retyping it.
   *
   * The caret stays in the document. Do not move focus back to Linear LaTeX.
   */
  async function prepareNextLineAfterInsert(insertedText, textBefore) {
    await sleep(100);

    const textAfter = DocsUtils.readHiddenModelText();
    if (!DocsUtils.insertLandedAtDocumentEnd(textBefore, textAfter, insertedText)) {
      DocsUtils.updateInsertPointerFromCursor();
      return;
    }

    await DocsUtils.insertText('\n', { cursorLeft: 0, skipFocus: true });
    await sleep(80);
    DocsUtils.updateInsertPointerFromCursor();
  }

  async function insertLatex(latex, pngDataUrl, options = {}) {
    const trimmed = (latex || '').trim();
    const insertText = latex ?? '';
    if (!trimmed) {
      return { ok: false, error: 'Type LaTeX first.' };
    }



    if (!DocsUtils.isDocumentEditPage()) {

      return { ok: false, error: 'Open a document at a URL ending in /edit.' };

    }



    if (DocsUtils.isUnsupportedDocsView()) {

      return { ok: false, error: 'Desktop editor required. Use the /edit URL.' };

    }



    const speech = LatexSpeech.toNaturalSpeech(trimmed);

    if (typeof EquationNavigator !== 'undefined') {
      EquationNavigator.beginInsert();
    }

    await prepareDocumentForInsert({ fast: options.fastReturn === true });

    if (options.newLine) {
      await DocsUtils.openLineBelow();
    }



    let insertedAs = null;



    const tryImage = pngDataUrl && options.skipImage !== true;

    if (tryImage) {

      const imagesBefore = DocsUtils.countInlineImages();

      const imageOk = await DocsUtils.insertImagePng(pngDataUrl, imagesBefore);

      if (imageOk) {

        insertedAs = 'image';

        if (!options.skipAnnounce) {
          announce('Equation inserted. ', {
            priority: 'assertive',
            latex: trimmed,
            speech: 'Equation inserted. ' + speech
          });
        }

        if (typeof EquationNavigator !== 'undefined') {
          EquationNavigator.onInserted(trimmed);
        }

        return { ok: true, speech, latex: trimmed, insertedAs, verified: true };

      }

    }



    const zoneText = DocsUtils.zoneText(insertText);
    // In the accessible authoring workflow each equation occupies one line.
    // Insert the following line break in the same editor operation so focus
    // can leave Google Docs immediately and the next equation cannot become
    // attached to this one's closing delimiter.
    const safeAuthoring = options.safeAuthoring === true;
    const documentText = safeAuthoring ? zoneText + '\n' : zoneText;
    const textBefore = DocsUtils.readHiddenModelText();
    const stateBefore = captureInsertionState(trimmed);

    const textOk = await DocsUtils.insertText(documentText, { cursorLeft: 0 });



    if (!textOk) {
      return {
        ok: false,
        error:
          'Could not insert. Click once in the document where you want the equation, then press Alt Enter again.',
        speech
      };
    }

    if (safeAuthoring) {
      // Save the new empty-line caret as the next insertion target before the
      // iframe takes focus back. Verification itself does not need focus.
      await sleep(80);
      DocsUtils.updateInsertPointerFromCursor();
      if (typeof EditorPanel !== 'undefined' && EditorPanel.isVisible?.()) {
        EditorPanel.focusInput({ selectAll: true });
      }
    }



    const verification = await waitForInsertionEvidence(
      trimmed,
      zoneText,
      stateBefore,
      options.fastReturn ? 1600 : 6000
    );

    if (!verification.verified) {
      return {
        ok: true,
        speech,
        latex: trimmed,
        insertedAs: 'text',
        verified: false,
        warning:
          'Equation entered. Google Docs did not expose it to the equation list.'
      };
    }



    if (options.fastReturn && typeof EquationNavigator !== 'undefined') {
      // Update navigation state now, but wait to speak until Docs finishes
      // moving focus and (at document end) creating the next line.
      EquationNavigator.onInserted(trimmed, { skipAnnounce: true });
    } else if (typeof EquationNavigator !== 'undefined') {
      EquationNavigator.onInserted(trimmed, {
        skipAnnounce: options.skipAnnounce === true
      });
    } else if (!options.skipAnnounce) {
      announce('', {
        priority: 'assertive',
        interrupt: true,
        latex: trimmed,
        speech
      });
    }

    if (!safeAuthoring) {
      await prepareNextLineAfterInsert(zoneText, textBefore);
    }

    if (options.fastReturn) {
      // Wait until NVDA finishes "document content, edit, blank". If we
      // speak during that focus change, NVDA drops the math entirely.
      await sleep(500);
      if (typeof EquationNavigator !== 'undefined') {
        EquationNavigator.onInserted(trimmed);
      } else {
        announce('', {
          priority: 'assertive',
          interrupt: true,
          latex: trimmed,
          speech
        });
      }
    }



    return {

      ok: true,

      speech,

      latex: trimmed,

      insertedAs: insertedAs || 'text',

      verified: true

    };

  }



  async function deleteEquation(equation) {
    if (!DocsUtils.isDocumentEditPage()) {
      return { ok: false, error: 'Open a document at a URL ending in /edit.' };
    }
    if (DocsUtils.isUnsupportedDocsView()) {
      return { ok: false, error: 'Desktop editor required. Use the /edit URL.' };
    }
    return DocsUtils.deleteEquationZone(equation);
  }

  async function replaceEquation(equation, latex) {
    if (!DocsUtils.isDocumentEditPage()) {
      return { ok: false, error: 'Open a document at a URL ending in /edit.' };
    }
    if (DocsUtils.isUnsupportedDocsView()) {
      return { ok: false, error: 'Desktop editor required. Use the /edit URL.' };
    }

    if (typeof EquationNavigator !== 'undefined') {
      EquationNavigator.beginInsert();
    }

    const result = await DocsUtils.replaceEquationZone(equation, latex);

    if (result.ok) {
      result.speech = LatexSpeech.toNaturalSpeech(result.latex);
      if (typeof EquationNavigator !== 'undefined') {
        EquationNavigator.onInserted(result.latex, { prefix: 'Equation replaced. ' });
      }
    }

    return result;
  }

  function getPageInfo() {

    return {

      ok: true,

      isEditPage: DocsUtils.isDocumentEditPage(),

      isUnsupported: DocsUtils.isUnsupportedDocsView(),

      equationCount: DocsUtils.scanDocumentForZones().length

    };

  }



  return {

    announce,

    listEquations,

    findNearestEquation,

    findEquationAtClick,

    insertLatex,

    replaceEquation,

    deleteEquation,

    getPageInfo

  };

})();



if (typeof window !== 'undefined') {

  window.DocumentBridge = DocumentBridge;

}

