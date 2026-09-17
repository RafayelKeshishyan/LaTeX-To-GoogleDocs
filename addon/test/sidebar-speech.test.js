'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'Sidebar.html'), 'utf8');
const start = html.indexOf('    const greek =');
const end = html.indexOf('    function setStatus', start);
assert.ok(start >= 0 && end > start, 'Could not find the sidebar speech converter.');

const context = {};
vm.createContext(context);
vm.runInContext(
  html.slice(start, end) + '\nthis.toSpeech = naturalSpeech;',
  context,
  { filename: 'Sidebar speech converter' }
);

const cases = [
  ['y=x^2', 'y equals x squared'],
  ['y=\\sqrt{x + 3}', 'y equals the square root of x plus 3'],
  ['\\frac{3}{4}', 'the fraction with numerator 3 and denominator 4'],
  ['x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}',
    'x equals the fraction with numerator minus b plus or minus the square root of b squared minus 4ac and denominator 2a'],
  ['\\sum_{i=1}^{n} i', 'the sum from i equals 1 to n i']
];

for (const [latex, expected] of cases) {
  assert.equal(context.toSpeech(latex), expected, latex);
}

assert.doesNotMatch(html, /\.innerHTML\s*=/, 'Sidebar must not build accessible content with innerHTML.');
assert.match(html, /class="visual-preview" aria-hidden="true"/);
assert.match(html, /role="status" aria-live="assertive"/);
assert.match(html, />\s*Edit selected equation from document\s*</);

console.log('All sidebar speech and accessibility checks passed.');
