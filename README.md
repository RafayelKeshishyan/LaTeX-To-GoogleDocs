# LaTeX for Google Docs

Bring an **accessible Linear / Professional** LaTeX equation workflow to Google Docs — for blind and low-vision students, sighted LaTeX users, and TVIs.

This project extends the [Access Digi Math](https://accessuci.ics.uci.edu/digimath/) mission: students learn LaTeX math before college STEM, using muscle memory aligned with Microsoft Word.

## v2 — Side panel editor (production approach)

Version 2 uses a **Chrome side panel** as the primary equation editor instead of fragile in-document overlays.

| Step | Action | What happens |
|------|--------|--------------|
| 1 | Click in the document where the equation goes | Cursor is placed |
| 2 | **Alt+=** | Side panel opens — Linear LaTeX editor |
| 3 | Type LaTeX | Screen reader announces keystrokes in the panel |
| 4 | **Alt+Enter** | Equation inserted into the document as `⟦eq⟧...⟦/eq⟧` |
| 5 | Arrow keys on equation | Natural math speech (like Word Professional mode) |
| 6 | **F2** near an equation | Loads that equation into the panel for editing |
| 7 | **Ctrl+Shift+R** | Re-read equation at cursor |

**Why this approach:** Google Docs uses a virtualized canvas, not stable text DOM. A side panel is reliable, accessible, and production-ready. The document stores LaTeX source; the panel provides live KaTeX preview and natural speech.

## Quick start

1. Open `chrome://extensions` → **Developer mode** → **Load unpacked** → select `extension/`
2. Open a Google Doc at a URL ending in `/edit`
3. Press **Alt+=** (or click the extension icon → **Open Equation Editor**)
4. Type `y=\sqrt{x + 3}` in the side panel
5. Press **Alt+Enter** to insert

**Self-test as a blind student:** [docs/blind-student-test.md](docs/blind-student-test.md) — **NVDA on Windows** or **VoiceOver on Mac** (~15 min, keyboard-only). Windows: install NVDA from [nvaccess.org/download](https://www.nvaccess.org/download/).

See [docs/acceptance-test.md](docs/acceptance-test.md) for the formal acceptance matrix.

### Google Workspace add-on (schools that block extensions)

Use the Apps Script sidebar in `addon/`. See [addon/README.md](addon/README.md).

## Keyboard shortcuts

| Action | Shortcut |
|--------|----------|
| Open equation editor | **Alt+=** |
| Insert into document | **Alt+Enter** (in side panel) |
| Read equation at cursor | **Ctrl+Shift+R** (in document) |
| Edit equation near cursor | **F2** (in document) |
| Fallback open editor | **Ctrl+Alt+M** |
| Open from toolbar | Click extension icon |

## Documentation

| Document | Description |
|----------|-------------|
| [docs/README.md](docs/README.md) | Project overview |
| [docs/blind-student-test.md](docs/blind-student-test.md) | Self-test script (act as blind student) |
| [docs/acceptance-test.md](docs/acceptance-test.md) | Screen reader acceptance test (NVDA / VoiceOver) |
| [docs/word-baseline.md](docs/word-baseline.md) | Word workflow reference |
| [docs/tvi-guide.md](docs/tvi-guide.md) | Teaching guide for TVIs |
| [docs/worksheets/](docs/worksheets/) | DigiMath tutorial worksheets |

## Project structure

```
GoogleDocs_Latex/
├── extension/          # Chrome extension (side panel + document bridge)
│   ├── sidepanel/      # Primary accessible equation editor UI
│   └── content/        # Google Docs integration (insert at cursor)
├── addon/              # Google Workspace Add-on (Apps Script)
└── docs/               # Documentation and worksheets
```

## Reference

- [Access Digi Math](https://accessuci.ics.uci.edu/digimath/)
- [Google Docs equation screen reader support](https://support.google.com/docs/answer/16712774)
