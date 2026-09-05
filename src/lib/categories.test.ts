import { expect, test } from "bun:test";
import {
  categoryLabel,
  categoryShortLabel,
  groupCategories,
} from "@/lib/categories";

// The manifest hands us categories in plain ID order; grouping fixes that.
const ALL = [
  "eiken_1st_grade",
  "eiken_pre1st_grade",
  "kanken_pre1st_grade",
  "yoji_01_kyu5",
  "yoji_07_kyu1",
];

test("groupCategories buckets into English then 漢字・四字熟語", () => {
  const groups = groupCategories(ALL);
  expect(groups.map((g) => g.label)).toEqual(["English", "漢字・四字熟語"]);
  expect(groups[0].categories).toEqual([
    "eiken_1st_grade",
    "eiken_pre1st_grade",
  ]);
  expect(groups[1].categories).toEqual([
    "kanken_pre1st_grade",
    "yoji_01_kyu5",
    "yoji_07_kyu1",
  ]);
});

test("groupCategories orders by grade, not by category id", () => {
  const [, kanji] = groupCategories([
    "yoji_07_kyu1",
    "yoji_01_kyu5",
    "kanken_pre1st_grade",
    "eiken_1st_grade",
  ]);
  expect(kanji.categories).toEqual([
    "kanken_pre1st_grade",
    "yoji_01_kyu5",
    "yoji_07_kyu1",
  ]);
});

test("groupCategories drops empty groups", () => {
  expect(groupCategories(["eiken_1st_grade"]).map((g) => g.id)).toEqual([
    "english",
  ]);
  expect(groupCategories([])).toEqual([]);
});

test("groupCategories puts Dvorak after the kanji row", () => {
  const groups = groupCategories([
    "dvorak_home_row",
    "kanken_pre1st_grade",
    "eiken_1st_grade",
  ]);
  expect(groups.map((g) => g.label)).toEqual([
    "English",
    "漢字・四字熟語",
    "Dvorak",
  ]);
  expect(groups[2].categories).toEqual(["dvorak_home_row"]);
});

test("groupCategories keeps unknown categories under その他", () => {
  const groups = groupCategories(["eiken_1st_grade", "new_stuff"]);
  expect(groups.map((g) => g.id)).toEqual(["english", "other"]);
  expect(groups[1].categories).toEqual(["new_stuff"]);
});

test("categoryShortLabel drops the group name, categoryLabel keeps it", () => {
  expect(categoryShortLabel("yoji_04_kyu2j")).toBe("四字熟語 準2級");
  expect(categoryLabel("yoji_04_kyu2j")).toBe("四字熟語（漢検準2級）");
  expect(categoryShortLabel("new_stuff")).toBe("new_stuff");
});
