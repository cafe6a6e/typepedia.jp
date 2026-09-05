import { useMemo, useState } from "react";
import type { KeyStat, ScoreResult } from "@/types";

interface Props {
  result: ScoreResult;
  onBack: () => void;
}

type SortColumn = "total" | "correct" | "miss" | "accuracy";
type SortDir = "asc" | "desc";

/** How many rows the table shows, whatever the sort. */
const VISIBLE_ROWS = 10;

/**
 * Sortable columns, in display order. `initialDir` is the direction a column
 * gets the first time it is picked: accuracy and correct hits are most useful
 * from the weak end, misses and volume from the busy end.
 */
const COLUMNS: { column: SortColumn; label: string; initialDir: SortDir }[] = [
  { column: "total", label: "打鍵", initialDir: "desc" },
  { column: "correct", label: "正解", initialDir: "asc" },
  { column: "miss", label: "ミス", initialDir: "desc" },
  { column: "accuracy", label: "正解率", initialDir: "asc" },
];

/** Make an otherwise-invisible key visible in the table. */
function visChar(ch: string): string {
  if (ch === " ") return "␣";
  if (ch === "\t") return "⇥";
  return ch;
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** Result screen: accuracy summary and a sortable key table. */
export function ResultView({ result, onBack }: Props) {
  const { correct, miss, total, accuracy, keyStats } = result;
  const [sort, setSort] = useState<{ column: SortColumn; dir: SortDir }>({
    column: "accuracy",
    dir: "asc",
  });

  const rows = useMemo(() => {
    const sign = sort.dir === "asc" ? 1 : -1;
    // Ties fall back to the busiest key, then the name, so the order is stable.
    const ranked = [...keyStats].sort(
      (a: KeyStat, b: KeyStat) =>
        sign * (a[sort.column] - b[sort.column]) ||
        b.total - a.total ||
        a.key.localeCompare(b.key),
    );
    return ranked.slice(0, VISIBLE_ROWS);
  }, [keyStats, sort]);

  /** Re-sort by a column, flipping the direction if it is already active. */
  function pick(column: SortColumn, initialDir: SortDir) {
    setSort((s) =>
      s.column === column
        ? { column, dir: s.dir === "asc" ? "desc" : "asc" }
        : { column, dir: initialDir },
    );
  }

  return (
    <div className="w-full max-w-md text-center">
      <h2 className="mb-4 text-2xl font-bold">結果</h2>

      <div className="mb-6 flex items-baseline justify-center gap-4 rounded-md bg-white/5 px-4 py-3">
        <span className="text-3xl font-bold tabular-nums">{pct(accuracy)}</span>
        <span className="text-sm text-white/50">
          正解 <span className="font-mono text-green-400">{correct}</span> ・
          ミス <span className="font-mono text-red-400">{miss}</span> ・ 打鍵{" "}
          <span className="font-mono text-white">{total}</span>
        </span>
      </div>

      <h3 className="mb-2 text-left text-xs font-semibold text-white/50">
        キー別（上位{VISIBLE_ROWS}件）
      </h3>
      {keyStats.length === 0 ? (
        <p className="rounded-md bg-white/5 px-4 py-3 text-sm text-white/50">
          打鍵がありませんでした
        </p>
      ) : (
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-xs text-white/40">
              <th className="py-1 text-left font-normal">キー</th>
              {COLUMNS.map(({ column, label, initialDir }) => {
                const active = sort.column === column;
                return (
                  <th
                    key={column}
                    className="py-1 text-right font-normal"
                    aria-sort={
                      active
                        ? sort.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => pick(column, initialDir)}
                      className={`w-full text-right hover:text-white ${
                        active ? "text-white" : ""
                      }`}
                    >
                      {label}
                      <span className="ml-0.5 inline-block w-2 text-[9px]">
                        {active ? (sort.dir === "asc" ? "▲" : "▼") : ""}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.key} className="border-b border-white/10">
                <td className="py-1.5 text-left font-mono text-base">
                  {visChar(s.key)}
                </td>
                <td className="py-1.5 text-right font-mono">{s.total}</td>
                <td className="py-1.5 text-right font-mono text-green-400">
                  {s.correct}
                </td>
                <td className="py-1.5 text-right font-mono text-red-400">
                  {s.miss}
                </td>
                <td className="py-1.5 text-right font-mono text-white/70">
                  {pct(s.accuracy)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button
        type="button"
        onClick={onBack}
        className="mt-6 text-sm text-white/50 hover:text-white"
      >
        コース選択に戻る（Space）
      </button>
    </div>
  );
}
