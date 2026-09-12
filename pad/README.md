# Digi Math Pad

An independent, accessible **Linear LaTeX** workspace for blind and low-vision students using NVDA, JAWS + MathCAT, or VoiceOver on Mac.

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
| Work name → Linear | **Enter** from Assignment name / Practice page name |
| New equation / focus empty | **Alt+=** |
| New note (explanation / thoughts) | **Alt+N** |
| Hear math (Professional) | **Alt+Enter** · **Escape** back to Linear |
| Previous / next equation from Linear | **Alt+Up** / **Alt+Down** (arrows only edit inside the field) |
| Remove selected item in Your work | **Delete** (confirms if not empty) |
| Remove from editor | **Alt+Delete** |
| Undo remove / clear / sheet delete | **Ctrl+Shift+Z** (app undo). **Ctrl+Z** in Linear undoes typing only |
| Paste clipboard as new equation | **Ctrl+Shift+V** |
| Copy all answers | **Ctrl+Shift+C** |
| Your work navigation | **Arrow Up/Down**, **Home/End**, **Enter** to edit |
| Open Review | **Alt+R** |
| Quick help | **Quick help** button (dialog focuses its heading) |
| Review navigation | **Arrow Up/Down**, **Home/End**, **Enter** to edit, **Escape** to close |
| Save | **Ctrl+S** (also autosaves) |
| Print / visual PDF | **Ctrl+P** |

## Student workflow

1. **Practice** class = free practice pages. **New class** = a course (Algebra 1, etc.).
2. Enter a class name in the in-page dialog. Use **Rename class** later if needed.
3. In a class, choose **New assignment** and edit its **Assignment name**. In Practice, choose **New practice page** and edit its **Practice page name**.
4. Write in Linear; optional **Problem number** (1.2, 3a) matches a worksheet.
5. **Alt+N** adds a note for explanations or thoughts.
6. **Alt+Enter** only when you want the math read (typing stays quiet).
7. Check for **Saved to your account** when signed in, or **Saved locally** in personal mode.
8. Use **Review answers**, **Download Word**, **Copy all**, **Print / visual PDF**, **Download accessible HTML**, or **Download backup**.
9. Signed-in work returns on another device. Browser-only personal practice returns only in the same browser profile.

Downloaded JSON backups contain one assignment or practice page and remain available even when an answer is incomplete or invalid.

## Automated keyboard check

With the dev server running:

```bash
npm.cmd run test:sr
npm.cmd run test:cloud
npm.cmd run test:word
```

Optional: `PAD_URL=http://localhost:5173/ npm.cmd run test:sr`

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

The Docs extension still helps insert `[[eq]]` into shared Docs. **Accessible authoring and braille live in Digi Math Pad.**
