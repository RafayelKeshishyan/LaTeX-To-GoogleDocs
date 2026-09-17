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
    getActiveDocument() {
      return {
        getCursor: () => cursor,
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

const oldImage = body.images[0];
const replaced = context.replaceEquationImage(
  0,
  payload('y=\\sqrt{x+3}', 'y equals the square root of x plus 3', 'second image')
);
assert.equal(replaced.success, true);
assert.equal(body.images.length, 1);
assert.notEqual(body.images[0], oldImage);
assert.equal(body.images[0].altDescription, 'y equals the square root of x plus 3');
listed = context.listEquationImages();
assert.equal(listed[0].latex, 'y=\\sqrt{x+3}');

const deleted = context.deleteEquationImage(0);
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
