/**
 * Google Workspace add-on for accessible equation images.
 */

/**
 * Open sidebar when add-on is activated from Extensions menu.
 */
function onOpen(e) {
  DocumentApp.getUi()
    .createAddonMenu()
    .addItem('LaTeX Equation Editor', 'showSidebar')
    .addToUi();
}

/**
 * Run when add-on is installed.
 */
function onInstall(e) {
  onOpen(e);
}

/**
 * Show the LaTeX equation sidebar.
 */
function showSidebar() {
  var html = HtmlService.createTemplateFromFile('Sidebar').evaluate()
    .setTitle('LaTeX for Google Docs')
    .setWidth(320);
  DocumentApp.getUi().showSidebar(html);
}

var ACCESSIBLE_MATH_TITLE = 'Equation';
var EQUATION_PROPERTY_PREFIX = 'accessible_math_';

/**
 * Insert a rendered PNG at the user's Docs cursor and attach real image alt
 * text. No visible LaTeX delimiters are written into the document.
 *
 * @param {object} payload dataUrl, latex, speech, width, and height
 * @return {object} Result status
 */
function insertEquationImage(payload) {
  var parts = validateImagePayload_(payload);
  if (!parts.ok) return parts;

  var doc = DocumentApp.getActiveDocument();
  var cursor = doc.getCursor();
  if (!cursor) {
    return {
      success: false,
      error: 'Place the document cursor where the equation should go, then try again.'
    };
  }

  var blob = pngBlobFromDataUrl_(parts.dataUrl);
  var image = cursor.insertInlineImage(blob);
  if (!image) {
    return {
      success: false,
      error: 'Google Docs cannot insert an image at this cursor position.'
    };
  }

  configureEquationImage_(image, parts);
  saveEquationMetadata_(image, parts.latex, parts.speech);

  return {
    success: true,
    message: 'Equation image inserted with alt text.',
    speech: parts.speech
  };
}

/** List accessible equation images in document order. */
function listEquationImages() {
  var images = getEquationImages_();
  cleanupEquationMetadata_(images);
  return images.map(function(image, index) {
    var metadata = readEquationMetadata_(image);
    return {
      index: index,
      latex: metadata ? metadata.latex : '',
      speech: metadata ? metadata.speech : (image.getAltDescription() || 'equation'),
      title: image.getAltTitle() || ACCESSIBLE_MATH_TITLE
    };
  });
}

/** Replace one add-on equation image while keeping its document position. */
function replaceEquationImage(index, payload) {
  var parts = validateImagePayload_(payload);
  if (!parts.ok) return parts;

  var images = getEquationImages_();
  var target = images[Number(index)];
  if (!target) return { success: false, error: 'That equation no longer exists.' };

  var parent = target.getParent();
  if (!parent || typeof parent.insertInlineImage !== 'function') {
    return { success: false, error: 'Google Docs cannot replace that image in place.' };
  }

  var childIndex = parent.getChildIndex(target);
  var image = parent.insertInlineImage(childIndex, pngBlobFromDataUrl_(parts.dataUrl));
  configureEquationImage_(image, parts);
  saveEquationMetadata_(image, parts.latex, parts.speech);
  target.removeFromParent();

  return {
    success: true,
    message: 'Equation image replaced.',
    speech: parts.speech
  };
}

/** Delete one add-on equation image. */
function deleteEquationImage(index) {
  var images = getEquationImages_();
  var target = images[Number(index)];
  if (!target) return { success: false, error: 'That equation no longer exists.' };
  target.removeFromParent();
  return { success: true, message: 'Equation image deleted.' };
}

function getActiveBody_() {
  var doc = DocumentApp.getActiveDocument();
  if (doc.getActiveTab) return doc.getActiveTab().asDocumentTab().getBody();
  return doc.getBody();
}

function getEquationImages_() {
  var images = getActiveBody_().getImages() || [];
  return images.filter(function(image) {
    return image.getAltTitle() === ACCESSIBLE_MATH_TITLE;
  });
}

function validateImagePayload_(payload) {
  payload = payload || {};
  var latex = String(payload.latex || '').trim();
  var speech = String(payload.speech || '').trim();
  var dataUrl = String(payload.dataUrl || '');
  if (!latex) return { success: false, ok: false, error: 'Type LaTeX first.' };
  if (!speech) return { success: false, ok: false, error: 'The equation needs an alt description.' };
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
    return { success: false, ok: false, error: 'The equation image was not valid PNG data.' };
  }
  var rawWidth = Math.max(1, Number(payload.width) || 160);
  var rawHeight = Math.max(1, Number(payload.height) || 40);
  var scale = Math.min(1, 600 / rawWidth, 240 / rawHeight);
  return {
    ok: true,
    latex: latex,
    speech: speech,
    dataUrl: dataUrl,
    width: Math.max(24, rawWidth * scale),
    height: Math.max(20, rawHeight * scale)
  };
}

function pngBlobFromDataUrl_(dataUrl) {
  var base64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
  return Utilities.newBlob(
    Utilities.base64Decode(base64),
    'image/png',
    'accessible-equation.png'
  );
}

function configureEquationImage_(image, parts) {
  image
    .setAltTitle(ACCESSIBLE_MATH_TITLE)
    .setAltDescription(parts.speech)
    .setWidth(Math.round(parts.width))
    .setHeight(Math.round(parts.height));
}

function imageDigest_(imageOrBlob) {
  var blob = imageOrBlob.getBlob ? imageOrBlob.getBlob() : imageOrBlob;
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    blob.getBytes()
  );
  return digest.map(function(value) {
    var byte = value < 0 ? value + 256 : value;
    return ('0' + byte.toString(16)).slice(-2);
  }).join('');
}

function saveEquationMetadata_(image, latex, speech) {
  var properties = PropertiesService.getDocumentProperties();
  if (!properties) return;
  properties.setProperty(
    EQUATION_PROPERTY_PREFIX + imageDigest_(image),
    JSON.stringify({ latex: latex, speech: speech })
  );
}

function readEquationMetadata_(image) {
  var properties = PropertiesService.getDocumentProperties();
  if (!properties) return null;
  var raw = properties.getProperty(EQUATION_PROPERTY_PREFIX + imageDigest_(image));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function cleanupEquationMetadata_(images) {
  var properties = PropertiesService.getDocumentProperties();
  if (!properties) return;
  var liveKeys = {};
  images.forEach(function(image) {
    liveKeys[EQUATION_PROPERTY_PREFIX + imageDigest_(image)] = true;
  });
  var stored = properties.getProperties();
  Object.keys(stored).forEach(function(key) {
    if (key.indexOf(EQUATION_PROPERTY_PREFIX) === 0 && !liveKeys[key]) {
      properties.deleteProperty(key);
    }
  });
}

/**
 * Get introductory worksheet template examples.
 * @return {Array<object>} Template list
 */
function getWorksheetTemplates() {
  return [
    {
      id: 'tutorial-1',
      title: 'Tutorial 1 — Exponents',
      examples: [
        { label: 'x squared', latex: 'x^2' },
        { label: '2 to the 10th', latex: '2^{10}' },
        { label: 'Pythagorean', latex: 'a^2 + b^2 = c^2' }
      ]
    },
    {
      id: 'tutorial-2',
      title: 'Tutorial 2 — Fractions',
      examples: [
        { label: 'Three fourths', latex: '\\frac{3}{4}' },
        { label: 'a over b', latex: '\\frac{a}{b}' },
        { label: 'Complex fraction', latex: '\\frac{x+1}{x-1}' }
      ]
    },
    {
      id: 'tutorial-3',
      title: 'Tutorial 3 — Square Roots',
      examples: [
        { label: 'Acceptance test', latex: 'y=\\sqrt{x + 3}' },
        { label: 'Square root of 16', latex: '\\sqrt{16}' },
        { label: 'Distance', latex: '\\sqrt{x^2 + y^2}' }
      ]
    },
    {
      id: 'tutorial-4',
      title: 'Tutorial 4 — Quadratic Formula',
      examples: [
        { label: 'Quadratic formula', latex: 'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}' },
        { label: 'Discriminant', latex: 'b^2 - 4ac' },
        { label: 'Simple quadratic', latex: 'x^2 + 5x + 6 = 0' }
      ]
    }
  ];
}
