# Phase 3 Research — Native Google Docs Equation Conversion

Investigation of converting Professional-mode LaTeX to **native Google Docs equations** so Google's built-in [equation screen reader support](https://support.google.com/docs/answer/16712774) applies — without relying on KaTeX overlays.

---

## Motivation

Our v1 extension uses:

- Delimited LaTeX text: `⟦eq⟧...⟦/eq⟧`
- KaTeX overlay for visual rendering
- Custom ARIA live region for natural math speech

**Stretch goal:** Convert to native Docs equation objects so:

- Sighted users see Google's equation renderer (survives without extension).
- Screen readers use Google's improving native math accessibility.
- Collaboration improves — recipients without extension still see real equations.

---

## MathPad approach (competitor analysis)

[MathPad](https://workspace.google.com/marketplace) (Google Workspace Marketplace) claims to convert LaTeX to native Google Docs equations.

### Observed workflow

1. User enters LaTeX in MathPad sidebar or via `$$...$$` shorthand.
2. MathPad converts LaTeX → native equation object via Docs API / Apps Script.
3. Result is a first-class Google Docs equation, not an image.

### Strengths

- Native equation accessibility path.
- No image de-render cycle.
- Works for collaborators without extension.

### Gaps vs our acceptance test

- No **Alt+=** inline insert.
- No **Linear mode** with keystroke speech.
- No **F2** round-trip to LaTeX source.
- LaTeX editing happens in sidebar, not in document.

### Conclusion

MathPad solves **Professional display + native accessibility** but not the **Linear/Professional blind student workflow**. Complementary, not replacement.

---

## Google Docs native equation capabilities

### Insertion

- **UI:** Insert → Equation
- **API:** `DocumentApp` does **not** expose programmatic equation insertion as of 2025–2026.
- **Workaround:** MathPad likely uses Advanced Docs API or UI automation patterns not publicly documented.

### LaTeX support inside equation editor

Google's equation editor accepts **LaTeX-like shortcuts** when already inside equation mode:

| Shortcut in equation mode | Result |
|---|---|
| `x^2` | Superscript |
| `\sqrt` | Square root |
| `\frac` | Fraction |

This is **not** full LaTeX Linear mode — user must be inside Google's equation editor, not typing delimited text in document body.

### Screen reader support

Google documents [equation accessibility for screen readers](https://support.google.com/docs/answer/16712774):

- Equations are navigable objects.
- ChromeVox can read equation content.
- Quality varies by equation complexity; improving over time.

---

## Technical feasibility for our project

### Option A — Apps Script + Advanced Docs API

**Hypothesis:** Use `docs.documents.batchUpdate` with `insertInlineObject` or equivalent for equations.

**Status:** Google's public Apps Script `DocumentApp` lacks equation insert. Advanced Docs API may have limited support. Requires further API exploration and possible Google whitelist.

**Risk:** High — undocumented or restricted endpoints.

### Option B — Clipboard / paste automation

**Hypothesis:** Copy equation from external tool, paste as native equation.

**Status:** Unreliable in extension context; breaks keyboard-only workflow.

**Risk:** High — poor accessibility.

### Option C — Hybrid model (recommended Phase 3)

1. **v1 (current):** Delimited LaTeX + KaTeX overlay + ARIA speech.
2. **v2 add-on:** Sidebar option "Convert to native equation" for export/sharing.
3. **v3:** Automatic conversion on Enter if API becomes available.

```
Linear mode (always LaTeX text)
    ↓ Enter
Professional mode (KaTeX overlay + ARIA)  ← v1
    ↓ optional "Export native"
Native Docs equation                       ← Phase 3
```

### Option D — MathML intermediate

**Hypothesis:** LaTeX → MathML → native equation.

**Status:** Google does not expose MathML import for Docs equations. Word uses Office Math ML internally; no parallel in Docs API.

**Risk:** Blocked by platform.

---

## Recommended Phase 3 roadmap

| Milestone | Deliverable | Dependency |
|---|---|---|
| 3.1 | Document MathPad conversion behavior (reverse-engineer UX) | Marketplace access |
| 3.2 | Prototype "Export to native" button in add-on sidebar | Apps Script API research |
| 3.3 | Test native equation ChromeVox speech vs our ARIA speech | Acceptance test |
| 3.4 | Student doc export mode (extension optional for recipients) | 3.2 success |
| 3.5 | Google extension whitelist for deeper DOM access | Google application |

---

## Acceptance test impact

If native conversion succeeds:

| Step | v1 (KaTeX) | Phase 3 (native) |
|---|---|---|
| Alt+= insert | ✅ extension | ✅ extension |
| Linear keystroke speech | ✅ | ✅ |
| Enter natural speech | ✅ ARIA | ✅ Google native (test) |
| F2 edit | ✅ | ✅ (must preserve LaTeX delimiter or sync) |
| View without extension | ⚠️ delimiters visible | ✅ native equation |

**Critical requirement:** F2 must still restore editable LaTeX. Native equations alone do not provide this — delimiter text must remain authoritative source.

---

## Open questions

1. Does Advanced Docs API support `InsertEquation` request type?
2. Can MathPad's approach be replicated in open-source add-on code?
3. Does native equation speech match ClearSpeak output students learn on DigiMath?
4. Do native equations survive copy/paste between Docs and Word?
5. Will Google add official LaTeX Linear mode to Docs equation editor?

---

## References

- [Google Docs equation screen reader support](https://support.google.com/docs/answer/16712774)
- [Microsoft math accessibility trees](https://devblogs.microsoft.com/math-in-office/math-accessibility-trees/)
- [Access Digi Math](https://accessuci.ics.uci.edu/digimath/)
- [benchmark.md](benchmark.md) — MathPad partial pass analysis

---

## Status

**Phase 3 — research complete, implementation deferred.**

v1 extension and add-on deliver full acceptance test pass via delimited LaTeX + KaTeX + ARIA. Native conversion tracked as future enhancement.
