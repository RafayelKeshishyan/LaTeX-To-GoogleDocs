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
      'For equations, optional Problem number matches the worksheet (1.2, 3a). Leave blank to use Equation numbers.',
      'Alt+Enter and Escape work from Problem number as well as Linear.',
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
      'In Linear, Up or Down moves to the previous or next equation or note.',
      'In a note, use Alt+Up or Alt+Down to move between items.',
      'In Your work or Review, arrows move and Enter edits.',
    ],
  },
  {
    id: 'help-correct',
    title: 'Correct a mistake',
    items: [
      'Invalid math stays on the field with a short error.',
      'Control+Shift+Z undoes remove or page changes.',
      'Control+Z in Linear undoes typing.',
    ],
  },
  {
    id: 'help-review',
    title: 'Review and save',
    items: [
      'Alt+R opens Review. Arrows move; Enter edits; Escape closes.',
      'Control+S saves your draft. Work also autosaves.',
      'Download Word makes an editable Word file to turn in.',
    ],
  },
];

export function HelpDialog({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const frame = requestAnimationFrame(() => {
      if (!dialog.open) dialog.showModal();
    });
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
        'h3[tabindex], button:not([disabled])',
      ),
    );
  }

  function closeDialog() {
    if (dialogRef.current?.open) dialogRef.current.close();
    onClose();
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
        closeDialog();
      }}
      onKeyDown={onDialogKeyDown}
    >
      <div className="review-header">
        <h2
          ref={headingRef}
          id="help-heading"
          tabIndex={-1}
          autoFocus
          aria-describedby="help-intro"
        >
          Quick help
        </h2>
        <button type="button" onClick={closeDialog}>
          Close help and return
        </button>
      </div>
      <p id="help-intro">
        Shortcuts are optional. Tab reaches every help topic. On a Mac, use Option for Alt and
        Command for Ctrl.
      </p>

      {SECTIONS.map((section) => {
        const listId = `${section.id}-list`;
        // The section is left unnamed on purpose: naming it makes it a landmark whose
        // name repeats the focusable heading immediately inside it.
        return (
          <section key={section.id} className="help-section">
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
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
    </dialog>
  );
}
