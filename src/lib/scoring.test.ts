import { expect, test } from "bun:test";
import { computeScore } from "@/lib/scoring";

test("accuracy is correct/total and zero when nothing was typed", () => {
  const empty = computeScore(0, 0, {}, {});
  expect(empty.total).toBe(0);
  expect(empty.accuracy).toBe(0);
  expect(empty.missByChar).toEqual([]);
  expect(empty.topAccuracyKeys).toEqual([]);

  const r = computeScore(9, 1, { z: { x: 1 } }, {});
  expect(r.total).toBe(10);
  expect(r.accuracy).toBeCloseTo(0.9, 5);
});

test("per-char count sums its wrong keys; ratio is share of counted misses", () => {
  const r = computeScore(0, 10, { あ: { x: 3, y: 2 }, か: { z: 5 } }, {});
  const a = r.missByChar.find((m) => m.char === "あ");
  expect(a?.count).toBe(5);
  expect(a?.ratio).toBeCloseTo(0.5, 5); // 5 of 10 counted misses
});

test("ratio uses counted (tallied) misses, not the physical miss total", () => {
  // Physical miss total (20) exceeds tallied misses (4) after de-duping runs.
  const r = computeScore(0, 20, { あ: { x: 2 }, か: { y: 2 } }, {});
  const a = r.missByChar.find((m) => m.char === "あ");
  expect(a?.ratio).toBeCloseTo(0.5, 5); // 2 of 4 counted, not 2/20
});

test("breakdown is sorted by count desc and truncated to 10 chars", () => {
  const detail: Record<string, Record<string, number>> = {};
  for (let i = 0; i < 12; i++) {
    detail[String.fromCharCode(97 + i)] = { z: 12 - i };
  }
  const miss = Object.values(detail).reduce(
    (s, k) => s + Object.values(k)[0],
    0,
  );
  const r = computeScore(0, miss, detail, {});
  expect(r.missByChar).toHaveLength(10);
  expect(r.missByChar[0].char).toBe("a"); // count 12
  expect(r.missByChar.map((m) => m.char)).not.toContain("l"); // count 1 dropped
});

test("wrong keys per char are most-frequent first and capped at 5", () => {
  const keys: Record<string, number> = {};
  for (let i = 0; i < 7; i++) keys[String.fromCharCode(97 + i)] = i + 1; // a..g = 1..7
  const r = computeScore(0, 28, { あ: keys }, {});
  const wk = r.missByChar[0].wrongKeys;
  expect(wk).toHaveLength(5);
  expect(wk[0]).toEqual({ key: "g", count: 7 });
  expect(wk.map((w) => w.key)).not.toContain("a"); // smallest dropped
});

test("topAccuracyKeys rank by accuracy, breaking ties by press volume", () => {
  const keyStats = {
    a: { correct: 10, total: 10 }, // 100%, most presses
    e: { correct: 5, total: 5 }, // 100%, fewer presses
    x: { correct: 3, total: 4 }, // 75%
    z: { correct: 0, total: 2 }, // 0%
  };
  const r = computeScore(0, 3, {}, keyStats);
  expect(r.topAccuracyKeys.map((k) => k.key)).toEqual(["a", "e", "x", "z"]);
  expect(r.topAccuracyKeys[0]).toEqual({
    key: "a",
    correct: 10,
    total: 10,
    accuracy: 1,
  });
  expect(r.topAccuracyKeys[2].accuracy).toBeCloseTo(0.75, 5);
});

test("topAccuracyKeys is truncated to 10", () => {
  const keyStats: Record<string, { correct: number; total: number }> = {};
  for (let i = 0; i < 12; i++) {
    keyStats[String.fromCharCode(97 + i)] = { correct: i, total: i + 1 };
  }
  const r = computeScore(0, 12, {}, keyStats);
  expect(r.topAccuracyKeys).toHaveLength(10);
});
