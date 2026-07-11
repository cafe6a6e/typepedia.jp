/** Fetch and prepare sentences for a game. */
import { getDueReviews, reviewInfoOf } from "@/lib/study";
import type {
  Lang,
  RawSentence,
  ReviewInfo,
  Sentence,
  SentenceFileRef,
  StudySettings,
} from "@/types";

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

/** A game's sentences plus, for each slot, its review info (null when fresh). */
export interface GameLoad {
  sentences: Sentence[];
  reviews: (ReviewInfo | null)[];
}

/**
 * Load one game's worth of sentences from a category. A fraction of the slots
 * (復習割合) is filled with due review items for that category; the rest are
 * sampled fresh from a random file in the category. The combined set is
 * shuffled so reviews and fresh questions interleave.
 */
export async function loadGameSentences(
  category: string,
  n: number,
  study: StudySettings,
): Promise<GameLoad> {
  const files = (await getSentenceFiles()).filter(
    (f) => f.category === category,
  );
  if (files.length === 0)
    throw new Error(`No sentence files for category: ${category}`);
  const file = await fetchSentenceFile(pick(files));

  // Reserve up to 復習割合 of the slots for due reviews.
  const reviewSlots = Math.min(Math.round(n * study.reviewRatio), n);
  const due = getDueReviews(category, study);
  const pickedReviews = pickN(due, reviewSlots);
  const reviewQs = new Set(pickedReviews.map((it) => it.q));

  // Fill the rest with fresh questions not already chosen as reviews.
  const freshPool = file.filter((s) => !reviewQs.has(s.q));
  const pickedFresh = pickN(freshPool, n - pickedReviews.length);

  const combined: { sentence: Sentence; review: ReviewInfo | null }[] = [
    ...pickedReviews.map((it) => ({
      sentence: { disp: it.disp, q: it.q, lang: it.lang },
      review: reviewInfoOf(it),
    })),
    ...pickedFresh.map((s) => ({ sentence: s, review: null })),
  ];
  const shuffled = pickN(combined, combined.length);

  return {
    sentences: shuffled.map((x) => x.sentence),
    reviews: shuffled.map((x) => x.review),
  };
}
