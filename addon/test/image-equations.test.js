'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class MockBlob {
  constructor(bytes, contentType, name) {
    this.bytes = Array.from(bytes);
    this.contentType = contentType;
    this.name = name;
  }
  getBytes() { return this.bytes; }
}

class MockImage {
  constructor(blob, parent) {
    this.blob = blob;
    this.parent = parent;
    this.altTitle = '';
    this.altDescription = '';
    this.width = 0;
    this.height = 0;
  }
  getBlob() { return this.blob; }
  getType() { return 'INLINE_IMAGE'; }
  getParent() { return this.parent; }
  getAltTitle() { return this.altTitle; }
  getAltDescription() { return this.altDescription; }
  setAltTitle(value) { this.altTitle = value; return this; }
  setAltDescription(value) { this.altDescription = value; return this; }
  setWidth(value) { this.width = value; return this; }
  setHeight(value) { this.height = value; return this; }
  removeFromParent() {
    const index = this.parent.images.indexOf(this);
    if (index >= 0) this.parent.images.splice(index, 1);
  }
}

class MockBody {
  constructor() { this.images = []; }
  getImages() { return this.images.slice(); }
  getChild(index) { return this.images[index]; }
  getNumChildren() { return this.images.length; }
  getChildIndex(image) { return this.images.indexOf(image); }
  insertInlineImage(first, second) {
    const hasIndex = typeof first === 'number';
    const index = hasIndex ? first : this.images.length;
    const blob = hasIndex ? second : first;
    const image = new MockImage(blob, this);
    this.images.splice(index, 0, image);
    return image;
  }
}

const body = new MockBody();
let cursor = { insertInlineImage: (blob) => body.insertInlineImage(blob) };
let selection = null;
const values = new Map();
const documentProperties = {
  setProperty(key, value) { values.set(key, value); },
  getProperty(key) { return values.get(key) || null; },
  getProperties() { return Object.fromEntries(values); },
  deleteProperty(key) { values.delete(key); }
};

const context = {
  console,
  DocumentApp: {
    ElementType: { INLINE_IMAGE: 'INLINE_IMAGE' },
    getActiveDocument() {
      return {
        getCursor: () => cursor,
        getSelection: () => selection,
        getBody: () => body
      };
    }
  },
  PropertiesService: {
    getDocumentProperties: () => documentProperties
  },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'sha256' },
    base64Decode: (value) => Array.from(Buffer.from(value, 'base64')),
    newBlob: (bytes, type, name) => new MockBlob(bytes, type, name),
    computeDigest: (_algorithm, bytes) => Array.from(
      crypto.createHash('sha256').update(Buffer.from(bytes)).digest()
    )
  }
};

vm.createContext(context);
const source = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');
vm.runInContext(source, context, { filename: 'Code.gs' });

const paragraph = {};
const nextParagraph = {};
const paragraphContainer = {
  getChildIndex(value) {
    assert.equal(value, paragraph);
    return 2;
  },
  insertParagraph(index, text) {
    assert.equal(index, 3);
    assert.equal(text, '');
    return nextParagraph;
  }
};
paragraph.getParent = () => paragraphContainer;
let savedCursor = null;
const cursorDocument = {
  getActiveTab() {
    return {
      asDocumentTab() {
        return {
          newPosition(element, offset) {
            assert.equal(element, nextParagraph);
            assert.equal(offset, 0);
            return { element, offset };
          }
        };
      }
    };
  },
  setCursor(position) { savedCursor = position; }
};
assert.equal(
  context.moveCursorBelowImage_(cursorDocument, { getParent: () => paragraph }),
  true
);
assert.deepEqual(savedCursor, { element: nextParagraph, offset: 0 });

const inlineImage = {};
const inlineParagraph = {
  getChildIndex(value) {
    assert.equal(value, inlineImage);
    return 4;
  }
};
let inlineCursor = null;
const inlineDocument = {
  getActiveTab() {
    return {
      asDocumentTab() {
        return {
          newPosition(element, offset) { return { element, offset }; }
        };
      }
    };
  },
  setCursor(position) { inlineCursor = position; }
};
inlineImage.getParent = () => inlineParagraph;
assert.equal(context.moveCursorAfterImage_(inlineDocument, inlineImage), true);
assert.equal(inlineCursor.element, inlineParagraph);
assert.equal(inlineCursor.offset, 5);

function payload(sourceText, speech, bytes) {
  return {
    latex: sourceText,
    speech,
    dataUrl: 'data:image/png;base64,' + Buffer.from(bytes).toString('base64'),
    width: 123.6,
    height: 38.2
  };
}

const invalid = context.insertEquationImage({ latex: 'x', speech: 'x', dataUrl: 'not-an-image' });
assert.equal(invalid.success, false);
assert.match(invalid.error, /valid PNG/);

cursor = null;
const noCursor = context.insertEquationImage(payload('x', 'x', 'cursor test'));
assert.equal(noCursor.success, false);
assert.match(noCursor.error, /Place the document cursor/);
cursor = { insertInlineImage: (blob) => body.insertInlineImage(blob) };

const inserted = context.insertEquationImage(payload('y=x^2', 'y equals x squared', 'first image'));
assert.equal(inserted.success, true);
assert.equal(body.images.length, 1);
assert.equal(body.images[0].altTitle, 'Equation');
assert.equal(body.images[0].altDescription, 'y equals x squared');
assert.equal(body.images[0].width, 124);
assert.equal(body.images[0].height, 38);

let listed = context.listEquationImages();
assert.equal(listed.length, 1);
assert.equal(listed[0].latex, 'y=x^2');
assert.equal(listed[0].speech, 'y equals x squared');

const nothingSelected = context.getSelectedEquation();
assert.equal(nothingSelected.success, false);
assert.match(nothingSelected.error, /cursor immediately before or after/);

cursor = {
  getElement: () => body,
  getOffset: () => 0
};
const equationBeforeCursor = context.getSelectedEquation();
assert.equal(equationBeforeCursor.success, true);
assert.equal(equationBeforeCursor.equation.latex, 'y=x^2');

cursor = {
  getElement: () => body,
  getOffset: () => 1
};
const equationAfterCursor = context.getSelectedEquation();
assert.equal(equationAfterCursor.success, true);
assert.equal(equationAfterCursor.equation.latex, 'y=x^2');

const textBeforeImage = {
  getText: () => 'work',
  getParent: () => textParagraph
};
const textAfterImage = {
  getText: () => 'answer',
  getParent: () => textParagraph
};
const textParagraph = {
  children: [textBeforeImage, body.images[0], textAfterImage],
  getChild(index) { return this.children[index]; },
  getNumChildren() { return this.children.length; },
  getChildIndex(child) { return this.children.indexOf(child); }
};
assert.equal(context.equationAdjacentToCursor_({
  getElement: () => textBeforeImage,
  getOffset: () => 4
}), body.images[0]);
assert.equal(context.equationAdjacentToCursor_({
  getElement: () => textAfterImage,
  getOffset: () => 0
}), body.images[0]);

cursor = { insertInlineImage: (blob) => body.insertInlineImage(blob) };
selection = {
  getRangeElements: () => [{ getElement: () => body.images[0] }]
};
const selectedEquation = context.getSelectedEquation();
assert.equal(selectedEquation.success, true);
assert.equal(selectedEquation.equation.index, 0);
assert.equal(selectedEquation.equation.latex, 'y=x^2');
assert.equal(selectedEquation.equation.speech, 'y equals x squared');
assert.equal(selectedEquation.equation.target.path, '0');
assert.ok(selectedEquation.equation.target.digest);
selection = null;

const oldImage = body.images[0];
const staleTarget = context.replaceEquationImage(
  0,
  payload('z=1', 'z equals 1', 'stale image'),
  { path: '99', digest: selectedEquation.equation.target.digest }
);
assert.equal(staleTarget.success, false);
assert.match(staleTarget.error, /document changed/i);
assert.equal(body.images[0], oldImage);
const replaced = context.replaceEquationImage(
  0,
  payload('y=\\sqrt{x+3}', 'y equals the square root of x plus 3', 'second image'),
  selectedEquation.equation.target
);
assert.equal(replaced.success, true);
assert.equal(body.images.length, 1);
assert.notEqual(body.images[0], oldImage);
assert.equal(body.images[0].altDescription, 'y equals the square root of x plus 3');
listed = context.listEquationImages();
assert.equal(listed[0].latex, 'y=\\sqrt{x+3}');

const staleDelete = context.deleteEquationImage(0, selectedEquation.equation.target);
assert.equal(staleDelete.success, false);
assert.match(staleDelete.error, /document changed/i);
const deleted = context.deleteEquationImage(0, listed[0].target);
assert.equal(deleted.success, true);
assert.equal(body.images.length, 0);
context.listEquationImages();
assert.equal(values.size, 0);

// Identical equations share an image digest. Removing one must not remove the
// editing metadata needed by the other copy.
context.insertEquationImage(payload('x^2', 'x squared', 'same image'));
context.insertEquationImage(payload('x^2', 'x squared', 'same image'));
assert.equal(context.listEquationImages().length, 2);
context.deleteEquationImage(0);
listed = context.listEquationImages();
assert.equal(listed.length, 1);
assert.equal(listed[0].latex, 'x^2');
context.deleteEquationImage(0);
context.listEquationImages();
assert.equal(values.size, 0);

console.log('All accessible equation image tests passed.');
