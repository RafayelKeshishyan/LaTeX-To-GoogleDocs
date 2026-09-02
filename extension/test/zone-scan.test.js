/**
 * Run: node extension/test/zone-scan.test.js
 */
'use strict';

function clearKixText(text) {
  if (!text) return '';
  return text
    .replace(/\u200C/g, '')
    .replace(/\u200B/g, '')
    .replace(/\uFEFF/g, '')
    .replace(/\u034F/g, '')
    .replace(/\u00A0/g, ' ');
}

function normalizeScanText(text) {
  if (!text) return '';
  return clearKixText(text).replace(/[\u200B-\u200D\uFEFF\u034F\u00AD\u2060]/g, '');
}

function hasEquationMarkup(text) {
  const normalized = normalizeScanText(text);
  if (/(?:\[\[eq\]\]|\u27E6eq\u27E7|⟦eq⟧)/i.test(normalized)) return true;
  if (/\[\[/.test(normalized) && /\/eq\]\]/i.test(normalized)) return true;
  return false;
}

function findZones(text) {
  const normalized = normalizeScanText(text);
  const zones = [];
  const patterns = [
    /\[\[eq\]\]([\s\S]*?)\[\[\/eq\]\]/gi,
    /\u27E6eq\u27E7([\s\S]*?)\u27E6\/eq\u27E7/g,
    /\[\s*\[\s*eq\s*\]\s*\]([\s\S]*?)\[\s*\[\s*\/\s*eq\s*\]\s*\]/gi
  ];

  for (const source of patterns) {
    const re = new RegExp(source.source, source.flags.includes('g') ? source.flags : source.flags + 'g');
    let match;
    while ((match = re.exec(normalized)) !== null) {
      zones.push({ fullMatch: match[0], latex: match[1] });
    }
  }
  return zones;
}

const samples = [
  '[[eq]]y=x+x^2[[/eq]]',
  'before [[eq]]y=\\sqrt{x + 3}[[/eq]] after',
  '[[eq]]y=x+x^2[[/eq]]'.replace(/\[\[/g, '[\u200B['),
  '\u27E6eq\u27E7y=x^2\u27E6/eq\u27E7'
];

let failed = 0;
for (const sample of samples) {
  const ok = hasEquationMarkup(sample) && findZones(sample).length > 0;
  console.log(ok ? 'PASS' : 'FAIL', JSON.stringify(sample.slice(0, 60)));
  if (!ok) failed++;
}

const extracted = findZones('[[eq]]y=x+x^2[[/eq]]')[0]?.latex;
if (extracted !== 'y=x+x^2') {
  console.log('FAIL latex extract got', extracted);
  failed++;
} else {
  console.log('PASS latex extract');
}

process.exit(failed ? 1 : 0);
