import katex from 'katex';

/** Extract a bare <math>…</math> tree from KaTeX HTML. */
function extractMath(html: string): string {
  const start = html.indexOf('<math');
  const end = html.lastIndexOf('</math>');
  if (start < 0 || end < 0 || end <= start) return '';
  return html.slice(start, end + 7);
}

/**
 * LaTeX → MathML for NVDA/JAWS MathCAT and VoiceOver where supported.
 * Returns empty string on parse failure.
 */
export function latexToMathML(latex: string): string {
  const src = latex.trim();
  if (!src) return '';

  try {
    let html: string;
    try {
      html = katex.renderToString(src, {
        throwOnError: true,
        output: 'mathml',
        displayMode: true,
      });
    } catch (err) {
      if (!/output/i.test(String((err as Error)?.message))) throw err;
      html = katex.renderToString(src, {
        throwOnError: true,
        displayMode: true,
      });
    }
    return extractMath(html);
  } catch {
    return '';
  }
}

/** Visual KaTeX (HTML + hidden MathML). Live preview never throws. */
export function renderKatexHtml(latex: string): { html: string; error: string | null } {
  const src = latex.trim();
  if (!src) return { html: '', error: null };
  try {
    const html = katex.renderToString(src, {
      throwOnError: false,
      displayMode: true,
      output: 'htmlAndMathml',
      strict: 'ignore',
    });
    return { html, error: null };
  } catch (err) {
    return { html: '', error: (err as Error).message || 'Could not render equation.' };
  }
}

/**
 * Turn clipboard text into Linear source. Accepts plain LaTeX, or MathML that
 * carries an application/x-tex annotation (what Copy MathML produces).
 */
export function latexFromClipboardText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const texAnnotation =
    /<annotation\b[^>]*\bencoding\s*=\s*["']application\/x-tex["'][^>]*>([\s\S]*?)<\/annotation>/i.exec(
      trimmed,
    );
  if (texAnnotation) {
    return texAnnotation[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .trim();
  }

  if (/^<math[\s>]/i.test(trimmed)) return '';
  return trimmed;
}

/** Strict check for Alt+Enter / hand-in — does not drive live preview speech. */
export function latexParseError(latex: string): string | null {
  const src = latex.trim();
  if (!src) return 'Type an equation first.';
  try {
    katex.renderToString(src, {
      throwOnError: true,
      displayMode: true,
      output: 'mathml',
      strict: 'ignore',
    });
    return null;
  } catch (err) {
    const msg = (err as Error).message || 'Invalid equation.';
    const short = msg.replace(/^KaTeX parse error:\s*/i, '').split('\n')[0];
    if (short.includes("Expected '}', got 'EOF'")) {
      return 'Missing a closing brace.';
    }
    if (/Unexpected end of input|got 'EOF'/i.test(short)) {
      return 'Equation ends before it is complete.';
    }
    const unknown = /Undefined control sequence:\s*(\\[A-Za-z]+)/i.exec(short);
    if (unknown) return `Unknown command ${unknown[1]}.`;
    return `Check near: ${short.slice(0, 90)}`;
  }
}
