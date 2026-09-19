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
  ['\\sum_{i=1}^{n} i', 'the sum from i equals 1 to n i'],
  ['\\lim_{x\\to0} \\frac{\\sin x}{x}',
    'the limit as x approaches 0 the fraction with numerator sine x and denominator x'],
  ['\\int_0^1 x^2\\,dx', 'the integral from 0 to 1 x squared dx'],
  ['\\vec{F}=m\\vec{a}', 'vector F equals m vector a'],
  ['9.8\\ \\mathrm{m/s^2}', '9.8 m divided by s squared'],
  ['30^\\circ', '30 degrees'],
  ['\\ce{2H2 + O2 -> 2H2O}',
    '2 hydrogen sub 2 plus oxygen sub 2 yields 2 hydrogen sub 2 oxygen'],
  ['\\ce{Ca^2+}', 'calcium charge 2 plus']
];

for (const [latex, expected] of cases) {
  assert.equal(context.toSpeech(latex), expected, latex);
}

assert.doesNotMatch(html, /\.innerHTML\s*=/, 'Sidebar must not build accessible content with innerHTML.');
assert.match(html, /class="visual-preview" aria-hidden="true"/);
assert.match(html, /role="status" aria-live="assertive"/);
assert.match(html, />\s*Edit equation at document cursor\s*</);
assert.match(html, />\s*Delete equation at cursor\s*</);
assert.match(html, /id="new-line-after" type="checkbox" checked/);
assert.match(html, /aria-label="New line after insert"/);
assert.doesNotMatch(html, /aria-describedby="input-help"/);
assert.doesNotMatch(html, /placeholder="Example:/);
assert.match(html, /mhchem\.min\.js/);
assert.match(html, />\s*Return to document\s*</);
assert.match(html, /google\.script\.host\.editor\.focus\(\)/);
assert.match(html, /function returnToDocument\(\)/);
assert.match(html, /wasInsert/);
assert.match(html, /if \(wasInsert\) \{[\s\S]*?google\.script\.host\.editor\.focus\(\)/);
assert.match(html, /event\.key === 'Escape'/);
assert.match(html, /ACCESSIBLE_EQUATIONS_FOCUS_REQUEST/);
assert.match(html, /ACCESSIBLE_EQUATIONS_FOCUS_READY/);
assert.match(html, /ACCESSIBLE_EQUATIONS_FOCUS_INPUT/);
assert.match(html, /window\.top\.postMessage\(ready/);
assert.match(html, /fromSelf/);
assert.match(html, /function focusEditorForDocumentCursor\(\)/);
assert.doesNotMatch(html, /Checking the document cursor/);
assert.match(html, /New equation\. /);
assert.match(html, /Editing equation:/);
assert.match(html, /Selected\./);
assert.doesNotMatch(html, /Linear LaTeX/);
assert.doesNotMatch(html, /aria-label="Linear/);
assert.match(html, /stopEditing\(wasInsert\)/);
assert.match(html, /Alt\+Equals edits/);
assert.match(html, /Ctrl\+Shift\+Delete deletes/);
assert.match(html, /actions stack/);
assert.match(html, /actions quiet/);
assert.match(html, /actions danger-row/);
assert.match(html, /id="all-equations"/);
assert.match(html, /function refreshEquationsIfOpen\(\)/);
assert.match(html, /scale: 2/);
assert.doesNotMatch(html, /scale: 3/);
assert.doesNotMatch(html, /updatePreview\(\);\s*refreshEquations\(\);/);
assert.doesNotMatch(html, /Equations refreshed/);
assert.match(html, /event\.ctrlKey && event\.shiftKey && event\.key === 'Delete'/);
assert.match(html, /dataset\.selectedAction === 'edit'/);
assert.match(html, /dataset\.selectedAction === 'delete'/);

console.log('All sidebar speech and accessibility checks passed.');
