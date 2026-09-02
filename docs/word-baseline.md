# Word Baseline — Tina-Style Workflow

This document records the **gold-standard workflow** already working in schools with Microsoft Word, JAWS, and braille displays. Our Google Docs tool must replicate this experience.

Based on the [Writing LaTeX in Word Tutorial](../Writing%20LaTeX%20in%20Word%20Tutorial.docx) and the Perkins-UCI Access Digi Math webinar.

---

## Who uses this workflow

**Tina** (blind high school student, Perkins-UCI webinar): teachers give assignments in accessible Word; Tina reads, writes, and submits math independently using Word + JAWS + braille display.

The same pedagogy is taught on [Access Digi Math](https://accessuci.ics.uci.edu/digimath/) before students encounter Word in the classroom.

---

## Word equation modes

| Mode | Word UI label | What student types | What student hears |
|---|---|---|---|
| **Linear** | `{ } LaTeX` | Raw LaTeX: `y=\sqrt{x+3}` | Keystrokes: "y equals backslash sqrt left brace x plus 3 right brace" |
| **Professional** | Rendered display | (not editable as text) | Natural speech: "y equals the square root of x plus 3" |

---

## Step-by-step: Word baseline

### 1. Insert equation

- **Shortcut:** `Alt+=`
- **Result:** Equation editor opens at cursor position.
- **Screen reader:** Announces equation editor / math zone.

### 2. Ensure Linear (LaTeX) mode

- In Word's equation ribbon, select **{ } LaTeX** (Linear format).
- **Screen reader:** Ready for LaTeX character input.

### 3. Type LaTeX

- Example: `y=\sqrt{x + 3}`
- **Screen reader:** Announces each keystroke as LaTeX characters.
- Student can use backspace, arrow keys, and standard editing within the zone.

### 4. Commit to Professional

- **Shortcut:** `Enter`
- **Result:** LaTeX converts to rendered Office Math (display format).
- **Screen reader:** Reads natural math speech via MathML accessibility tree.
- Example speech: *"y equals the square root of x plus 3"*

### 5. Navigate finished equation

- Arrow keys or Tab to move through document.
- When focus lands on equation: **natural math speech** (not raw LaTeX, not "image").

### 6. Return to Linear for editing

- **Word shortcut:** `Ctrl+Shift+=`
- **Result:** Equation reverts to editable LaTeX source.
- **Screen reader:** Announces LaTeX characters again.
- Student edits (e.g., change `3` to `5`), then presses `Enter` to re-commit.

> **Google Docs difference:** We use **F2** instead of `Ctrl+Shift+=` because the latter triggers Chrome browser zoom. See [tvi-guide.md](tvi-guide.md).

---

## Example lesson flow (DigiMath Tutorial 3)

1. `Alt+=`
2. Type: `y=\sqrt{x+3}`
3. `Enter` → hear natural speech
4. `Ctrl+Shift+=` (Word) / **F2** (Google Docs) → edit
5. Change to `y=\sqrt{x+5}`
6. `Enter` → updated speech

---

## Why Word works (technical)

Word equations are **Office Math** objects backed by MathML. Windows exposes them through **UIA accessibility trees** — screen readers get structured math, not images.

Reference: [Microsoft math accessibility trees](https://devblogs.microsoft.com/math-in-office/math-accessibility-trees/)

Google Docs has no equivalent for user-authored LaTeX. Our extension builds ClearSpeak-style speech from LaTeX and uses ARIA live regions.

---

## Acceptance test mapping

| Word step | Google Docs equivalent | Shortcut |
|---|---|---|
| Insert equation | Insert equation zone | Alt+= |
| Linear LaTeX typing | Linear mode (delimited text) | (type) |
| Commit Professional | KaTeX overlay + ARIA speech | Enter |
| Navigate equation | Focus zone / arrow keys | (navigate) |
| Edit LaTeX | Return to Linear | F2 |
| Show source (teaching) | LaTeX source toggle | Ctrl+Shift+L |

Full test script: [acceptance-test.md](acceptance-test.md)

---

## Classroom notes for TVIs

- Teach Word workflow first on DigiMath, then transfer to Google Docs in Chrome (Windows or Mac).
- Emphasize **F2** replaces **Ctrl+Shift+=** in Google Docs.
- Use **Ctrl+Shift+L** to show LaTeX source when demonstrating to sighted classmates.
- Blind students' ChromeVox experience is unchanged whether source is shown or hidden.
