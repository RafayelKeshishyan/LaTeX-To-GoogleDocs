/**
 * Run: node extension/test/latex-speech.test.js
 *
 * The same cases run in a browser via latex-speech.test.html, which needs no
 * toolchain at all.
 */
'use strict';

const LatexSpeech = require('../lib/latex-speech.js');
const cases = require('./latex-speech.cases.js');

let failed = 0;

for (const testCase of cases) {
  let actual;
  try {
    actual = LatexSpeech.toNaturalSpeech(testCase.latex);
  } catch (err) {
    actual = 'THREW: ' + err.message;
  }

  if (actual === testCase.expect) {
    console.log('PASS', JSON.stringify(testCase.latex));
  } else {
    failed += 1;
    console.log('FAIL', JSON.stringify(testCase.latex));
    console.log('  expected:', testCase.expect);
    console.log('  actual:  ', actual);
  }
}

console.log(failed ? `\n${failed} failing` : `\nAll ${cases.length} passing`);
process.exit(failed ? 1 : 0);
