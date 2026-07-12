import { beforeEach, expect, test } from "bun:test";
import { addMemo, deleteMemos, formatTimestamp, getMemos } from "@/lib/memo";

// localStorage is provided by happy-dom (see test/setup.ts).
const KEY = "typepedia:memos";

const sample = (note: string) => ({
  category: "英語（英検1級）",
  disp: "apple",
  q: "apple",
  note,
});

beforeEach(() => {
  localStorage.clear();
});

test("addMemo returns a memo with a generated id and timestamp", () => {
  const m = addMemo(sample("first"));
  expect(m.id).toBeString();
  expect(m.id.length).toBeGreaterThan(0);
  expect(m.ts).toBeGreaterThan(0);
  expect(m.note).toBe("first");
  expect(getMemos()).toHaveLength(1);
});

test("getMemos returns memos newest-first", () => {
  const a = addMemo(sample("a"));
  const b = addMemo(sample("b"));
  const notes = getMemos().map((m) => m.note);
  // Newest-first ordering by ts; ids are unique regardless of equal ts.
  expect(getMemos()).toHaveLength(2);
  expect(new Set(notes)).toEqual(new Set(["a", "b"]));
  expect(getMemos()[0].ts).toBeGreaterThanOrEqual(getMemos()[1].ts);
  expect(a.id).not.toBe(b.id);
});

test("deleteMemos removes only the given ids and returns the rest", () => {
  const a = addMemo(sample("a"));
  addMemo(sample("b"));
  const c = addMemo(sample("c"));
  const remaining = deleteMemos([a.id, c.id]);
  expect(remaining).toHaveLength(1);
  expect(remaining[0].note).toBe("b");
  expect(getMemos()).toHaveLength(1);
});

test("deleteMemos with unknown ids is a no-op", () => {
  addMemo(sample("a"));
  expect(deleteMemos(["nope"])).toHaveLength(1);
});

test("getMemos tolerates missing and malformed storage", () => {
  expect(getMemos()).toEqual([]);
  localStorage.setItem(KEY, "{broken");
  expect(getMemos()).toEqual([]);
  localStorage.setItem(KEY, JSON.stringify({ not: "an array" }));
  expect(getMemos()).toEqual([]);
});

test("formatTimestamp produces a non-empty localized string", () => {
  const s = formatTimestamp(Date.now());
  expect(s).toBeString();
  expect(s.length).toBeGreaterThan(0);
});
