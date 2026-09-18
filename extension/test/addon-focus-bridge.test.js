'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const worker = fs.readFileSync(path.join(root, 'background', 'service-worker.js'), 'utf8');
const content = fs.readFileSync(path.join(root, 'content', 'content.js'), 'utf8');
const pageMain = fs.readFileSync(path.join(root, 'content', 'page-main.js'), 'utf8');
const addon = fs.readFileSync(path.join(root, '..', 'addon', 'Sidebar.html'), 'utf8');

assert.equal(manifest.version, '2.12.4');
assert.equal(manifest.commands['insert-equation'].suggested_key, undefined);
assert.match(manifest.commands['insert-equation'].description, /Accessible Equation Editor/);
assert.match(worker, /action: 'focusAccessibleAddon'/);
assert.match(content, /ACCESSIBLE_EQUATIONS_FOCUS_REQUEST/);
assert.match(content, /ACCESSIBLE_EQUATIONS_FOCUS_READY/);
assert.match(content, /ACCESSIBLE_EQUATIONS_FOCUS_INPUT/);
assert.match(content, /e\.key === 'F2'/);
assert.match(content, /const isAltEquals/);
assert.match(content, /requestAccessibleAddonFocus\(\)/);
assert.match(content, /LATEX_GDOCS_ACCESSIBLE_ADDON_HOTKEY/);
assert.match(pageMain, /function relayAccessibleAddonHotkey\(event\)/);
assert.match(pageMain, /event\.key === '=' \|\| event\.code === 'Equal'/);
assert.match(pageMain, /LATEX_GDOCS_ACCESSIBLE_ADDON_HOTKEY/);
assert.match(addon, /ACCESSIBLE_EQUATIONS_FOCUS_REQUEST/);
assert.match(addon, /ACCESSIBLE_EQUATIONS_FOCUS_READY/);
assert.match(addon, /ACCESSIBLE_EQUATIONS_FOCUS_INPUT/);
assert.match(addon, /focusEditorForDocumentCursor/);
assert.match(addon, /\.getSelectedEquation\(\)/);

console.log('Accessible add-on focus bridge checks passed.');
