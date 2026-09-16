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
  /** Convert clipboard MathML (or other wrappers) into Linear before inserting. */
  normalizePaste?: (text: string) => string;
  /** Student UI: one line so Enter cannot insert a confusing blank line. */
  singleLine?: boolean;
  /** Move between worksheet items with plain Up/Down in the one-line student editor. */
  onNavigate?: (direction: -1 | 1) => void;
};

export function LinearEditor({
  latex,
  onChange,
  onCommit,
  accessibleName,
  error,
  focusRequest = 0,
  caret = 'end',
  normalizePaste,
  singleLine = false,
  onNavigate,
}: Props) {
  const id = useId();
  const errorId = `${id}-error`;
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!focusRequest) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const pos = caret === 'start' ? 0 : el.value.length;
    el.setSelectionRange(pos, pos);
  }, [focusRequest, caret]);

  function onPaste(e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (!normalizePaste) return;
    const raw = e.clipboardData.getData('text/plain');
    const next = normalizePaste(raw);
    if (!next || next === raw) return;
    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const merged = el.value.slice(0, start) + next + el.value.slice(end);
    onChange(merged);
    requestAnimationFrame(() => {
      const pos = start + next.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.altKey && e.key === 'Enter') {
      e.preventDefault();
      onCommit();
      return;
    }
    if (
      singleLine &&
      !e.altKey &&
      !e.ctrlKey &&
      !e.metaKey &&
      (e.key === 'ArrowUp' || e.key === 'ArrowDown')
    ) {
      e.preventDefault();
      e.stopPropagation();
      onNavigate?.(e.key === 'ArrowUp' ? -1 : 1);
      return;
    }
    if (singleLine && e.key === 'Enter') {
      e.preventDefault();
    }
  }

  const fieldProps = {
    id,
    value: latex,
    spellCheck: false as const,
    autoComplete: 'off',
    className: 'linear-input',
    'aria-label': accessibleName,
    'aria-invalid': (error ? true : undefined) as boolean | undefined,
    'aria-errormessage': error ? errorId : undefined,
    'aria-describedby': error ? errorId : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    onPaste,
    onKeyDown,
  };

  return (
    <div className="linear-editor">
      <label htmlFor={id}>Linear</label>
      {singleLine ? (
        <input
          {...fieldProps}
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          autoCorrect="off"
          autoCapitalize="off"
        />
      ) : (
        <textarea
          {...fieldProps}
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          rows={4}
          autoCorrect="off"
          autoCapitalize="off"
        />
      )}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
      <p className="hint" aria-hidden="true">
        Alt+Enter hears math. Escape returns.
        {singleLine
          ? ' Up or Down changes item. Type on one line here.'
          : ' Alt+Up or Alt+Down changes item. Arrow keys edit here.'}
      </p>
    </div>
  );
}
