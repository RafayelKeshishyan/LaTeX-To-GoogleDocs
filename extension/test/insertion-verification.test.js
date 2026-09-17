/**
 * Run: node extension/test/insertion-verification.test.js
 */
'use strict';

const verify = require('../lib/insertion-verification.js');

const zone = '[[eq]]x^2[[/eq]]';
const cases = [
  {
    name: 'unchanged document is not a confirmed insert',
    before: 'Before\n',
    after: 'Before\n',
    inserted: zone,
    increased: false,
    atEnd: false
  },
  {
    name: 'empty model text is not treated as document end',
    before: '',
    after: '',
    inserted: zone,
    increased: false,
    atEnd: false
  },
  {
    name: 'new equation at document end is confirmed',
    before: 'Before\n',
    after: 'Before\n' + zone,
    inserted: zone,
    increased: true,
    atEnd: true
  },
  {
    name: 'new equation in the middle does not get a trailing newline',
    before: 'Before\nAfter',
    after: 'Before\n' + zone + '\nAfter',
    inserted: zone,
    increased: true,
    atEnd: false
  },
  {
    name: 'a second identical equation is still detected',
    before: zone + '\n',
    after: zone + '\n' + zone,
    inserted: zone,
    increased: true,
    atEnd: true
  },
  {
    name: 'Google Docs zero-width characters do not hide an insert',
    before: 'Before\n',
    after: 'Before\n[\u200B[eq]]x^2[\u200B[/eq]]',
    inserted: zone,
    increased: true,
    atEnd: true
  }
];

let failed = 0;
for (const testCase of cases) {
  const increased = verify.insertedTextCountIncreased(
    testCase.before,
    testCase.after,
    testCase.inserted
  );
  const atEnd = verify.landedAtDocumentEnd(
    testCase.before,
    testCase.after,
    testCase.inserted
  );
  const ok = increased === testCase.increased && atEnd === testCase.atEnd;
  console.log(ok ? 'PASS' : 'FAIL', testCase.name);
  if (!ok) {
    console.log('  expected:', {
      increased: testCase.increased,
      atEnd: testCase.atEnd
    });
    console.log('  actual:  ', { increased, atEnd });
    failed += 1;
  }
}

const duplicateBefore = zone + '\n' + zone;
const duplicateAfterDelete = zone;
if (!verify.textCountDecreased(duplicateBefore, duplicateAfterDelete, zone)) {
  console.log('FAIL deleting one of two identical equations is detected');
  failed += 1;
} else {
  console.log('PASS deleting one of two identical equations is detected');
}

const replacement = '[[eq]]x^3[[/eq]]';
const replacedSecond = zone + '\n' + replacement;
const replacementOk =
  verify.textCountDecreased(duplicateBefore, replacedSecond, zone) &&
  verify.insertedTextCountIncreased(duplicateBefore, replacedSecond, replacement);
if (!replacementOk) {
  console.log('FAIL replacing one of two identical equations is detected');
  failed += 1;
} else {
  console.log('PASS replacing one of two identical equations is detected');
}

process.exit(failed ? 1 : 0);
