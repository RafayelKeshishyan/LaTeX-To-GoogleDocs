# Accessible Equations in Google Docs

This workflow keeps Google Docs as the main reading and writing environment. The add-on is used only when a teacher or student needs to insert, edit, or delete math.

## Before class

Use the latest Chrome and the latest available NVDA or JAWS. In Google Docs, turn on screen-reader support with `Ctrl+Alt+Z`, or use **Tools → Accessibility settings → Turn on screen reader support**.

The sidebar heading must be **Accessible Equation Editor**. A sidebar headed **LaTeX Equation Editor** is the older Chrome extension and should not be used for the image workflow.

Open **Accessible Equation Editor** once and leave it open. The sidebar's **Return to document** button moves focus directly back to the Docs editing area. With Chrome extension version 2.12.1 loaded, `Ctrl+Shift+9` returns focus to the open Accessible Equation Editor. If the Docs cursor is next to an equation, the screen reader announces its natural wording and its LaTeX loads selected for editing; otherwise the field opens in new-equation mode. `Alt+Shift+E` is not used because Google Docs captures it for the Extensions menu. Do not rely on `Ctrl+Alt+Period` or `Ctrl+Alt+Comma`: depending on the Docs layout and screen reader, those commands can land on Google's Calendar/Keep side panel instead.

## Student workflow

### Read the assignment

Stay in the Google Docs editing area. Use the normal Docs commands:

- Left or Right Arrow: character
- Ctrl+Left or Ctrl+Right: word
- Up or Down Arrow: line
- Ctrl+Up or Ctrl+Down: paragraph

An equation created by the add-on is an inline image. The screen reader should announce its image title, **Equation**, followed by natural math wording such as “y equals x squared.”

### Insert an answer

1. Put the Docs cursor at the answer location before moving into the sidebar.
2. Open **Accessible Equation Editor**.
3. Type linear LaTeX.
4. Activate **Read wording** and verify the spoken description.
5. For an answer inside a teacher’s sentence, uncheck **Put the next equation on a new line**.
6. For calculations or steps that should stack vertically, leave that option checked.
7. Press `Alt+Enter` or activate **Insert at cursor**.

### Edit an answer

1. Navigate to the equation and put the text cursor immediately before or after it. Highlighting the image is optional.
2. Activate **Edit equation at cursor** from the add-on menu, or **Edit equation at document cursor** if focus can be returned to the open sidebar.
3. Edit the loaded LaTeX in the sidebar.
4. Activate **Replace equation**.

The replacement stays in the selected image’s document position. If another collaborator changes the document while the equation is open, the add-on refuses to replace a different image and asks the user to select it again.

### Delete an answer

1. Put the text cursor immediately before or after the equation image.
2. Activate **Delete equation at cursor...** from the add-on menu, or **Delete equation at document cursor** if focus can be returned to the open sidebar.
3. Listen to the equation wording in the confirmation message.
4. Activate **Confirm delete equation at cursor**.

The two-step action is intentional protection against deleting the wrong answer.

## Teacher workflow

- Write instructions, questions, headings, and answer labels as normal Google Docs text.
- Prefer an explicit label such as **Answer:** over a long row of underscores, which can be noisy or unclear with a screen reader.
- Use the inline placement option for a short blank inside a sentence.
- Use separate lines for equations, multi-step work, and longer answers.
- Use the add-on for teacher equations too, so each equation has verified alt text and saved LaTeX.
- Google Docs' native equations now have richer structural screen-reader reading. Teachers may use them when they do not need LaTeX round-trip editing, but this add-on cannot create or replace native Docs equations through the current Apps Script or Docs API.
- Provide a text description for diagrams, graphs, molecular structures, and other visuals. Equation alt text does not make a visual diagram accessible.
- Keep tables simple, include a header row, and avoid merged cells when possible.

## Supported notation target

The intended scope is:

- Algebra 1 and Algebra 2: fractions, roots, exponents, inequalities, functions, systems, and quadratic expressions
- Introductory calculus: limits, derivatives, sums, and definite integrals
- Introductory physics: Greek symbols, vectors, subscripts, scientific expressions, and units
- Introductory chemistry: formulas, subscripts, ions, states, and simple reactions through KaTeX `\ce{...}` syntax

Complex matrices, aligned derivations, structural chemical diagrams, graphs, and advanced spatial notation require separate testing and may need a dedicated accessible math application.

## Platform boundaries

- Google Docs owns the document accessibility tree and some announcements such as “application” or “image.” The add-on cannot suppress those words.
- Pressing Enter on an image cannot launch the add-on. Google Docs does not expose a Docs selection-change trigger, an Enter-on-image handler, or a global add-on keyboard shortcut to Apps Script.
- Apps Script can move focus from its sidebar back into Docs, but it has no matching reverse API. Chrome extension version 2.12.1 supplies that missing bridge with `Ctrl+Shift+9`; schools that block Chrome extensions must use the add-on menu to return to the sidebar.
- Image alt text is linear speech, not structurally navigable MathML. It does not provide MathCAT-style movement through a numerator, denominator, exponent, or matrix.
- A `blob:https://docs.google.com/...` address is temporary browser rendering data. It is not a stable equation identifier. The add-on uses the Apps Script `InlineImage`, adjacent cursor position or optional selection, document path, and saved equation metadata instead.

## What testers should record

- Screen reader and version
- Browser and version
- Exact announcement when the equation image is reached
- Whether the surrounding teacher question remains easy to read
- Insert, selected-image edit, replacement, and two-step deletion results
- Inline blank and separate-line placement results
- Any formula whose natural wording is confusing or incorrect

## Reference material

- [Use Google Docs Editors with a screen reader](https://support.google.com/docs/answer/6282736?hl=en)
- [Use Google Docs with a screen reader](https://support.google.com/docs/answer/1632201?hl=en)
- [Use equations in a document with a screen reader](https://support.google.com/docs/answer/16712774?hl=en)
- [Apps Script Document service](https://developers.google.com/apps-script/reference/document)
- [Apps Script triggers](https://developers.google.com/apps-script/guides/triggers)
