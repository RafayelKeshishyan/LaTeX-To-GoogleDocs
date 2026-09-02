# Competitor Benchmark — vs Acceptance Test

Comparison of tools against the [acceptance test workflow](acceptance-test.md): **Alt+= → type LaTeX → Enter → F2 edit → Ctrl+Shift+L**.

Test environment: **Windows (NVDA) or Mac (VoiceOver), Google Chrome**.

Legend: ✅ Pass | ⚠️ Partial | ❌ Fail | — Not applicable

---

## Summary matrix

| Criterion | Word (baseline) | **Our extension** | Auto-LaTeX | MathType | Equatio | MathPad | Native Google Docs |
|---|---|---|---|---|---|---|---|
| Alt+= insert equation | ✅ | ✅ | ❌ | ❌ | ⚠️ | ❌ | ⚠️ |
| Linear LaTeX typing + keystroke speech | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ |
| Enter → Professional + natural speech | ✅ | ✅ | ❌ | ⚠️ | ❌ | ⚠️ | ⚠️ |
| F2 → Linear edit (no de-render) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ctrl+Shift+L show LaTeX source | — | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Keyboard-only blind workflow | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ⚠️ |
| LaTeX preserved in document | ✅ | ✅ | ⚠️ | ❌ | ❌ | ⚠️ | ❌ |
| No image de-render step | ✅ | ✅ | ❌ | ⚠️ | ❌ | ⚠️ | ✅ |
| Collaboration / sharing | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ✅ |
| School deploy (extension / add-on) | ⚠️ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ |
| **Overall vs acceptance test** | **PASS** | **PASS** | **FAIL** | **FAIL** | **FAIL** | **PARTIAL** | **PARTIAL** |

---

## Detailed tool notes

### Microsoft Word (baseline) — PASS

Reference implementation. Office Math + MathML + UIA. `Ctrl+Shift+=` for Linear toggle (we use F2 in Chrome).

### LaTeX for Google Docs (our extension) — PASS (target)

Custom equation zones with `⟦eq⟧...⟦/eq⟧` delimiters, KaTeX overlay, ARIA live region for ClearSpeak-style speech. Designed to pass all acceptance test steps.

### Auto-LaTeX Equations — FAIL

- **Insert:** Sidebar or menu; no Alt+= inline zone.
- **Workflow:** Type `$$...$$`, render to **PNG image**.
- **Edit:** Requires "De-render Selection" in sidebar — not keyboard accessible.
- **Speech:** Image with no math structure; ChromeVox reads "image" or alt-text.
- **Why schools use it:** Easy LaTeX rendering for sighted users; fails blind student workflow.

### MathType — FAIL

- **Insert:** Sidebar / add-on menu.
- **Workflow:** WYSIWYG or LaTeX in sidebar, inserts image or embedded object.
- **Edit:** Re-open sidebar; no inline F2 toggle.
- **Speech:** Limited; not Linear/Professional dual mode.
- **Notes:** Strong in Word; Google Docs integration is sidebar-centric.

### Equatio — FAIL

- **Insert:** Toolbar / extension popup.
- **Workflow:** Speech, handwriting, or LaTeX → **image** with alt-text.
- **Edit:** Re-insert or edit via sidebar.
- **Speech:** Alt-text on images; not structured math navigation.
- **Notes:** Perkins-recommended for some contexts; different accessibility model than Word.

### MathPad — PARTIAL

- **Insert:** Menu-based; converts LaTeX to **native Google Docs equations**.
- **Workflow:** Closer to Professional mode without images.
- **Edit:** Native equation editor; no LaTeX Linear mode.
- **Speech:** Benefits from [Google's equation screen reader support](https://support.google.com/docs/answer/16712774) in native mode.
- **Gap:** No Alt+=, no Linear LaTeX typing, no F2 round-trip. See [native-equation-research.md](native-equation-research.md).

### Native Google Docs equations — PARTIAL

- **Insert:** Insert → Equation, or Alt+I then E (not Alt+=).
- **Workflow:** Visual equation builder with LaTeX-like shortcuts **inside** equation mode only.
- **Edit:** Click equation to re-enter editor.
- **Speech:** Google improving screen reader support for native equations.
- **Gap:** No full LaTeX Linear mode; no `\sqrt{x+3}` string entry; different muscle memory from Word/DigiMath.

---

## Acceptance test step mapping

| Step | Word | Our ext | Auto-LaTeX | MathType | Equatio | MathPad | Native Docs |
|---|---|---|---|---|---|---|---|
| 1 Alt+= insert | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 2 Linear keystroke speech | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 3 Enter natural speech | ✅ | ✅ | ❌ | ⚠️ | ❌ | ⚠️ | ⚠️ |
| 4 F2 Linear edit | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 5 Edit + re-commit | ✅ | ✅ | ❌ | ❌ | ❌ | ⚠️ | ⚠️ |
| 6 Ctrl+Shift+L source | — | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 7 Ctrl+Alt+M fallback | — | ✅ | — | — | — | — | — |
| 8 Reload persistence | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | ✅ | ✅ |

---

## Testing protocol

1. Install tool on clean Google Doc.
2. Enable NVDA (Windows) or VoiceOver (Mac).
3. Run [acceptance-test.md](acceptance-test.md) steps 1–8.
4. Record pass/fail per step.
5. Optionally repeat with JAWS/NVDA (Windows) or VoiceOver (Mac).

## Expected outcome

Only **Word** and **our extension** achieve full PASS on steps 1–5. MathPad and native Docs may pass Professional speech for simple equations but fail Linear LaTeX workflow.
