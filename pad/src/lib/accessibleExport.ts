import type { PadSheet } from './document';
import { blockListName } from './document';
import { latexToMathML } from './mathml';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function exportAccessibleHtml(sheet: PadSheet): string {
  const content = sheet.blocks
    .map((block) => {
      const heading = escapeHtml(blockListName(sheet.blocks, block.id));
      if (block.type === 'prose') {
        return `<section><h2>${heading}</h2><p class="prose">${escapeHtml(
          block.text.trim() || '(empty)',
        )}</p></section>`;
      }

      const source = block.latex.trim();
      const mathml = source ? latexToMathML(source) : '';
      const rendered = mathml
        ? `<div class="math">${mathml}</div>`
        : `<p class="problem">${source ? 'This equation could not be rendered.' : 'Empty equation.'}</p>`;
      return `<section><h2>${heading}</h2>${rendered}<details><summary>Linear source</summary><code>${escapeHtml(
        source || '(empty)',
      )}</code></details></section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(sheet.title)}</title>
  <style>
    body { max-width: 52rem; margin: 2rem auto; padding: 0 1rem; font: 1rem/1.5 system-ui, sans-serif; color: #111; background: #fff; }
    section { margin: 2rem 0; }
    .prose { white-space: pre-wrap; }
    .math { overflow-x: auto; padding: 1rem; border: 1px solid #aaa; }
    math { display: block; margin: 0 auto; }
    code { white-space: pre-wrap; overflow-wrap: anywhere; }
    .problem { color: #8a1f1f; font-weight: 700; }
    @media print { details { display: none; } }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(sheet.title)}</h1>
    ${content}
  </main>
</body>
</html>`;
}
