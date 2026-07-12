import { expect, test } from "bun:test";
import { computeScore } from "@/lib/scoring";

test("accuracy is correct/total and zero when nothing was typed", () => {
  const empty = computeScore(0, 0, {});
  expect(empty.total).toBe(0);
  expect(empty.accuracy).toBe(0);
  expect(empty.missByChar).toEqual([]);
  expect(empty.leastMissedKeys).toEqual([]);

  const r = computeScore(9, 1, { z: { x: 1 } });
  expect(r.total).toBe(10);
  expect(r.accuracy).toBeCloseTo(0.9, 5);
});

test("per-char count sums its wrong keys; ratio = count/miss", () => {
  const r = computeScore(0, 10, { あ: { x: 3, y: 2 }, か: { z: 5 } });
  const a = r.missByChar.find((m) => m.char === "あ");
  expect(a?.count).toBe(5);
  expect(a?.ratio).toBeCloseTo(0.5, 5);
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
  const r = computeScore(0, miss, detail);
  expect(r.missByChar).toHaveLength(10);
  expect(r.missByChar[0].char).toBe("a"); // count 12
  expect(r.missByChar.map((m) => m.char)).not.toContain("l"); // count 1 dropped
});

test("wrong keys per char are most-frequent first and capped at 5", () => {
  const keys: Record<string, number> = {};
  for (let i = 0; i < 7; i++) keys[String.fromCharCode(97 + i)] = i + 1; // a..g = 1..7
  const r = computeScore(0, 28, { あ: keys });
  const wk = r.missByChar[0].wrongKeys;
  expect(wk).toHaveLength(5);
  expect(wk[0]).toEqual({ key: "g", count: 7 });
  expect(wk.map((w) => w.key)).not.toContain("a"); // smallest dropped
});

test("least-missed keys aggregate across chars, least-first, capped at 10", () => {
  const r = computeScore(0, 10, { あ: { x: 3, y: 2 }, か: { z: 5, x: 1 } });
  // Totals: x=4, y=2, z=5 -> ascending y, x, z.
  expect(r.leastMissedKeys).toEqual([
    { key: "y", count: 2 },
    { key: "x", count: 4 },
    { key: "z", count: 5 },
  ]);
});

test("least-missed keys are truncated to 10", () => {
  const keys: Record<string, number> = {};
  for (let i = 0; i < 12; i++) keys[String.fromCharCode(97 + i)] = i + 1;
  const r = computeScore(0, 78, { あ: keys });
  expect(r.leastMissedKeys).toHaveLength(10);
  expect(r.leastMissedKeys[0]).toEqual({ key: "a", count: 1 }); // least first
});
