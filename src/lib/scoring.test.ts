import { expect, test } from "bun:test";
import { computeScore } from "@/lib/scoring";

test("accuracy is correct/total and zero when nothing was typed", () => {
  const empty = computeScore(0, 0, {});
  expect(empty.total).toBe(0);
  expect(empty.accuracy).toBe(0);
  expect(empty.missByChar).toEqual([]);

  const r = computeScore(9, 1, { z: 1 });
  expect(r.total).toBe(10);
  expect(r.accuracy).toBeCloseTo(0.9, 5);
});

test("no misses yields an empty breakdown", () => {
  const r = computeScore(42, 0, {});
  expect(r.miss).toBe(0);
  expect(r.missByChar).toEqual([]);
});

test("breakdown is sorted by count desc with ratio = count/miss", () => {
  const r = computeScore(0, 10, { a: 5, b: 3, c: 2 });
  expect(r.missByChar.map((m) => m.char)).toEqual(["a", "b", "c"]);
  expect(r.missByChar[0]).toEqual({ char: "a", count: 5, ratio: 0.5 });
  expect(r.missByChar[1].ratio).toBeCloseTo(0.3, 5);
  // Ratios sum to 1 when every miss is attributed.
  const sum = r.missByChar.reduce((s, m) => s + m.ratio, 0);
  expect(sum).toBeCloseTo(1, 5);
});

test("breakdown is truncated to the top 10 characters", () => {
  const missByChar: Record<string, number> = {};
  // 12 distinct chars with descending counts 12..1.
  for (let i = 0; i < 12; i++) {
    missByChar[String.fromCharCode(97 + i)] = 12 - i;
  }
  const totalMiss = Object.values(missByChar).reduce((a, b) => a + b, 0);
  const r = computeScore(0, totalMiss, missByChar);
  expect(r.missByChar).toHaveLength(10);
  expect(r.missByChar[0].char).toBe("a");
  // The two smallest (k=2, l=1) are dropped.
  expect(r.missByChar.map((m) => m.char)).not.toContain("l");
});
