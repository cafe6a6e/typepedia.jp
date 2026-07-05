import { useState } from "react";
import { ModalShell } from "@/components/ModalShell";

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

  const fields: [string, string, boolean][] = [
    ["題材", category, false],
    ["意味 (disp)", disp, false],
    ["入力 (q)", q, true],
  ];

  return (
    <ModalShell onDismiss={onCancel} widthClass="max-w-lg">
      <h3 className="mb-4 text-lg font-bold">メモ</h3>

      {fields.map(([label, value, mono]) => (
        <div key={label} className="mb-2">
          <span className="text-xs text-white/50">{label}</span>
          <p
            className={`rounded-md bg-white/5 px-3 py-2 text-sm ${
              mono ? "font-mono break-all" : ""
            }`}
          >
            {value}
          </p>
        </div>
      ))}

      <label className="mt-2 flex flex-col gap-1">
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
    </ModalShell>
  );
}
