/** Result computation for a finished game. */
import type { ScoreResult, WrongKey } from "@/types";

/** How many mistyped characters to surface in the breakdown. */
const TOP_MISSES = 10;
/** How many wrong keys to list per mistyped character. */
const TOP_WRONG_KEYS = 5;
/** How many highest-accuracy keys to surface. */
const TOP_ACCURACY_KEYS = 10;

/** Nested miss tally: intended character -> pressed wrong key -> count. */
export type MissDetail = Record<string, Record<string, number>>;

/** Per-key press tally: key -> { correct presses, total presses }. */
export type KeyStats = Record<string, { correct: number; total: number }>;

function toWrongKeys(keys: Record<string, number>): WrongKey[] {
  return Object.entries(keys).map(([key, count]) => ({ key, count }));
}

/**
 * accuracy = correct / (correct + miss). The breakdown ranks the characters
 * mistyped most; for each it lists the keys pressed by mistake (most-first).
 * Separately it ranks keys by press accuracy (best-first) — this uses accuracy
 * rather than raw miss counts so ties don't dominate the ordering.
 */
export function computeScore(
  correct: number,
  miss: number,
  missDetail: MissDetail,
  keyStats: KeyStats,
): ScoreResult {
  const total = correct + miss;
  const accuracy = total > 0 ? correct / total : 0;

  // Distinct mistakes tallied in the breakdown (first wrong key of each run).
  const countedMiss = Object.values(missDetail).reduce(
    (s, keys) => s + Object.values(keys).reduce((a, b) => a + b, 0),
    0,
  );

  const missByChar = Object.entries(missDetail)
    .map(([char, keys]) => {
      const count = Object.values(keys).reduce((a, b) => a + b, 0);
      const wrongKeys = toWrongKeys(keys)
        .sort((a, b) => b.count - a.count)
        .slice(0, TOP_WRONG_KEYS);
      const ratio = countedMiss > 0 ? count / countedMiss : 0;
      return { char, count, ratio, wrongKeys };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_MISSES);

  // Highest-accuracy keys; break ties by volume (more presses first), then key.
  const topAccuracyKeys = Object.entries(keyStats)
    .map(([key, s]) => ({
      key,
      correct: s.correct,
      total: s.total,
      accuracy: s.total > 0 ? s.correct / s.total : 0,
    }))
    .sort(
      (a, b) =>
        b.accuracy - a.accuracy ||
        b.total - a.total ||
        a.key.localeCompare(b.key),
    )
    .slice(0, TOP_ACCURACY_KEYS);

  return { correct, miss, total, accuracy, missByChar, topAccuracyKeys };
}
