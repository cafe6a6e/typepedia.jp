import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { postScore } from "@/lib/api";
import type { ScoreResult } from "@/types";

interface Props {
  result: ScoreResult;
  username: string;
  onRetry: () => void;
}

/** Result screen: score breakdown, submit-to-ranking, and retry. */
export function ResultView({ result, username, onRetry }: Props) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );

  const submit = async () => {
    setStatus("sending");
    try {
      await postScore({
        username: username || "anonymous",
        score: result.score,
        cpm: result.cpm,
        wpm: result.wpm,
        accuracy: result.accuracy,
      });
      setStatus("done");
      navigate("/ranking");
    } catch {
      setStatus("error");
    }
  };

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
          onClick={submit}
          disabled={status === "sending" || status === "done"}
          className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-md font-semibold"
        >
          {status === "sending"
            ? "送信中…"
            : status === "done"
              ? "送信済み"
              : "ランキングに送信"}
        </button>
        {status === "error" && (
          <p className="text-red-400 text-sm">送信に失敗しました</p>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="text-white/50 hover:text-white text-sm"
        >
          もう一度（Space）
        </button>
      </div>
    </div>
  );
}
