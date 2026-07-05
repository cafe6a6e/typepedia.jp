/** Fetch and prepare sentences for a game. */
import type { Lang, RawSentence, Sentence, SentenceFileRef } from "@/types";

/** Heuristic: treat an entry as English when disp equals q and it is ASCII. */
function inferLang(raw: RawSentence): Lang {
  if (raw.lang) return raw.lang;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching ASCII range intentionally.
  const isAscii = /^[\x00-\x7F]*$/.test(raw.q);
  return raw.disp === raw.q && isAscii ? "en" : "ja";
}

function normalize(raw: RawSentence): Sentence {
  return { disp: raw.disp, q: raw.q, lang: inferLang(raw) };
}

/** Available sentence files across all categories.
 *
 * URLs are relative (no leading slash) so the site works both at a domain root
 * and under a GitHub Pages project subpath. The manifest is a static file
 * generated at build time (and served by the dev server) that lists every
 * `<category>/<id>.json`. */
export async function getSentenceFiles(): Promise<SentenceFileRef[]> {
  const res = await fetch("sentences/manifest.json");
  if (!res.ok) throw new Error(`Failed to list sentences: ${res.status}`);
  return (await res.json()) as SentenceFileRef[];
}

/** Distinct category folders that have sentence files, in listing order. */
export async function getCategories(): Promise<string[]> {
  const files = await getSentenceFiles();
  return [...new Set(files.map((f) => f.category))];
}

/** Fetch and normalize one sentence file. */
export async function fetchSentenceFile(
  ref: SentenceFileRef,
): Promise<Sentence[]> {
  const res = await fetch(`sentences/${ref.category}/${ref.id}.json`);
  if (!res.ok)
    throw new Error(
      `Failed to fetch ${ref.category}/${ref.id}.json: ${res.status}`,
    );
  const raw = (await res.json()) as RawSentence[];
  return raw.map(normalize);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Randomly sample up to `n` distinct items (Fisher–Yates partial shuffle). */
export function pickN<T>(items: T[], n: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

/**
 * Load one game's worth of sentences from a category: pick a random file in that
 * category, then sample N from it.
 */
export async function loadGameSentences(
  category: string,
  n: number,
): Promise<Sentence[]> {
  const files = (await getSentenceFiles()).filter(
    (f) => f.category === category,
  );
  if (files.length === 0)
    throw new Error(`No sentence files for category: ${category}`);
  const file = await fetchSentenceFile(pick(files));
  return pickN(file, n);
}
