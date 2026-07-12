import { expect, test } from "bun:test";
import {
  KANA_TO_ROMAJI,
  MAX_SPELLING_LEN,
  ROMAJI_TO_KANA,
  SPELLING_SET,
  startsWithVowel,
} from "@/lib/romajiTable";

test("every spelling round-trips through ROMAJI_TO_KANA / SPELLING_SET", () => {
  for (const spellings of Object.values(KANA_TO_ROMAJI)) {
    for (const s of spellings) {
      expect(SPELLING_SET.has(s)).toBe(true);
      expect(ROMAJI_TO_KANA[s]).toBeDefined();
    }
  }
});

test("ROMAJI_TO_KANA maps a known spelling to its kana", () => {
  expect(ROMAJI_TO_KANA.ka).toBe("か");
  expect(ROMAJI_TO_KANA.shi).toBe("し");
  expect(ROMAJI_TO_KANA.kyo).toBe("きょ");
});

test("MAX_SPELLING_LEN equals the longest spelling length", () => {
  const longest = Math.max(
    ...Object.values(KANA_TO_ROMAJI).flatMap((v) => v.map((s) => s.length)),
  );
  expect(MAX_SPELLING_LEN).toBe(longest);
});

test("startsWithVowel handles vowels, consonants, and empty input", () => {
  expect(startsWithVowel("a")).toBe(true);
  expect(startsWithVowel("ou")).toBe(true);
  expect(startsWithVowel("ka")).toBe(false);
  expect(startsWithVowel("")).toBe(false); // undefined[0] -> not a vowel
});
