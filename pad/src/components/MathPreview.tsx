import { memo, useEffect, useRef } from 'react';
import { latexToMathML, renderKatexHtml } from '../lib/mathml';
import 'katex/dist/katex.min.css';

type Props = {
  latex: string;
  active?: boolean;
  /** Increment to move keyboard focus here for MathCAT / VoiceOver. */
  focusToken?: number;
  onFocusFallback?: () => void;
};

const VisualMath = memo(function VisualMath({ html }: { html: string }) {
  return (
    <div
      className="visual-math"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

const AccessibleMath = memo(function AccessibleMath({ mathml }: { mathml: string }) {
  return (
    <div
      className="accessible-math"
      dangerouslySetInnerHTML={{ __html: mathml }}
    />
  );
});

/**
 * Live preview. Hidden from the accessibility tree while typing so incomplete
 * MathML / KaTeX errors are not spoken. Alt+Enter exposes and focuses it.
 */
export function MathPreview({
  latex,
  active = false,
  focusToken = 0,
  onFocusFallback,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const focusFallbackRef = useRef(onFocusFallback);
  const { html, error } = renderKatexHtml(latex);
  const mathml = latexToMathML(latex);
  const focusableMathml = mathml.replace('<math', '<math tabindex="0"');

  useEffect(() => {
    focusFallbackRef.current = onFocusFallback;
  }, [onFocusFallback]);

  useEffect(() => {
    if (!active || !focusToken) return;
    const frame = requestAnimationFrame(() => {
      const host = hostRef.current;
      const math = host?.querySelector<HTMLElement>('.accessible-math > math');
      math?.focus();
      if (!math || document.activeElement !== math) {
        host?.focus();
        focusFallbackRef.current?.();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [active, focusToken, focusableMathml]);

  if (!latex.trim()) {
    return (
      <div className="math-preview empty" aria-hidden="true">
        Preview empty
      </div>
    );
  }

  if (error || !html || (active && !mathml)) {
    return (
      <div className="math-preview error" aria-hidden="true">
        Preview unavailable
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      className={`math-preview${active ? ' active' : ''}`}
      aria-hidden={active ? undefined : true}
      tabIndex={active ? -1 : undefined}
    >
      <VisualMath html={html} />
      {active && <AccessibleMath mathml={focusableMathml} />}
    </div>
  );
}
