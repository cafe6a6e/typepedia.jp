/** Shared domain types for the typing game. */

/** Language of a sentence. "ja" = Japanese (q is romaji), "en" = plain ASCII. */
export type Lang = "ja" | "en";

/** Raw entry as authored in /sentences/<n>.json. `lang` is optional. */
export interface RawSentence {
  disp: string;
  q: string;
  lang?: Lang;
}

/** Normalized sentence used internally (lang always resolved). */
export interface Sentence {
  disp: string;
  q: string;
  lang: Lang;
}

/**
 * A single typing unit compiled from a sentence. For Japanese this is one kana
 * (possibly yōon/sokuon-merged); for English it is one character.
 * `variants` are the accepted romaji spellings, ordered preferred-first.
 */
export interface Slot {
  kana: string;
  display: string;
  variants: string[];
}

/** A whole sentence compiled into an ordered list of slots. */
export type Matcher = Slot[];

/** A sentence file identified by its category folder and integer id. */
export interface SentenceFileRef {
  category: string;
  id: number;
}

/** Position state while typing a single sentence. */
export interface EngineState {
  slotIndex: number;
  buffer: string;
}

/** Result of feeding one keystroke into the engine. */
export type FeedResult = "progress" | "complete-slot" | "complete-all" | "miss";

/** User settings, persisted to localStorage. */
export interface Settings {
  username: string;
  questionCount: number;
  /** Selected sentence category folder (typing material). */
  category: string;
  /** Ambiguous c-/cy- input -> "k" (か行) or "s" (さ行). One side always chosen. */
  cMapping: Record<string, "k" | "s">;
}

/** A computed score for one finished game. */
export interface ScoreResult {
  correct: number;
  miss: number;
  total: number;
  elapsedMs: number;
  cpm: number;
  wpm: number;
  accuracy: number;
  score: number;
}
