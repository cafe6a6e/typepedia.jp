import { useState } from "react";
import { ConfirmModal } from "@/components/ConfirmModal";
import { usePageTitle } from "@/hooks/usePageTitle";
import { deleteMemos, formatTimestamp, getMemos, type Memo } from "@/lib/memo";

export function MemoPage() {
  usePageTitle("メモ");
  const [memos, setMemos] = useState<Memo[]>(() => getMemos());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = memos.length > 0 && selected.size === memos.length;
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(memos.map((m) => m.id)));
  };

  const confirmDelete = () => {
    const remaining = deleteMemos([...selected]);
    setMemos(remaining);
    setSelected(new Set());
    setConfirmOpen(false);
  };

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">メモ</h2>
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => setConfirmOpen(true)}
          className="rounded-md bg-red-600/80 px-4 py-2 text-sm font-semibold hover:bg-red-600 disabled:opacity-40"
        >
          一括削除{selected.size > 0 ? `（${selected.size}）` : ""}
        </button>
      </div>

      {memos.length === 0 ? (
        <p className="text-white/50">まだメモがありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/20 text-white/60">
                <th className="w-14 py-2">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                    />
                    削除
                  </label>
                </th>
                <th className="w-44 py-2">登録日時</th>
                <th className="py-2">題材</th>
                <th className="py-2">意味</th>
                <th className="py-2">入力</th>
                <th className="py-2">メモ</th>
              </tr>
            </thead>
            <tbody>
              {memos.map((m) => (
                <tr key={m.id} className="border-b border-white/10 align-top">
                  <td className="py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(m.id)}
                      onChange={() => toggle(m.id)}
                      aria-label="削除対象に選択"
                    />
                  </td>
                  <td className="py-2 font-mono text-white/60 whitespace-nowrap">
                    {formatTimestamp(m.ts)}
                  </td>
                  <td className="py-2 pr-3 text-white/70">{m.category}</td>
                  <td className="py-2 pr-3">{m.disp}</td>
                  <td className="py-2 pr-3 font-mono text-white/70 break-all">
                    {m.q}
                  </td>
                  <td className="py-2 whitespace-pre-wrap">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmOpen && (
        <ConfirmModal
          title="削除の確認"
          message={`選択した ${selected.size} 件のメモを削除します。よろしいですか？`}
          confirmLabel="削除"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
