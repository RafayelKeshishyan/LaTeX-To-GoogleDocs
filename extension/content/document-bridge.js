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



  async function waitForEquationInDocument(latex, beforeCount, maxMs = 6000) {

    const start = Date.now();

    while (Date.now() - start < maxMs) {

      if (DocsUtils.documentContainsEquation(latex)) return true;

      if (DocsUtils.countEquationsWithLatex(latex) > beforeCount) return true;

      await sleep(200);

    }

    return DocsUtils.documentContainsEquation(latex);

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



    const zoneCountBefore = options.fastReturn
      ? 0
      : DocsUtils.scanDocumentForZones().length;

    const latexCountBefore = options.fastReturn
      ? 0
      : DocsUtils.countEquationsWithLatex(trimmed);

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
    const textBefore = DocsUtils.readHiddenModelText();

    const textOk = await DocsUtils.insertText(zoneText, { cursorLeft: 0 });



    if (!textOk) {
      return {
        ok: false,
        error:
          'Could not insert. Click once in the document where you want the equation, then press Alt Enter again.',
        speech
      };
    }



    if (options.fastReturn) {

      if (typeof EquationNavigator !== 'undefined') {
        EquationNavigator.onInserted(trimmed, { skipAnnounce: true });
      }

      await prepareNextLineAfterInsert(zoneText, textBefore);

      // Wait until NVDA finishes "document content, edit, blank". If we
      // speak during that focus change, NVDA drops the math entirely.
      await sleep(500);
      if (typeof EquationNavigator !== 'undefined') {
        EquationNavigator.onInserted(trimmed);
      }

      return {

        ok: true,

        speech,

        latex: trimmed,

        insertedAs: 'text',

        verified: true

      };

    }



    await sleep(250);

    let verified = await waitForEquationInDocument(trimmed, latexCountBefore);

    if (!verified) {

      verified = DocsUtils.scanDocumentForZones().length > zoneCountBefore;

    }

    if (!verified) {

      verified = DocsUtils.documentContainsEquation(trimmed);

    }



    if (typeof EquationNavigator !== 'undefined') {
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

    await prepareNextLineAfterInsert(zoneText, textBefore);



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

