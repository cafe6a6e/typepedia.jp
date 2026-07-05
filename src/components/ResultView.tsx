import type { ScoreResult } from "@/types";

interface Props {
  result: ScoreResult;
  onBack: () => void;
}

/** Result screen: score breakdown, then back to course selection. */
export function ResultView({ result, onBack }: Props) {
  const rows: [string, string][] = [
    ["正解打鍵", `${result.correct}`],
    ["ミス", `${result.miss}`],
    ["総打鍵", `${result.total}`],
    ["時間", `${(result.elapsedMs / 1000).toFixed(1)} 秒`],
    ["CPM (1分あたり)", `${result.cpm}`],
    ["WPM", `${result.wpm}`],
    ["正確率", `${(result.accuracy * 100).toFixed(1)} %`],
  ];

  return (
    <div className="text-center w-full max-w-md">
      <h2 className="text-2xl font-bold mb-2">結果</h2>
      <div className="text-6xl font-bold text-green-400 mb-1">
        {result.score}
      </div>
      <p className="text-xs text-white/40 mb-6">score = round(CPM × 正確率)</p>

      <table className="w-full text-sm mb-6">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-white/10">
              <td className="py-2 text-left text-white/60">{label}</td>
              <td className="py-2 text-right font-mono">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

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
