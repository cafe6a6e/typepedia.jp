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
  dvorak_left_hand: "Dvorak（左手限定）",
  rust: "Coding（Rust）",
};

/**
 * Display names the manifest carried, keyed by category id (see
 * `registerCategoryLabels`). Checked before the table above.
 */
const manifestLabels: Record<string, string> = {};

/**
 * Adopt display names discovered at runtime from the manifest, which reads them
 * from each material folder's `label.txt`. That is how ローカル専用題材 gets a
 * readable name without the name being written into a tracked source file.
 */
export function registerCategoryLabels(labels: Record<string, string>): void {
  Object.assign(manifestLabels, labels);
}

export function categoryLabel(category: string): string {
  return manifestLabels[category] ?? CATEGORY_LABELS[category] ?? category;
}

export type CategoryGroupId =
  | "english"
  | "kanji"
  | "dvorak"
  | "coding"
  | "local"
  | "other";

/** Display order of the groups on the start screen. */
export const CATEGORY_GROUPS: { id: CategoryGroupId; label: string }[] = [
  { id: "english", label: "English" },
  { id: "kanji", label: "漢字・四字熟語" },
  { id: "dvorak", label: "Dvorak" },
  { id: "coding", label: "Coding" },
  { id: "local", label: "local練" },
  { id: "other", label: "その他" },
];

interface CategoryMeta {
  /** Card label; the group name is dropped since the row already shows it. */
  short: string;
  group: CategoryGroupId;
  /** Sort key within the group (manifest order is plain ID localeCompare). */
  order: number;
  /**
   * 長文課題: one question is a whole multi-line text (a program), so a course
   * is sized by `Settings.longQuestionCount` and skips the review rotation.
   */
  longText?: boolean;
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
  dvorak_left_hand: { short: "左手限定", group: "dvorak", order: 4 },
  rust: { short: "Rust", group: "coding", order: 1, longText: true },
};

/**
 * Folder prefix marking ローカル専用題材. A `docs/sentences/local_…` folder is
 * gitignored and left out of the built manifest, so such material is never
 * registered in this file — its group, its ordering and its name are all
 * derived instead.
 */
const LOCAL_PREFIX = "local_";

/** Whether a category is local-only material, by folder-name convention. */
export function isLocal(category: string): boolean {
  return category.startsWith(LOCAL_PREFIX);
}

/**
 * Whether a category's questions are 長文 (one whole multi-line text each).
 * Long-text material is sized by its own 出題数 and left out of the spaced
 * review rotation, where a single-question course would be all review.
 */
export function isLongText(category: string): boolean {
  return CATEGORY_META[category]?.longText === true;
}

/**
 * Whether a category's file is one continuous passage, to be typed from the
 * top in file order. Shuffling it, or slotting review items into it, would
 * scramble the very order the material is written to teach. ローカル専用題材 is
 * written as prose split at 句点, so the whole local group is read in order.
 */
export function isOrdered(category: string): boolean {
  return isLocal(category);
}

/** Short card label; falls back to the full label, then the raw id. */
export function categoryShortLabel(category: string): string {
  return (
    manifestLabels[category] ??
    CATEGORY_META[category]?.short ??
    categoryLabel(category)
  );
}

export interface CategoryGroup {
  id: CategoryGroupId;
  label: string;
  categories: string[];
}

/** Which display group a category belongs to. */
function groupIdOf(category: string): CategoryGroupId {
  if (isLocal(category)) return "local";
  return CATEGORY_META[category]?.group ?? "other";
}

/**
 * Bucket the manifest's flat category list into display groups, dropping
 * groups that have no categories. Categories missing from CATEGORY_META land
 * in "その他" so newly added material never disappears from the picker.
 */
export function groupCategories(categories: string[]): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  for (const g of CATEGORY_GROUPS) {
    const members = categories.filter((c) => groupIdOf(c) === g.id);
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
