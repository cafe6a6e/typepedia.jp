/** Result computation for a finished game. */
import type { KeyStat, ScoreResult } from "@/types";

/** A metric the result view can rank keys by. */
export type SortColumn = "total" | "correct" | "miss" | "accuracy";
export type SortDir = "asc" | "desc";

/**
 * The `limit` keys that rank highest (or lowest) by `column`. Ties fall back to
 * the busiest key, then the name, so the same game always renders the same way.
 */
export function rankKeys(
  stats: KeyStat[],
  column: SortColumn,
  dir: SortDir,
  limit: number,
): KeyStat[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...stats]
    .sort(
      (a, b) =>
        sign * (a[column] - b[column]) ||
        b.total - a.total ||
        a.key.localeCompare(b.key),
    )
    .slice(0, limit);
}

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
 * letter is not a separate key. Every key is returned: the result view picks
 * the sort order and how many rows to show.
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

  // Busiest first, deterministically: this is the order the view falls back to
  // when its own sort key ties.
  const keyStats = stats.sort(
    (a, b) =>
      b.total - a.total ||
      b.accuracy - a.accuracy ||
      a.key.localeCompare(b.key),
  );

  return { correct, miss, total, accuracy, keyStats };
}
