import { useState } from "react";
import { ModalShell } from "@/components/ModalShell";

interface Props {
  category: string;
  disp: string;
  q: string;
  /** Current 学習中 status for this question. */
  initialLearning: boolean;
  /** Current 完全に覚えた status for this question. */
  initialMastered: boolean;
  onCancel: () => void;
  onSave: (note: string, learning: boolean, mastered: boolean) => void;
}

/** Modal to jot a note about the current question, shown during play. */
export function MemoModal({
  category,
  disp,
  q,
  initialLearning,
  initialMastered,
  onCancel,
  onSave,
}: Props) {
  const [note, setNote] = useState("");
  const [learning, setLearning] = useState(initialLearning);
  const [mastered, setMastered] = useState(initialMastered);

  // 学習中 → 完全に覚えた は進行段階。「覚えた」を ON にしたら復習ローテーション
  // から外すため 学習中 を自動 OFF にする。
  const toggleMastered = () =>
    setMastered((v) => {
      const next = !v;
      if (next) setLearning(false);
      return next;
    });
  const toggleLearning = () =>
    setLearning((v) => {
      const next = !v;
      if (next) setMastered(false);
      return next;
    });

  const fields: [string, string, boolean][] = [
    ["題材", category, false],
    ["意味 (disp)", disp, false],
    ["入力 (q)", q, true],
  ];

  return (
    <ModalShell onDismiss={onCancel} widthClass="max-w-lg">
      <h3 className="mb-4 text-lg font-bold">メモ</h3>

      {/* 学習中 toggle — focused on open so it can be switched immediately. */}
      <div className="mb-3 flex items-center justify-between rounded-md bg-white/5 px-3 py-2">
        <div>
          <span className="text-sm font-semibold">学習中</span>
          <p className="text-xs text-white/40">
            オンにすると、この題材で繰り返し復習出題されます
          </p>
        </div>
        <button
          type="button"
          // biome-ignore lint/a11y/noAutofocus: focus the learning toggle on open.
          autoFocus
          role="switch"
          aria-checked={learning}
          aria-label="学習中"
          onClick={toggleLearning}
          className={`flex h-7 w-12 shrink-0 items-center rounded-full px-1 transition-colors ${
            learning ? "bg-green-500" : "bg-white/20"
          }`}
        >
          <span
            className={`h-5 w-5 rounded-full bg-white transition-transform ${
              learning ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* 完全に覚えた toggle — marks the sentence as mastered (進捗率に反映)。 */}
      <div className="mb-4 flex items-center justify-between rounded-md bg-white/5 px-3 py-2">
        <div>
          <span className="text-sm font-semibold">完全に覚えた</span>
          <p className="text-xs text-white/40">
            進捗率に加算されます（設定で今後の出題から除外できます）
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={mastered}
          aria-label="完全に覚えた"
          onClick={toggleMastered}
          className={`flex h-7 w-12 shrink-0 items-center rounded-full px-1 transition-colors ${
            mastered ? "bg-sky-500" : "bg-white/20"
          }`}
        >
          <span
            className={`h-5 w-5 rounded-full bg-white transition-transform ${
              mastered ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

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
        <textarea
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
          onClick={() => onSave(note, learning, mastered)}
          className="rounded-md bg-green-600 px-5 py-2 text-sm font-semibold hover:bg-green-500"
        >
          OK
        </button>
      </div>
    </ModalShell>
  );
}
