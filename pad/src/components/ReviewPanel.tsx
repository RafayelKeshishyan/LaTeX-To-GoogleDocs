import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { PadSheet } from '../lib/document';
import { blockListName, emptyEquationCount, equationCount } from '../lib/document';
import { toNaturalSpeech } from '../lib/latexSpeech';
import { latexParseError } from '../lib/mathml';

type Props = {
  sheet: PadSheet;
  activeId: string;
  open: boolean;
  onClose: () => void;
  onJump: (blockId: string) => void;
  onHighlight: (blockId: string) => void;
};

function countLabel(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function withoutTrailingPunctuation(text: string): string {
  return text.trim().replace(/[.!?]+$/, '');
}

export function ReviewPanel({
  sheet,
  activeId,
  open,
  onClose,
  onJump,
  onHighlight,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef(activeId);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const frame = requestAnimationFrame(() => {
      dialog.querySelectorAll<HTMLElement>('[autofocus]').forEach((element) =>
        element.removeAttribute('autofocus'),
      );
      const selectedRow = dialog.querySelector<HTMLElement>('[data-selected="true"]');
      selectedRow?.setAttribute('autofocus', '');
      if (!dialog.open) dialog.showModal();
    });
    return () => {
      cancelAnimationFrame(frame);
      if (dialog.open) dialog.close();
    };
  }, [open]);

  const total = equationCount(sheet);
  const empty = emptyEquationCount(sheet);
  const invalid = sheet.blocks.filter(
    (block) =>
      block.type === 'equation' &&
      !!block.latex.trim() &&
      !!latexParseError(block.latex),
  ).length;
  const totalLabel = countLabel(total, 'equation');
  const summary =
    invalid > 0
      ? `${totalLabel}. ${invalid} invalid. ${
          empty === 0 ? 'None empty.' : `${empty} empty.`
        } Fix invalid equations before continuing.`
      : empty > 0
        ? `${totalLabel}. ${empty} empty. Review empty answers or continue.`
        : `${totalLabel}. Ready to continue.`;
  function focusActiveReviewRow(id = activeIdRef.current) {
    requestAnimationFrame(() => {
      const row = document.getElementById(`review-${id}`);
      if (row instanceof HTMLElement) {
        row.focus();
        return;
      }
      listRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
    });
  }

  function focusRow(id: string) {
    onHighlight(id);
    activeIdRef.current = id;
    focusActiveReviewRow(id);
  }

  function moveFrom(id: string, delta: number) {
    const ids = sheet.blocks.map((block) => block.id);
    const currentIndex = Math.max(0, ids.indexOf(id));
    const nextIndex = Math.min(ids.length - 1, Math.max(0, currentIndex + delta));
    const nextId = ids[nextIndex];
    if (!nextId) return;
    focusRow(nextId);
  }

  function move(delta: number) {
    moveFrom(activeIdRef.current, delta);
  }

  function closeDialog() {
    if (dialogRef.current?.open) dialogRef.current.close();
    onClose();
  }

  function jumpTo(id: string) {
    if (dialogRef.current?.open) dialogRef.current.close();
    onJump(id);
  }

  function onListKeyDown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
      return;
    }
    if (e.altKey) return;
    if (e.key === 'Home') {
      e.preventDefault();
      const firstId = sheet.blocks[0]?.id;
      if (firstId) focusRow(firstId);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      const lastId = sheet.blocks.at(-1)?.id;
      if (lastId) focusRow(lastId);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      jumpTo(activeIdRef.current);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      id="review-panel"
      className="review-panel review-dialog"
      aria-label="Review answers"
      onCancel={(e) => {
        e.preventDefault();
        closeDialog();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Tab') {
          const focusable = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not([disabled]), .review-list button[tabindex="0"]',
            ) || [],
          ).filter((element) => element.tabIndex !== -1);
          const first = focusable[0];
          const last = focusable.at(-1);
          const focused = document.activeElement;
          if (e.shiftKey && (focused === dialogRef.current || focused === first)) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && focused === last) {
            e.preventDefault();
            first?.focus();
          }
          return;
        }
        if (e.ctrlKey || e.metaKey) return;
        if (e.target instanceof Element && e.target.closest('.review-list')) return;
        if (!e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
          e.preventDefault();
          move(e.key === 'ArrowDown' ? 1 : -1);
          return;
        }
        if (!e.altKey && e.key === 'Home') {
          e.preventDefault();
          const firstId = sheet.blocks[0]?.id;
          if (firstId) focusRow(firstId);
          return;
        }
        if (!e.altKey && e.key === 'End') {
          e.preventDefault();
          const lastId = sheet.blocks.at(-1)?.id;
          if (lastId) focusRow(lastId);
          return;
        }
        if (!e.altKey) return;
        if (e.code === 'BracketLeft' || e.key === '[') {
          e.preventDefault();
          move(-1);
        } else if (e.code === 'BracketRight' || e.key === ']') {
          e.preventDefault();
          move(1);
        }
      }}
    >
      <div className="review-header">
        <h2 id="review-heading" aria-hidden="true">
          Review answers
        </h2>
        <button type="button" onClick={closeDialog}>
          Close review
        </button>
      </div>
      <p id="review-summary" className="hint" aria-hidden="true">
        {summary}
      </p>
      <div
        ref={listRef}
        className="review-list"
        role="toolbar"
        aria-label="Answers"
        aria-orientation="vertical"
      >
        {sheet.blocks.map((block) => {
          const label = blockListName(sheet.blocks, block.id);
          const selected = block.id === activeId;
          const optionId = `review-${block.id}`;

          if (block.type === 'prose') {
            const text = block.text.trim() || 'empty';
            return (
              <button
                type="button"
                key={block.id}
                id={optionId}
                className={`block-select${selected ? ' selected' : ''}`}
                tabIndex={selected ? 0 : -1}
                data-selected={selected ? 'true' : undefined}
                aria-label={`${label}, ${withoutTrailingPunctuation(text)}`}
                onKeyDown={onListKeyDown}
                onClick={() => jumpTo(block.id)}
              >
                {label}
                <span className="block-preview" aria-hidden="true">
                  {text}
                </span>
              </button>
            );
          }

          const parseError = block.latex.trim() ? latexParseError(block.latex) : null;
          const spoken = !block.latex.trim()
            ? 'Empty. Add an answer'
            : parseError
              ? `Invalid. ${parseError}`
              : toNaturalSpeech(block.latex);
          return (
            <button
              type="button"
              key={block.id}
              id={optionId}
              className={`block-select${selected ? ' selected' : ''}`}
              tabIndex={selected ? 0 : -1}
              data-selected={selected ? 'true' : undefined}
              aria-label={`${label}, ${withoutTrailingPunctuation(spoken)}`}
              onKeyDown={onListKeyDown}
              onClick={() => jumpTo(block.id)}
            >
              {label}
              {block.latex.trim() ? (
                <span className="block-preview" aria-hidden="true">
                  {block.latex}
                </span>
              ) : (
                <span className="block-preview empty" aria-hidden="true">
                  (empty — add an answer)
                </span>
              )}
            </button>
          );
        })}
      </div>
    </dialog>
  );
}
