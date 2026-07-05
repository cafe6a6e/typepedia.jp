import { useState } from "react";

interface Props {
  category: string;
  disp: string;
  q: string;
  onCancel: () => void;
  onSave: (note: string) => void;
}

/** Modal to jot a note about the current question, shown during play. */
export function MemoModal({ category, disp, q, onCancel, onSave }: Props) {
  const [note, setNote] = useState("");

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: overlay click-to-dismiss.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stop overlay dismiss. */}
      <div
        className="w-full max-w-lg rounded-lg border border-white/15 bg-neutral-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-bold">メモ</h3>

        <div className="mb-2">
          <span className="text-xs text-white/50">題材</span>
          <p className="rounded-md bg-white/5 px-3 py-2 text-sm">{category}</p>
        </div>
        <div className="mb-2">
          <span className="text-xs text-white/50">意味 (disp)</span>
          <p className="rounded-md bg-white/5 px-3 py-2 text-sm">{disp}</p>
        </div>
        <div className="mb-4">
          <span className="text-xs text-white/50">入力 (q)</span>
          <p className="rounded-md bg-white/5 px-3 py-2 font-mono text-sm break-all">
            {q}
          </p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/50">メモ</span>
          {/* biome-ignore lint/a11y/noAutofocus: focus the note field on open. */}
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className="w-full resize-y rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm"
            placeholder="この問題についてのメモ…"
          />
        </label>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm text-white/60 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(note)}
            className="rounded-md bg-green-600 px-5 py-2 text-sm font-semibold hover:bg-green-500"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
