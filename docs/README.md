# LaTeX for Google Docs — Project Overview

## Documentation map

| Document | Purpose |
|----------|---------|
| [docs-extension-a11y-retrospective.md](docs-extension-a11y-retrospective.md) | **What we tried on Google Docs accessibility, what worked, what the platform blocked** |
| [math-pad-plan.md](math-pad-plan.md) | Digi Math Pad product / stack plan |
| [math-pad-a11y-test.md](math-pad-a11y-test.md) | Pad NVDA / JAWS / VoiceOver checklist |
| [word-baseline.md](word-baseline.md) | Tina / Word gold-standard workflow |
| [blind-student-test.md](blind-student-test.md) | Extension keyboard self-test |
| [native-equation-research.md](native-equation-research.md) | Native Docs equations API gaps |
| [benchmark.md](benchmark.md) | Competitor notes |

## Mission


Help blind and low-vision students use **LaTeX math in Google Docs** with a workflow aligned with Microsoft Word.

School systems increasingly issue Chromebooks and use Google Workspace. Existing LaTeX add-ons render equations as **images**, breaking the Linear → Professional round-trip that Word provides. Students must use "De-render Selection" in a sidebar — unusable for blind students who need keyboard-only access.

## The problem

| Word (works today) | Google Docs add-ons (broken) |
|---|---|
| Alt+= opens equation editor | Sidebar or menu required |
| Linear mode: type LaTeX, hear keystrokes | LaTeX in delimiters, then render |
| Enter: Professional display + natural speech | Renders to PNG image |
| F2 / Ctrl+Shift+=: back to Linear | "De-render Selection" in sidebar |
| Equation object with MathML accessibility | Static image with alt-text at best |

Word works because equations are **Office Math** objects with UIA accessibility trees. Google Docs has no equivalent LaTeX-to-MathML pipeline for custom content.

## Our solution

**Custom equation zones** stored as delimited LaTeX text in the document:

```
⟦eq⟧y=\sqrt{x+3}⟦/eq⟧
```

- **Linear mode:** markers and LaTeX visible and editable; screen reader announces keystrokes.
- **Professional mode:** KaTeX overlay for sighted users; ARIA live region announces natural math speech; LaTeX source preserved in document text.
- **F2** toggles back to Linear — no de-render, no sidebar.

Delivered as:

1. **Chrome extension** (primary) — Word-parity shortcuts, overlays, screen reader support.
2. **Google Workspace add-on** (secondary) — sidebar for schools that block extensions.
3. **Teacher resources** — introductory LaTeX practice worksheets.

## Who this serves

- **Blind/low-vision students** — a Linear/Professional speech model aligned with Word.
- **Sighted students** — LaTeX input with rendered display, no sidebar de-render.
- **TVIs/teachers** — curriculum-aligned materials; Ctrl+Shift+L teaching mode to show LaTeX source.

## Testing

**NVDA on Windows, VoiceOver on Mac.** Acceptance tests use real desktop screen readers — not ChromeVox (ChromeOS-only; the deprecated Chrome extension is unreliable on Windows).

| Platform | Screen reader | Install / enable |
|----------|---------------|----------------|
| **Windows** | **NVDA** | [nvaccess.org/download](https://www.nvaccess.org/download/) or `winget install --id NVAccess.NVDA -e` |
| **Mac** | **VoiceOver** | Built in — **Cmd+F5** |

The same test script applies on both platforms; speech wording may differ slightly.

## Documentation index

- [blind-student-test.md](blind-student-test.md) — self-test script (keyboard-only, Windows or Mac)
- [acceptance-test.md](acceptance-test.md) — formal acceptance matrix
- [word-baseline.md](word-baseline.md) — Word reference workflow
- [benchmark.md](benchmark.md) — competitor pass/fail matrix
- [tvi-guide.md](tvi-guide.md) — teaching shortcuts and classroom tips
- [native-equation-research.md](native-equation-research.md) — Phase 3 native equation path
- [worksheets/](worksheets/) — LaTeX practice worksheets

## Links

- [Google Docs equation accessibility](https://support.google.com/docs/answer/16712774)
