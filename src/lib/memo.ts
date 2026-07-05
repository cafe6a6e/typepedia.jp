/** Saved question memos, persisted in localStorage. */

export interface Memo {
  id: string;
  /** Material / category label (題材), e.g. "日本語（漢検準1級）". */
  category: string;
  /** Sentence display text (意味). */
  disp: string;
  /** Typing target / romaji (入力). */
  q: string;
  /** Free-form note the user wrote. */
  note: string;
  /** Creation timestamp (epoch ms). */
  ts: number;
}

const STORAGE_KEY = "typepedia:memos";

function readAll(): Memo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as Memo[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: Memo[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore quota / unavailable storage.
  }
}

/** All memos, newest first. */
export function getMemos(): Memo[] {
  return readAll().sort((a, b) => b.ts - a.ts);
}

/** Save a new memo and return it. */
export function addMemo(input: {
  category: string;
  disp: string;
  q: string;
  note: string;
}): Memo {
  const memo: Memo = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category: input.category,
    disp: input.disp,
    q: input.q,
    note: input.note,
    ts: Date.now(),
  };
  const list = readAll();
  list.push(memo);
  writeAll(list);
  return memo;
}

/** Delete the given memo ids; returns the remaining memos, newest first. */
export function deleteMemos(ids: string[]): Memo[] {
  const drop = new Set(ids);
  const list = readAll().filter((m) => !drop.has(m.id));
  writeAll(list);
  return list.sort((a, b) => b.ts - a.ts);
}

/** Format an epoch-ms timestamp in the local timezone. */
export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
