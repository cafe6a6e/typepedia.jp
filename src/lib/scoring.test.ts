import { expect, test } from "bun:test";
import { computeScore } from "@/lib/scoring";

test("accuracy is correct/total and zero when nothing was typed", () => {
  const empty = computeScore(0, 0, {}, {});
  expect(empty.total).toBe(0);
  expect(empty.accuracy).toBe(0);
  expect(empty.lowAccuracyKeys).toEqual([]);
  expect(empty.highAccuracyKeys).toEqual([]);

  const r = computeScore(9, 1, { a: 9 }, { a: { s: 1 } });
  expect(r.total).toBe(10);
  expect(r.accuracy).toBeCloseTo(0.9, 5);
});

test("per-key stats combine correct hits and (deduped) misses", () => {
  const r = computeScore(5, 1, { a: 2, k: 3 }, { a: { s: 1 } });
  const a = r.highAccuracyKeys.find((s) => s.key === "a");
  expect(a).toMatchObject({ key: "a", correct: 2, miss: 1, total: 3 });
  expect(a?.accuracy).toBeCloseTo(2 / 3, 5);
  expect(a?.missRate).toBeCloseTo(1 / 3, 5);
  expect(a?.wrongKeys).toEqual([{ key: "s", count: 1 }]);
});

test("high-accuracy keys rank by accuracy, tie-break by volume", () => {
  const r = computeScore(
    18,
    1,
    { a: 10, e: 5, x: 3 },
    { x: { z: 1 } }, // x: 3/4 = 75%
  );
  // a and e are 100%; a has more presses -> first. x (75%) last.
  expect(r.highAccuracyKeys.map((s) => s.key)).toEqual(["a", "e", "x"]);
});

test("low-accuracy keys only include keys with misses, worst first", () => {
  const r = computeScore(
    2,
    4,
    { a: 1, b: 1, c: 5 },
    { a: { x: 3 }, b: { y: 1 } },
  );
  // a: 1/4 = 25%, b: 1/2 = 50%, c: 100% (no misses -> excluded).
  expect(r.lowAccuracyKeys.map((s) => s.key)).toEqual(["a", "b"]);
  expect(r.lowAccuracyKeys[0]).toMatchObject({ key: "a", miss: 3, correct: 1 });
});

test("wrong keys per low-accuracy key are most-frequent first, capped at 5", () => {
  const wrong: Record<string, number> = {};
  for (let i = 0; i < 7; i++) wrong[String.fromCharCode(97 + i)] = i + 1;
  const r = computeScore(1, 28, { z: 1 }, { z: wrong });
  const wk = r.lowAccuracyKeys[0].wrongKeys;
  expect(wk).toHaveLength(5);
  expect(wk[0]).toEqual({ key: "g", count: 7 });
});

test("each ranking is truncated to 10 keys", () => {
  const correctMap: Record<string, number> = {};
  const missMap: Record<string, Record<string, number>> = {};
  for (let i = 0; i < 12; i++) {
    const k = String.fromCharCode(97 + i);
    correctMap[k] = 12 - i;
    missMap[k] = { z: i + 1 }; // everyone has misses
  }
  const r = computeScore(78, 78, correctMap, missMap);
  expect(r.highAccuracyKeys).toHaveLength(10);
  expect(r.lowAccuracyKeys).toHaveLength(10);
});
