# Acceptance Test — Screen Reader (v2.1)

Formal acceptance matrix for the LaTeX-for-Google-Docs extension. For a guided walkthrough, see **[blind-student-test.md](./blind-student-test.md)**.

## Prerequisites

1. **Google Chrome** on **Windows or Mac** (desktop `/edit` URL).
2. Chrome extension **v2.1.0+** loaded from `extension/` (reload after code changes).
3. Screen reader running:
   - **Windows:** [NVDA](https://www.nvaccess.org/download/) (`winget install --id NVAccess.NVDA -e`)
   - **Mac:** **VoiceOver** (**Cmd+F5**)
4. Google Doc open at a URL ending in `/edit`.
5. Cursor in document body.
6. Accessibility options enabled (defaults): keystroke announce, preview speech, equation navigation.

> **Not ChromeVox:** Full ChromeVox is ChromeOS-only. The deprecated Chrome extension is unreliable on Windows — use NVDA or VoiceOver instead.

## Test equation

`y=\sqrt{x + 3}`

Expected natural speech: *"y equals the square root of x plus 3"*

---

## Step 1 — Extension ready

| # | Action | You should hear… |
|---|--------|------------------|
| 1.1 | Refresh Google Doc tab | *"LaTeX for Google Docs ready… Alt equals… Control Shift R…"* |

**Pass:** Ready announcement on load.

---

## Step 2 — Open equation editor (Alt+=)

| # | Action | You should hear… |
|---|--------|------------------|
| 2.1 | Focus document body | Editable text region |
| 2.2 | Press **Alt+=** | *"Equation editor ready. Linear mode…"* |
| 2.3 | Verify focus | **Linear LaTeX** text field |

**Pass:** Editor opens without using Google Docs native equation menu.

---

## Step 3 — Linear mode LaTeX typing

| # | Action | You should hear… |
|---|--------|------------------|
| 3.1 | Type `y` | *"y"* |
| 3.2 | Type `=` | *"equals"* |
| 3.3 | Type `\sqrt{x + 3}` | LaTeX keystrokes |
| 3.4 | **Read aloud** (optional) | Natural math speech |
| 3.5 | **Alt+Enter** after clicking in document | *"Equation inserted. y equals the square root of x plus 3"* |

**Pass:** Linear keystrokes; natural math speech only on Insert or Read aloud.

---

## Step 4 — Insert into document (Alt+Enter)

| # | Action | You should hear… |
|---|--------|------------------|
| 4.1 | Click in document at insert point | — |
| 4.2 | Press **Alt+Enter** in panel | *"Inserting at cursor…"* then *"Equation inserted. y equals…"* |
| 4.3 | Document | Equation stored (LaTeX source with ⟦eq⟧ markers) |

**Pass:** Natural math speech on insert; equation present in document.

**Note:** **Ctrl+Enter** is intentionally blocked (Google Docs page break).

---

## Step 5 — Navigate equation in document

| # | Action | You should hear… |
|---|--------|------------------|
| 5.1 | Arrow onto inserted equation | *"Equation: y equals the square root of x plus 3"* |
| 5.2 | **Ctrl+Shift+R** on equation | Same natural speech |

**Pass:** Natural math when navigating — not raw LaTeX delimiters.

---

## Step 6 — Edit equation (F2)

| # | Action | You should hear… |
|---|--------|------------------|
| 6.1 | Cursor near equation | — |
| 6.2 | Press **F2** | *"Editing equation…"* + natural speech |
| 6.3 | Change `3` to `5` | Keystroke *"5"* |
| 6.4 | **Alt+Enter** after placing cursor | Updated speech with *"x plus 5"* |

**Pass:** F2 loads nearest equation into panel.

---

## Step 7 — Equation list

| # | Action | You should hear… |
|---|--------|------------------|
| 7.1 | **Refresh list** | Equations listed with natural speech labels |
| 7.2 | Select equation | *"Loaded equation N for editing"* |

**Pass:** Document equations discoverable from panel.

---

## Step 8 — DigiMath template

| # | Action | You should hear… |
|---|--------|------------------|
| 8.1 | Tutorial 3 → Acceptance test | Template loads |
| 8.2 | **Alt+Enter** | Equation inserted |

**Pass:** Templates work for classroom worksheets.

---

## Known differences from Word

| Word | Google Docs v2.1 |
|------|------------------|
| Type inline in document | Type in side panel (linear mode) |
| Enter commits | **Alt+Enter** inserts |
| Rendered math in document | LaTeX source + speech |
| F2 inline edit | F2 loads into panel |
| Arrow through math | Arrow + Ctrl+Shift+R |

---

## Failures to report

- Side panel does not open on Alt+=
- Keystrokes not announced in panel
- Speech while typing (should only hear keystrokes in linear mode)
- Alt+Enter does not insert
- Arrow navigation does not announce equations
- Ctrl+Shift+R silent
- F2 does not load nearest equation
- Screen reader silent on **Read aloud**
