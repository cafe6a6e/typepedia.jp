import type { ScoreResult } from "@/types";

interface Props {
  result: ScoreResult;
  onBack: () => void;
}

/** Make an otherwise-invisible key visible in the table. */
function visChar(ch: string): string {
  if (ch === " ") return "␣";
  if (ch === "\t") return "⇥";
  return ch;
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** Result screen: accuracy summary and the busiest keys, then back to selection. */
export function ResultView({ result, onBack }: Props) {
  const { correct, miss, total, accuracy, topKeys } = result;

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
        キー別（打鍵数の多い順）
      </h3>
      {topKeys.length === 0 ? (
        <p className="rounded-md bg-white/5 px-4 py-3 text-sm text-white/50">
          打鍵がありませんでした
        </p>
      ) : (
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-xs text-white/40">
              <th className="py-1 text-left font-normal">キー</th>
              <th className="py-1 text-right font-normal">打鍵</th>
              <th className="py-1 text-right font-normal">正解</th>
              <th className="py-1 text-right font-normal">ミス</th>
              <th className="py-1 text-right font-normal">正解率</th>
            </tr>
          </thead>
          <tbody>
            {topKeys.map((s) => (
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
