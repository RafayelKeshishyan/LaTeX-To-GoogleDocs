# Blind Student Self-Test — Screen Reader (NVDA / JAWS / VoiceOver)

Use this script to test the extension **as a blind student would** — keyboard only, eyes closed or monitor off, letting your screen reader speak everything.

**Extension version:** 2.11.4+
**Time:** ~15 minutes  
**Test equation:** `y=\sqrt{x + 3}`  
**Expected natural speech:** *"y equals the square root of x plus 3"*

---

## Before you start

### Platform and browser

- **Windows or Mac** — use **Google Chrome** (the extension does not run in Safari).
- **No Chromebook required.**

### Screen reader setup

We do **not** use ChromeVox for Windows/Mac testing. Full **ChromeVox is built into ChromeOS only**. The old "ChromeVox Classic" Chrome extension is deprecated and often fails to install or work on Windows.

Use the screen reader that blind students actually use on each platform. **Run only one at a time** — JAWS and NVDA cannot share a session.

| Platform | Screen reader | Install / start |
|----------|---------------|-----------------|
| **Windows** | **JAWS** (what most US school IEPs specify) | Freedom Scientific installer. Confirm NVDA and Narrator are fully quit first. |
| **Windows** | **NVDA** (free) | [nvaccess.org/download](https://www.nvaccess.org/download/) — or `winget install --id NVAccess.NVDA -e`. Start from the Start menu, or **Ctrl+Alt+N**. |
| **Mac** | **VoiceOver** (built in) | **Cmd+F5** |

In the Google Doc, also turn on **Tools → Accessibility → Turn on screen reader support**, or press **Ctrl+Alt+Z**. JAWS needs that Docs setting.

On the extension options page, leave **Speech output** set to **My screen reader**. You should hear exactly one voice — your screen reader's — and each announcement **once**, the way Narrator does. If you also hear a second, slower Microsoft voice, the extension was not reloaded after 2.9.1.

The test steps below are the same on every screen reader. Wording may differ slightly, but you should hear the same **meaning** — native keystroke echo while typing, natural math on insert and navigation.

### Extension and document

1. Load this extension from `extension/` (see root README). After any code change: `chrome://extensions` → **Reload** on *LaTeX for Google Docs*.
2. Open a **new blank Google Doc** at a URL ending in `/edit`.
3. Click once in the document body so the cursor is in the text.
4. Optional: turn your monitor off or look away — rely only on speech.

### Extension shortcut reference

| Action | Keys |
|--------|------|
| Open equation editor | **Alt+=** |
| Insert at the cursor | **Alt+Enter** (in the panel) |
| Insert on a new line below the cursor | **Alt+Shift+Enter** (in the panel) |
| Return to the document from the panel | **Alt+D** |
| Close the panel | **Escape** |
| Move a line and read any equation on it | **Up** / **Down** (in the document) |
| Edit the equation at the cursor | **F2** (in the document) |
| Re-read the equation at the cursor | **Ctrl+Shift+R** (in the document) |
| Delete the equation at the cursor | **Ctrl+Shift+Delete** (in the document) |
| Copy a diagnostic report | **Ctrl+Shift+F9** |

---

## Part A — First-time setup

The extension no longer dumps a help speech on load. After refresh you should hear only what your screen reader normally says about the Google Doc.

| Step | Do this | You should hear… |
|------|---------|------------------|
| A.1 | Reload the extension at `chrome://extensions`, then refresh the Google Doc (`F5`) | The document, in your screen reader's usual voice — not a second voice, and not a list of shortcuts |
| A.2 | Confirm **Tools → Accessibility → Turn on screen reader support** (or **Ctrl+Alt+Z**) | Google Docs' own screen-reader confirmation, if any |

---

## Part B — Create an equation (Word "Linear mode" parity)

| Step | Do this | You should hear… |
|------|---------|------------------|
| B.1 | Click in the document, type `Before equation `, then press **Enter** | Normal typing |
| B.2 | Press **Alt+=** | Focus moves to **Linear LaTeX**. You should *not* hear a long shortcut lecture. |
| B.3 | Type `y` | *"y"* |
| B.4 | Type `=` | *"equals"* |
| B.5 | Type `\sqrt{x + 3}` | LaTeX keystrokes: *"backslash"*, *"s"*, etc. |
| B.6 | Activate **Read aloud** (optional) | *"y equals the square root of x plus 3"* — only when you ask for it |
| B.7 | Press **Alt+Enter** | *"y equals the square root of x plus 3"* — once. Focus returns to Linear LaTeX with the completed source selected; the document has the equation followed by a new line. |
| B.8 | Press **Escape** to close the panel | Panel closes, focus returns to the document |

The equation is now stored in the document as `[[eq]]y=\sqrt{x + 3}[[/eq]]`. Put it on its own line — delete and replace both require the equation to be the only thing on its line.

**Pass criteria:** You never needed the mouse except to place the cursor once at the start.

---

## Part C — Navigate equations in the document (Word "Professional mode" parity)

Up and Down move the caret one line, exactly as they do in Google Docs normally. The extension adds the announcement on top; it does not hijack the keys.

| Step | Do this | You should hear… |
|------|---------|------------------|
| C.1 | Put the cursor a line or two above your equation | — |
| C.2 | Press **Down** until you reach the equation's line | *"Equation: y equals the square root of x plus 3"* |
| C.3 | Press **Down** again to leave the equation | Nothing, or the next line's content |
| C.4 | Press **Up** to return to the equation | The equation speech again |
| C.5 | With the caret on the equation, press **Ctrl+Shift+R** | *"Equation: y equals…"* |

**Pass criteria:** You hear **natural math**, not raw `[[eq]]` delimiters or backslash-LaTeX. The caret ends up on the line you heard announced — sighted observers should see it move with the speech.

---

## Part D — Edit an equation in place (F2)

F2 replaces the equation where it sits. There is no delete-then-reinsert step, and the equation keeps its position in the document.

| Step | Do this | You should hear… |
|------|---------|------------------|
| D.1 | Put the caret on the equation's line (Part C) | *"Equation: …"* |
| D.2 | Press **F2** | Panel opens with the existing LaTeX loaded; *"Editing equation…"* plus natural speech |
| D.3 | Change `3` to `5` in the LaTeX box | Keystroke *"5"* |
| D.4 | Press **Alt+Enter** | *"Equation replaced. y equals the square root of x plus 5"* |
| D.5 | Press **Escape**, then arrow onto the equation | *"…x plus 5"* |

**Pass criteria:** The document still has exactly one equation, on the same line as before. Nothing was appended to the end of the document.

---

## Part E — Delete an equation

| Step | Do this | You should hear… |
|------|---------|------------------|
| E.1 | Put the caret on the equation's line | *"Equation: …"* |
| E.2 | Press **Ctrl+Shift+Delete** | *"Deleted equation 1 of 1. y equals the square root of x plus 5"* |
| E.3 | Arrow up and down around that spot | No equation announced |

If the extension cannot confirm it removed the right text, it undoes the change and explains why instead of guessing. Hearing *"Equation shares a line with other text"* or *"Could not put the cursor on that equation"* is a **safe** outcome, not a crash — the document is unchanged.

**Pass criteria:** The equation is gone and no other line was harmed. Check that the first line of the document is still intact.

---

## Part F — Placement: no stray blank lines

This part covers the two cases that used to leave an extra empty line behind. You need a document with at least three lines of content to test it properly.

**F.1 — Retype an equation you just deleted.** Delete an equation in the *middle* of the document (Part E), leaving the caret on the now-empty line. Press **Alt+=**, type a different equation, and press **Alt+Enter**.

The equation should fill the empty line that the delete left behind. Arrow down once: you should land on the line that followed the original equation, **not** on a blank line. The document should have the same number of lines it had before you deleted anything.

**F.2 — Add an equation between two existing lines.** Put the caret on any line in the middle of the document, press **Alt+=**, type an equation, and press **Alt+Shift+Enter**.

You should hear *"Equation inserted on a new line."* The equation goes on a brand new line directly below where your caret was, and the line that used to follow is pushed down intact.

**F.3 — Keep adding equations at the end.** Put the caret on the last line of the document. Insert an equation with **Alt+Enter**, then insert another one the same way.

Each equation should land on its own line, one after the other, with no blank lines between them. This is the flow that the trailing newline exists for, and it should be unchanged.

**F.4 — Safe focus.** After **Alt+Enter**, type one letter without changing focus. It must replace the selected LaTeX in the panel and must not appear in the Google Doc. Use **Alt+D** only when you intentionally want to return to document navigation.

---

## Part G — Equation list and templates

| Step | Do this | You should hear… |
|------|---------|------------------|
| G.1 | Press **Alt+=** to open the editor | Panel opens |
| G.2 | Activate **Refresh list** | Your equation(s) listed with natural speech in each item's label |
| G.3 | Select an equation from the list | *"Loaded equation N for editing"* |
| G.4 | Under **Tutorial 3**, activate the **Acceptance test** template | *"Template loaded: Acceptance test"* and LaTeX fills in |
| G.5 | Press **Alt+D** to return to the document, place the caret, then **Alt+=** and **Alt+Enter** | Success announcement |

---

## Part H — Quick regression checks

| Check | Pass? |
|-------|-------|
| Alt+= opens the editor from the document (no extension icon click) | ☐ |
| Linear keystrokes announced character-by-character | ☐ |
| Natural math speech only on insert or Read aloud, not while typing | ☐ |
| Alt+Enter inserts (Ctrl+Enter is blocked to avoid page breaks) | ☐ |
| Up/Down move the caret **and** announce equations | ☐ |
| Up/Down still work while the panel is open | ☐ |
| Ctrl+Shift+R re-reads the equation at the cursor | ☐ |
| F2 replaces the equation in place, keeping its position | ☐ |
| Ctrl+Shift+Delete removes the right equation and nothing else | ☐ |
| A failed delete or replace undoes itself and says why | ☐ |
| Inserting into a blank line adds no extra blank line | ☐ |
| Alt+Shift+Enter puts the equation on a new line below | ☐ |
| Inserting at the end still leaves a fresh line for the next equation | ☐ |
| Inserting mid-sentence does not split the sentence | ☐ |
| Insert success and failure both announced clearly | ☐ |
| An unconfirmed insert says to check the document and does **not** claim “Inserted” | ☐ |

---

## Known differences from Microsoft Word

| Word | This extension |
|------|----------------|
| Type inline in the document | Type in the editor panel (linear mode) |
| Enter commits | **Alt+Enter** inserts |
| Rendered math in the document | LaTeX source stored as `[[eq]]…[[/eq]]`; natural speech on navigation |
| Built-in math navigation | Up/Down arrows plus **Ctrl+Shift+R** |
| Press Enter to open a line, then type | **Alt+Shift+Enter** opens the line and inserts in one step |
| Edit in place by clicking into the equation | **F2** loads it into the panel, then **Alt+Enter** replaces it in place |

---

## Report failures

Note the step letter/number, what your screen reader said, and what you expected.

For anything involving the caret, equation detection, or a failed delete or replace, press **Ctrl+Shift+F9** first. It copies a diagnostic report to the clipboard covering the caret position, the measured line map, and which scanners found equations. Paste that into your report.

Common fixes:

- **No speech at all** → NVDA/VoiceOver off, or the doc is not at a `/edit` URL
- **Insert failed** → Click in the document first, then Alt+Enter
- **No equation announced on arrow** → The equation may share a line with other text; give it its own line
- **Stale behavior** → Reload the extension at `chrome://extensions`, then refresh the doc

See also: [acceptance-test.md](./acceptance-test.md) for the formal test matrix.
