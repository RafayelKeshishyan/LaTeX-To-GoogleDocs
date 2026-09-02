# Blind Student Self-Test — Screen Reader (NVDA / VoiceOver)

Use this script to test the extension **as a blind student would** — keyboard only, eyes closed or monitor off, letting your screen reader speak everything.

**Extension version:** 2.1.0+  
**Time:** ~15 minutes  
**Test equation:** `y=\sqrt{x + 3}`  
**Expected natural speech:** *"y equals the square root of x plus 3"*

---

## Before you start

### Platform and browser

- **Windows or Mac** — use **Google Chrome** (the extension does not run in Safari).
- **No Chromebook required.**

### Screen reader setup

We do **not** use ChromeVox for Windows/Mac testing. Full **ChromeVox is built into ChromeOS only**. The old “ChromeVox Classic” Chrome extension is deprecated and often fails to install or work on Windows.

Use the screen reader that blind students actually use on each platform:

| Platform | Screen reader | Install |
|----------|---------------|---------|
| **Windows** | **NVDA** (free) | [nvaccess.org/download](https://www.nvaccess.org/download/) — or run in PowerShell: `winget install --id NVAccess.NVDA -e` |
| **Mac** | **VoiceOver** (built in) | No install — toggle with **Cmd+F5** |

**Turn speech on:**

| Platform | How to start |
|----------|--------------|
| **Windows (NVDA)** | Run NVDA from the Start menu, or **Ctrl+Alt+N** if you chose the desktop shortcut during install |
| **Mac (VoiceOver)** | **Cmd+F5** |

The test steps below are the same on both platforms. Wording may differ slightly (NVDA vs VoiceOver voices), but you should hear the same **meaning** — keystrokes in linear mode, natural math on insert and navigation.

### Extension and document

1. Load this extension from `extension/` (see root README). After any code change: `chrome://extensions` → **Reload** on *LaTeX for Google Docs*.
2. Open a **new blank Google Doc** at a URL ending in `/edit`.
3. Click once in the document body so the cursor is in the text.
4. Optional: turn your monitor off or look away — rely only on speech.

### Extension shortcut reference

| Action | Keys |
|--------|------|
| Open equation editor | **Alt+=** |
| Insert into document | **Alt+Enter** (in editor panel) |
| Edit nearest equation | **F2** (in document) |
| Re-read equation at cursor | **Ctrl+Shift+R** (in document) |
| Close editor panel | **Escape** |
| Read aloud (panel) | Activate **Read aloud** button |

---

## Part A — First-time setup (hear the extension load)

| Step | Do this | You should hear… |
|------|---------|------------------|
| A.1 | Refresh the Google Doc tab (`F5`) | Something like *"LaTeX for Google Docs ready. Press Alt equals…"* |
| A.2 | Wait 2 seconds | The ready message without clicking anything |

**Fail?** Reload extension at `chrome://extensions`, then refresh the doc again. On Windows, confirm NVDA is running (check the system tray).

---

## Part B — Create an equation (Word “Linear mode” parity)

| Step | Do this | You should hear… |
|------|---------|------------------|
| B.1 | Click in the document, type `Before equation ` | Normal typing |
| B.2 | Press **Alt+=** | *"Equation editor ready. Linear mode…"* and focus moves to **Linear LaTeX** |
| B.3 | Type `y` | *"y"* |
| B.4 | Type `=` | *"equals"* |
| B.5 | Type `\sqrt{x + 3}` | LaTeX keystrokes: *"backslash"*, *"s"*, etc. |
| B.6 | Press **Read aloud** (optional) | *"y equals the square root of x plus 3"* — only if you click Read aloud |
| B.7 | Click once in the document **after** the text `Before equation ` | Cursor placed for insert |
| B.8 | Press **Alt+Enter** | *"Inserting at cursor…"* then *"Equation inserted. y equals the square root of x plus 3"* |
| B.9 | Press **Escape** to close the panel (optional) | Panel closes |

**Pass criteria:** You never needed the mouse except to place the cursor once before insert.

---

## Part C — Navigate equations in the document (Word “Professional mode” parity)

| Step | Do this | You should hear… |
|------|---------|------------------|
| C.1 | Click in the document near your inserted equation | — |
| C.2 | Press **Left arrow** or **Right arrow** until the cursor is on/near the equation | *"Equation: y equals the square root of x plus 3"* |
| C.3 | Arrow away from the equation | No repeat of the same announcement |
| C.4 | Arrow back onto the equation | Equation speech again |
| C.5 | With cursor on the equation, press **Ctrl+Shift+R** | *"Equation: y equals…"* or *"No equation at cursor"* if misaligned |

**Pass criteria:** You hear **natural math**, not raw `⟦eq⟧` delimiters or backslash-LaTeX.

---

## Part D — Edit an equation (F2)

| Step | Do this | You should hear… |
|------|---------|------------------|
| D.1 | Place cursor near the equation in the document | — |
| D.2 | Press **F2** | Panel opens; *"Editing equation…"* plus natural speech |
| D.3 | Change `3` to `5` in the LaTeX box | Keystroke *"5"* |
| D.4 | Click in document after the equation (insert point for updated version) | — |
| D.5 | Press **Alt+Enter** | *"Equation inserted… x plus 5"* |
| D.6 | Arrow onto the new/updated equation | *"…x plus 5"* |

---

## Part E — Equation list and templates

| Step | Do this | You should hear… |
|------|---------|------------------|
| E.1 | Press **Alt+=** to open editor | Panel opens |
| E.2 | Activate **Refresh list** | Your equation(s) listed with natural speech in each item’s label |
| E.3 | Select an equation from the list | *"Loaded equation N for editing"* |
| E.4 | Under **Tutorial 3**, activate **Acceptance test** template | *"Template loaded: Acceptance test"* and LaTeX fills in |
| E.5 | Insert at a new cursor position with **Alt+Enter** | Success announcement |

---

## Part F — Quick regression checks

| Check | Pass? |
|-------|-------|
| Alt+= opens editor from document (no extension icon click) | ☐ |
| Linear keystrokes announced character-by-character | ☐ |
| Professional preview speech only on Insert or Read aloud (not while typing) | ☐ |
| Alt+Enter inserts (not Ctrl+Enter — blocked to avoid page breaks) | ☐ |
| Arrow navigation announces equations | ☐ |
| Ctrl+Shift+R re-reads equation at cursor | ☐ |
| F2 loads nearest equation for editing | ☐ |
| Insert success/failure announced clearly | ☐ |

---

## Known differences from Microsoft Word

| Word | This extension |
|------|----------------|
| Type inline in the document | Type in the side panel (linear mode) |
| Enter commits | **Alt+Enter** inserts |
| Rendered math in document | LaTeX source stored; natural speech via screen reader |
| Built-in math navigation | Arrow keys + **Ctrl+Shift+R** |

---

## Report failures

Note the step letter/number, what your screen reader said, and what you expected. Common fixes:

- **No speech at all** → NVDA/VoiceOver off, or doc not at `/edit`
- **Insert failed** → Click in document first, then Alt+Enter
- **No equation on arrow** → Cursor may be too far from equation; try Ctrl+Shift+R
- **Stale behavior** → Reload extension + refresh doc

See also: [acceptance-test.md](./acceptance-test.md) for the formal test matrix.
