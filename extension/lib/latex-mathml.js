/**
 * latex-mathml.js — LaTeX to MathML for NVDA/JAWS MathCAT
 *
 * KaTeX already produces MathML. Screen readers speak that tree; they must
 * not be given raw LaTeX or an aria-label that hides the <math> element.
 * Returns '' if KaTeX is missing or the LaTeX does not parse — callers then
 * keep the existing English fallback. Never used as document storage.
 */

const LatexMathML = (() => {
  function extractMath(html) {
    if (!html) return '';
    const start = html.indexOf('<math');
    const end = html.lastIndexOf('</math>');
    if (start < 0 || end < 0 || end <= start) return '';
    return html.slice(start, end + 7);
  }

  function fromLatex(latex) {
    const src = (latex || '').trim();
    if (!src || typeof katex === 'undefined') return '';

    try {
      let html;
      try {
        html = katex.renderToString(src, {
          throwOnError: true,
          output: 'mathml',
          displayMode: false
        });
      } catch (err) {
        if (!/output/i.test(String(err && err.message))) throw err;
        html = katex.renderToString(src, {
          throwOnError: true,
          displayMode: false
        });
      }
      return extractMath(html);
    } catch {
      return '';
    }
  }

  return { fromLatex };
})();

if (typeof window !== 'undefined') {
  window.LatexMathML = LatexMathML;
}
