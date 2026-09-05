/** Result computation for a finished game. */
import type { KeyStat, ScoreResult } from "@/types";

/** How many keys to surface in the ranking. */
const TOP_KEYS = 10;

/** Correct presses per expected key. */
export type KeyCorrect = Record<string, number>;
/** Misses per expected key. */
export type KeyMiss = Record<string, number>;

/** Sum counts into `into`, folding A and a onto the same key. */
function foldCase(counts: Record<string, number>, into: Map<string, number>) {
  for (const [key, n] of Object.entries(counts)) {
    const k = key.toLowerCase();
    into.set(k, (into.get(k) ?? 0) + n);
  }
}

/**
 * accuracy = correct / (correct + miss). Keystroke statistics are per expected
 * key: `keyCorrect` counts right hits and `keyMiss` counts fumbled attempts
 * (the first wrong key of each run). Keys are folded to lower case so a shifted
 * letter is not a separate key, then ranked by how often they came up, since
 * that is what makes a row worth reading.
 */
export function computeScore(
  correct: number,
  miss: number,
  keyCorrect: KeyCorrect,
  keyMiss: KeyMiss,
): ScoreResult {
  const total = correct + miss;
  const accuracy = total > 0 ? correct / total : 0;

  const correctByKey = new Map<string, number>();
  const missByKey = new Map<string, number>();
  foldCase(keyCorrect, correctByKey);
  foldCase(keyMiss, missByKey);

  const keys = new Set([...correctByKey.keys(), ...missByKey.keys()]);
  const stats: KeyStat[] = [...keys].map((key) => {
    const c = correctByKey.get(key) ?? 0;
    const m = missByKey.get(key) ?? 0;
    const t = c + m;
    return { key, correct: c, miss: m, total: t, accuracy: t > 0 ? c / t : 0 };
  });

  const topKeys = stats
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.accuracy - a.accuracy ||
        a.key.localeCompare(b.key),
    )
    .slice(0, TOP_KEYS);

  return { correct, miss, total, accuracy, topKeys };
}
