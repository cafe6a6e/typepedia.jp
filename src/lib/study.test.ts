import { beforeEach, expect, test } from "bun:test";
import type { Sentence } from "@/types";
import {
  getDueReviews,
  isLearning,
  recordReview,
  reviewInfoOf,
  setLearning,
} from "@/lib/study";

// Minimal in-memory localStorage so the study lib is exercisable under bun test.
class MemStorage {
  private store = new Map<string, string>();
  getItem(k: string): string | null {
    return this.store.has(k) ? (this.store.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.store.set(k, v);
  }
  removeItem(k: string): void {
    this.store.delete(k);
  }
  clear(): void {
    this.store.clear();
  }
}

// biome-ignore lint/suspicious/noExplicitAny: test shim for the global.
(globalThis as any).localStorage = new MemStorage();

const CAT = "eiken_1st_grade";
const S: Sentence = { disp: "apple", q: "apple", lang: "en" };
const STUDY = { reviewFrequencyHours: 8, reviewCount: 3, reviewRatio: 0.5 };

// A study item that is already past the review-frequency window (so it is due).
function overdue() {
  return getDueReviews(CAT, STUDY);
}

beforeEach(() => {
  localStorage.clear();
});

test("first review's 最終出題日時 falls back to the registration time", () => {
  const before = Date.now();
  setLearning(CAT, S, true);
  const after = Date.now();

  const [item] = overdue();
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
