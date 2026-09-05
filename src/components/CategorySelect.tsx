import { Fragment } from "react";
import { categoryShortLabel, groupCategories } from "@/lib/categories";

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
    <span className="mt-px block text-[10px] leading-tight font-normal tabular-nums text-white/45">
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
    <div className="mx-auto mb-8 flex max-w-xl flex-col gap-2">
      <span className="text-left text-sm text-white/60">題材を選択</span>
      <div className="grid grid-cols-[auto_1fr] items-start gap-x-4 gap-y-3 text-left">
        {groupCategories(categories).map((g) => (
          <Fragment key={g.id}>
            <div className="pt-1.5 text-sm whitespace-nowrap text-white/50">
              {g.label}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {g.categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={(e) => {
                    onSelect(c);
                    e.currentTarget.blur();
                  }}
                  className={`rounded-md border px-2.5 py-1.5 text-sm transition-colors ${
                    c === selected
                      ? "border-green-500/70 bg-green-500/15 font-semibold"
                      : "border-white/10 text-white/60 hover:bg-white/5"
                  }`}
                >
                  {categoryShortLabel(c)}
                  <ProgressLine p={progress?.[c]} />
                </button>
              ))}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
