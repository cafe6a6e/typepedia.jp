import { categoryLabel } from "@/lib/categories";

/** Learned / total counts for a single category. */
export interface CategoryProgress {
  learned: number;
  total: number;
}

interface Props {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
  /** Per-category 覚えた数/総数, keyed by category id. */
  progress?: Record<string, CategoryProgress>;
}

/** "覚えた 12 / 2560 (0.5%)" line, hidden until totals are known. */
function ProgressLine({ p }: { p?: CategoryProgress }) {
  if (!p || p.total === 0) return null;
  const pct = Math.round((p.learned / p.total) * 1000) / 10;
  return (
    <span className="mt-0.5 block text-xs font-normal text-white/45">
      覚えた {p.learned} / {p.total}（{pct}%）
    </span>
  );
}

/** Buttons to pick the typing material (sentence category) before a game. */
export function CategorySelect({
  categories,
  selected,
  onSelect,
  progress,
}: Props) {
  return (
    <div className="flex flex-col gap-2 mb-8">
      <span className="text-sm text-white/60">題材を選択</span>
      <div className="flex gap-2 justify-center flex-wrap">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={(e) => {
              onSelect(c);
              e.currentTarget.blur();
            }}
            className={`px-4 py-2 rounded-md border transition-colors ${
              c === selected
                ? "border-green-500/70 bg-green-500/15 font-semibold"
                : "border-white/10 text-white/60 hover:bg-white/5"
            }`}
          >
            {categoryLabel(c)}
            <ProgressLine p={progress?.[c]} />
          </button>
        ))}
      </div>
    </div>
  );
}
