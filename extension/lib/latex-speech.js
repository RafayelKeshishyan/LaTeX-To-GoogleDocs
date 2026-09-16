/**
 * latex-speech.js — LaTeX to natural math speech (shared by content script and side panel)
 *
 * Speech is produced by scanning the LaTeX and matching braces, not by
 * pattern-replacing whole expressions. Regexes cannot describe balanced
 * braces, so anything nested — a fraction holding a root, an exponent written
 * as ^{2} — has to be walked rather than matched.
 */

const LatexSpeech = (() => {
  const GREEK = {
    '\\alpha': 'alpha', '\\beta': 'beta', '\\gamma': 'gamma', '\\delta': 'delta',
    '\\epsilon': 'epsilon', '\\zeta': 'zeta', '\\eta': 'eta', '\\theta': 'theta',
    '\\iota': 'iota', '\\kappa': 'kappa', '\\lambda': 'lambda', '\\mu': 'mu',
    '\\nu': 'nu', '\\xi': 'xi', '\\pi': 'pi', '\\rho': 'rho',
    '\\sigma': 'sigma', '\\tau': 'tau', '\\upsilon': 'upsilon', '\\phi': 'phi',
    '\\chi': 'chi', '\\psi': 'psi', '\\omega': 'omega'
  };

  const SYMBOLS = {
    '\\pm': 'plus or minus', '\\mp': 'minus or plus',
    '\\times': 'times', '\\div': 'divided by', '\\cdot': 'dot',
    '\\leq': 'less than or equal to', '\\geq': 'greater than or equal to',
    '\\le': 'less than or equal to', '\\ge': 'greater than or equal to',
    '\\neq': 'not equal to', '\\approx': 'approximately equal to',
    '\\infty': 'infinity', '\\ldots': 'dot dot dot', '\\dots': 'dot dot dot',
    '\\to': 'approaches', '\\rightarrow': 'approaches',
    '\\{': 'open brace', '\\}': 'close brace', '\\|': 'vertical bar',
    '\\%': 'percent', '\\$': 'dollar'
  };

  const FUNCTIONS = {
    '\\sin': 'sine', '\\cos': 'cosine', '\\tan': 'tangent',
    '\\csc': 'cosecant', '\\sec': 'secant', '\\cot': 'cotangent',
    '\\arcsin': 'arc sine', '\\arccos': 'arc cosine', '\\arctan': 'arc tangent',
    '\\log': 'log', '\\ln': 'natural log', '\\exp': 'exponential'
  };

  const BIG_OPERATORS = {
    '\\sum': 'the sum', '\\prod': 'the product',
    '\\int': 'the integral', '\\lim': 'the limit'
  };

  const OPERATORS = {
    '=': 'equals', '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by',
    '(': 'open parenthesis', ')': 'close parenthesis',
    '[': 'open bracket', ']': 'close bracket',
    '<': 'less than', '>': 'greater than', ',': 'comma'
  };

  const ROOT_NAMES = { 2: 'square', 3: 'cube', 4: 'fourth', 5: 'fifth' };

  const SPACING_COMMANDS = ['\\,', '\\;', '\\:', '\\!', '\\ ', '\\quad', '\\qquad'];

  function keystroke(char) {
    const map = {
      '=': 'equals',
      '+': 'plus',
      '-': 'minus',
      '*': 'times',
      '/': 'slash',
      '^': 'caret',
      '_': 'underscore',
      '{': 'left brace',
      '}': 'right brace',
      '(': 'open parenthesis',
      ')': 'close parenthesis',
      '[': 'open bracket',
      ']': 'close bracket',
      '\\': 'backslash',
      ' ': 'space',
      '.': 'dot',
      ',': 'comma',
      '|': 'vertical bar',
      '<': 'less than',
      '>': 'greater than',
      ';': 'semicolon',
      ':': 'colon'
    };
    return map[char] || char;
  }

  function editingKey(key) {
    const map = {
      Backspace: 'backspace',
      Delete: 'delete',
      Enter: 'new line',
      Tab: 'tab',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
      Home: 'home',
      End: 'end'
    };
    return map[key] || null;
  }

  /** Index of the brace closing the group that opens at `open`, or -1. */
  function matchBrace(latex, open) {
    let depth = 0;
    for (let i = open; i < latex.length; i++) {
      const ch = latex[i];
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  /**
   * Read one argument: a braced group, a whole command, or a single
   * character — the same three shapes LaTeX itself accepts.
   */
  function readArgument(latex, start) {
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

  /** The optional index in \sqrt[3]{x}. */
  function readOptional(latex, start) {
    if (latex[start] !== '[') return null;
    const close = latex.indexOf(']', start);
    if (close < 0) return null;
    return { text: latex.slice(start + 1, close), next: close + 1 };
  }

  function rootPrefix(index) {
    const trimmed = (index || '').trim();
    if (!trimmed) return 'the square root of';
    if (ROOT_NAMES[trimmed]) return `the ${ROOT_NAMES[trimmed]} root of`;
    return `the ${speakSegment(trimmed)}th root of`;
  }

  function speakSuperscript(text) {
    const trimmed = text.trim();
    if (trimmed === '2') return 'squared';
    if (trimmed === '3') return 'cubed';
    return `to the power of ${speakSegment(trimmed)}`;
  }

  /** Sums, products, integrals and limits carry their bounds as scripts. */
  function speakBigOperator(name, latex, start) {
    let next = start;
    let sub = null;
    let sup = null;

    for (let guard = 0; guard < 2; guard++) {
      if (latex[next] === '_' && sub === null) {
        const arg = readArgument(latex, next + 1);
        sub = arg.text;
        next = arg.next;
      } else if (latex[next] === '^' && sup === null) {
        const arg = readArgument(latex, next + 1);
        sup = arg.text;
        next = arg.next;
      } else {
        break;
      }
    }

    const label = BIG_OPERATORS[name];

    if (name === '\\lim') {
      return { text: sub ? `${label} as ${speakSegment(sub)}` : label, next };
    }
    if (sub && sup) {
      return { text: `${label} from ${speakSegment(sub)} to ${speakSegment(sup)}`, next };
    }
    if (sub) return { text: `${label} from ${speakSegment(sub)}`, next };
    if (sup) return { text: `${label} to ${speakSegment(sup)}`, next };
    return { text: label, next };
  }

  function speakCommand(latex, start) {
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
        next: denominator.next
      };
    }

    if (name === '\\sqrt') {
      const index = readOptional(latex, next);
      if (index) next = index.next;
      const body = readArgument(latex, next);
      return { text: `${rootPrefix(index && index.text)} ${speakSegment(body.text)}`, next: body.next };
    }

    if (name === '\\text' || name === '\\mathrm' || name === '\\operatorname') {
      const body = readArgument(latex, next);
      return { text: body.text.trim(), next: body.next };
    }

    if (BIG_OPERATORS[name]) return speakBigOperator(name, latex, next);
    if (FUNCTIONS[name]) return { text: FUNCTIONS[name], next };
    if (GREEK[name]) return { text: GREEK[name], next };
    if (SYMBOLS[name]) return { text: SYMBOLS[name], next };

    // \left and \right only size the delimiter that follows; let the loop read it.
    if (name === '\\left' || name === '\\right') return { text: '', next };
    if (name === '\\\\') return { text: 'new line', next };
    if (SPACING_COMMANDS.indexOf(name) !== -1) return { text: '', next };

    return { text: name.slice(1), next };
  }

  function speakSegment(latex) {
    const parts = [];
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
        parts.push(speakSegment(close < 0 ? latex.slice(i + 1) : latex.slice(i + 1, close)));
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

  function toNaturalSpeech(latex) {
    if (!latex || !latex.trim()) return 'empty equation';
    return speakSegment(latex.trim()) || 'empty equation';
  }

  return { keystroke, editingKey, toNaturalSpeech };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LatexSpeech;
}

if (typeof window !== 'undefined') {
  window.LatexSpeech = LatexSpeech;
}
