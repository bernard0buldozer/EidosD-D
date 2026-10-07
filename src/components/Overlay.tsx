import { useEffect, useRef, type ReactNode } from "react";
export function Overlay({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="folio-dialog"
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label={`Закрыть: ${title}`}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="folio-content">{children}</div>
    </dialog>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <input
        aria-label={label}
        type="number"
        step="1"
        min={min}
        value={value ?? ""}
        placeholder="—"
        onChange={(e) => {
          if (e.target.value === "") onChange(null);
          else {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(Math.max(min, Math.trunc(v)));
          }
        }}
      />
    </label>
  );
}
