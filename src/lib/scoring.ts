/** Result computation for a finished game. */
import type { ScoreResult } from "@/types";

/** How many mistyped characters to surface in the breakdown. */
const TOP_MISSES = 10;

/**
 * accuracy = correct / (correct + miss). The miss breakdown ranks the
 * characters that were mistyped most, each with its share of total misses.
 */
export function computeScore(
  correct: number,
  miss: number,
  missByChar: Record<string, number>,
): ScoreResult {
  const total = correct + miss;
  const accuracy = total > 0 ? correct / total : 0;
  const breakdown = Object.entries(missByChar)
    .map(([char, count]) => ({
      char,
      count,
      ratio: miss > 0 ? count / miss : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_MISSES);
  return { correct, miss, total, accuracy, missByChar: breakdown };
}
