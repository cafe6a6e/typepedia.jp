import type { KeyboardEvent, ReactNode } from "react";

interface Props {
  /** Called on Escape or a click on the backdrop. */
  onDismiss: () => void;
  /** Extra key handling (e.g. a focus trap); runs after Escape handling. */
  onKeyDown?: (e: KeyboardEvent) => void;
  /** Max-width class for the card (default "max-w-sm"). */
  widthClass?: string;
  children: ReactNode;
}

/** Centered modal overlay: click-outside and Escape both dismiss. */
export function ModalShell({
  onDismiss,
  onKeyDown,
  widthClass = "max-w-sm",
  children,
}: Props) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: overlay click/Esc to dismiss.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onDismiss}
      onKeyDown={(e) => {
        if (e.key === "Escape") onDismiss();
        onKeyDown?.(e);
      }}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stop overlay dismiss. */}
      <div
        className={`w-full ${widthClass} rounded-lg border border-white/15 bg-neutral-900 p-6 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
