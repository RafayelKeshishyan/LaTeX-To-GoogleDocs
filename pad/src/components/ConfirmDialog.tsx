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

  function closeDialog(action: () => void) {
    if (dialogRef.current?.open) dialogRef.current.close();
    action();
  }

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

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="class-dialog confirm-dialog"
      tabIndex={-1}
      aria-label="Confirmation"
      onCancel={(e) => {
        e.preventDefault();
        closeDialog(onCancel);
      }}
    >
      <h2 id="confirm-heading" tabIndex={-1} autoFocus>
        {title}
      </h2>
      <p id="confirm-message" aria-hidden="true">{message}</p>
      <div className="toolbar">
        <button type="button" onClick={() => closeDialog(onCancel)}>
          Cancel
        </button>
        <button
          type="button"
          className="danger-button"
          onClick={() => closeDialog(onConfirm)}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
