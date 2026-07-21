import { beforeEach, expect, test } from "bun:test";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "@/lib/settings";
import type { Settings } from "@/types";

// localStorage is provided by happy-dom (see test/setup.ts).
const KEY = "typing-game:settings";

function seed(raw: unknown): void {
  localStorage.setItem(KEY, JSON.stringify(raw));
}

beforeEach(() => {
  localStorage.clear();
});

test("loadSettings returns defaults when nothing is stored", () => {
  expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
});

test("loadSettings returns defaults on malformed JSON", () => {
  localStorage.setItem(KEY, "{not valid json");
  expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
});

test("saveSettings / loadSettings round-trips a full settings object", () => {
  const custom: Settings = {
    username: "alice",
    questionCount: 20,
    category: "kanken_pre1st_grade",
    cMapping: { ...DEFAULT_SETTINGS.cMapping, ca: "s" },
    study: { reviewFrequencyHours: 12, reviewCount: 5, reviewRatio: 0.25 },
    autoPlayAudio: false,
  };
  saveSettings(custom);
  expect(loadSettings()).toEqual(custom);
});

test("username falls back to default when not a string", () => {
  seed({ username: 123 });
  expect(loadSettings().username).toBe(DEFAULT_SETTINGS.username);
});

test("questionCount is clamped positive and floored", () => {
  seed({ questionCount: 7.9 });
  expect(loadSettings().questionCount).toBe(7);
  seed({ questionCount: 0 });
  expect(loadSettings().questionCount).toBe(DEFAULT_SETTINGS.questionCount);
  seed({ questionCount: -3 });
  expect(loadSettings().questionCount).toBe(DEFAULT_SETTINGS.questionCount);
  seed({ questionCount: "abc" });
  expect(loadSettings().questionCount).toBe(DEFAULT_SETTINGS.questionCount);
});

test("category falls back to default when empty or non-string", () => {
  seed({ category: "" });
  expect(loadSettings().category).toBe(DEFAULT_SETTINGS.category);
  seed({ category: 42 });
  expect(loadSettings().category).toBe(DEFAULT_SETTINGS.category);
});

// --- 学習設定: normalizeStudy clamping (boundary conditions) ---

test("reviewFrequencyHours must be finite and > 0", () => {
  const d = DEFAULT_SETTINGS.study.reviewFrequencyHours;
  seed({ study: { reviewFrequencyHours: 0 } });
  expect(loadSettings().study.reviewFrequencyHours).toBe(d);
  seed({ study: { reviewFrequencyHours: -5 } });
  expect(loadSettings().study.reviewFrequencyHours).toBe(d);
  seed({ study: { reviewFrequencyHours: "x" } });
  expect(loadSettings().study.reviewFrequencyHours).toBe(d);
  seed({ study: { reviewFrequencyHours: 0.5 } });
  expect(loadSettings().study.reviewFrequencyHours).toBe(0.5);
});

test("reviewCount must be finite, >= 1, and is floored", () => {
  const d = DEFAULT_SETTINGS.study.reviewCount;
  seed({ study: { reviewCount: 0 } });
  expect(loadSettings().study.reviewCount).toBe(d);
  seed({ study: { reviewCount: 0.5 } });
  expect(loadSettings().study.reviewCount).toBe(d);
  seed({ study: { reviewCount: 1 } });
  expect(loadSettings().study.reviewCount).toBe(1);
  seed({ study: { reviewCount: 4.9 } });
  expect(loadSettings().study.reviewCount).toBe(4);
});

test("reviewRatio must be finite and within [0, 1]", () => {
  const d = DEFAULT_SETTINGS.study.reviewRatio;
  seed({ study: { reviewRatio: -0.1 } });
  expect(loadSettings().study.reviewRatio).toBe(d);
  seed({ study: { reviewRatio: 1.1 } });
  expect(loadSettings().study.reviewRatio).toBe(d);
  seed({ study: { reviewRatio: "x" } });
  expect(loadSettings().study.reviewRatio).toBe(d);
  seed({ study: { reviewRatio: 0 } });
  expect(loadSettings().study.reviewRatio).toBe(0);
  seed({ study: { reviewRatio: 1 } });
  expect(loadSettings().study.reviewRatio).toBe(1);
});

test("missing study block falls back entirely to defaults", () => {
  seed({ username: "bob" });
  expect(loadSettings().study).toEqual(DEFAULT_SETTINGS.study);
});

// --- ローマ字カスタマイズ: normalizeCMapping ---

test("cMapping keeps valid sides, defaults invalid ones, drops unknown keys", () => {
  seed({
    cMapping: {
      ca: "s", // valid override
      ci: "x", // invalid side -> default
      bogus: "k", // unknown input -> dropped
    },
  });
  const { cMapping } = loadSettings();
  expect(cMapping.ca).toBe("s");
  expect(cMapping.ci).toBe(DEFAULT_SETTINGS.cMapping.ci);
  expect("bogus" in cMapping).toBe(false);
  // Every known input is present.
  for (const key of Object.keys(DEFAULT_SETTINGS.cMapping)) {
    expect(cMapping[key] === "k" || cMapping[key] === "s").toBe(true);
  }
});

test("cMapping fills every gap when given an empty object", () => {
  seed({ cMapping: {} });
  expect(loadSettings().cMapping).toEqual(DEFAULT_SETTINGS.cMapping);
});
