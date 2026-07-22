import { beforeEach, expect, test } from "bun:test";
import {
  getMasteredCountByCategory,
  getMasteredSet,
  isMastered,
  setMastered,
} from "@/lib/mastery";

// localStorage is provided by happy-dom (see test/setup.ts).

const CAT = "eiken_1st_grade";

beforeEach(() => {
  localStorage.clear();
});

test("setMastered / isMastered round-trip by uuid", () => {
  expect(isMastered("u1")).toBe(false);
  setMastered("u1", CAT, true);
  expect(isMastered("u1")).toBe(true);
  setMastered("u1", CAT, false);
  expect(isMastered("u1")).toBe(false);
});

test("an empty uuid is never mastered and never stored", () => {
  setMastered("", CAT, true);
  expect(isMastered("")).toBe(false);
  expect(getMasteredSet().size).toBe(0);
});

test("getMasteredCountByCategory tallies per category", () => {
  setMastered("u1", CAT, true);
  setMastered("u2", CAT, true);
  setMastered("u3", "kanken_pre1st_grade", true);
  const counts = getMasteredCountByCategory();
  expect(counts[CAT]).toBe(2);
  expect(counts.kanken_pre1st_grade).toBe(1);
});

test("getMasteredSet returns all mastered uuids", () => {
  setMastered("u1", CAT, true);
  setMastered("u2", CAT, true);
  expect(getMasteredSet()).toEqual(new Set(["u1", "u2"]));
});

test("un-mastering a not-mastered uuid is a no-op", () => {
  setMastered("missing", CAT, false);
  expect(getMasteredSet().size).toBe(0);
});

test("tolerates malformed storage", () => {
  localStorage.setItem("typepedia:mastered", "not json");
  expect(isMastered("u1")).toBe(false);
  expect(getMasteredCountByCategory()).toEqual({});
});
