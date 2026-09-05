import { expect, test } from "bun:test";
import {
  bucketLatencies,
  computeScore,
  rankKeys,
  summariseLatency,
} from "@/lib/scoring";

test("accuracy is correct/total and zero when nothing was typed", () => {
  const empty = computeScore(0, 0, {}, {});
  expect(empty.total).toBe(0);
  expect(empty.accuracy).toBe(0);
  expect(empty.keyStats).toEqual([]);

  const r = computeScore(9, 1, { a: 9 }, { a: 1 });
  expect(r.total).toBe(10);
  expect(r.accuracy).toBeCloseTo(0.9, 5);
});

test("per-key stats combine correct hits and misses", () => {
  const r = computeScore(5, 1, { a: 2, k: 3 }, { a: 1 });
  const a = r.keyStats.find((s) => s.key === "a");
  expect(a).toMatchObject({ key: "a", correct: 2, miss: 1, total: 3 });
  expect(a?.accuracy).toBeCloseTo(2 / 3, 5);
});

test("upper and lower case fold onto the same key", () => {
  const r = computeScore(5, 3, { T: 3, t: 2 }, { T: 1, t: 2 });
  expect(r.keyStats.map((s) => s.key)).toEqual(["t"]);
  expect(r.keyStats[0]).toMatchObject({
    key: "t",
    correct: 5,
    miss: 3,
    total: 8,
  });
  expect(r.keyStats[0].accuracy).toBeCloseTo(5 / 8, 5);
});

test("keys rank by how often they came up, tie-break by accuracy", () => {
  const r = computeScore(18, 2, { a: 10, e: 5, x: 4, z: 1 }, { e: 1, x: 1 });
  // a: 10, e: 6, x: 5, z: 1 presses.
  expect(r.keyStats.map((s) => s.key)).toEqual(["a", "e", "x", "z"]);
});

test("keys with the same volume are ordered by accuracy, then name", () => {
  const r = computeScore(7, 2, { b: 4, a: 3, c: 4 }, { a: 1, c: 1 });
  // a: 4 (75%), b: 4 (100%), c: 5 -> c first, then b (100%) before a (75%).
  expect(r.keyStats.map((s) => s.key)).toEqual(["c", "b", "a"]);
});

test("every key is returned; trimming is the view's job", () => {
  const keyCorrect: Record<string, number> = {};
  for (let i = 0; i < 12; i++) {
    keyCorrect[String.fromCharCode(97 + i)] = 12 - i;
  }
  const r = computeScore(78, 0, keyCorrect, {});
  expect(r.keyStats).toHaveLength(12);
  expect(r.keyStats[0].key).toBe("a");
  expect(r.keyStats.at(-1)?.key).toBe("l");
});

test("a key that was only ever missed still shows up", () => {
  const r = computeScore(0, 2, {}, { q: 2 });
  expect(r.keyStats[0]).toMatchObject({
    key: "q",
    correct: 0,
    miss: 2,
    total: 2,
    accuracy: 0,
  });
});

const stats = [
  { key: "a", correct: 40, miss: 2, total: 42, accuracy: 40 / 42 },
  { key: "i", correct: 38, miss: 0, total: 38, accuracy: 1 },
  { key: "z", correct: 0, miss: 2, total: 2, accuracy: 0 },
  { key: "q", correct: 1, miss: 1, total: 2, accuracy: 0.5 },
];

test("rankKeys sorts by the chosen metric in either direction", () => {
  expect(rankKeys(stats, "accuracy", "asc", 10).map((s) => s.key)).toEqual([
    "z",
    "q",
    "a",
    "i",
  ]);
  expect(rankKeys(stats, "total", "desc", 10).map((s) => s.key)).toEqual([
    "a",
    "i",
    "q",
    "z",
  ]);
  expect(rankKeys(stats, "miss", "desc", 10).map((s) => s.key)).toEqual([
    "a",
    "z",
    "q",
    "i",
  ]);
});

test("rankKeys trims to the limit and breaks ties by volume then name", () => {
  expect(rankKeys(stats, "accuracy", "asc", 2).map((s) => s.key)).toEqual([
    "z",
    "q",
  ]);
  // q and z both have 2 presses; the busier-then-alphabetical fallback applies.
  expect(rankKeys(stats, "total", "asc", 2).map((s) => s.key)).toEqual([
    "q",
    "z",
  ]);
});

test("latency buckets step by half an octave from 32ms", () => {
  // One sample per bin from 0 to past the top so every edge shows up.
  const all = bucketLatencies([
    1, 40, 50, 70, 100, 150, 200, 300, 400, 600, 800, 1200, 1700, 5000,
  ]);
  expect(all.map((b) => b.min)).toEqual([
    0, 32, 45, 64, 91, 128, 181, 256, 362, 512, 724, 1024, 1448, 2048,
  ]);
  expect(all.at(-1)?.max).toBe(Number.POSITIVE_INFINITY);
});

test("latency buckets drop the empty ends but keep gaps in the middle", () => {
  const b = bucketLatencies([100, 100, 700]);
  // 91–128 … 512–724: the bins between stay even though they are empty.
  expect(b.map((x) => [x.min, x.count])).toEqual([
    [91, 2],
    [128, 0],
    [181, 0],
    [256, 0],
    [362, 0],
    [512, 1],
  ]);
  expect(bucketLatencies([])).toEqual([]);
});

/** Shorthand: samples all attributed to the same key. */
const gaps = (key: string, ...ms: number[]) => ms.map((n) => ({ key, ms: n }));

test("summariseLatency reports the median, not the mean", () => {
  // The 9000ms outlier would drag a mean far off; the median ignores it.
  expect(summariseLatency(gaps("a", 100, 120, 140, 9000)).median).toBe(130);
  expect(summariseLatency(gaps("a", 100, 120, 140)).median).toBe(120);
  expect(summariseLatency([])).toEqual({
    count: 0,
    median: 0,
    buckets: [],
    keys: [],
  });
});

test("latency is split per key, case-folded and alphabetical", () => {
  const s = summariseLatency([
    ...gaps("b", 300),
    ...gaps("A", 120),
    ...gaps("a", 100, 140),
    ...gaps(" ", 90),
  ]);
  expect(s.keys.map((k) => k.key)).toEqual([" ", "a", "b"]);
  // A and a fold together: three gaps, median 120.
  expect(s.keys[1]).toMatchObject({ key: "a", count: 3, median: 120 });
});

test("per-key buckets line up with the overall ones and sum to them", () => {
  const s = summariseLatency([
    ...gaps("a", 100, 110, 300),
    ...gaps("b", 105, 700),
  ]);
  for (const k of s.keys) expect(k.buckets).toHaveLength(s.buckets.length);
  const summed = s.buckets.map((_, i) =>
    s.keys.reduce((n, k) => n + k.buckets[i], 0),
  );
  expect(summed).toEqual(s.buckets.map((b) => b.count));
});

test("computeScore carries the latency summary", () => {
  const r = computeScore(3, 0, { a: 3 }, {}, gaps("a", 120, 130));
  expect(r.latency.count).toBe(2);
  expect(r.latency.median).toBe(125);
});
