/**
 * LaTeX → natural English speech (ClearSpeak-style).
 * Used as a fallback when MathCAT is unavailable, and for status text.
 * Ported from extension/lib/latex-speech.js
 */

const GREEK: Record<string, string> = {
  '\\alpha': 'alpha',
  '\\beta': 'beta',
  '\\gamma': 'gamma',
  '\\delta': 'delta',
  '\\epsilon': 'epsilon',
  '\\zeta': 'zeta',
  '\\eta': 'eta',
  '\\theta': 'theta',
  '\\iota': 'iota',
  '\\kappa': 'kappa',
  '\\lambda': 'lambda',
  '\\mu': 'mu',
  '\\nu': 'nu',
  '\\xi': 'xi',
  '\\pi': 'pi',
  '\\rho': 'rho',
  '\\sigma': 'sigma',
  '\\tau': 'tau',
  '\\upsilon': 'upsilon',
  '\\phi': 'phi',
  '\\chi': 'chi',
  '\\psi': 'psi',
  '\\omega': 'omega',
};

const SYMBOLS: Record<string, string> = {
  '\\pm': 'plus or minus',
  '\\mp': 'minus or plus',
  '\\times': 'times',
  '\\div': 'divided by',
  '\\cdot': 'dot',
  '\\leq': 'less than or equal to',
  '\\geq': 'greater than or equal to',
  '\\le': 'less than or equal to',
  '\\ge': 'greater than or equal to',
  '\\neq': 'not equal to',
  '\\approx': 'approximately equal to',
  '\\infty': 'infinity',
  '\\ldots': 'dot dot dot',
  '\\dots': 'dot dot dot',
  '\\to': 'approaches',
  '\\rightarrow': 'approaches',
  '\\{': 'open brace',
  '\\}': 'close brace',
  '\\|': 'vertical bar',
  '\\%': 'percent',
  '\\$': 'dollar',
};

const FUNCTIONS: Record<string, string> = {
  '\\sin': 'sine',
  '\\cos': 'cosine',
  '\\tan': 'tangent',
  '\\csc': 'cosecant',
  '\\sec': 'secant',
  '\\cot': 'cotangent',
  '\\arcsin': 'arc sine',
  '\\arccos': 'arc cosine',
  '\\arctan': 'arc tangent',
  '\\log': 'log',
  '\\ln': 'natural log',
  '\\exp': 'exponential',
};

const BIG_OPERATORS: Record<string, string> = {
  '\\sum': 'the sum',
  '\\prod': 'the product',
  '\\int': 'the integral',
  '\\lim': 'the limit',
};

const OPERATORS: Record<string, string> = {
  '=': 'equals',
  '+': 'plus',
  '-': 'minus',
  '*': 'times',
  '/': 'divided by',
  '(': 'open parenthesis',
  ')': 'close parenthesis',
  '[': 'open bracket',
  ']': 'close bracket',
  '<': 'less than',
  '>': 'greater than',
  ',': 'comma',
};

const ROOT_NAMES: Record<string, string> = {
  '2': 'square',
  '3': 'cube',
  '4': 'fourth',
  '5': 'fifth',
};

const SPACING = ['\\,', '\\;', '\\:', '\\!', '\\ ', '\\quad', '\\qquad'];

function matchBrace(latex: string, open: number): number {
  let depth = 0;
  for (let i = open; i < latex.length; i++) {
    const ch = latex[i];
    if (ch === '\\') {
      i += 1;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function readArgument(latex: string, start: number): { text: string; next: number } {
  let i = start;
  while (i < latex.length && /\s/.test(latex[i])) i += 1;
  if (i >= latex.length) return { text: '', next: i };

  if (latex[i] === '{') {
    const close = matchBrace(latex, i);
    if (close < 0) return { text: latex.slice(i + 1), next: latex.length };
    return { text: latex.slice(i + 1, close), next: close + 1 };
  }

  if (latex[i] === '\\') {
    const command = /^\\([a-zA-Z]+|.)/.exec(latex.slice(i));
    if (command) return { text: command[0], next: i + command[0].length };
  }

  return { text: latex[i], next: i + 1 };
}

function readOptional(latex: string, start: number): { text: string; next: number } | null {
  if (latex[start] !== '[') return null;
  const close = latex.indexOf(']', start);
  if (close < 0) return null;
  return { text: latex.slice(start + 1, close), next: close + 1 };
}

function rootPrefix(index: string | undefined): string {
  const trimmed = (index || '').trim();
  if (!trimmed) return 'the square root of';
  if (ROOT_NAMES[trimmed]) return `the ${ROOT_NAMES[trimmed]} root of`;
  return `the ${speakSegment(trimmed)}th root of`;
}

function speakSuperscript(text: string): string {
  const trimmed = text.trim();
  if (trimmed === '2') return 'squared';
  if (trimmed === '3') return 'cubed';
  return `to the power of ${speakSegment(trimmed)}`;
}

function speakBigOperator(name: string, latex: string, start: number) {
  let next = start;
  let sub: string | null = null;
  let sup: string | null = null;

  for (let guard = 0; guard < 2; guard++) {
    if (latex[next] === '_' && sub === null) {
      const arg = readArgument(latex, next + 1);
      sub = arg.text;
      next = arg.next;
    } else if (latex[next] === '^' && sup === null) {
      const arg = readArgument(latex, next + 1);
      sup = arg.text;
      next = arg.next;
    } else break;
  }

  const label = BIG_OPERATORS[name];
  if (name === '\\lim') {
    return { text: sub ? `${label} as ${speakSegment(sub)}` : label, next };
  }
  if (sub && sup) {
    return {
      text: `${label} from ${speakSegment(sub)} to ${speakSegment(sup)}`,
      next,
    };
  }
  if (sub) return { text: `${label} from ${speakSegment(sub)}`, next };
  if (sup) return { text: `${label} to ${speakSegment(sup)}`, next };
  return { text: label, next };
}

function speakCommand(latex: string, start: number): { text: string; next: number } | null {
  const match = /^\\([a-zA-Z]+|.)/.exec(latex.slice(start));
  if (!match) return null;

  const name = match[0];
  let next = start + name.length;

  if (name === '\\frac' || name === '\\dfrac' || name === '\\tfrac') {
    const numerator = readArgument(latex, next);
    const denominator = readArgument(latex, numerator.next);
    return {
      text:
        `the fraction with numerator ${speakSegment(numerator.text)} ` +
        `and denominator ${speakSegment(denominator.text)}`,
      next: denominator.next,
    };
  }

  if (name === '\\sqrt') {
    const index = readOptional(latex, next);
    if (index) next = index.next;
    const body = readArgument(latex, next);
    return {
      text: `${rootPrefix(index?.text)} ${speakSegment(body.text)}`,
      next: body.next,
    };
  }

  if (name === '\\text' || name === '\\mathrm' || name === '\\operatorname') {
    const body = readArgument(latex, next);
    return { text: body.text.trim(), next: body.next };
  }

  if (BIG_OPERATORS[name]) return speakBigOperator(name, latex, next);
  if (FUNCTIONS[name]) return { text: FUNCTIONS[name], next };
  if (GREEK[name]) return { text: GREEK[name], next };
  if (SYMBOLS[name]) return { text: SYMBOLS[name], next };
  if (name === '\\left' || name === '\\right') return { text: '', next };
  if (name === '\\\\') return { text: 'new line', next };
  if (SPACING.includes(name)) return { text: '', next };

  return { text: name.slice(1), next };
}

function speakSegment(latex: string): string {
  const parts: string[] = [];
  let literal = '';

  function flush() {
    if (literal) {
      parts.push(literal);
      literal = '';
    }
  }

  let i = 0;
  while (i < latex.length) {
    const ch = latex[i];

    if (/\s/.test(ch)) {
      flush();
      i += 1;
      continue;
    }

    if (ch === '{') {
      const close = matchBrace(latex, i);
      flush();
      parts.push(
        speakSegment(close < 0 ? latex.slice(i + 1) : latex.slice(i + 1, close)),
      );
      i = close < 0 ? latex.length : close + 1;
      continue;
    }

    if (ch === '}') {
      i += 1;
      continue;
    }

    if (ch === '^' || ch === '_') {
      const arg = readArgument(latex, i + 1);
      flush();
      parts.push(ch === '^' ? speakSuperscript(arg.text) : `sub ${speakSegment(arg.text)}`);
      i = arg.next;
      continue;
    }

    if (ch === '\\') {
      const command = speakCommand(latex, i);
      if (command) {
        flush();
        if (command.text) parts.push(command.text);
        i = command.next;
        continue;
      }
      i += 1;
      continue;
    }

    if (OPERATORS[ch]) {
      flush();
      parts.push(OPERATORS[ch]);
      i += 1;
      continue;
    }

    literal += ch;
    i += 1;
  }

  flush();
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function toNaturalSpeech(latex: string): string {
  if (!latex?.trim()) return 'empty equation';
  return speakSegment(latex.trim()) || 'empty equation';
}
