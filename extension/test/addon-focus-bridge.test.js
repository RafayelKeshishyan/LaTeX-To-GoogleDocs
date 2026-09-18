'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const worker = fs.readFileSync(path.join(root, 'background', 'service-worker.js'), 'utf8');
const content = fs.readFileSync(path.join(root, 'content', 'content.js'), 'utf8');
const addon = fs.readFileSync(path.join(root, '..', 'addon', 'Sidebar.html'), 'utf8');

assert.equal(manifest.version, '2.12.0');
assert.equal(manifest.commands['insert-equation'].suggested_key.default, 'Alt+Shift+E');
assert.match(manifest.commands['insert-equation'].description, /Accessible Equation Editor/);
assert.match(worker, /action: 'focusAccessibleAddon'/);
assert.match(content, /ACCESSIBLE_EQUATIONS_FOCUS_REQUEST/);
assert.match(content, /ACCESSIBLE_EQUATIONS_FOCUS_READY/);
assert.match(content, /ACCESSIBLE_EQUATIONS_FOCUS_INPUT/);
assert.match(addon, /ACCESSIBLE_EQUATIONS_FOCUS_REQUEST/);
assert.match(addon, /ACCESSIBLE_EQUATIONS_FOCUS_READY/);
assert.match(addon, /ACCESSIBLE_EQUATIONS_FOCUS_INPUT/);

console.log('Accessible add-on focus bridge checks passed.');
