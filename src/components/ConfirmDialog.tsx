import { useEffect, useRef } from "react";
import { X } from "./Icons";
export function ConfirmDialog({
  title,
  children,
  onConfirm,
  onClose,
  confirmLabel = "Подтвердить",
}: {
  title: string;
  children: React.ReactNode;
  onConfirm: () => void;
  onClose: () => void;
  confirmLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      onCancel={onClose}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-button" aria-label="Закрыть" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div>{children}</div>
      <div className="button-row">
        <button className="button secondary" onClick={onClose}>
          Отмена
        </button>
        <button
          className="button primary"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
