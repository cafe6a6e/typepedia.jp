import type { ScoreResult } from "@/types";

interface Props {
  result: ScoreResult;
  onBack: () => void;
}

/** Result screen: score breakdown, then back to course selection. */
export function ResultView({ result, onBack }: Props) {
  // 1段目：正確性の指標（最優先）
  const accuracyRows: [string, string][] = [
    ["正確率", `${(result.accuracy * 100).toFixed(1)} %`],
    ["正解打鍵", `${result.correct}`],
    ["ミス", `${result.miss}`],
    ["総打鍵", `${result.total}`],
  ];

  // 2段目：速度・時間の指標（重要度低）
  const speedRows: [string, string][] = [
    ["時間", `${(result.elapsedMs / 1000).toFixed(1)} 秒`],
    ["CPM (1分あたり)", `${result.cpm}`],
    ["WPM", `${result.wpm}`],
  ];

  return (
    <div className="text-center w-full max-w-md">
      <h2 className="text-2xl font-bold mb-2">結果</h2>
      <div className="text-6xl font-bold text-green-400 mb-1">
        {result.score}
      </div>
      <p className="text-xs text-white/40 mb-6">score = round(CPM × 正確率)</p>

      {/* 1段目：正確性 */}
      <table className="w-full text-base mb-6">
        <tbody>
          {accuracyRows.map(([label, value]) => (
            <tr key={label} className="border-b border-white/10">
              <td className="py-2.5 text-left text-white/80">{label}</td>
              <td className="py-2.5 text-right font-mono font-semibold">
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 2段目：速度・時間（重要度低） */}
      <table className="w-full text-xs mb-6">
        <tbody>
          {speedRows.map(([label, value]) => (
            <tr key={label} className="border-b border-white/5">
              <td className="py-1.5 text-left text-white/40">{label}</td>
              <td className="py-1.5 text-right font-mono text-white/50">
                {value}
              </td>
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
