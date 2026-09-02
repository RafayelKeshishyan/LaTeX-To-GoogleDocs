/**
 * latex-speech.js — LaTeX to natural math speech (ClearSpeak-style basics)
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
    '\\neq': 'not equal to', '\\approx': 'approximately equal to',
    '\\infty': 'infinity', '\\ldots': 'dot dot dot'
  };

  /**
   * Announce a single keystroke in Linear mode.
   */
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
      ' ': 'space'
    };
    return map[char] || char;
  }

  /**
   * Announce a LaTeX token being typed (e.g. \sqrt).
   */
  function tokenSpeech(token) {
    if (token === '\\sqrt') return 'backslash sqrt';
    if (token === '\\frac') return 'backslash frac';
    if (GREEK[token]) return 'backslash ' + GREEK[token];
    if (SYMBOLS[token]) return 'backslash ' + SYMBOLS[token].replace(/^\\/, '');
    if (token.startsWith('\\')) return token.slice(1).split('').join(' ');
    return token;
  }

  /**
   * Convert LaTeX to natural math speech for Professional mode.
   */
  function toNaturalSpeech(latex) {
    if (!latex || !latex.trim()) return 'empty equation';

    let s = latex.trim();

    // Replace known commands (longest first)
    const allCommands = Object.keys({ ...GREEK, ...SYMBOLS })
      .concat(['\\sqrt', '\\frac', '\\pm', '\\mp'])
      .sort((a, b) => b.length - a.length);

    // Handle \frac{a}{b}
    s = s.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, (_, num, den) => {
      return `the fraction with numerator ${toNaturalSpeech(num)} and denominator ${toNaturalSpeech(den)}`;
    });

    // Handle \sqrt{...}
    s = s.replace(/\\sqrt\{([^}]*)\}/g, (_, inner) => {
      return `the square root of ${toNaturalSpeech(inner)}`;
    });

    // Handle ^{...} and ^x
    s = s.replace(/\^\{([^}]*)\}/g, (_, exp) => ` to the power of ${toNaturalSpeech(exp)}`);
    s = s.replace(/\^(\w)/g, (_, exp) => ` squared`.replace('squared', exp === '2' ? 'squared' : ` to the power of ${exp}`));

    // Handle _{...} subscripts
    s = s.replace(/_\{([^}]*)\}/g, (_, sub) => ` sub ${toNaturalSpeech(sub)}`);
    s = s.replace(/_(\w)/g, (_, sub) => ` sub ${sub}`);

    // Greek and symbols
    for (const [cmd, spoken] of Object.entries({ ...GREEK, ...SYMBOLS })) {
      s = s.split(cmd).join(' ' + spoken + ' ');
    }

    // Remaining backslash commands
    s = s.replace(/\\([a-zA-Z]+)/g, '$1');

    // Operators and punctuation
    s = s.replace(/=/g, ' equals ');
    s = s.replace(/\+/g, ' plus ');
    s = s.replace(/-/g, ' minus ');
    s = s.replace(/\*/g, ' times ');
    s = s.replace(/\//g, ' divided by ');
    s = s.replace(/\(/g, ' open parenthesis ');
    s = s.replace(/\)/g, ' close parenthesis ');

    // Collapse whitespace
    s = s.replace(/\s+/g, ' ').trim();

    return s || 'empty equation';
  }

  return {
    keystroke,
    tokenSpeech,
    toNaturalSpeech
  };
})();

if (typeof window !== 'undefined') {
  window.LatexSpeech = LatexSpeech;
}
