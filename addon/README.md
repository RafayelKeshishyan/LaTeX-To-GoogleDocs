# Google Workspace Add-on — LaTeX for Google Docs

Sidebar add-on for inserting LaTeX equation zones (`⟦eq⟧...⟦/eq⟧`) into Google Docs. Secondary delivery for schools that block Chrome extensions.

## Features

- LaTeX editor with live KaTeX preview
- Insert equation delimiters at cursor
- DigiMath worksheet templates (Tutorials 1–4)
- Link to [Access Digi Math](https://accessuci.ics.uci.edu/digimath/)

## Prerequisites

- [Node.js](https://nodejs.org/) (for clasp CLI)
- Google account with Google Docs access
- [clasp](https://github.com/google/clasp) — Google Apps Script CLI

## Setup with clasp

### 1. Install clasp

```bash
npm install -g @google/clasp
```

### 2. Login to Google

```bash
clasp login
```

### 3. Create Apps Script project

From the `addon/` directory:

```bash
cd addon
clasp create --type docs --title "LaTeX for Google Docs" --rootDir .
```

This creates `.clasp.json` (gitignored — contains script ID).

### 4. Push code

```bash
clasp push
```

### 5. Deploy as test add-on

```bash
clasp open
```

In the Apps Script editor:

1. Click **Deploy** → **Test deployments**
2. Select type **Editor add-on**
3. Install for your account

### 6. Use in Google Docs

1. Open a Google Doc
2. **Extensions** → **LaTeX for Google Docs** → **LaTeX Equation Editor**
3. Type LaTeX, preview renders live
4. Click **Insert at Cursor**

## Files

| File | Purpose |
|---|---|
| `appsscript.json` | Manifest (scopes, runtime) |
| `Code.gs` | Server-side: sidebar, insert, templates |
| `Sidebar.html` | Client UI with KaTeX preview |

## KaTeX loading (CDN)

The add-on sidebar loads KaTeX from jsDelivr CDN. This is intentional: Google Apps Script `HtmlService` runs in Google's sandbox, which allows external scripts, unlike the Chrome extension's Manifest V3 CSP (`script-src 'self'`). The extension vendors KaTeX locally under `extension/lib/katex/`; the add-on does not share that bundle because clasp/GAS does not support binary font assets cleanly.

## Equation format

Equations are inserted as plain text delimiters:

```
⟦eq⟧y=\sqrt{x+3}⟦/eq⟧
```

Students with the **Chrome extension** get Alt+= / Enter / F2 workflow and KaTeX overlays. Users with only the add-on see delimiter text and can use the sidebar to insert/edit.

## Publishing (production)

For school-wide deployment:

1. Create a Google Cloud project
2. Configure OAuth consent screen
3. Submit add-on to [Google Workspace Marketplace](https://developers.google.com/workspace/marketplace)

See [Google Apps Script add-on documentation](https://developers.google.com/apps-script/add-ons).

## Limitations

- Cannot intercept Alt+= (requires Chrome extension)
- No F2 Linear/Professional toggle from sidebar alone
- Insertion is plain text — rendering requires extension
- `DocumentApp` cannot insert native Google Docs equations

## Related

- Chrome extension: `../extension/`
- TVI guide: `../docs/tvi-guide.md`
- Acceptance test: `../docs/acceptance-test.md`
