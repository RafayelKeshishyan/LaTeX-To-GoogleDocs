# TVI Guide — Teaching LaTeX in Google Docs

Guide for Teachers of the Visually Impaired (TVIs) transitioning students from Word + DigiMath to Google Docs in **Chrome on Windows or Mac**.

---

## Shortcut differences from Word

| Action | Microsoft Word | Google Docs (our extension) | Why different? |
|---|---|---|---|
| Insert equation | `Alt+=` | `Alt+=` | Same muscle memory |
| Commit to Professional | `Enter` | `Enter` | Same |
| Return to Linear (edit) | `Ctrl+Shift+=` | **`F2`** | `Ctrl+Shift+=` triggers Chrome zoom |
| Show LaTeX source (teaching) | (not built-in) | **`Ctrl+Shift+L`** | New teaching feature |
| Fallback insert | — | `Ctrl+Alt+M` | If Alt+= is blocked |

### Teaching script for F2

> "In Word you press Control Shift Equals to edit the equation. In Google Docs in Chrome, press **F2** — the same key you use to rename a file. F2 means **edit**."

F2 is universal (Excel cell edit, file rename) and does not conflict with browser shortcuts.

---

## Recommended lesson sequence

### Phase 1 — DigiMath (online)

Students learn LaTeX syntax on [Access Digi Math](https://accessuci.ics.uci.edu/digimath/) Tutorials 1–4:

1. Exponents: `x^2`
2. Fractions: `\frac{a}{b}`
3. Square roots: `\sqrt{x}`
4. Quadratic formula

### Phase 2 — Word (if available)

Transfer to Word using [word-baseline.md](word-baseline.md):

- `Alt+=` → Linear → type → `Enter` → Professional
- `Ctrl+Shift+=` to edit

### Phase 3 — Google Docs (Chrome on Windows or Mac)

Same flow with one shortcut change:

- `Alt+=` → Linear → type → **Alt+Enter** to insert
- **`F2`** to edit (instead of `Ctrl+Shift+=`)

Use worksheets in [worksheets/](worksheets/) — same LaTeX examples as DigiMath.

---

## Teaching mode: Show LaTeX source

Press **`Ctrl+Shift+L`** in Professional mode to reveal LaTeX source below the rendered equation.

| Setting | Sighted students see | Blind students hear |
|---|---|---|
| Source **hidden** (default) | Rendered math only | Natural math speech |
| Source **shown** | Rendered math + monospace LaTeX below | Natural math speech (unchanged) |

**When to use:**

- Demonstrating connection between LaTeX code and display math (DigiMath slide 17 pedagogy).
- Peer tutoring: sighted classmate sees both forms.
- Assessment: verify student wrote correct LaTeX.

**When to hide:**

- Clean document for print/PDF export.
- Student work shared with sighted peers.

Toggle persists per user via extension settings.

---

## Screen reader setup (Windows and Mac)

| Platform | Tool | Setup |
|----------|------|--------|
| **Windows** | **NVDA** | [nvaccess.org/download](https://www.nvaccess.org/download/) — free, open source |
| **Mac** | **VoiceOver** | Built in — **Cmd+F5** |

ChromeVox is **not** used for Windows/Mac testing. Full ChromeVox is built into **ChromeOS only**.

1. **Start the screen reader** (NVDA from Start menu, or VoiceOver with Cmd+F5).
2. **Verify extension loaded:** `chrome://extensions` → LaTeX for Google Docs enabled.
3. **Open Google Doc** — extension activates on `docs.google.com/document/*`.
4. **Practice:** [blind-student-test.md](blind-student-test.md) or [acceptance-test.md](acceptance-test.md).

### What students should hear

| Mode | Example input | Screen reader output |
|---|---|---|
| Linear | `y=\sqrt{x+3}` | Keystrokes: "y", "equals", "backslash", "s", … |
| Professional | (after insert / navigation) | "y equals the square root of x plus 3" |

Speech may differ slightly between NVDA, VoiceOver, and JAWS on Word. Document differences for IEP assistive technology notes.

---

## Braille display notes

- Linear mode: Nemeth/UEB braille should show LaTeX characters as typed.
- Professional mode: braille may show rendered representation depending on NVDA/VoiceOver braille settings.
- Test with student's actual braille display configuration before relying on it for assessment.

---

## Google Workspace add-on (schools blocking extensions)

If IT blocks Chrome extensions, deploy the Apps Script add-on (see [addon/README.md](../addon/README.md)):

- Sidebar provides LaTeX editor with live preview.
- Insert equations as `⟦eq⟧...⟦/eq⟧` delimiters.
- Student still needs extension for Alt+= / F2 keyboard workflow, OR uses sidebar for insert/edit.

**Best practice:** Request extension whitelist for students who need keyboard-only access.

---

## Worksheet templates

Pre-filled examples matching DigiMath tutorials:

| Worksheet | Topic | Example LaTeX |
|---|---|---|
| [tutorial-1-exponents.md](worksheets/tutorial-1-exponents.md) | Exponents | `x^2`, `2^{10}` |
| [tutorial-2-fractions.md](worksheets/tutorial-2-fractions.md) | Fractions | `\frac{3}{4}` |
| [tutorial-3-sqrt.md](worksheets/tutorial-3-sqrt.md) | Square roots | `y=\sqrt{x+3}` |
| [tutorial-4-quadratic.md](worksheets/tutorial-4-quadratic.md) | Quadratic formula | `x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}` |

---

## Troubleshooting

| Issue | Solution |
|---|---|
| Alt+= opens browser menu | Use `Ctrl+Alt+M` fallback; check extension is enabled |
| No speech on insert | Ensure NVDA/VoiceOver is on; check extension announcements in panel |
| Overlay misaligned | Scroll document; extension repositions on scroll |
| Equation shows raw delimiters | Extension not loaded — reload tab |
| Collaborator sees delimiters only | Collaborator needs extension for rendered view |

---

## Curriculum alignment checklist

- [ ] Student completed DigiMath Tutorials 1–4
- [ ] Student practiced Word workflow (if available)
- [ ] Student knows **F2** replaces `Ctrl+Shift+=` in Google Docs
- [ ] TVI demonstrated **Ctrl+Shift+L** teaching toggle
- [ ] Student passed [acceptance test](acceptance-test.md) steps 1–5
