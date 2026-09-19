/**
 * Google Workspace add-on for accessible equation images.
 */

/**
 * Open sidebar when add-on is activated from Extensions menu.
 */
function onOpen(e) {
  DocumentApp.getUi()
    .createAddonMenu()
    .addItem('Open Accessible Equation Editor', 'showSidebar')
    .addItem('Edit equation at cursor', 'showSidebarForSelectedEquation')
    .addItem('Delete equation at cursor...', 'showSidebarForSelectedEquationDelete')
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
  showSidebar_('');
}

/** Open the sidebar and load the equation selected or adjacent to the cursor. */
function showSidebarForSelectedEquation() {
  showSidebar_('edit');
}

/** Open the sidebar and confirm deletion of the equation at the cursor. */
function showSidebarForSelectedEquationDelete() {
  showSidebar_('delete');
}

function showSidebar_(selectedAction) {
  var template = HtmlService.createTemplateFromFile('Sidebar');
  template.selectedAction = selectedAction || '';
  var html = template.evaluate()
    .setTitle('Equation Editor')
    .setWidth(320);
  DocumentApp.getUi().showSidebar(html);
}

var ACCESSIBLE_MATH_TITLE = 'Equation';
var EQUATION_PROPERTY_PREFIX = 'accessible_math_';
/**
 * Where spoken math is stored for screen readers.
 *   'description' — description = speech, title empty (preferred for NVDA in Docs)
 *   'title'       — title = speech, description empty
 * Opening All equations / Refresh rewrites older double-field images.
 */
var ALT_SPEECH_FIELD = 'description';

/** Per-request cache so one image is not SHA-hashed repeatedly. */
var digestCache_ = null;

function withDigestCache_(fn) {
  var previous = digestCache_;
  digestCache_ = previous || {};
  try {
    return fn();
  } finally {
    digestCache_ = previous;
  }
}

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
  if (parts.newLineAfter) moveCursorBelowImage_(doc, image);
  else moveCursorAfterImage_(doc, image);

  return {
    success: true,
    message: 'Equation image inserted with alt text.',
    speech: parts.speech
  };
}

/**
 * Put the next insertion on its own line. The sidebar keeps browser focus,
 * while the saved Docs cursor moves to a new paragraph below the image.
 */
function moveCursorBelowImage_(doc, image) {
  var paragraph = image.getParent();
  if (!paragraph || typeof paragraph.getParent !== 'function') return false;

  var container = paragraph.getParent();
  if (!container ||
      typeof container.getChildIndex !== 'function' ||
      typeof container.insertParagraph !== 'function') {
    return false;
  }

  var paragraphIndex = container.getChildIndex(paragraph);
  if (paragraphIndex < 0) return false;

  var nextParagraph = container.insertParagraph(paragraphIndex + 1, '');
  var position;
  if (doc.getActiveTab) {
    position = doc.getActiveTab().asDocumentTab().newPosition(nextParagraph, 0);
  } else {
    position = doc.newPosition(nextParagraph, 0);
  }
  doc.setCursor(position);
  return true;
}

/** Keep worksheet answers inline by moving the saved Docs cursor past the image. */
function moveCursorAfterImage_(doc, image) {
  var paragraph = image.getParent();
  if (!paragraph || typeof paragraph.getChildIndex !== 'function') return false;
  var childIndex = paragraph.getChildIndex(image);
  if (childIndex < 0) return false;
  var position;
  if (doc.getActiveTab) {
    position = doc.getActiveTab().asDocumentTab().newPosition(paragraph, childIndex + 1);
  } else {
    position = doc.newPosition(paragraph, childIndex + 1);
  }
  doc.setCursor(position);
  return true;
}

/** List accessible equation images in document order. */
function listEquationImages() {
  return withDigestCache_(function() {
    var images = getEquationImages_();
    cleanupEquationMetadata_(images);
    // Rewrite old title+description doubles so NVDA/JAWS do not hear the math twice.
    images.forEach(repairEquationAltText_);
    return images.map(function(image, index) {
      return equationRecord_(image, index);
    });
  });
}

/**
 * Put spoken math in only one alt field (see ALT_SPEECH_FIELD).
 * Call after deploy so older “Title: Equation + description” images get fixed.
 */
function repairEquationAltText_(image) {
  var metadata = readEquationMetadata_(image);
  var speech =
    (metadata && metadata.speech) ||
    image.getAltDescription() ||
    (image.getAltTitle() !== ACCESSIBLE_MATH_TITLE ? image.getAltTitle() : '') ||
    '';
  speech = String(speech || '').trim();
  if (!speech) return false;

  var title = String(image.getAltTitle() || '');
  var description = String(image.getAltDescription() || '');
  var wantsTitle = ALT_SPEECH_FIELD === 'title';
  var alreadyOk = wantsTitle
    ? title === speech && !description
    : !title && description === speech;
  if (alreadyOk) return false;

  configureEquationImage_(image, {
    speech: speech,
    width: image.getWidth(),
    height: image.getHeight()
  });
  return true;
}

/** Return the add-on equation image selected or immediately next to the cursor. */
function getSelectedEquation() {
  return withDigestCache_(function() {
    var doc = DocumentApp.getActiveDocument();
    var selection = doc.getSelection();
    var selectedImages = [];
    if (selection) {
      var rangeElements = selection.getRangeElements
        ? selection.getRangeElements()
        : selection.getSelectedElements();
      selectedImages = rangeElements.map(function(rangeElement) {
        return rangeElement.getElement();
      }).filter(isEquationImage_);
    }

    if (selectedImages.length > 1) {
      return {
        success: false,
        error: 'Select only one equation image.'
      };
    }

    var targetImage = selectedImages.length === 1
      ? selectedImages[0]
      : equationAdjacentToCursor_(doc.getCursor());
    if (targetImage && targetImage.error) return targetImage;
    if (!targetImage) {
      return {
        success: false,
        error: 'Put the document cursor immediately before or after one equation, then try again.'
      };
    }

    var metadata = readEquationMetadata_(targetImage);
    if (!metadata || !metadata.latex) {
      return {
        success: false,
        error: 'This equation has alt text but no saved source to edit.'
      };
    }

    // Do not scan every body image here — replace/delete use target path+digest.
    // Index is only a display hint when the list is closed.
    return { success: true, equation: equationRecord_(targetImage, 0) };
  });
}

function isEquationImage_(element) {
  if (!(element &&
      typeof element.getType === 'function' &&
      element.getType() === DocumentApp.ElementType.INLINE_IMAGE)) {
    return false;
  }
  // Legacy marker, or any image we stored LaTeX for (title/description A/B layouts).
  if (element.getAltTitle() === ACCESSIBLE_MATH_TITLE) return true;
  return Boolean(readEquationMetadata_(element));
}

/** Find one add-on equation immediately before or after the Docs cursor. */
function equationAdjacentToCursor_(cursor) {
  if (!cursor || typeof cursor.getElement !== 'function' || typeof cursor.getOffset !== 'function') {
    return null;
  }
  var element = cursor.getElement();
  var offset = cursor.getOffset();
  if (isEquationImage_(element)) return element;

  var candidates = [];
  function addCandidate(candidate) {
    if (isEquationImage_(candidate) && candidates.indexOf(candidate) < 0) {
      candidates.push(candidate);
    }
  }
  function childAt(container, index) {
    if (!container || typeof container.getChild !== 'function' || index < 0) return null;
    if (typeof container.getNumChildren === 'function' && index >= container.getNumChildren()) {
      return null;
    }
    try {
      return container.getChild(index);
    } catch (err) {
      return null;
    }
  }

  if (typeof element.getChild === 'function') {
    addCandidate(childAt(element, offset));
    addCandidate(childAt(element, offset - 1));
  } else if (typeof element.getParent === 'function') {
    var parent = element.getParent();
    if (parent && typeof parent.getChildIndex === 'function') {
      var childIndex = parent.getChildIndex(element);
      var text = typeof element.getText === 'function' ? element.getText() : '';
      if (offset === 0) addCandidate(childAt(parent, childIndex - 1));
      if (offset === text.length) addCandidate(childAt(parent, childIndex + 1));
    }
  }

  if (candidates.length > 1) {
    return {
      success: false,
      error: 'The cursor is between two equations. Move it to the other side of the equation you want.'
    };
  }
  return candidates[0] || null;
}

function equationRecord_(image, index) {
  var metadata = readEquationMetadata_(image);
  var spoken =
    (metadata && metadata.speech) ||
    image.getAltDescription() ||
    image.getAltTitle() ||
    'equation';
  return {
    index: index,
    latex: metadata ? metadata.latex : '',
    speech: spoken,
    title: image.getAltTitle() || ACCESSIBLE_MATH_TITLE,
    target: {
      path: elementPath_(image),
      digest: imageDigest_(image)
    }
  };
}

function elementPath_(element) {
  var body = null;
  try {
    body = getActiveBody_();
  } catch (err) {
    body = null;
  }
  var path = [];
  var current = element;
  // Paths are relative to the active body so elementAtPath_ can resolve them.
  // Walking past Body (e.g. into a tab wrapper) made replace/delete fail in Docs.
  while (current && current !== body && typeof current.getParent === 'function') {
    var parent = current.getParent();
    if (!parent || typeof parent.getChildIndex !== 'function') break;
    path.unshift(parent.getChildIndex(current));
    current = parent;
  }
  return path.join('.');
}

/** Resolve a saved path like "3.1" from the active body without hashing images. */
function elementAtPath_(pathString) {
  var parts = String(pathString || '').split('.');
  if (!parts.length || parts[0] === '') return null;
  var current = getActiveBody_();
  for (var i = 0; i < parts.length; i += 1) {
    var childIndex = Number(parts[i]);
    if (!current ||
        typeof current.getChild !== 'function' ||
        !isFinite(childIndex) ||
        childIndex < 0) {
      return null;
    }
    if (typeof current.getNumChildren === 'function' &&
        childIndex >= current.getNumChildren()) {
      return null;
    }
    try {
      current = current.getChild(childIndex);
    } catch (err) {
      return null;
    }
  }
  return current;
}

function findEquationTarget_(index, expectedTarget) {
  return withDigestCache_(function() {
    var images;
    if (expectedTarget && expectedTarget.path) {
      var byPath = elementAtPath_(expectedTarget.path);
      if (byPath && isEquationImage_(byPath) &&
          (!expectedTarget.digest || imageDigest_(byPath) === expectedTarget.digest)) {
        return byPath;
      }

      // Fallback: same path+digest scan as before (handles odd structures).
      images = getEquationImages_();
      for (var i = 0; i < images.length; i += 1) {
        if (elementPath_(images[i]) === expectedTarget.path &&
            (!expectedTarget.digest ||
              imageDigest_(images[i]) === expectedTarget.digest)) {
          return images[i];
        }
      }
      return null;
    }

    images = getEquationImages_();
    return images[Number(index)] || null;
  });
}

/** Replace one add-on equation image while keeping its document position. */
function replaceEquationImage(index, payload, expectedTarget) {
  var parts = validateImagePayload_(payload);
  if (!parts.ok) return parts;

  var target = findEquationTarget_(index, expectedTarget);
  if (!target) {
    return {
      success: false,
      error: 'The document changed. Select the equation again before replacing it.'
    };
  }

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
function deleteEquationImage(index, expectedTarget) {
  var target = findEquationTarget_(index, expectedTarget);
  if (!target) {
    return {
      success: false,
      error: 'The document changed. Select the equation again before deleting it.'
    };
  }
  target.removeFromParent();
  return { success: true, message: 'Equation image deleted.' };
}

/** Delete the equation image currently selected in Google Docs. */
function deleteSelectedEquation() {
  var selected = getSelectedEquation();
  if (!selected.success) return selected;
  return deleteEquationImage(
    selected.equation.index,
    selected.equation.target
  );
}

function getActiveBody_() {
  var doc = DocumentApp.getActiveDocument();
  if (doc.getActiveTab) return doc.getActiveTab().asDocumentTab().getBody();
  return doc.getBody();
}

function getEquationImages_() {
  var images = getActiveBody_().getImages() || [];
  return images.filter(isEquationImage_);
}

function validateImagePayload_(payload) {
  payload = payload || {};
  var latex = String(payload.latex || '').trim();
  var speech = String(payload.speech || '').trim();
  var dataUrl = String(payload.dataUrl || '');
  if (!latex) return { success: false, ok: false, error: 'Type an equation first.' };
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
    height: Math.max(20, rawHeight * scale),
    newLineAfter: payload.newLineAfter !== false
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
  if (ALT_SPEECH_FIELD === 'title') {
    image
      .setAltTitle(parts.speech)
      .setAltDescription('');
  } else {
    // Default A/B option: speech only in description (empty title).
    image
      .setAltTitle('')
      .setAltDescription(parts.speech);
  }
  image
    .setWidth(Math.round(parts.width))
    .setHeight(Math.round(parts.height));
}

function imageDigest_(imageOrBlob) {
  var cacheKey = null;
  if (digestCache_ &&
      imageOrBlob &&
      typeof imageOrBlob.getParent === 'function' &&
      typeof imageOrBlob.getBlob === 'function') {
    cacheKey = elementPath_(imageOrBlob);
    if (cacheKey && Object.prototype.hasOwnProperty.call(digestCache_, cacheKey)) {
      return digestCache_[cacheKey];
    }
  }

  var blob = imageOrBlob.getBlob ? imageOrBlob.getBlob() : imageOrBlob;
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    blob.getBytes()
  );
  var hex = digest.map(function(value) {
    var byte = value < 0 ? value + 256 : value;
    return ('0' + byte.toString(16)).slice(-2);
  }).join('');

  if (cacheKey && digestCache_) digestCache_[cacheKey] = hex;
  return hex;
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
    },
    {
      id: 'tutorial-5',
      title: 'Tutorial 5 - Introductory Calculus',
      examples: [
        { label: 'Limit', latex: '\\lim_{x\\to0} \\frac{\\sin x}{x}' },
        { label: 'Derivative', latex: '\\frac{dy}{dx}=2x' },
        { label: 'Definite integral', latex: '\\int_0^1 x^2\\,dx' }
      ]
    },
    {
      id: 'tutorial-6',
      title: 'Tutorial 6 - Physics',
      examples: [
        { label: 'Newton second law', latex: '\\vec{F}=m\\vec{a}' },
        { label: 'Kinetic energy', latex: 'E_k=\\frac{1}{2}mv^2' },
        { label: 'Acceleration with units', latex: 'a=9.8\\ \\mathrm{m/s^2}' }
      ]
    },
    {
      id: 'tutorial-7',
      title: 'Tutorial 7 - Chemistry',
      examples: [
        { label: 'Water', latex: '\\ce{H2O}' },
        { label: 'Combustion example', latex: '\\ce{CH4 + 2O2 -> CO2 + 2H2O}' },
        { label: 'Calcium ion', latex: '\\ce{Ca^2+}' }
      ]
    }
  ];
}
