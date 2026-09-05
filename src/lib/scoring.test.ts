import { expect, test } from "bun:test";
import { computeScore } from "@/lib/scoring";

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
