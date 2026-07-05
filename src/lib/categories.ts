/** Friendly labels for sentence category folders. */

export const DEFAULT_CATEGORY = "eiken_1st_grade";

export const CATEGORY_LABELS: Record<string, string> = {
  eiken_1st_grade: "英語（英検1級）",
  kanken_pre1st_grade: "日本語（漢検準1級）",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}
