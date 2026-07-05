import { CategorySelect } from "@/components/CategorySelect";

interface Props {
  loading: boolean;
  username: string;
  count: number;
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
}

/** Idle screen: pick a category, then press Space to start. */
export function StartScreen({
  loading,
  username,
  count,
  categories,
  selected,
  onSelect,
}: Props) {
  return (
    <div className="text-center">
      <h2 className="text-4xl font-bold mb-1">Typepedia</h2>
      <p className="text-sm text-white/50 mb-8">
        タイピングしながら知識が増える
      </p>

      <CategorySelect
        categories={categories}
        selected={selected}
        onSelect={onSelect}
      />

      {loading ? (
        <p className="text-white/60">読み込み中…</p>
      ) : (
        <>
          <p className="text-lg mb-2">
            <kbd className="px-2 py-1 bg-white/10 rounded">Space</kbd>{" "}
            を押して開始
          </p>
          <p className="text-sm text-white/40">
            出題数 {count} 問
            {username ? ` ・ ${username}` : "（設定でユーザー名未設定）"}
          </p>
        </>
      )}
    </div>
  );
}
