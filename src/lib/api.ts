/** Ranking store.
 *
 * The site is hosted statically (GitHub Pages) with no backend, so the ranking
 * is kept locally in the browser's localStorage. It is therefore a per-device
 * leaderboard rather than a global one. The public async interface is kept
 * identical to a network client so callers need no changes.
 */
import type { ScoreEntry } from "@/types";

const STORAGE_KEY = "typepedia:ranking";
const MAX_ENTRIES = 1000;
const TOP_N = 100;

function readAll(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as ScoreEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: ScoreEntry[]): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(list.slice(0, MAX_ENTRIES)),
    );
  } catch {
    // Ignore quota / unavailable storage.
  }
}

export async function getRanking(): Promise<ScoreEntry[]> {
  return readAll().slice(0, TOP_N);
}

export interface PostScorePayload {
  username: string;
  score: number;
  cpm: number;
  wpm: number;
  accuracy: number;
}

const clamp01 = (v: number): number =>
  Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
const numOr0 = (v: number): number =>
  Number.isFinite(v) && v >= 0 ? Math.round(v) : 0;

export async function postScore(
  payload: PostScorePayload,
): Promise<ScoreEntry[]> {
  const entry: ScoreEntry = {
    username: (payload.username ?? "").trim().slice(0, 24) || "anonymous",
    score: numOr0(payload.score),
    cpm: numOr0(payload.cpm),
    wpm: numOr0(payload.wpm),
    accuracy: clamp01(payload.accuracy),
    ts: Date.now(),
  };
  const list = readAll();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const capped = list.slice(0, MAX_ENTRIES);
  writeAll(capped);
  return capped.slice(0, TOP_N);
}
