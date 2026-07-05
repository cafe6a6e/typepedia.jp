import { categoryLabel } from "@/lib/categories";

interface Props {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
}

/** Buttons to pick the typing material (sentence category) before a game. */
export function CategorySelect({ categories, selected, onSelect }: Props) {
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
          </button>
        ))}
      </div>
    </div>
  );
}
