/** Friendly labels for sentence category folders. */

export const DEFAULT_CATEGORY = "eiken_1st_grade";

export const CATEGORY_LABELS: Record<string, string> = {
  eiken_1st_grade: "英語（英検1級）",
  eiken_pre1st_grade: "英語（英検準1級）",
  kanken_pre1st_grade: "日本語（漢検準1級）",
  yoji_01_kyu5: "四字熟語（漢検5級）",
  yoji_02_kyu4: "四字熟語（漢検4級）",
  yoji_03_kyu3: "四字熟語（漢検3級）",
  yoji_04_kyu2j: "四字熟語（漢検準2級）",
  yoji_05_kyu2: "四字熟語（漢検2級）",
  yoji_06_kyu1j: "四字熟語（漢検準1級）",
  yoji_07_kyu1: "四字熟語（漢検1級）",
  dvorak_home_row: "Dvorak（Home段限定）",
  dvorak_right3: "Dvorak（右小/薬/中指限定）",
  dvorak_right_index: "Dvorak（右小/薬/人指限定）",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export type CategoryGroupId = "english" | "kanji" | "dvorak" | "other";

/** Display order of the groups on the start screen. */
export const CATEGORY_GROUPS: { id: CategoryGroupId; label: string }[] = [
  { id: "english", label: "English" },
  { id: "kanji", label: "漢字・四字熟語" },
  { id: "dvorak", label: "Dvorak" },
  { id: "other", label: "その他" },
];

interface CategoryMeta {
  /** Card label; the group name is dropped since the row already shows it. */
  short: string;
  group: CategoryGroupId;
  /** Sort key within the group (manifest order is plain ID localeCompare). */
  order: number;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  eiken_1st_grade: { short: "英検1級", group: "english", order: 1 },
  eiken_pre1st_grade: { short: "英検準1級", group: "english", order: 2 },
  kanken_pre1st_grade: { short: "漢検準1級", group: "kanji", order: 1 },
  yoji_01_kyu5: { short: "四字熟語 5級", group: "kanji", order: 2 },
  yoji_02_kyu4: { short: "四字熟語 4級", group: "kanji", order: 3 },
  yoji_03_kyu3: { short: "四字熟語 3級", group: "kanji", order: 4 },
  yoji_04_kyu2j: { short: "四字熟語 準2級", group: "kanji", order: 5 },
  yoji_05_kyu2: { short: "四字熟語 2級", group: "kanji", order: 6 },
  yoji_06_kyu1j: { short: "四字熟語 準1級", group: "kanji", order: 7 },
  yoji_07_kyu1: { short: "四字熟語 1級", group: "kanji", order: 8 },
  dvorak_home_row: { short: "Home段限定", group: "dvorak", order: 1 },
  dvorak_right3: { short: "右小/薬/中指限定", group: "dvorak", order: 2 },
  dvorak_right_index: { short: "右小/薬/人指限定", group: "dvorak", order: 3 },
};

/** Short card label; falls back to the full label, then the raw id. */
export function categoryShortLabel(category: string): string {
  return CATEGORY_META[category]?.short ?? categoryLabel(category);
}

export interface CategoryGroup {
  id: CategoryGroupId;
  label: string;
  categories: string[];
}

/**
 * Bucket the manifest's flat category list into display groups, dropping
 * groups that have no categories. Categories missing from CATEGORY_META land
 * in "その他" so newly added material never disappears from the picker.
 */
export function groupCategories(categories: string[]): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  for (const g of CATEGORY_GROUPS) {
    const members = categories.filter(
      (c) => (CATEGORY_META[c]?.group ?? "other") === g.id,
    );
    if (members.length === 0) continue;
    members.sort((a, b) => {
      const oa = CATEGORY_META[a]?.order ?? Number.MAX_SAFE_INTEGER;
      const ob = CATEGORY_META[b]?.order ?? Number.MAX_SAFE_INTEGER;
      return oa === ob ? a.localeCompare(b) : oa - ob;
    });
    groups.push({ ...g, categories: members });
  }
  return groups;
}
