/**
 * Run: node extension/test/speech-output.test.js
 * Ensures automatic screen-reader announcements prefer complete natural speech.
 */
'use strict';

const assert = require('node:assert/strict');

const SpeechOutput = require('../lib/speech-output.js');

const natural = 'y equals the square root of x plus 3';
let mathmlConversions = 0;
global.LatexMathML = {
  fromLatex: () => {
    mathmlConversions += 1;
    return '<math><mi>y</mi></math>';
  }
};

{
  const result = SpeechOutput.prepareLiveAnnouncement('Equation inserted. ', {
    latex: 'y=\\sqrt{x+3}',
    fallback: natural
  });
  assert.equal(result.prefix, natural);
  assert.equal(result.mathml, '');
  assert.equal(mathmlConversions, 0);
  console.log('PASS natural speech replaces automatic live-region MathML');
}

{
  const result = SpeechOutput.prepareLiveAnnouncement('Equation inserted. ', {
    latex: 'y=\\sqrt{x+3}',
    fallback: natural,
    preferMathML: true
  });
  assert.equal(result.prefix, 'Equation inserted.');
  assert.equal(result.mathml, '<math><mi>y</mi></math>');
  assert.equal(mathmlConversions, 1);
  console.log('PASS MathML is used only when a caller explicitly requests it');
}

delete global.LatexMathML;
