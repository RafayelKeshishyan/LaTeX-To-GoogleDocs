/**
 * Run: node extension/test/document-bridge.test.js
 * Exercises insert outcomes with a mocked Google Docs surface.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'content', 'document-bridge.js'),
  'utf8'
);

function makeBridge({
  confirmInsert = true,
  transportOk = true,
  beforeCount = 0,
  scannersExposeInsert = true,
  containsExposesInsert = true
} = {}) {
  let inserted = false;
  let insertCalls = 0;
  let panelFocusCalls = 0;
  let panelSelectedAll = false;
  let pointerUpdates = 0;
  const insertedTexts = [];
  const navCalls = [];
  const zone = '[[eq]]x^2[[/eq]]';
  const beforeText = beforeCount ? zone : 'Before\nAfter';
  const afterText = beforeText + (beforeCount ? '\n' : '') + zone;

  const DocsUtils = {
    isDocumentEditPage: () => true,
    isUnsupportedDocsView: () => false,
    ensureInsertPoint: async () => {},
    focusEditor: () => {},
    zoneText: (latex) => `[[eq]]${latex}[[/eq]]`,
    readHiddenModelText: () =>
      inserted && confirmInsert ? afterText : beforeText,
    scanDocumentForZones: () =>
      Array.from({
        length:
          beforeCount +
          (inserted && confirmInsert && scannersExposeInsert ? 1 : 0)
      }, () => ({ latex: 'x^2' })),
    countEquationsWithLatex: () =>
      beforeCount +
      (inserted && confirmInsert && scannersExposeInsert ? 1 : 0),
    documentContainsEquation: () =>
      beforeCount > 0 ||
      (inserted && confirmInsert && containsExposesInsert),
    insertText: async (text) => {
      insertCalls += 1;
      insertedTexts.push(text);
      if (!transportOk) return false;
      inserted = true;
      return true;
    },
    insertLandedAtDocumentEnd: () => false,
    updateInsertPointerFromCursor: () => {
      pointerUpdates += 1;
    },
    countInlineImages: () => 0,
    insertImagePng: async () => false,
    listEquationsOrdered: () => [],
    findEquationForCursor: () => null,
    findEquationAtPoint: () => null,
    deleteEquationZone: async () => ({ ok: true }),
    replaceEquationZone: async () => ({ ok: true, latex: 'x^2' })
  };

  const context = {
    console,
    setTimeout,
    clearTimeout,
    document: {},
    window: {},
    DocsUtils,
    ExtensionContext: { ensurePageMain: async () => {} },
    LatexSpeech: { toNaturalSpeech: () => 'x squared' },
    InsertionVerification: require('../lib/insertion-verification.js'),
    EditorPanel: {
      isVisible: () => true,
      focusInput: (options = {}) => {
        panelFocusCalls += 1;
        panelSelectedAll = options.selectAll === true;
      }
    },
    EquationNavigator: {
      beginInsert: () => {},
      onInserted: (_latex, options) => navCalls.push(options || {})
    },
    SpeechOutput: undefined
  };
  vm.createContext(context);
  vm.runInContext(source + '\nthis.__bridge = DocumentBridge;', context);
  return {
    bridge: context.__bridge,
    navCalls,
    getInsertCalls: () => insertCalls,
    getInsertedTexts: () => insertedTexts,
    getPanelFocusCalls: () => panelFocusCalls,
    didPanelSelectAll: () => panelSelectedAll,
    getPointerUpdates: () => pointerUpdates
  };
}

async function run() {
  {
    const harness = makeBridge();
    const result = await harness.bridge.insertLatex('x^2', null, {
      fastReturn: true,
      safeAuthoring: true,
      skipImage: true,
      skipAnnounce: true
    });
    assert.equal(result.ok, true);
    assert.equal(result.verified, true);
    assert.equal(harness.getInsertCalls(), 1);
    assert.deepEqual(harness.getInsertedTexts(), ['[[eq]]x^2[[/eq]]\n']);
    assert.equal(harness.getPointerUpdates(), 1);
    assert.equal(harness.getPanelFocusCalls(), 1);
    assert.equal(harness.didPanelSelectAll(), true);
    assert.equal(harness.navCalls.length, 2);
    assert.equal(harness.navCalls[0].skipAnnounce, true);
    console.log('PASS safe authoring inserts one equation line and restores panel focus');
  }

  {
    const harness = makeBridge({ confirmInsert: true, beforeCount: 1 });
    const result = await harness.bridge.insertLatex('x^2', null, {
      fastReturn: true,
      skipImage: true
    });
    assert.equal(result.verified, true);
    console.log('PASS a second identical equation is confirmed by its increased count');
  }

  {
    const harness = makeBridge({
      confirmInsert: true,
      scannersExposeInsert: false,
      containsExposesInsert: true
    });
    const result = await harness.bridge.insertLatex('x^2', null, {
      fastReturn: true,
      skipImage: true
    });
    assert.equal(result.verified, true);
    console.log('PASS first insert uses Docs fallback evidence when scanners lag');
  }

  {
    const harness = makeBridge({ confirmInsert: false });
    const result = await harness.bridge.insertLatex('x^2', null, {
      fastReturn: true,
      skipImage: true
    });
    assert.equal(result.ok, true);
    assert.equal(result.verified, false);
    assert.match(result.warning, /equation entered.*did not expose/i);
    assert.equal(harness.navCalls.length, 0);
    console.log('PASS an unconfirmed insert never claims success in the document bridge');
  }

  {
    const harness = makeBridge({ transportOk: false });
    const result = await harness.bridge.insertLatex('x^2', null, {
      fastReturn: true,
      skipImage: true
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /Could not insert/i);
    console.log('PASS a rejected insert reports failure immediately');
  }
}

run().catch((err) => {
  console.error('FAIL', err);
  process.exitCode = 1;
});
