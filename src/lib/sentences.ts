/** Fetch and prepare sentences for a game. */
import { getMasteredSet } from "@/lib/mastery";
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
  return {
    disp: raw.disp,
    q: raw.q,
    kana: raw.kana,
    lang: inferLang(raw),
    uuid: raw.uuid ?? "",
  };
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

/**
 * Total number of sentences per category id, summed from the manifest's
 * per-file `count`. Files predating the count field contribute 0.
 */
export async function getCategoryTotals(): Promise<Record<string, number>> {
  const files = await getSentenceFiles();
  const totals: Record<string, number> = {};
  for (const f of files) {
    totals[f.category] = (totals[f.category] ?? 0) + (f.count ?? 0);
  }
  return totals;
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
  hideMastered = false,
): Promise<GameLoad> {
  const files = (await getSentenceFiles()).filter(
    (f) => f.category === category,
  );
  if (files.length === 0)
    throw new Error(`No sentence files for category: ${category}`);
  const file = await fetchSentenceFile(pick(files));

  // When enabled, "完全に覚えた" sentences are excluded from both reviews and
  // fresh questions. Items without a uuid (legacy state) are never excluded.
  const mastered = hideMastered ? getMasteredSet() : new Set<string>();
  const isHidden = (uuid: string | undefined) =>
    Boolean(uuid) && mastered.has(uuid as string);

  // Reserve up to 復習割合 of the slots for due reviews.
  const reviewSlots = Math.min(Math.round(n * study.reviewRatio), n);
  const due = getDueReviews(category, study).filter((it) => !isHidden(it.uuid));
  const pickedReviews = pickN(due, reviewSlots);
  const reviewQs = new Set(pickedReviews.map((it) => it.q));

  // Fill the rest with fresh questions not already chosen as reviews.
  const freshPool = file.filter((s) => !reviewQs.has(s.q) && !isHidden(s.uuid));
  const pickedFresh = pickN(freshPool, n - pickedReviews.length);

  const combined: { sentence: Sentence; review: ReviewInfo | null }[] = [
    ...pickedReviews.map((it) => ({
      sentence: {
        disp: it.disp,
        q: it.q,
        kana: it.kana,
        lang: it.lang,
        uuid: it.uuid ?? "",
      },
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
