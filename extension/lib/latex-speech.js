/**
 * latex-speech.js — LaTeX to natural math speech (shared by content script and side panel)
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

  function toNaturalSpeech(latex) {
    if (!latex || !latex.trim()) return 'empty equation';

    let s = latex.trim();

    s = s.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, (_, num, den) => {
      return `the fraction with numerator ${toNaturalSpeech(num)} and denominator ${toNaturalSpeech(den)}`;
    });

    s = s.replace(/\\sqrt\{([^}]*)\}/g, (_, inner) => {
      return `the square root of ${toNaturalSpeech(inner)}`;
    });

    s = s.replace(/\^\{([^}]*)\}/g, (_, exp) => ` to the power of ${toNaturalSpeech(exp)}`);
    s = s.replace(/\^(\w)/g, (_, exp) => (exp === '2' ? ' squared' : ` to the power of ${exp}`));

    s = s.replace(/_\{([^}]*)\}/g, (_, sub) => ` sub ${toNaturalSpeech(sub)}`);
    s = s.replace(/_(\w)/g, (_, sub) => ` sub ${sub}`);

    for (const [cmd, spoken] of Object.entries({ ...GREEK, ...SYMBOLS })) {
      s = s.split(cmd).join(' ' + spoken + ' ');
    }

    s = s.replace(/\\([a-zA-Z]+)/g, '$1');
    s = s.replace(/=/g, ' equals ');
    s = s.replace(/\+/g, ' plus ');
    s = s.replace(/-/g, ' minus ');
    s = s.replace(/\*/g, ' times ');
    s = s.replace(/\//g, ' divided by ');
    s = s.replace(/\(/g, ' open parenthesis ');
    s = s.replace(/\)/g, ' close parenthesis ');
    s = s.replace(/\s+/g, ' ').trim();

    return s || 'empty equation';
  }

  return { keystroke, editingKey, toNaturalSpeech };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LatexSpeech;
}
