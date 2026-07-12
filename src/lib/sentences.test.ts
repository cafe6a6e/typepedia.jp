import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  fetchSentenceFile,
  loadGameSentences,
  pickN,
} from "@/lib/sentences";
import { setLearning } from "@/lib/study";
import type { RawSentence, Sentence, StudySettings } from "@/types";

// --- pickN: pure sampling bounds ---

test("pickN returns everything when n exceeds the length", () => {
  const src = [1, 2, 3];
  const out = pickN(src, 10);
  expect(out).toHaveLength(3);
  expect(new Set(out)).toEqual(new Set(src));
});

test("pickN returns an empty array for n = 0", () => {
  // n = 0 is the real lower bound (e.g. reviewRatio 0 -> 0 review slots).
  expect(pickN([1, 2, 3], 0)).toEqual([]);
});

test("pickN samples distinct items from the source without mutating it", () => {
  const src = [1, 2, 3, 4, 5];
  const snapshot = [...src];
  const out = pickN(src, 3);
  expect(out).toHaveLength(3);
  expect(new Set(out).size).toBe(3); // no duplicates
  for (const v of out) expect(src).toContain(v);
  expect(src).toEqual(snapshot); // input untouched
});

test("pickN is stable under a stubbed Math.random", () => {
  const orig = Math.random;
  Math.random = () => 0;
  try {
    const out = pickN([1, 2, 3, 4], 2);
    expect(out).toHaveLength(2);
    expect(new Set(out).size).toBe(2);
  } finally {
    Math.random = orig;
  }
});

// --- fetch-backed loaders ---

const realFetch = globalThis.fetch;

function jsonRes(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => data,
  } as Response);
}

function installFetch(manifest: unknown, fileData: RawSentence[]) {
  // @ts-expect-error minimal fetch stub for tests
  globalThis.fetch = (url: string) =>
    url === "sentences/manifest.json"
      ? jsonRes(manifest)
      : jsonRes(fileData);
}

const CAT = "eiken_1st_grade";
const STUDY: StudySettings = {
  reviewFrequencyHours: 0, // seeded learning items are due immediately
  reviewCount: 3,
  reviewRatio: 0.5,
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("fetchSentenceFile infers lang (en when disp==q & ASCII, else ja)", async () => {
  const raw: RawSentence[] = [
    { disp: "apple", q: "apple" }, // ascii, disp==q -> en
    { disp: "りんご", q: "ringo" }, // disp!=q -> ja
    { disp: "あ", q: "あ" }, // disp==q but non-ascii -> ja
    { disp: "x", q: "x", lang: "ja" }, // explicit lang wins
  ];
  installFetch([], raw);
  const out = await fetchSentenceFile({ category: CAT, id: 1 });
  expect(out.map((s: Sentence) => s.lang)).toEqual(["en", "ja", "ja", "ja"]);
});

test("loadGameSentences throws when the category has no files", async () => {
  installFetch([{ category: "other", id: 1 }], []);
  await expect(loadGameSentences(CAT, 10, STUDY)).rejects.toThrow();
});

function seedLearning(count: number): Set<string> {
  const qs = new Set<string>();
  for (let i = 0; i < count; i++) {
    const q = `review${i}`;
    setLearning(CAT, { disp: q, q, lang: "en" }, true);
    qs.add(q);
  }
  return qs;
}

function freshFile(count: number): RawSentence[] {
  return Array.from({ length: count }, (_, i) => ({
    disp: `fresh${i}`,
    q: `fresh${i}`,
  }));
}

test("loadGameSentences fills round(n*ratio) slots with due reviews", async () => {
  seedLearning(8);
  installFetch([{ category: CAT, id: 1 }], freshFile(10));
  const load = await loadGameSentences(CAT, 10, {
    ...STUDY,
    reviewRatio: 0.5,
  });
  expect(load.sentences).toHaveLength(10);
  expect(load.reviews).toHaveLength(10);
  // round(10 * 0.5) = 5 review slots.
  const reviewCount = load.reviews.filter(Boolean).length;
  expect(reviewCount).toBe(5);
});

test("loadGameSentences rounds the review-slot count (0.55 -> 6)", async () => {
  seedLearning(8);
  installFetch([{ category: CAT, id: 1 }], freshFile(10));
  const load = await loadGameSentences(CAT, 10, {
    ...STUDY,
    reviewRatio: 0.55,
  });
  expect(load.reviews.filter(Boolean).length).toBe(6);
});

test("review and fresh slots stay aligned and don't overlap by q", async () => {
  const reviewQs = seedLearning(4);
  installFetch([{ category: CAT, id: 1 }], freshFile(10));
  const load = await loadGameSentences(CAT, 8, { ...STUDY, reviewRatio: 0.5 });
  expect(load.sentences).toHaveLength(8);
  load.sentences.forEach((s, i) => {
    const info = load.reviews[i];
    if (info) {
      // A review slot's sentence is one of the seeded learning items.
      expect(reviewQs.has(s.q)).toBe(true);
      expect(info.attempt).toBe(1);
    } else {
      // Fresh slots never reuse a review q.
      expect(reviewQs.has(s.q)).toBe(false);
    }
  });
});

test("loadGameSentences falls back to fresh when no reviews are due", async () => {
  // No learning items seeded -> zero due reviews.
  installFetch([{ category: CAT, id: 1 }], freshFile(10));
  const load = await loadGameSentences(CAT, 6, STUDY);
  expect(load.sentences).toHaveLength(6);
  expect(load.reviews.every((r) => r === null)).toBe(true);
});
