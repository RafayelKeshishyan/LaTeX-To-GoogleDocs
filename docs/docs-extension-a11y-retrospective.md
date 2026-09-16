# Google Docs Extension — Accessibility Retrospective

**Audience:** Future us, Digi Math Pad contributors, TVIs, and anyone who asks “why not just fix Google Docs?”  
**Scope:** Chrome extension in `extension/` (through **v2.11.0**, Sep 2026).  
**Outcome:** The extension remains useful for **inserting and editing LaTeX in shared Docs**. It **cannot** deliver Word-level MathCAT / braille / piece-by-piece math exploration *inside* the Google Doc canvas. That work moved to **Digi Math Pad** (`pad/`).

---

## 1. What we set out to do

Replicate a **Word + JAWS + braille** Linear LaTeX workflow inside Google Docs:

| Word (gold standard — Tina) | Target for Docs |
|-----------------------------|-----------------|
| Alt+= → Linear LaTeX | Same |
| Keystroke echo while typing | Same |
| Enter → Professional math + natural speech | Same |
| Arrow onto equation → MathML / MathCAT / braille | Same |
| F2 / Ctrl+Shift+= → edit Linear again | Same |

Motivation: schools on Chromebooks / Google Workspace; existing LaTeX add-ons render **images** that break Linear ↔ Professional for blind students.

Reference baselines: [docs/word-baseline.md](word-baseline.md) and [docs/blind-student-test.md](blind-student-test.md).

---

## 2. What actually shipped (and still works)

These pieces are real product value. Do not throw them away when documenting “failure” — the failure is **in-Doc MathCAT parity**, not the whole extension.

### Storage and editing

- Equations stored as plain text: `[[eq]]…[[/eq]]` (ASCII delimiters; Unicode ⟦eq⟧ was abandoned because Docs corrupted it).
- Survives copy/paste, revision history, and collaborators without the extension (they see source).
- **Alt+=** opens an in-page equation panel (iframe), not Chrome’s sidePanel API.
- **Alt+Enter** inserts at caret; **Alt+Shift+Enter** opens a line below then inserts.
- **F2** edit in place; **Ctrl+Shift+Delete** delete; **Ctrl+Shift+R** re-read.
- Up/Down leave Docs caret movement alone and announce when a line holds an equation.
- Canvas Docs workarounds: MAIN-world key dispatch (`page-main.js`), hidden-model text read, measured line table for caret Y.

### Speech and math conversion

- Custom ClearSpeak-style LaTeX → English (`lib/latex-speech.js`), brace-aware for nested fractions/roots.
- Unit tests: `extension/test/latex-speech.test.html`.
- Options: **My screen reader** (ARIA live region) vs **Chrome speech** (`chrome.tts`) — never both by default (dual-voice bug).

### Placement / reliability work (approx. 2.7–2.8.x)

- Trailing newline only at **end of document** (avoid blank lines when re-inserting mid-doc).
- Delete/replace verify document text and undo on failure.
- Diagnostics: **Ctrl+Shift+F9**.

### Late MathML attempt (2.11.0)

- KaTeX → MathML in **panel preview** and **live-region announcements**.
- Helped when focus was in *our* HTML; did **not** stop NVDA from reading Docs’ own tree or raw `[[eq]]` in the document body.

---

## 3. Timeline of accessibility experiments (what we tried)

Rough order from the Sep 2026 push. Versions are approximate labels used in that workstream.

### 3.1 Dual voice (Chrome TTS + screen reader)

**Symptom:** User heard a voice with all SRs off; with Narrator/NVDA/JAWS, everything spoke twice. Ctrl silenced the SR but not Web Speech.

**Cause:** `DocumentBridge.announce()` wrote an ARIA live region **and** called `SpeechOutput.speak()` every time. Content scripts often fell through to `speechSynthesis` (Microsoft voices), which sounded like Narrator.

**Fix:** Modes `screenReader` | `extension`; default screen reader; `SpeechOutput.setEnabled` / `watchStoredMode`. Pass 1 (all SRs off) then silence confirmed the fix.

**Lesson:** One announcement channel. Chrome TTS is fine for demos with no SR; it is not a substitute for JAWS/NVDA + braille.

---

### 3.2 Live region gymnastics (NVDA / JAWS double-speak)

**Tried:**

- Polite + assertive regions.
- Clear → wait → rewrite (force re-announce).
- Dual write: page live region **and** Docs editable iframe live region.
- `role="alert"` vs `role="status"`.
- `clip:rect` offscreen styling (JAWS sometimes skips clipped nodes).
- Delayed announce after insert (~500 ms) so Docs’ focus speech finished first.

**Results:**

- Two regions → same sentence twice.
- Clear/rewrite twice → same sentence twice.
- Iframe region did not reliably beat Docs’ own “document content, edit, multiline” when focus moved into the Doc.
- Delay sometimes let MathML/English through; often NVDA still cancelled our live region for Docs chrome.

**Lesson:** Live regions can **add** speech on top of Docs. They cannot **replace** Docs’ accessibility tree or give MathCAT a navigable math object in the canvas.

---

### 3.3 Focus: panel vs document after Alt+Enter

**Conflict:**

- Stay in Linear LaTeX → user complained focus bounced back to the box; heard “LaTeX frame”, “Linear LaTeX”, landmarks.
- Stay in document → NVDA/JAWS announce **application / main / Document content edit multiline** (Docs, not us). Required for caret/next equation, but noisy.

**Tried:** Mute Docs with `aria-hidden` during insert; return focus to panel; leave focus in Doc; strip iframe `title` (then NVDA said **unknown**); restore short title `LaTeX`; hide Close/banner; remove `<main>` landmark / long `aria-describedby`.

**Lesson:** Any focus move into Google Docs triggers Docs’ verbose edit-field announcement. That is platform behavior. Suppressing it by hiding Docs from AT risks breaking the document for the SR entirely.

---

### 3.4 “Make NVDA as quiet as Narrator”

Narrator often sounded cleaner because it announces less UI chrome and was easier to confuse with our TTS. NVDA/JAWS are doing their job: they describe landmarks, frames, and contenteditable.

**Tried:** Less announce text on open/F2; no “ready” dump; no “Inserted.” prefix; position-only “2 of 3” + math.

**Partial win:** Less *our* chatter. Docs + Linear box still noisy.

---

### 3.5 MathML / MathCAT (clues from industry practice)

Industry advice (and correct for **web** apps):

1. Do not force SRs to read raw LaTeX.
2. Feed **MathML**; let MathCAT speak / braille.
3. In a web view: KaTeX/MathJax with MathML; `role="math"`; avoid `aria-label` that hides the tree.
4. Careful with `aria-live` on every keystroke.

**What we implemented in the extension:**

- `lib/latex-mathml.js` + KaTeX in content scripts / panel.
- Preview without `role="img"` + English `aria-label` (those hid MathML).
- Live region: prefix text + `<math>` when announcing insert/nav.

**Evidence from Speech Viewer:** A line like `𝑦 = 𝑥 2` showed MathCAT-style reading of an announcement — progress for **our** live region. Immediately before/after: still `Document content edit multiline`, `LaTeX frame`, Linear box reading `y=\sqrt{…}`, and raw document lines with `[[eq]]` when focused in Docs.

**Hard limit:** MathML in an extension live region ≠ MathML **in the Google Doc**. The caret lives in Docs’ hidden input / canvas pipeline. NVDA’s virtual cursor on the Doc does not walk our KaTeX tree.

---

### 3.6 Option “store MathML or images in the Doc” (rejected as Word-parity)

Evaluated as “long-term Option 3”:

| Approach | Blocker |
|----------|---------|
| True MathML as document content | Docs canvas has no MathML a11y tree for third-party content like Word OMML |
| Native Docs equations via API | Public Apps Script / Docs APIs do not expose reliable equation insert ([native-equation-research.md](native-equation-research.md)); MathPad-style paths are undocumented |
| PNG + alt text as primary storage | No solid alt API on clipboard paste; F2/delete/list/nav all assume `[[eq]]` text zones — full rewrite; alt text is a **flat string**, not MathCAT exploration / Nemeth tree |

**Decision:** Do not fake Word-in-Docs. Build **Digi Math Pad** (owned HTML + MathML) for accessible authoring; keep extension for Docs collaboration/insert.

---

## 4. What we could not succeed at (explicit)

Treat these as **out of scope for the Docs extension**, not as open bugs to grind forever:

1. **Silence Docs’ “application / Document content / edit / multiline”** when the caret enters the document while a screen reader is on.
2. **Stop NVDA/JAWS from reading `[[eq]]…[[/eq]]`** when the user arrows onto that line in the Doc (source is literal document text).
3. **MathCAT piece-by-piece navigation and braille** for equations *as they sit in the Google Doc*.
4. **Parity with Word Professional mode** inside Docs for blind students (Tina profile).
5. **One quiet insert path** that both (a) leaves the caret in the Doc for workflow and (b) never triggers Docs edit-field speech.
6. **Detect “is JAWS/NVDA running?”** from a webpage and auto-pick speech mode — not reliably available; user setting required.
7. **Native Docs equation objects** as a supported, maintainable extension feature (research incomplete / API gap).

---

## 5. Root cause (one paragraph)

Google Docs paints text to a **canvas** and exposes editing through a **hidden contenteditable / iframe** pipeline. Assistive tech therefore sees a generic multiline edit surface plus whatever text is in the model (including `[[eq]]` LaTeX). Word stores equations as **Office Math / MathML** with a real accessibility tree. A Chrome extension can inject HTML beside Docs and speak via live regions or TTS; it **cannot** replace Docs’ equation model with OMML/MathML. Fighting that boundary produced months of focus/live-region/MathML work with diminishing returns.

---

## 6. Evidence we relied on

- Manual NVDA **Speech Viewer** logs (paste sessions during Sep 2026).
- Pass tests: all SRs off → silence after TTS gated; insert/delete/end-of-doc newline restored after regressions.
- NVDA log errors around Docs `gainFocus` / `speakObject` / COM failures (Docs tree flaky under NVDA).
- Prior research: [native-equation-research.md](native-equation-research.md), [benchmark.md](benchmark.md), [word-baseline.md](word-baseline.md).

---

## 7. What to keep vs freeze

| Keep | Freeze / deprioritize |
|------|------------------------|
| `[[eq]]` insert/edit/delete for shared Docs | “Make Docs as quiet as Narrator” |
| Word-style shortcuts and speech tests | Dual live regions / iframe AT muting experiments |
| Canvas caret / line-table engineering | Claiming MathCAT-in-Docs |
| Optional Chrome TTS for no-SR demos | PNG-as-primary-equation without a full redesign |
| Thin bridge later: “Open in Digi Math Pad” | Undocumented native Docs equation automation |

---

## 8. Recommended narrative for stakeholders

> We built a working Google Docs LaTeX insert/edit tool aligned with familiar Word shortcuts. Full blind-student math accessibility (MathCAT, braille, explore structure) requires a document surface we control. Google Docs’ canvas does not provide that. Digi Math Pad is that surface; Word remains the classroom gold standard where schools use Office; the Docs extension remains the bridge into Google Classroom documents.

---

## 9. Pointers into the codebase

| Concern | Where |
|---------|--------|
| Insert / announce | `extension/content/document-bridge.js` |
| Live region / TTS modes | `extension/lib/speech-output.js` |
| MathML helper | `extension/lib/latex-mathml.js` |
| LaTeX → English | `extension/lib/latex-speech.js` |
| Docs iframe / keys | `extension/content/page-main.js`, `docs-utils.js` |
| Panel UI | `extension/sidepanel/` |
| Nav announce | `extension/content/equation-navigator.js` |
| Accessible authoring successor | `pad/` (Digi Math Pad) |
| Pad plan | [math-pad-plan.md](math-pad-plan.md) |

---

*Last updated: September 2026 — after Speech Viewer–driven NVDA testing and the decision to prioritize Digi Math Pad for MathCAT/braille.*
