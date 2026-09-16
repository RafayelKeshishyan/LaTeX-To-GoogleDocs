# Digi Math Pad — Accessibility checklist

**Target:** NVDA and JAWS (Windows) + VoiceOver (Mac), with braille where MathCAT/VoiceOver support it.

**App:** Digi Math Pad (`pad/`) — not the Google Docs extension.

---

## Before you start

- [ ] Only **one** screen reader running
- [ ] Chrome (Windows) or Safari/Chrome (Mac)
- [ ] `cd pad && npm.cmd run dev` — open the local URL
- [ ] Capture ready: NVDA **Speech Viewer** (NVDA menu → Tools), or JAWS **Speech History** (below)
- [ ] Comparing two readers? Match **verbosity** and **punctuation level** first, or every row will
      "fail" for reasons that are not the Pad

---

## Account entry

| Step | Action | Expect |
|------|--------|--------|
| S.1 | Open the configured sign-in page | Focus starts on the Sign in heading; Email and Password are explicitly labeled |
| S.2 | Tab through the choices | Continue with personal practice, Create account, Email, Password, then Sign in to your account; the current Sign in state is not repeated as another control |
| S.3 | Activate **Create account** | Focus moves directly to Name; the alternate action becomes Sign in; no repeated grouping label or unfinished teacher/student choice is exposed |
| S.4 | Submit invalid credentials or unavailable service | One concise alert is displayed and announced; focus and typed values remain available for correction |

---

## Part A — First load (work name → write)

| Step | Action | Expect |
|------|--------|--------|
| A.1 | Open personal practice | Focus on **Practice page name**; hear the browser-only save boundary once |
| A.2 | **Clear practice page** if needed | Confirm; Ctrl+Shift+Z can undo |
| A.3 | Tab from title | Hear “Current practice page, combo box, [page title]”; no “Choose practice page” region, repeated “Practice,” or equation count |
| A.4 | From title: **Enter** | Land directly in **Linear** (`Equation N`, or problem number if set) |
| A.5 | **Alt+=** on empty equation | Do not spawn an extra blank; explain what to do |
| A.6 | Optional equation **Problem number** | Type `1.2`; Your work and Linear speak `1.2` instead of Equation N |
| A.7 | **Alt+N** | New note for explanation/thoughts; editable Note text; no Problem number field |
| A.8 | Refresh an existing practice page | The document title, banner context, and focused Practice page name may be announced once; the field name and value are not duplicated |
| A.9 | Open **Quick help** | One Close help button is exposed; Escape also closes; Tab wraps from the final topic to that same button |

---

## Part B — Linear → MathML (core)

| Step | Action | Expect |
|------|--------|--------|
| B.1 | Type `y=\sqrt{x + 3}` | Native key echo only |
| B.2 | **Alt+Enter** (Hear math) | Unclipped native MathML focused for the screen reader |
| B.3 | **Escape** | Back to Linear |
| B.4 | **Alt+=** | New Equation 2; focus Linear and announce its position |
| B.5 | Explore math / braille | Structured math (MathCAT), not only `backslash sqrt` |
| B.6 | Type incomplete `\sqrt{`, then **Alt+Enter** | Stay in Linear; hear a short error; field is marked invalid |

---

## Part B2 — Edit / remove / list

| Step | Action | Expect |
|------|--------|--------|
| B2.1 | In Linear, **Up** / **Down** | Moves to the adjacent equation or note; notes are not skipped |
| B2.1a | Tab to Your work, then use arrows | The entire list is one Tab stop; focus movement speaks each row once |
| B2.1b | In a multiline note, **Alt+Up** / **Alt+Down** | Moves to the adjacent item; plain arrows continue editing the note |
| B2.2 | **Enter** on Equation 1 | Edit older answer in Linear |
| B2.3 | Focus an equation or note in **Your work**, press **Delete** | The undoable item is removed without a confirmation dialog; removal is announced once and focus reaches the adjacent row; **Ctrl+Shift+Z** restores without leaving the list |
| B2.3a | Activate **Remove current item** | The stable Remove button keeps focus, so “Removed Equation N” or “Removed Note N” is the first new announcement |
| B2.3b | Remove the only equation | Hear “Removed Equation 1. New blank equation”; the required replacement editor is empty |
| B2.3a | Focus Assignment name / Practice page name, press **Delete** | Equation is not removed; Delete edits the field normally |
| B2.4 | **Alt+Backspace** while typing | Must **not** delete the equation |
| B2.5 | **Duplicate** | New equation with same LaTeX |
| B2.6 | **Ctrl+Shift+V** | Clipboard LaTeX becomes a new equation |
| B2.7 | Tab through the action buttons | Every button, including Undo, is reached; no toolbar “grouping” announcements; Review is a dialog opener, not “collapsed” |

---

## Part C — Classes, assignments, and practice pages

| Step | Action | Expect |
|------|--------|--------|
| C.1 | **New class** | In-page dialog opens; focus lands on labeled Class name field |
| C.2 | Create Algebra 1 | **Current assignment** and **Assignment name** labels are present |
| C.3 | **Rename class** | Same dialog opens with current name; save updates Current class |
| C.4 | **New assignment**, name Homework 2 | New empty assignment; Assignment name focused |
| C.5 | Switch Current assignment back | Previous equations are still there |
| C.6 | Switch to Practice | Labels change to Current practice page / Practice page name |
| C.7 | Duplicate / Delete assignment or practice page | Names match the current type; delete confirms and can be undone |
| C.8 | Reload after “Saved locally in this browser” | Most recently open work and edits return |
| C.9 | Simulate blocked local storage | Visible Not saved warning and spoken backup instruction |

---

## Part D — Review and download

| Step | Action | Expect |
|------|--------|--------|
| D.1 | **Alt+R** or **Review answers** | The modal opens once on the first answer needing attention, or the current answer. The focused row says Empty or Invalid when needed; the dialog does not read every answer or announce totals |
| D.2 | **Arrow Up/Down**, **Home/End** | Focus moves within the vertical Answers toolbar without “N of M”; Tab cannot leave the dialog |
| D.3 | Enter / activate a row | Jumps to edit that equation or note |
| D.3a | **Escape** | Review closes and focus returns directly to Review answers; NVDA does not fall back to Skip to Linear or the main landmark |
| D.4 | **Copy all answers** | Numbered LaTeX (+ prose) on clipboard |
| D.5 | **Print / visual PDF** | Title + visually rendered math; use HTML when structured MathML is required |
| D.6 | **Download backup** / **Upload backup** | JSON round-trip restores a sheet |
| D.7 | **Download accessible HTML** | Standalone HTML contains headings, native MathML, and optional Linear LaTeX source |
| D.8 | **Download Word** | `.docx` opens in desktop Word with editable Office Math objects, not equation images |
| D.9 | **Save draft** vs **Export and backup** / **Download copies** | Save keeps work in the pad; export only makes downloadable copies (no fake Submit) |

---

## Part E — Templates

| Step | Action | Expect |
|------|--------|--------|
| E.1 | Quadratic formula template | LaTeX loads; status speaks natural math |
| E.2 | Copy Linear / Copy MathML for HTML | Linear pastes back into the Pad; MathML is for HTML/Word (paste into Linear extracts the Linear source when present) |

---

## Windows (JAWS) notes

### Capture what JAWS said

JAWS keeps a text record of recent speech, so you never have to transcribe audio.

| Action | Desktop | Laptop |
|--------|---------|--------|
| Show Speech History | **Insert+Space**, then **H** | **CapsLock+Space**, then **H** |
| Copy whole history to clipboard | **Insert+Space**, then **Ctrl+H** | **CapsLock+Space**, then **Ctrl+H** |
| Clear history | **Insert+Space**, then **Shift+H** | **CapsLock+Space**, then **Shift+H** |

Loop, one row at a time: **clear → do the step → copy → paste under that row**. One capture per step is
what makes a JAWS log comparable to an NVDA log. History clears on lock or log off, and can be turned
off in Settings Center.

### Math reads through MathCAT in both readers

JAWS and NVDA both use MathCAT, so equation wording should nearly match. When it does not, check the
MathCAT speech style and verbosity (JAWS: Settings Center; NVDA: MathCAT settings) before suspecting
the Pad.

| Step | JAWS difference to expect |
|------|---------------------------|
| B.2 | JAWS appends **"math content"** after the expression |
| B.5 | Press **Enter** on the focused math to open the **Math Viewer**; Down/Up zoom in and out, Left/Right move within a level, **Esc** closes |

### Where JAWS and NVDA may genuinely differ

Spend JAWS time on these four, not on wording:

- **Status messages** (saved, removed, errors) — all share one `role="status"` region.
  Readers differ on interrupting, and fast successive messages are where one gets dropped. A message
  that never arrives is a bug.
- **Your work buttons** (one row in the Tab order inside an application region) — check that each
  arrow press speaks the row **once**, says “button,” and does not add “N of M.”
- **Disclosures** — More equation actions, Organize pages, Export and backup: expanded/collapsed state.
- **Dialogs** — Quick help and confirmations focus their headings; Review focuses an answer.
  Tab cannot escape any modal dialog.

**The test:** missing or wrong is a bug; merely more verbose or differently worded is the screen reader.

---

## Mac (VoiceOver) notes

- Toggle VoiceOver: **Cmd+F5**
- Cmd replaces Ctrl for save / copy-all / paste-as-equation / undo
- MathML exploration is often stronger in Safari

---

## Failures that are *not* Pad bugs

- Google Docs still saying `[[eq]]` or “document content” — wrong app; use the Pad
- Two screen readers at once
- Treating the visual PDF as the accessible math copy; use Word or accessible HTML for structured math
- JAWS and NVDA using different words for the same control, or one being more verbose — compare only
  after verbosity and punctuation levels match
- JAWS saying “math content” after an equation, or needing **Enter** for the Math Viewer — expected
