import { useEffect, useRef } from 'react';

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: Props) {
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

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="class-dialog confirm-dialog"
      role="alertdialog"
      aria-labelledby="confirm-heading"
      aria-describedby="confirm-message"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 ref={headingRef} id="confirm-heading" tabIndex={-1}>
        {title}
      </h2>
      <p id="confirm-message">{message}</p>
      <div className="toolbar" role="group" aria-label="Confirmation actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="danger-button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
