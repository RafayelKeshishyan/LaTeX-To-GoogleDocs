import { useEffect, useId, useRef } from 'react';

type Props = {
  latex: string;
  onChange: (latex: string) => void;
  onCommit: () => void;
  accessibleName: string;
  error?: string | null;
  /** Increment to move keyboard focus into this field after render. */
  focusRequest?: number;
  caret?: 'start' | 'end';
};

export function LinearEditor({
  latex,
  onChange,
  onCommit,
  accessibleName,
  error,
  focusRequest = 0,
  caret = 'end',
}: Props) {
  const id = useId();
  const errorId = `${id}-error`;
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!focusRequest) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const pos = caret === 'start' ? 0 : el.value.length;
    el.setSelectionRange(pos, pos);
  }, [focusRequest, caret]);

  return (
    <div className="linear-editor">
      <label htmlFor={id}>Linear</label>
      <textarea
        ref={inputRef}
        id={id}
        value={latex}
        rows={4}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        aria-label={accessibleName}
        aria-invalid={error ? 'true' : undefined}
        aria-errormessage={error ? errorId : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.altKey && e.key === 'Enter') {
            e.preventDefault();
            onCommit();
          }
        }}
      />
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
      <p className="hint" aria-hidden="true">
        Alt+Enter hears math. Escape returns. Alt+Up or Alt+Down changes equation.
        Arrow keys edit here.
      </p>
    </div>
  );
}
