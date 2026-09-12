import { useEffect, useRef, type KeyboardEvent } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
};

type HelpSection = {
  id: string;
  title: string;
  items: string[];
};

const SECTIONS: HelpSection[] = [
  {
    id: 'help-write',
    title: 'Write',
    items: [
      'From the page name, press Enter for Linear.',
      'Alt+Equals adds an equation, or focuses the empty one.',
      'Alt+N adds a note for explanations or thoughts.',
      'Alt+Delete removes the equation or note you are editing.',
      'Optional Problem number matches the worksheet (1.2, 3a). Leave blank to use Equation or Note numbers.',
    ],
  },
  {
    id: 'help-preview',
    title: 'Hear math',
    items: [
      'Alt+Enter hears the math with your screen reader.',
      'Escape returns to Linear. Your typing stays editable.',
    ],
  },
  {
    id: 'help-move',
    title: 'Move',
    items: [
      'In Linear, arrows only edit.',
      'Alt+Up or Alt+Down changes equation.',
      'Your work lists answers in order. Skip to Your work, then Enter. Arrows browse; Enter edits.',
      'Notes sit with equations in that same list.',
    ],
  },
  {
    id: 'help-correct',
    title: 'Correct a mistake',
    items: [
      'Invalid math stays on the field with a short error.',
      'Control+Shift+Z undoes remove, clear, or page delete.',
      'Control+Z in Linear undoes typing.',
    ],
  },
  {
    id: 'help-review',
    title: 'Review and save',
    items: [
      'Alt+R opens Review. Arrows move; Enter edits; Escape closes.',
      'Control+S saves your draft. Work also autosaves.',
      'Export and backup makes downloadable copies.',
    ],
  },
];

export function HelpDialog({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    if (!dialog.open) dialog.showModal();
    const moveFocus = () => headingRef.current?.focus();
    moveFocus();
    const frame = requestAnimationFrame(moveFocus);
    return () => {
      cancelAnimationFrame(frame);
      if (dialog.open) dialog.close();
    };
  }, [open]);

  function focusables(): HTMLElement[] {
    const dialog = dialogRef.current;
    if (!dialog) return [];
    return Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'h2[tabindex], h3[tabindex], button:not([disabled])',
      ),
    );
  }

  function onDialogKeyDown(e: KeyboardEvent<HTMLDialogElement>) {
    if (e.key !== 'Tab') return;
    const items = focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items.at(-1);
    const focused = document.activeElement;
    if (e.shiftKey && (focused === first || focused === headingRef.current)) {
      e.preventDefault();
      last?.focus();
      return;
    }
    if (!e.shiftKey && focused === last) {
      e.preventDefault();
      first?.focus();
    }
  }

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="class-dialog help-dialog"
      aria-labelledby="help-heading"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={onDialogKeyDown}
    >
      <div className="review-header">
        <h2
          ref={headingRef}
          id="help-heading"
          tabIndex={-1}
          aria-describedby="help-intro"
        >
          Quick help
        </h2>
        <button type="button" onClick={onClose}>
          Close help and return
        </button>
      </div>
      <p id="help-intro">
        Shortcuts are optional. Tab reaches every help topic. On a Mac, use Option for Alt and
        Command for Ctrl.
      </p>

      {SECTIONS.map((section) => {
        const listId = `${section.id}-list`;
        return (
          <section key={section.id} className="help-section" aria-labelledby={section.id}>
            <h3 id={section.id} tabIndex={0} aria-describedby={listId}>
              {section.title}
            </h3>
            <ul id={listId}>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        );
      })}

      <div className="toolbar" role="group" aria-label="Help actions">
        <button type="button" onClick={onClose}>
          Close help and return
        </button>
      </div>
    </dialog>
  );
}
