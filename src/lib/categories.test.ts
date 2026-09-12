import { expect, test } from "bun:test";
import {
  categoryLabel,
  categoryShortLabel,
  groupCategories,
  isLongText,
  isOrdered,
  registerCategoryLabels,
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

test("the Dvorak row keeps its materials in drill order", () => {
  const [dvorak] = groupCategories([
    "dvorak_right_index",
    "dvorak_right3",
    "dvorak_home_row",
  ]);
  expect(dvorak.label).toBe("Dvorak");
  expect(dvorak.categories).toEqual([
    "dvorak_home_row",
    "dvorak_right3",
    "dvorak_right_index",
  ]);
  expect(dvorak.categories.map(categoryShortLabel)).toEqual([
    "Home段限定",
    "右小/薬/中指限定",
    "右小/薬/人指限定",
  ]);
  expect(dvorak.categories.map(categoryLabel)).toEqual([
    "Dvorak（Home段限定）",
    "Dvorak（右小/薬/中指限定）",
    "Dvorak（右小/薬/人指限定）",
  ]);
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

test("Coding sits after Dvorak and before その他", () => {
  const groups = groupCategories([
    "rust",
    "mystery_material",
    "dvorak_home_row",
    "eiken_1st_grade",
  ]);
  expect(groups.map((g) => g.label)).toEqual([
    "English",
    "Dvorak",
    "Coding",
    "その他",
  ]);
  expect(groups[2].categories).toEqual(["rust"]);
});

test("Rust is labelled as a Coding material", () => {
  expect(categoryShortLabel("rust")).toBe("Rust");
  expect(categoryLabel("rust")).toBe("Coding（Rust）");
});

test("only 長文 materials report themselves as long text", () => {
  expect(isLongText("rust")).toBe(true);
  expect(isLongText("eiken_1st_grade")).toBe(false);
  expect(isLongText("dvorak_home_row")).toBe(false);
  // An id the app has never heard of must not claim to be long text — it lands
  // in その他 and is played with the ordinary 出題数.
  expect(isLongText("mystery_material")).toBe(false);
});

test("local_ material lands in the local練 row, not その他", () => {
  // Local material is never registered in CATEGORY_META — it is recognised by
  // its folder prefix alone, so a new local folder needs no code change.
  const groups = groupCategories([
    "local_drill",
    "eiken_1st_grade",
    "mystery_material",
  ]);
  expect(groups.map((g) => g.label)).toEqual(["English", "local練", "その他"]);
  expect(groups[1].categories).toEqual(["local_drill"]);
  expect(groups[2].categories).toEqual(["mystery_material"]);
});

test("local_ material is read in order; everything else is shuffled", () => {
  expect(isOrdered("local_drill")).toBe(true);
  // Long text is still sampled — each of its questions stands on its own.
  expect(isOrdered("rust")).toBe(false);
  expect(isOrdered("kanken_pre1st_grade")).toBe(false);
  expect(isOrdered("mystery_material")).toBe(false);
});

test("a manifest label names material the code has never heard of", () => {
  // Without a label an unregistered folder shows as its raw id.
  expect(categoryShortLabel("local_drill")).toBe("local_drill");
  registerCategoryLabels({ local_drill: "ドリル" });
  expect(categoryShortLabel("local_drill")).toBe("ドリル");
  expect(categoryLabel("local_drill")).toBe("ドリル");
});
