/** Friendly labels for sentence category folders. */

export const DEFAULT_CATEGORY = "eiken_1st_grade";

export const CATEGORY_LABELS: Record<string, string> = {
  eiken_1st_grade: "英語（英検1級）",
  kanken_pre1st_grade: "日本語（漢検準1級）",
  yoji_01_kyu5: "四字熟語（漢検5級）",
  yoji_02_kyu4: "四字熟語（漢検4級）",
  yoji_03_kyu3: "四字熟語（漢検3級）",
  yoji_04_kyu2j: "四字熟語（漢検準2級）",
  yoji_05_kyu2: "四字熟語（漢検2級）",
  yoji_06_kyu1j: "四字熟語（漢検準1級）",
  yoji_07_kyu1: "四字熟語（漢検1級）",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}
