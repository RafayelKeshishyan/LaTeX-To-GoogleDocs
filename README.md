# LaTeX for Google Docs

An accessible LaTeX equation workflow for Google Docs, built for blind and low-vision students, sighted LaTeX users, and TVIs.

> **Accessible authoring:** For NVDA/JAWS MathCAT and braille, use **[EquaNote](pad/README.md)** (`pad/`). Google Docs cannot expose MathML the way Word or a web MathML page can. The Chrome extension remains for inserting LaTeX into shared Docs. Full write-up of what we tried on Docs: **[docs/docs-extension-a11y-retrospective.md](docs/docs-extension-a11y-retrospective.md)**.

This is an independent project for helping students learn LaTeX math before college STEM, using muscle memory aligned with Microsoft Word.

## How it works

Equations are stored in the document as plain text wrapped in ASCII delimiters:

```
[[eq]]y=\sqrt{x + 3}[[/eq]]
```

Because the source is ordinary text, it survives copy/paste, sharing, and revision history, and every collaborator sees the same thing. The extension reads those delimiters back and speaks them as natural math ("y equals the square root of x plus 3") instead of letting the screen reader spell out backslashes.

You type equations in a panel that the extension injects into the page. It looks like a side panel but is an in-page iframe, so it works without the Chrome side-panel API and keeps focus under the extension's control.

## Quick start

1. Open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and select the `extension/` folder.
2. Open a Google Doc at a URL ending in `/edit`.
3. Click once in the document body to place the cursor.
4. Press **Alt+=** to open the editor.
5. Type `y=\sqrt{x + 3}`.
6. Press **Alt+Enter** to insert it at the cursor.

## Keyboard shortcuts

Everything below works from the document unless noted.

| Action | Keys |
|--------|------|
| Focus the add-on and edit the equation beside the cursor | **Alt+=** |
| Open the editor (fallback if Alt+= is taken) | **Ctrl+Alt+M** |
| Insert the equation at the cursor | **Alt+Enter** (in the panel) |
| Insert on a new line below the cursor | **Alt+Shift+Enter** (in the panel) |
| Return to the document from the panel | **Alt+D** |
| Close the panel | **Escape** |
| Move a line and read any equation on it | **Up** / **Down** |
| Optional fallback for focusing the add-on | **F2** |
| Read the equation at the cursor aloud | **Ctrl+Shift+R** |
| Delete the equation at the cursor | **Ctrl+Shift+Delete** |
| Copy a diagnostic report to the clipboard | **Ctrl+Shift+F9** |

With version 2.12.4, press **Alt+=** while the cursor is in Google Docs to focus the already-open **Accessible Equation Editor** Apps Script sidebar. Open the add-on sidebar once from the Extensions menu first. Alt+= is captured in Google Docs' main editing context and relayed to the add-on; F2 remains an optional fallback.

### Where the equation lands

**Alt+Enter** inserts a standalone equation at the cursor and starts the next empty line. Focus immediately returns to Linear LaTeX, with the completed source selected, so typing starts the next equation instead of changing the Google Doc.

**Alt+Shift+Enter** starts a fresh line below the current one and puts the equation there. This is how you add an equation *between* two existing lines without having to leave the panel and press Enter in the document first.

The extension intentionally uses one equation per line. This simpler block-equation workflow is safer for screen-reader users and keeps consecutive equations from running together.

### Navigating and editing

Up and Down behave exactly as they normally do in Google Docs: the caret moves one line. The extension only adds an announcement, so if the line it lands on holds an equation, you hear the natural math reading. This keeps the caret and the speech in the same place, which matters when a TVI is teaching next to a student watching the screen.

**F2** replaces an equation where it sits. The old text is swapped for the new text on the same line, so the equation keeps its position in the document. You do not need to delete and reinsert.

Delete and replace both verify the document before and after the edit. If the result is not what was expected, the extension issues an undo and tells you why rather than leaving the document in a surprising state.

### Speech and screen readers

This is one product, not a separate NVDA build and JAWS build. After **Alt+Enter**, focus returns to Linear LaTeX so an accidental keystroke cannot alter or delete document text. Press **Alt+D** or close the panel when you intentionally want to navigate the document.

Speech is a setting with two channels — never both at once:

- **Chrome speech** — the original engine (`chrome.tts`). Speaks the math without bouncing focus. This is the voice that worked before screen readers were in the mix.
- **My screen reader** — automatic announcements use the extension's complete natural-math sentence. This is more dependable than asking NVDA/JAWS to enter MathML while focus is moving between the editor and Google Docs. The professional preview remains MathML so it can be explored directly. Chrome speech mode uses the same English reading through the extension's voice.

Google Docs itself will still say things like "application" and "document content" when the cursor enters the document, and it will still read `[[eq]]…[[/eq]]` in the document body. That is the screen reader reading Google Docs' text, which this extension cannot replace with MathML.

Run **one** screen reader at a time. On Google Docs, turn on **Tools → Accessibility → Turn on screen reader support** (or **Ctrl+Alt+Z**) when using JAWS.

## Working with the Google Docs canvas

Google Docs renders text to a `<canvas>`, so there is no per-line DOM to inspect and synthetic mouse clicks do not move the caret. The extension works around this in three ways:

- Caret movement uses synthetic keyboard events dispatched from the page's main world, not clicks.
- Line positions are discovered by walking the caret and recording where it actually lands, so headings, mixed font sizes, paragraph spacing, and gaps between pages are measured rather than assumed. The measurement is cached until the document changes.
- Equation text is read from the offscreen copy of the document that Google maintains for text input.

If something misbehaves, press **Ctrl+Shift+F9**. It copies a diagnostic report covering the caret position, the measured line map, and which scanners found equations. That report is what to attach to a bug description.

## Testing

**Speech conversion:** open `extension/test/latex-speech.test.html` in Chrome. It checks the LaTeX-to-speech converter against the practice curriculum equations and reports pass/fail — no build step or server needed. If you have Node installed, run `node extension/test/latex-speech.test.js`, `node extension/test/speech-output.test.js`, `node extension/test/zone-scan.test.js`, `node extension/test/insertion-verification.test.js`, and `node extension/test/document-bridge.test.js`.

The extension reports **Inserted** only after Google Docs exposes evidence of the new equation. In canvas documents it may instead say that Google Docs accepted the command but did not expose the equation to the extension list. The entered math is still read, and focus remains safely in Linear LaTeX.

**Self-test as a blind student:** [docs/blind-student-test.md](docs/blind-student-test.md) is a keyboard-only script that takes about 15 minutes with **NVDA or JAWS on Windows**, or **VoiceOver on Mac**. Windows users can install NVDA from [nvaccess.org/download](https://www.nvaccess.org/download/).

See [docs/acceptance-test.md](docs/acceptance-test.md) for the formal acceptance matrix.

### Google Workspace add-on (schools that block extensions)

Use the Apps Script sidebar in `addon/`. See [addon/README.md](addon/README.md).

## Documentation

| Document | Description |
|----------|-------------|
| [docs/README.md](docs/README.md) | Project overview |
| [docs/blind-student-test.md](docs/blind-student-test.md) | Self-test script (act as a blind student) |
| [docs/acceptance-test.md](docs/acceptance-test.md) | Screen reader acceptance test (NVDA / VoiceOver) |
| [docs/word-baseline.md](docs/word-baseline.md) | Word workflow reference |
| [docs/tvi-guide.md](docs/tvi-guide.md) | Teaching guide for TVIs |
| [docs/worksheets/](docs/worksheets/) | LaTeX practice worksheets |

## Project structure

```
GoogleDocs_Latex/
├── extension/          # Chrome extension (MV3)
│   ├── background/     # Service worker: commands and panel state
│   ├── content/        # Google Docs integration
│   │   ├── page-main.js        # Runs in the page's MAIN world
│   │   ├── docs-utils.js       # Caret, line mapping, insert/delete/replace
│   │   ├── equation-navigator.js
│   │   └── content.js          # Key handling and message routing
│   ├── sidepanel/      # Equation editor UI (injected as an iframe)
│   ├── options/        # Settings page
│   └── lib/            # KaTeX, natural math speech, speech output
├── addon/              # Google Workspace add-on (Apps Script)
└── docs/               # Documentation and worksheets
```

## Reference

- [Google Docs equation screen reader support](https://support.google.com/docs/answer/16712774)
