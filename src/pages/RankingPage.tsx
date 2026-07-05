import { useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useSettings } from "@/hooks/useSettings";
import { getRanking } from "@/lib/api";
import type { ScoreEntry } from "@/types";

export function RankingPage() {
  usePageTitle("ランキング");
  const { settings } = useSettings();
  const [entries, setEntries] = useState<ScoreEntry[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    getRanking()
      .then((list) => {
        setEntries(list);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">ランキング</h2>

      {state === "loading" && <p className="text-white/50">読み込み中…</p>}
      {state === "error" && (
        <p className="text-red-400">読み込みに失敗しました</p>
      )}
      {state === "ready" && entries.length === 0 && (
        <p className="text-white/50">まだ記録がありません。</p>
      )}

      {state === "ready" && entries.length > 0 && (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/20 text-white/60 text-sm">
              <th className="py-2 w-16">順位</th>
              <th className="py-2">ユーザー名</th>
              <th className="py-2 text-right">スコア</th>
              <th className="py-2 text-right w-20">CPM</th>
              <th className="py-2 text-right w-20">正確率</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const mine =
                settings.username && e.username === settings.username;
              return (
                <tr
                  key={`${e.ts}-${i}`}
                  className={`border-b border-white/10 ${mine ? "bg-green-500/10" : ""}`}
                >
                  <td className="py-2 font-mono">{i + 1}</td>
                  <td className="py-2">{e.username}</td>
                  <td className="py-2 text-right font-mono font-semibold">
                    {e.score}
                  </td>
                  <td className="py-2 text-right font-mono text-white/60">
                    {e.cpm}
                  </td>
                  <td className="py-2 text-right font-mono text-white/60">
                    {(e.accuracy * 100).toFixed(0)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
