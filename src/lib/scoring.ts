/** Result computation for a finished game. */
import type { ScoreResult, WrongKey } from "@/types";

/** How many mistyped characters to surface in the breakdown. */
const TOP_MISSES = 10;
/** How many wrong keys to list per mistyped character. */
const TOP_WRONG_KEYS = 5;
/** How many least-mistaken keys to surface. */
const LEAST_KEYS = 10;

/** Nested miss tally: intended character -> pressed wrong key -> count. */
export type MissDetail = Record<string, Record<string, number>>;

function toWrongKeys(keys: Record<string, number>): WrongKey[] {
  return Object.entries(keys).map(([key, count]) => ({ key, count }));
}

/**
 * accuracy = correct / (correct + miss). The breakdown ranks the characters
 * mistyped most; for each it lists the keys pressed by mistake (most-first),
 * and separately the keys mis-pressed the fewest times overall (least-first).
 */
export function computeScore(
  correct: number,
  miss: number,
  missDetail: MissDetail,
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

  // Aggregate wrong-key counts across every character, then take the least.
  const keyTotals: Record<string, number> = {};
  for (const keys of Object.values(missDetail)) {
    for (const [key, count] of Object.entries(keys)) {
      keyTotals[key] = (keyTotals[key] ?? 0) + count;
    }
  }
  const leastMissedKeys = toWrongKeys(keyTotals)
    .sort((a, b) => a.count - b.count)
    .slice(0, LEAST_KEYS);

  return { correct, miss, total, accuracy, missByChar, leastMissedKeys };
}
