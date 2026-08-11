import { type KeyboardEvent, type ReactNode, useRef } from "react";

interface Props {
  /** Called on Escape or a click on the backdrop. */
  onDismiss: () => void;
  /** Extra key handling; runs after Escape and focus-trap handling. */
  onKeyDown?: (e: KeyboardEvent) => void;
  /** Max-width class for the card (default "max-w-sm"). */
  widthClass?: string;
  children: ReactNode;
}

/** Elements that can receive keyboard focus, in document order. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Centered modal overlay: click-outside and Escape both dismiss. Tab / Shift+Tab
 * are trapped inside the card so focus can't escape to the page behind it.
 */
export function ModalShell({
  onDismiss,
  onKeyDown,
  widthClass = "max-w-sm",
  children,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onDismiss();
      onKeyDown?.(e);
      return;
    }

    // Focus trap: wrap Tab at the last element and Shift+Tab at the first.
    if (e.key === "Tab" && cardRef.current) {
      const nodes = cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (nodes.length > 0) {
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;
        const inside = cardRef.current.contains(active);
        if (e.shiftKey && (active === first || !inside)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !inside)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    onKeyDown?.(e);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: overlay click/Esc to dismiss.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      // 背景そのものを押したときだけ閉じる。カード内のクリックは target が
      // 子要素になるので、カード側で stopPropagation する必要がない。
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={cardRef}
        className={`w-full ${widthClass} rounded-lg border border-white/15 bg-neutral-900 p-6 shadow-xl`}
      >
        {children}
      </div>
    </div>
  );
}
