import { beforeEach, expect, test } from "bun:test";
import type { Sentence } from "@/types";
import {
  getDueReviews,
  isLearning,
  recordReview,
  reviewInfoOf,
  setLearning,
} from "@/lib/study";

// localStorage is provided by happy-dom (see test/setup.ts).

const CAT = "eiken_1st_grade";
const S: Sentence = { disp: "apple", q: "apple", lang: "en" };
const STUDY = { reviewFrequencyHours: 8, reviewCount: 3, reviewRatio: 0.5 };
// Same settings but due immediately (used to retrieve items regardless of time).
const NOW = { ...STUDY, reviewFrequencyHours: 0 };

beforeEach(() => {
  localStorage.clear();
});

test("a new learning item is not due until 復習頻度 elapses", () => {
  setLearning(CAT, S, true);
  // Registered just now → not due within the 8h window...
  expect(getDueReviews(CAT, STUDY)).toHaveLength(0);
  // ...but a 0h window makes it due immediately.
  expect(getDueReviews(CAT, NOW)).toHaveLength(1);
});

test("first review's 最終出題日時 falls back to the registration time", () => {
  const before = Date.now();
  setLearning(CAT, S, true);
  const after = Date.now();

  const [item] = getDueReviews(CAT, NOW);
  expect(item).toBeTruthy();
  const info = reviewInfoOf(item);
  expect(info.attempt).toBe(1);
  // No prior presentation yet → uses registeredTs, i.e. the mark time.
  expect(info.lastReviewedTs).toBeGreaterThanOrEqual(before);
  expect(info.lastReviewedTs).toBeLessThanOrEqual(after);
});

test("learning auto-clears once the review count is reached", () => {
  setLearning(CAT, S, true);
  expect(isLearning(CAT, S.q)).toBe(true);

  // Three reviews (reviewCount = 3): still learning until the last one lands.
  recordReview(CAT, S.q, STUDY.reviewCount);
  expect(isLearning(CAT, S.q)).toBe(true);
  recordReview(CAT, S.q, STUDY.reviewCount);
  expect(isLearning(CAT, S.q)).toBe(true);
  recordReview(CAT, S.q, STUDY.reviewCount);

  // Graduated: 学習中 cleared and no longer offered as a review.
  expect(isLearning(CAT, S.q)).toBe(false);
  expect(getDueReviews(CAT, STUDY)).toHaveLength(0);
});

test("later reviews show the actual last-presented time", () => {
  // reviewFrequencyHours: 0 so the item is due again immediately after a review.
  const immediate = { ...STUDY, reviewFrequencyHours: 0 };
  setLearning(CAT, S, true);
  const t0 = Date.now();
  recordReview(CAT, S.q, immediate.reviewCount);

  const [item] = getDueReviews(CAT, immediate);
  expect(item).toBeTruthy();
  const info = reviewInfoOf(item);
  expect(info.attempt).toBe(2);
  expect(info.lastReviewedTs).toBeGreaterThanOrEqual(t0);
});

// --- boundary conditions ---

test("getDueReviews only returns items in the requested category", () => {
  setLearning(CAT, S, true);
  setLearning("kanken_pre1st_grade", { disp: "犬", q: "inu", lang: "ja" }, true);
  const due = getDueReviews(CAT, NOW);
  expect(due).toHaveLength(1);
  expect(due[0].q).toBe(S.q);
});

test("getDueReviews is inclusive at exactly the frequency boundary", () => {
  setLearning(CAT, S, true);
  // registeredTs is "now"; a 0h window means now - reg (>= 0) qualifies.
  expect(getDueReviews(CAT, { ...STUDY, reviewFrequencyHours: 0 })).toHaveLength(
    1,
  );
});

test("a graduated item (reviewsDone == reviewCount) is never due", () => {
  setLearning(CAT, S, true);
  for (let i = 0; i < STUDY.reviewCount; i++) {
    recordReview(CAT, S.q, STUDY.reviewCount);
  }
  // Even with a 0h window it is excluded (learning cleared + count reached).
  expect(getDueReviews(CAT, NOW)).toHaveLength(0);
});

test("re-enabling learning while still learning preserves progress", () => {
  setLearning(CAT, S, true);
  recordReview(CAT, S.q, 99); // high count so it stays learning; reviewsDone=1
  setLearning(CAT, S, true); // re-affirm while already learning
  const [item] = getDueReviews(CAT, NOW);
  expect(item.reviewsDone).toBe(1); // not reset
});

test("enabling learning fresh resets progress", () => {
  setLearning(CAT, S, true);
  recordReview(CAT, S.q, 99); // reviewsDone=1, still learning
  setLearning(CAT, S, false); // turn off
  setLearning(CAT, S, true); // turn back on -> fresh cycle
  const [item] = getDueReviews(CAT, NOW);
  expect(item.reviewsDone).toBe(0); // reset
});

test("setLearning(false) on an untracked item is a no-op", () => {
  setLearning(CAT, S, false);
  expect(isLearning(CAT, S.q)).toBe(false);
  expect(getDueReviews(CAT, NOW)).toHaveLength(0);
});
