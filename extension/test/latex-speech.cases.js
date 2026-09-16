/**
 * Expected natural math speech for each LaTeX input.
 * Shared by latex-speech.test.html (browser) and latex-speech.test.js (Node).
 */

const LATEX_SPEECH_CASES = [
  { group: 'Empty input', latex: '', expect: 'empty equation' },
  { group: 'Empty input', latex: '   ', expect: 'empty equation' },

  {
    group: 'Acceptance equation',
    latex: 'y=\\sqrt{x + 3}',
    expect: 'y equals the square root of x plus 3'
  },

  { group: 'Tutorial 1 — exponents', latex: 'x^2', expect: 'x squared' },
  { group: 'Tutorial 1 — exponents', latex: '2^{10}', expect: '2 to the power of 10' },
  {
    group: 'Tutorial 1 — exponents',
    latex: 'a^2 + b^2 = c^2',
    expect: 'a squared plus b squared equals c squared'
  },

  {
    group: 'Tutorial 2 — fractions',
    latex: '\\frac{3}{4}',
    expect: 'the fraction with numerator 3 and denominator 4'
  },
  {
    group: 'Tutorial 2 — fractions',
    latex: '\\frac{a}{b}',
    expect: 'the fraction with numerator a and denominator b'
  },
  {
    group: 'Tutorial 2 — fractions',
    latex: '\\frac{x+1}{x-1}',
    expect: 'the fraction with numerator x plus 1 and denominator x minus 1'
  },

  { group: 'Tutorial 3 — roots', latex: '\\sqrt{16}', expect: 'the square root of 16' },
  {
    group: 'Tutorial 3 — roots',
    latex: '\\sqrt{x^2 + y^2}',
    expect: 'the square root of x squared plus y squared'
  },

  {
    group: 'Tutorial 4 — quadratic',
    latex: 'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}',
    expect:
      'x equals the fraction with numerator minus b plus or minus ' +
      'the square root of b squared minus 4ac and denominator 2a'
  },
  { group: 'Tutorial 4 — quadratic', latex: 'b^2 - 4ac', expect: 'b squared minus 4ac' },
  {
    group: 'Tutorial 4 — quadratic',
    latex: 'x^2 + 5x + 6 = 0',
    expect: 'x squared plus 5x plus 6 equals 0'
  },

  {
    group: 'Nesting (previously broken)',
    latex: '\\frac{x^{2}}{y}',
    expect: 'the fraction with numerator x squared and denominator y'
  },
  {
    group: 'Nesting (previously broken)',
    latex: '\\frac{\\frac{1}{2}}{3}',
    expect:
      'the fraction with numerator the fraction with numerator 1 and denominator 2 ' +
      'and denominator 3'
  },
  {
    group: 'Nesting (previously broken)',
    latex: '\\sqrt{\\frac{a}{b}}',
    expect: 'the square root of the fraction with numerator a and denominator b'
  },
  {
    group: 'Nesting (previously broken)',
    latex: 'x^{\\frac{1}{2}}',
    expect: 'x to the power of the fraction with numerator 1 and denominator 2'
  },

  { group: 'Roots with an index', latex: '\\sqrt[3]{8}', expect: 'the cube root of 8' },
  { group: 'Roots with an index', latex: '\\sqrt[4]{16}', expect: 'the fourth root of 16' },
  { group: 'Roots with an index', latex: '\\sqrt[n]{x}', expect: 'the nth root of x' },

  { group: 'Subscripts', latex: 'x_1', expect: 'x sub 1' },
  { group: 'Subscripts', latex: 'a_{ij}', expect: 'a sub ij' },

  {
    group: 'Large operators',
    latex: '\\sum_{i=1}^{n} i',
    expect: 'the sum from i equals 1 to n i'
  },
  { group: 'Large operators', latex: '\\int_0^1 x', expect: 'the integral from 0 to 1 x' },
  { group: 'Large operators', latex: '\\lim_{x \\to 0}', expect: 'the limit as x approaches 0' },

  { group: 'Symbols and functions', latex: '\\alpha + \\beta', expect: 'alpha plus beta' },
  { group: 'Symbols and functions', latex: 'x \\leq 5', expect: 'x less than or equal to 5' },
  { group: 'Symbols and functions', latex: '\\pi r^2', expect: 'pi r squared' },
  { group: 'Symbols and functions', latex: '\\sin x', expect: 'sine x' },

  {
    group: 'Delimiters and text',
    latex: '\\left( x + 1 \\right)',
    expect: 'open parenthesis x plus 1 close parenthesis'
  },
  { group: 'Delimiters and text', latex: '\\text{if } x > 0', expect: 'if x greater than 0' },

  {
    group: 'Cubed',
    latex: 'x^3 + x^2',
    expect: 'x cubed plus x squared'
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LATEX_SPEECH_CASES;
}
