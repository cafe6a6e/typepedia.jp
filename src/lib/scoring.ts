/** Score computation for a finished game. */
import type { ScoreResult } from "@/types";

/**
 * CPM = correct keystrokes per minute, WPM = CPM / 5 (standard word length),
 * accuracy = correct / (correct + miss), score = round(CPM * accuracy).
 */
export function computeScore(
  correct: number,
  miss: number,
  elapsedMs: number,
): ScoreResult {
  const total = correct + miss;
  const minutes = elapsedMs / 60000;
  const cpm = minutes > 0 ? correct / minutes : 0;
  const wpm = cpm / 5;
  const accuracy = total > 0 ? correct / total : 0;
  const score = Math.round(cpm * accuracy);
  return {
    correct,
    miss,
    total,
    elapsedMs,
    cpm: Math.round(cpm),
    wpm: Math.round(wpm),
    accuracy,
    score,
  };
}
