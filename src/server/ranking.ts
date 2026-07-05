/** Ranking persistence backed by a JSON file on disk. */
import type { ScoreEntry } from "@/types";

const RANKING_PATH = "data/ranking.json";
const MAX_ENTRIES = 1000;

// Serialize writes so concurrent POSTs don't clobber each other.
let writeChain: Promise<unknown> = Promise.resolve();

export async function readRanking(): Promise<ScoreEntry[]> {
  const file = Bun.file(RANKING_PATH);
  if (!(await file.exists())) return [];
  try {
    const data = JSON.parse(await file.text());
    return Array.isArray(data) ? (data as ScoreEntry[]) : [];
  } catch {
    return [];
  }
}

export async function addScore(entry: ScoreEntry): Promise<ScoreEntry[]> {
  const op = writeChain.then(async () => {
    const list = await readRanking();
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    const capped = list.slice(0, MAX_ENTRIES);
    await Bun.write(RANKING_PATH, JSON.stringify(capped, null, 2));
    return capped;
  });
  // Keep the chain alive even if one write fails.
  writeChain = op.catch(() => {});
  return op;
}
