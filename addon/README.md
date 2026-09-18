# Accessible Equation Images for Google Docs

This Google Workspace add-on provides a deliberately simple workflow for blind students:

1. Put the Google Docs cursor where the equation belongs.
2. Open the add-on sidebar and type linear LaTeX.
3. Press `Alt+Enter` or activate **Insert at cursor**.
4. The add-on inserts a rendered PNG with concise math wording in its image alt description.

For example, `y=x^2` is inserted as a visual equation whose alt description is “y equals x squared.” No visible `⟦eq⟧` codes are added to the document.

## What this version is designed to improve

- NVDA and JAWS encounter a normal image with a short alt description in the document.
- The visual KaTeX preview is hidden from the sidebar accessibility tree, avoiding its noisy internal markup.
- The sidebar exposes the natural wording before insertion and has a **Read wording** button.
- By default, each insertion advances the saved Docs cursor to a new paragraph, so consecutive equations appear one below another.
- The placement checkbox also supports inline answers inside teacher-created blanks.
- Equations inserted by the add-on can be loaded, replaced in place, or deleted from the sidebar.
- A student can select an equation while reading the document and use the dedicated **Edit selected equation** or **Delete selected equation...** menu command for that exact image.
- The sidebar can remain open for the entire assignment. **Return to document** moves focus back to Docs, and the Docs side-panel landmark shortcut returns to the open sidebar without reopening the Extensions menu.
- Selected-image deletion uses a two-step confirmation, and replacement verifies the image identity before changing the document.
- Original LaTeX is stored in document properties so it can be edited later.
- KaTeX `\ce{...}` formulas and expanded Algebra 2, introductory calculus, physics, and chemistry speech are supported for basic classroom notation.

## Important limitation

The equation is an image with flat alt text, not structurally navigable math. A screen reader can read “the fraction with numerator … and denominator …,” but MathCAT cannot move through the numerator and denominator as separate structures. Google Docs may also announce its own words such as “image,” “application,” or document/container labels; the add-on cannot suppress those because they belong to Google Docs.

This is intended as a practical basic-math workflow, not a replacement for a dedicated accessible math editor.

## Files

| File | Purpose |
|---|---|
| `appsscript.json` | Apps Script runtime and least-privilege document scopes |
| `Code.gs` | Inserts images, sets alt text, and saves editing metadata |
| `Sidebar.html` | Accessible editor, KaTeX preview, PNG renderer, and equation list |
| `test/image-equations.test.js` | Local server-side behavior tests |

## Local test

From the repository root:

```bash
node addon/test/image-equations.test.js
```

## Install in one test document

Start with a document-bound Apps Script project so the add-on can read the user's Docs cursor. Google documents this same setup for its Docs add-on quickstart.

1. Create a new Google Doc for testing.
2. In that document, choose **Extensions → Apps Script**.
3. In Apps Script, open **Project Settings** and copy the Script ID.
4. Enable **Show `appsscript.json` manifest file in editor**.

You can paste the three project files into the Apps Script editor, or push this directory with clasp. For clasp, install and log in:

```bash
npm install -g @google/clasp
clasp login
cd addon
```

Before `clasp push`, create an untracked `addon/.clasp.json` containing the Script ID from the bound project:

```json
{
  "scriptId": "PASTE_THE_SCRIPT_ID_HERE",
  "rootDir": "."
}
```

Push the files:

```bash
clasp push
```

Then:

1. In Apps Script, run `onOpen` once and approve the requested current-document permission.
2. Reload the Google Doc.
3. Use **Extensions → Accessible Equations for Google Docs → Open Accessible Equation Editor**.

Do not create a standalone Apps Script project for this prototype. The cursor APIs used for insertion require document-bound execution. Marketplace packaging can be done after the NVDA and JAWS behavior is proven.

The sidebar uses KaTeX and html2canvas from jsDelivr. The school network must allow that CDN. For a production Marketplace release, vendor those browser assets or use an approved asset host.

## NVDA and JAWS acceptance test

1. In an empty document, type a sentence and press Enter.
2. Leave the Docs cursor on the blank line and open the sidebar.
3. Type `y=x^2`, press **Read wording**, and verify “y equals x squared.”
4. Press `Alt+Enter` and wait for “Inserted: y equals x squared.”
5. Return to the document and navigate across the image. Record exactly what the screen reader says.
6. Repeat with `y=\sqrt{x+3}` and `\frac{3}{4}`.
7. Reopen or refresh the sidebar, select an equation under **Equations in document**, change it, and activate **Replace equation**.
8. In the document, select an equation image. Use **Extensions → Accessible Equations for Google Docs → Edit selected equation**, change it, and activate **Replace equation**.
9. Run the same test once with NVDA/Chrome and once with JAWS/Chrome.

Success means the equation’s natural wording is spoken in the document without visible delimiter codes. Extra Google Docs container announcements are a platform limitation, but repeated preview markup or add-on-generated “frame/document” chatter is a bug.

## Known constraints

- The add-on cannot intercept keystrokes while focus is in the Google Docs editing canvas.
- Google Docs does not expose an Enter-on-image or document selection-change trigger. Loading the selected equation requires the add-on menu command or sidebar button.
- `Alt+Enter` works while focus is in the sidebar’s LaTeX field.
- The Docs cursor must be placed before focus moves into the sidebar.
- The add-on does not create native Google Docs equation objects.
- Image alt text provides a linear description, not interactive mathematical structure or Nemeth braille.
- Production publication requires a Google Cloud project, OAuth consent configuration, and Google Workspace Marketplace review.

## Related project material

- Chrome extension: `../extension/`
- Blind-student test: `../docs/blind-student-test.md`
- Acceptance test: `../docs/acceptance-test.md`
- Accessibility retrospective: `../docs/docs-extension-a11y-retrospective.md`
- Student and teacher screen-reader workflow: `../docs/google-docs-addon-screen-reader-guide.md`
