/** Result computation for a finished game. */
import type {
  KeyStat,
  LatencyBucket,
  LatencyKeyStat,
  LatencySample,
  LatencyStats,
  ScoreResult,
  SpeedPoint,
  SpeedStats,
  StrokeSample,
} from "@/types";

/** Histogram floor; anything faster lands in the open-ended bottom bin. */
const LATENCY_FLOOR = 32;
/** How many half-octave (×√2) steps the closed bins span: 32ms up to 2048ms. */
const LATENCY_STEPS = 12;

/** Bin edges: 32, 45, 64, … 2048. */
const LATENCY_EDGES = Array.from({ length: LATENCY_STEPS + 1 }, (_, i) =>
  Math.round(LATENCY_FLOOR * Math.SQRT2 ** i),
);

/**
 * Log-spaced histogram of the gaps, in half-octave steps. Open-ended bins at
 * both ends keep every sample somewhere; the empty bins at either end are then
 * trimmed so a single course does not render mostly blank. Empty bins *inside*
 * the range stay, since a gap in the distribution is information.
 */
export function bucketLatencies(samples: number[]): LatencyBucket[] {
  const edges = [0, ...LATENCY_EDGES, Number.POSITIVE_INFINITY];
  const buckets: LatencyBucket[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    buckets.push({ min: edges[i], max: edges[i + 1], count: 0 });
  }
  for (const ms of samples) {
    const i = buckets.findIndex((b) => ms >= b.min && ms < b.max);
    if (i >= 0) buckets[i].count++;
  }
  const first = buckets.findIndex((b) => b.count > 0);
  if (first < 0) return [];
  let last = buckets.length - 1;
  while (buckets[last].count === 0) last--;
  return buckets.slice(first, last + 1);
}

/** Middle value; the mean would be dragged around by the odd long pause. */
function median(samples: number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** How many of `samples` fall in each of the already-chosen `buckets`. */
function countInto(samples: number[], buckets: LatencyBucket[]): number[] {
  const counts = buckets.map(() => 0);
  for (const ms of samples) {
    const i = buckets.findIndex((b) => ms >= b.min && ms < b.max);
    if (i >= 0) counts[i]++;
  }
  return counts;
}

export function summariseLatency(samples: LatencySample[]): LatencyStats {
  const all = samples.map((s) => s.ms);
  const buckets = bucketLatencies(all);

  // Fold A and a together, as KeyStat does.
  const byKey = new Map<string, number[]>();
  for (const { key, ms } of samples) {
    const k = key.toLowerCase();
    const list = byKey.get(k);
    if (list) list.push(ms);
    else byKey.set(k, [ms]);
  }

  // Counted against the *trimmed* buckets, so the per-key arrays line up with
  // `buckets` index for index and the view can stack them without remapping.
  const keys: LatencyKeyStat[] = [...byKey.entries()]
    .map(([key, list]) => ({
      key,
      count: list.length,
      median: Math.round(median(list)),
      buckets: countInto(list, buckets),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return {
    count: samples.length,
    median: Math.round(median(all)),
    buckets,
    keys,
  };
}

/** Trailing window the speed curve averages over, in ms. */
const SPEED_WINDOW = 3000;
/** Distance between two points of the curve, in ms. */
const SPEED_STEP = 250;

/**
 * Typing speed as a trailing average: each point counts the keystrokes landing
 * in the window that ends there, over the window's full width. The divisor is
 * the width even before a whole window has passed, so the curve opens with an
 * honest ramp instead of a spike off one early keystroke.
 *
 * `strokes` must be in time order, which is how the game records them; the
 * window's two ends then only ever move forward, so this is a single pass.
 */
export function summariseSpeed(strokes: StrokeSample[]): SpeedStats {
  const last = strokes.at(-1);
  if (!last) return { points: [], mean: 0, peak: 0, seconds: 0 };

  const points: SpeedPoint[] = [];
  // `head` is the first stroke past t; `tail` the first one still in the window.
  let head = 0;
  let tail = 0;
  const sampleAt = (t: number) => {
    while (head < strokes.length && strokes[head].at <= t) head++;
    while (tail < head && strokes[tail].at <= t - SPEED_WINDOW) tail++;
    points.push({
      t,
      cps: (head - tail) / (SPEED_WINDOW / 1000),
      // Before the first keystroke there is nothing to name but the question
      // the player was looking at, which is the one the first keystroke ends up
      // on anyway.
      sentence: strokes[Math.max(head - 1, 0)].sentence,
    });
  };

  for (let t = 0; t < last.at; t += SPEED_STEP) sampleAt(t);
  // The curve ends on the last keystroke rather than the next step, so the axis
  // can run from 0 to exactly when the typing stopped.
  sampleAt(last.at);

  const seconds = last.at / 1000;
  return {
    points,
    mean: seconds > 0 ? strokes.length / seconds : 0,
    peak: points.reduce((max, p) => Math.max(max, p.cps), 0),
    seconds,
  };
}

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
 * letter is not a separate key. Every key is returned; the result view decides
 * the order. `latencies` are the gaps between consecutive correct keystrokes,
 * already filtered by the caller, and `strokes` is every correct keystroke on
 * the session's clock.
 */
export function computeScore(
  correct: number,
  miss: number,
  keyCorrect: KeyCorrect,
  keyMiss: KeyMiss,
  latencies: LatencySample[] = [],
  strokes: StrokeSample[] = [],
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

  return {
    correct,
    miss,
    total,
    accuracy,
    keyStats,
    latency: summariseLatency(latencies),
    speed: summariseSpeed(strokes),
  };
}
