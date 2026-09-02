/**

 * document-bridge.js — Document operations for side panel (no overlays)

 */



const DocumentBridge = (() => {

  let ariaLiveRegion = null;

  let ariaLiveAssertive = null;



  function initAnnounce() {

    if (!ariaLiveRegion) {

      ariaLiveRegion = document.createElement('div');

      ariaLiveRegion.id = 'latex-gdocs-aria-live';

      ariaLiveRegion.setAttribute('role', 'status');

      ariaLiveRegion.setAttribute('aria-live', 'polite');

      ariaLiveRegion.setAttribute('aria-atomic', 'true');

      ariaLiveRegion.className = 'latex-gdocs-sr-only';

      ariaLiveRegion.style.cssText =

        'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';

      document.body.appendChild(ariaLiveRegion);

    }



    if (!ariaLiveAssertive) {

      ariaLiveAssertive = document.createElement('div');

      ariaLiveAssertive.id = 'latex-gdocs-aria-live-assertive';

      ariaLiveAssertive.setAttribute('role', 'alert');

      ariaLiveAssertive.setAttribute('aria-live', 'assertive');

      ariaLiveAssertive.setAttribute('aria-atomic', 'true');

      ariaLiveAssertive.className = 'latex-gdocs-sr-only';

      ariaLiveAssertive.style.cssText = ariaLiveRegion.style.cssText;

      document.body.appendChild(ariaLiveAssertive);

    }

  }



  function speakLive(el, text) {

    el.textContent = '';

    requestAnimationFrame(() => {

      el.textContent = text;

      setTimeout(() => {

        el.textContent = '';

        requestAnimationFrame(() => {

          el.textContent = text;

        });

      }, 80);

    });

  }



  function announce(text, options = {}) {

    initAnnounce();

    const el = options.priority === 'assertive' ? ariaLiveAssertive : ariaLiveRegion;

    speakLive(el, text);

    if (typeof SpeechOutput !== 'undefined') {

      SpeechOutput.speak(text);

    }

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



  async function prepareNextLineAfterInsert() {
    await sleep(100);
    DocsUtils.focusEditor();
    await DocsUtils.insertText('\n', { cursorLeft: 0 });
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
          announce('Equation inserted. ' + speech, { priority: 'assertive' });
        }

        if (typeof EquationNavigator !== 'undefined') {
          EquationNavigator.onInserted(trimmed);
        }

        return { ok: true, speech, latex: trimmed, insertedAs, verified: true };

      }

    }



    const textOk = await DocsUtils.insertText(DocsUtils.zoneText(insertText), { cursorLeft: 0 });



    if (!textOk) {

      return {

        ok: false,

        error:

          'Could not insert. Click once in the document where you want the equation, then press Alt Enter again.',

        speech

      };

    }



    if (options.fastReturn) {

      DocsUtils.focusEditor();

      if (typeof EquationNavigator !== 'undefined') {
        EquationNavigator.onInserted(trimmed);
      }

      prepareNextLineAfterInsert().catch(() => {});

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



    DocsUtils.focusEditor();



    if (!options.skipAnnounce) {
      announce('Equation inserted. ' + speech, { priority: 'assertive' });
    }

    if (typeof EquationNavigator !== 'undefined') {
      EquationNavigator.onInserted(trimmed);
    }

    prepareNextLineAfterInsert().catch(() => {});



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

