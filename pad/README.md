# EquaNote

An independent, accessible **Linear LaTeX** workspace for blind and low-vision students, designed for
NVDA, JAWS, and VoiceOver on Mac. Verified with NVDA + MathCAT; JAWS and VoiceOver passes are still
open — see [`../docs/math-pad-a11y-test.md`](../docs/math-pad-a11y-test.md).

Students keep **separate sheets** for each assignment, write and fix equations here (real MathML), review answers, then hand in via an **editable Word document with Office Math**, a **visual PDF**, **Copy all answers**, or an **accessible HTML file with MathML**. JSON backup and restore protect editable source work. This is not Google Docs.

## Requirements

- Node.js 20+ (LTS recommended)

## Run locally

```bash
cd pad
npm.cmd install
npm.cmd run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

**PowerShell note:** If `npm` fails with “npm.ps1 is not digitally signed”, call **`npm.cmd`** instead.

## Connect a Supabase development project

1. Run all migrations described in [`../supabase/README.md`](../supabase/README.md).
2. Copy `.env.example` to `.env.local`.
3. Add the Supabase Project URL and **Publishable key** from the project's Connect panel.
4. Restart the development server.

When configured, the Pad opens with an accessible sign-in/account-creation screen. Signed-in
practice and working documents sync to the user's private account. A user can also choose
**Continue with personal practice** for browser-only work.
Never put a Supabase secret key, legacy `service_role` key, or database password in a Vite
environment variable.

### How saved work is separated

Browser storage is keyed per person: personal practice has its own slot, and each signed-in
account has its own. Nothing is ever carried across automatically, so a shared computer cannot
mix two students' work. On a first sign-in where the browser already holds personal practice,
the Pad asks whether to copy it in or start empty.

If the account cannot be reached, the editor keeps working and saving in the browser. Choosing
**Try my account again** never replaces what is on screen; when the account holds different
work, the Pad asks which version to keep.

## Keyboard

Shortcuts are optional. Every action is reachable with Tab and Enter.

| Action | Keys |
|--------|------|
| Work name → Linear | **Enter** from Practice page name |
| New equation / focus empty | **Alt+=** |
| New note (explanation / thoughts) | **Alt+N** |
| Hear math | **Alt+Enter** · **Escape** back to Linear (also from Problem number) |
| Previous / next equation or note | **Up** / **Down** from Linear; **Alt+Up** / **Alt+Down** from any editor |
| Remove selected item in Your work | **Delete** (confirms if not empty) |
| Remove from editor | **Alt+Delete** |
| Undo remove | **Ctrl+Shift+Z** (app undo). **Ctrl+Z** in Linear undoes typing only |
| Your work navigation | **Arrow Up/Down**, **Home/End**, **Enter** to edit |
| Open Review | **Alt+R** |
| Quick help | **Quick help** button (dialog focuses its heading) |
| Review navigation | **Arrow Up/Down**, **Home/End**, **Enter** to edit, **Escape** to close |
| Save | **Ctrl+S** (also autosaves) |

## Student workflow

1. Choose **New practice page** for each worksheet; edit its **Practice page name**.
2. Write in Linear; an equation’s optional **Problem number** (1.2, 3a) matches the teacher packet.
3. **Alt+N** adds a note for explanations or thoughts.
4. **Alt+Enter** only when you want the math read (typing stays quiet).
5. Check for **Saved to your account** when signed in, or **Saved locally** in personal mode.
6. Use **Review answers**, then **Download Word** to turn in editable Office Math.
7. Signed-in work returns on another device. Browser-only personal practice returns only in the same browser profile.

Advanced tools (Classes, MathML copy, JSON backup, templates, and more) stay in the code behind
`STUDENT_SIMPLE_UI` in `src/lib/uiFlags.ts` — flip that flag to `false` to restore them.

## Automated keyboard check

With the dev server running:

```bash
npm.cmd run test:sr
npm.cmd run test:cloud
npm.cmd run test:word
```

Optional: `PAD_URL=http://localhost:5173/ npm.cmd run test:sr`

Before a release, install the additional Playwright engines once, build, and run the
production cross-browser smoke test. It covers Chrome, Edge (when installed), Firefox,
and WebKit as a Safari-engine check:

```bash
npx.cmd playwright install firefox webkit
npm.cmd run build
npm.cmd run test:browsers
```

WebKit on Windows does not replace a short VoiceOver check in Safari on macOS/iOS.

## Accessibility checklist

See [docs/math-pad-a11y-test.md](../docs/math-pad-a11y-test.md).

## Stack

TypeScript, React, Vite, KaTeX (MathML), `docx` (native Office Math), and Supabase. Browser
storage provides local recovery; signed-in workspace libraries also autosave to a private
Supabase row.

## Not in this build

- Teacher / classroom assign and submit (student practice and export only for now)
- Google Docs extension bridge (optional later)

Word export produces editable OMML equations rather than pictures. The automated package test
checks common radicals, fractions, and scripts. Complex equations still require manual testing
in desktop Word with the screen-reader versions supported for deployment.

## Relation to the Chrome extension

The Docs extension still helps insert `[[eq]]` into shared Docs. **Accessible authoring and braille live in EquaNote.**
