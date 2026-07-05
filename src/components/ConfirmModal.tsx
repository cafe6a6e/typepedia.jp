import { type KeyboardEvent, useEffect, useRef } from "react";
import { ModalShell } from "@/components/ModalShell";

interface Props {
  title: string;
  message: string;
  cancelLabel?: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation dialog. On open, focus moves to Cancel and Tab / Shift+Tab cycle
 * only between the Cancel and confirm buttons (focus trap).
 */
export function ConfirmModal({
  title,
  message,
  cancelLabel = "Cancel",
  confirmLabel,
  onCancel,
  onConfirm,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const trapTab = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    // Only two focusable controls, so Tab / Shift+Tab toggle between them.
    e.preventDefault();
    const next =
      document.activeElement === cancelRef.current ? confirmRef : cancelRef;
    next.current?.focus();
  };

  return (
    <ModalShell onDismiss={onCancel} onKeyDown={trapTab}>
      <h3 className="mb-2 text-lg font-bold">{title}</h3>
      <p className="mb-5 text-sm text-white/70">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          className="rounded-md px-4 py-2 text-sm text-white/60 hover:bg-white/5"
        >
          {cancelLabel}
        </button>
        <button
          ref={confirmRef}
          type="button"
          onClick={onConfirm}
          className="rounded-md bg-red-600 px-5 py-2 text-sm font-semibold hover:bg-red-500"
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}
