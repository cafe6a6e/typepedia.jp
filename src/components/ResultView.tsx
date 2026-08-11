import type { KeyStat, ScoreResult, WrongKey } from "@/types";

interface Props {
  result: ScoreResult;
  onBack: () => void;
}

/** Make an otherwise-invisible space visible in the breakdown. */
function visChar(ch: string): string {
  if (ch === " ") return "␣";
  if (ch === "\t") return "⇥";
  return ch;
}

/** Render one key with its (red) miss count, e.g. `x(3)`. */
function keyChip(w: WrongKey) {
  return (
    <span key={w.key} className="inline-block font-mono">
      {visChar(w.key)}
      <span className="text-white/40">(</span>
      <span className="text-red-400">{w.count}</span>
      <span className="text-white/40">)</span>
    </span>
  );
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** Shared cells for a per-key stats row (key, ミス数, 正解数, ミス率). */
function keyStatCells(s: KeyStat, keyClass: string) {
  return (
    <>
      <td className={`py-2 text-left font-mono text-lg ${keyClass}`}>
        {visChar(s.key)}
      </td>
      <td className="py-2 text-right font-mono">{s.miss}</td>
      <td className="py-2 text-right font-mono text-green-400">{s.correct}</td>
      <td className="py-2 text-right font-mono text-white/60">
        {pct(s.missRate)}
      </td>
    </>
  );
}

/** Result screen: accuracy summary and miss breakdown, then back to selection. */
export function ResultView({ result, onBack }: Props) {
  const { correct, miss, total, accuracy } = result;
  const accuracyPct = (accuracy * 100).toFixed(1);
  const missPct = (total > 0 ? (miss / total) * 100 : 0).toFixed(1);

  return (
    <div className="text-center w-full max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">結果</h2>

      <section className="mb-8 text-left">
        <h3 className="mb-2 text-sm font-semibold text-white/60">サマリ</h3>
        <div className="flex flex-col gap-2 rounded-md bg-white/5 px-4 py-3 text-sm">
          <p>
            正解率 = <span className="font-bold">{accuracyPct}%</span>{" "}
            <span className="text-white/50">
              （正解数{" "}
              <span className="font-mono text-green-400">{correct}</span> /
              総打鍵数 <span className="font-mono text-white">{total}</span>）
            </span>
          </p>
          <p>
            ミス率 = <span className="font-bold">{missPct}%</span>{" "}
            <span className="text-white/50">
              （ミス数 <span className="font-mono text-red-400">{miss}</span> /
              総打鍵数 <span className="font-mono text-white">{total}</span>）
            </span>
          </p>
        </div>
      </section>

      <section className="mb-8 text-left">
        <h3 className="mb-4 text-sm font-semibold text-white/60">
          キーストローク統計
        </h3>

        <h4 className="mb-2 text-xs font-semibold text-red-300/80">
          正解率の低いキー（下位10）
        </h4>
        {result.lowAccuracyKeys.length === 0 ? (
          <p className="mb-6 rounded-md bg-white/5 px-4 py-3 text-sm text-white/50">
            ミスはありませんでした 🎉
          </p>
        ) : (
          <div className="mb-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-white/40">
                  <th className="py-1 text-left font-normal">キー</th>
                  <th className="py-1 text-right font-normal">ミス数</th>
                  <th className="py-1 text-right font-normal">正解数</th>
                  <th className="py-1 text-right font-normal">ミス率</th>
                  <th className="py-1 pl-4 text-left font-normal">
                    誤入力キー（多い順・上位5）
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.lowAccuracyKeys.map((s) => (
                  <tr key={s.key} className="border-b border-white/10">
                    {keyStatCells(s, "text-red-300")}
                    <td className="py-2 pl-4 text-left">
                      <span className="flex flex-wrap gap-x-2 gap-y-1">
                        {s.wrongKeys.map(keyChip)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h4 className="mb-2 text-xs font-semibold text-green-300/80">
          正解率の高いキー（上位10）
        </h4>
        {result.highAccuracyKeys.length === 0 ? (
          <p className="rounded-md bg-white/5 px-4 py-3 text-sm text-white/50">
            データがありません
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-white/40">
                  <th className="py-1 text-left font-normal">キー</th>
                  <th className="py-1 text-right font-normal">ミス数</th>
                  <th className="py-1 text-right font-normal">正解数</th>
                  <th className="py-1 text-right font-normal">ミス率</th>
                </tr>
              </thead>
              <tbody>
                {result.highAccuracyKeys.map((s) => (
                  <tr key={s.key} className="border-b border-white/10">
                    {keyStatCells(s, "text-green-300")}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3 items-center">
        <button
          type="button"
          onClick={onBack}
          className="text-white/50 hover:text-white text-sm"
        >
          コース選択に戻る（Space）
        </button>
      </div>
    </div>
  );
}
