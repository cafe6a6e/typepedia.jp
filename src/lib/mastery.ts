/** Per-sentence "完全に覚えた" status, keyed by the stable sentence UUID. */

/** One mastered sentence's record. */
export interface MasteryItem {
  /** Category folder id the sentence belongs to (for per-category totals). */
  category: string;
  /** Epoch ms it was marked as mastered. */
  ts: number;
}

const STORAGE_KEY = "typepedia:mastered";

function readAll(): Record<string, MasteryItem> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === "object"
      ? (data as Record<string, MasteryItem>)
      : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, MasteryItem>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore quota / unavailable storage.
  }
}

/** Whether the sentence with this uuid is marked 完全に覚えた. */
export function isMastered(uuid: string): boolean {
  if (!uuid) return false;
  return uuid in readAll();
}

/**
 * Set the 完全に覚えた flag for a sentence. Stores the category so per-category
 * progress can be counted without re-fetching sentence files. No-op with an
 * empty uuid (ad-hoc/test sentences have no stable identity).
 */
export function setMastered(
  uuid: string,
  category: string,
  mastered: boolean,
): void {
  if (!uuid) return;
  const map = readAll();
  if (mastered) {
    map[uuid] = { category, ts: Date.now() };
  } else if (uuid in map) {
    delete map[uuid];
  } else {
    return;
  }
  writeAll(map);
}

/** Count of mastered sentences per category id. */
export function getMasteredCountByCategory(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of Object.values(readAll())) {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
  }
  return counts;
}

/** Set of all mastered sentence uuids (for excluding them from games). */
export function getMasteredSet(): Set<string> {
  return new Set(Object.keys(readAll()));
}
