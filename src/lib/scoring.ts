/** Result computation for a finished game. */
import type { KeyStat, ScoreResult, WrongKey } from "@/types";

/** How many keys to surface in each ranking. */
const TOP_KEYS = 10;
/** How many wrong keys to list per low-accuracy key. */
const TOP_WRONG_KEYS = 5;

/** Correct presses per expected key. */
export type KeyCorrect = Record<string, number>;
/** Misses per expected key: expected key -> pressed wrong key -> count. */
export type KeyMiss = Record<string, Record<string, number>>;

function toWrongKeys(keys: Record<string, number>): WrongKey[] {
  return Object.entries(keys)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_WRONG_KEYS);
}

/**
 * accuracy = correct / (correct + miss). Keystroke statistics are per expected
 * key: `keyCorrect` counts right hits, `keyMiss` counts fumbled attempts (first
 * wrong key of each run) and what was pressed instead. Keys are ranked by
 * accuracy — highest for the "good" list, lowest (among keys with misses) for
 * the "needs work" list — breaking ties by volume so they stay meaningful.
 */
export function computeScore(
  correct: number,
  miss: number,
  keyCorrect: KeyCorrect,
  keyMiss: KeyMiss,
): ScoreResult {
  const total = correct + miss;
  const accuracy = total > 0 ? correct / total : 0;

  const keys = new Set([...Object.keys(keyCorrect), ...Object.keys(keyMiss)]);
  const stats: KeyStat[] = [...keys].map((key) => {
    const c = keyCorrect[key] ?? 0;
    const wrongMap = keyMiss[key] ?? {};
    const m = Object.values(wrongMap).reduce((a, b) => a + b, 0);
    const t = c + m;
    return {
      key,
      correct: c,
      miss: m,
      total: t,
      accuracy: t > 0 ? c / t : 0,
      missRate: t > 0 ? m / t : 0,
      wrongKeys: toWrongKeys(wrongMap),
    };
  });

  const highAccuracyKeys = [...stats]
    .sort(
      (a, b) =>
        b.accuracy - a.accuracy ||
        b.total - a.total ||
        a.key.localeCompare(b.key),
    )
    .slice(0, TOP_KEYS);

  const lowAccuracyKeys = stats
    .filter((s) => s.miss > 0)
    .sort(
      (a, b) =>
        a.accuracy - b.accuracy ||
        b.miss - a.miss ||
        b.total - a.total ||
        a.key.localeCompare(b.key),
    )
    .slice(0, TOP_KEYS);

  return { correct, miss, total, accuracy, lowAccuracyKeys, highAccuracyKeys };
}
