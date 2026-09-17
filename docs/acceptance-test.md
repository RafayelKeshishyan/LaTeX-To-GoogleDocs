# Extension acceptance test — NVDA, JAWS, and Narrator (v2.11.4)

This is the short release test for the Google Docs extension. Run the same
steps with one screen reader at a time. Record behavior, not exact wording;
screen readers use different control names and verbosity.

For the longer student walkthrough, see
[blind-student-test.md](./blind-student-test.md).

## Set up each run

1. Reload version **2.11.4** at `chrome://extensions`, then refresh the Doc.
2. Use current Chrome on Windows and a document URL ending in `/edit`.
3. In Docs, turn on **Tools → Accessibility → Screen reader support**.
4. In the extension options, select **My screen reader**.
5. Run only one reader:
   - **NVDA:** use focus mode (`NVDA+Space`) while editing.
   - **JAWS:** turn off the Virtual PC Cursor (`JAWS+Z`) while editing.
   - **Narrator:** turn off scan mode (`Narrator+Space`) while editing.
6. Start with a new document containing these three lines:

   ```text
   Before
   Middle
   After
   ```

Google Docs may say “application,” “document content,” “edit,” and the literal
`[[eq]]` source. That noise is a known platform limitation. It is not a failure
unless it prevents the extension's math announcement or the requested action.

## Core test

| # | Action | Pass condition |
|---|---|---|
| 1 | Put the caret after **Before** and press **Alt+=** | Focus lands in **Linear LaTeX** without a mouse and without a long help announcement. |
| 2 | Type `y=\sqrt{x + 3}` | Native character/word echo occurs once. No second synthetic voice speaks over the reader. |
| 3 | Press **Alt+Enter** | The equation is on its own line, the next line is ready, and focus is back in **Linear LaTeX** with the source selected. Hear the complete sentence **“y equals the square root of x plus 3”** once—not a fragment such as “right bracket.” Typing a letter now changes the selected LaTeX, never the document. |
| 4 | Press **Escape**, then arrow away and back | The caret moves normally and the extension announces the corresponding natural math once. Docs may additionally expose the literal source. |
| 5 | Press **Ctrl+Shift+R** | The current equation is spoken once and focus remains usable. |
| 6 | Press **F2**, change `3` to `5`, then **Alt+Enter** | Only that equation changes, in place, and the replacement is announced. |
| 7 | Press **Ctrl+Shift+Delete** | Only that equation is removed. A failed safety check must leave the document unchanged and explain the failure. |

## Placement and duplicate-equation regression

| # | Action | Pass condition |
|---|---|---|
| 8 | On the **Middle** line, insert `x^2` with **Alt+Shift+Enter** | A new equation line appears immediately below Middle; After remains intact. |
| 9 | At the end of the document, insert `x^2` twice with **Alt+Enter** | Both identical equations exist on separate consecutive lines with no blank line between them. |
| 10 | Arrow to the second `x^2`, press **F2**, change it to `x^3`, and commit | The first remains `x^2`; only the second becomes `x^3`. |
| 11 | Delete the remaining `x^2` with **Ctrl+Shift+Delete** | `x^2` is removed and `x^3` remains. The existence of another similar equation does not trigger an undo. |
| 12 | Refresh the panel equation list | Its order and count match the document. Selecting an item loads that exact equation. |

## Failure and uncertainty behavior

If the extension says:

> Equation entered. Google Docs did not expose it to the equation list.

mark the list/navigation result as **Unconfirmed**. The editor accepted the
command, but its canvas did not provide readable text for the extension list.
The extension should still read the entered math once and keep focus in Linear
LaTeX; it must not ask a blind student to inspect the page visually.

## Reader scorecard

Use **Pass**, **Fail**, or **Unconfirmed**. Add a short speech-history excerpt
for failures.

| Check | NVDA | JAWS | Narrator |
|---|---|---|---|
| Alt+= reliably focuses Linear LaTeX |  |  |  |
| Typing has one voice |  |  |  |
| Insert is confirmed and math is heard once |  |  |  |
| Arrow navigation announces the correct equation |  |  |  |
| Ctrl+Shift+R works |  |  |  |
| F2 replaces the correct equation |  |  |  |
| Delete removes the correct equation |  |  |  |
| Repeated formulas behave correctly |  |  |  |
| No focus trap or unrecoverable silence |  |  |  |
| Overall usable despite Docs' own speech |  |  |  |

Recommend a reader only after it passes every action and a blind tester judges
the remaining Docs chatter usable. A reader being quieter is not enough if its
caret, editing, or equation announcements are unreliable.

## What to report

- Reader name and version; Chrome version.
- Test number and whether it was Pass, Fail, or Unconfirmed.
- What was spoken and where the caret actually landed.
- For caret, list, replace, or delete failures, press **Ctrl+Shift+F9** and
  include the copied diagnostic report.
