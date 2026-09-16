/**
 * Code.gs — Google Workspace Add-on for LaTeX equation zones
 */

var EQ_OPEN = '\u27E6eq\u27E7';     // ⟦eq⟧
var EQ_CLOSE = '\u27E6/eq\u27E7';   // ⟦/eq⟧

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
  var html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('LaTeX for Google Docs')
    .setWidth(320);
  DocumentApp.getUi().showSidebar(html);
}

/**
 * Insert equation delimiters at cursor with optional LaTeX content.
 * @param {string} latex - LaTeX content (may be empty for new zone)
 * @return {object} Result status
 */
function insertEquation(latex) {
  var doc = DocumentApp.getActiveDocument();
  var cursor = doc.getCursor();

  if (!cursor) {
    return { success: false, error: 'Place your cursor in the document first.' };
  }

  var text = EQ_OPEN + (latex || '') + EQ_CLOSE;
  var inserted = cursor.insertText(text);

  return {
    success: true,
    message: 'Equation inserted. Use the Chrome extension for Alt+= workflow.',
    text: text
  };
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
