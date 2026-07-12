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

/** Spaced-review parameters for the "学習中" feature. */
export interface StudySettings {
  /** 復習頻度: hours that must pass before an item is due again. */
  reviewFrequencyHours: number;
  /** 復習回数: how many times a learning item is re-presented before graduating. */
  reviewCount: number;
  /** 復習割合: fraction (0–1) of a game's questions drawn from due reviews. */
  reviewRatio: number;
}

/** User settings, persisted to localStorage. */
export interface Settings {
  username: string;
  questionCount: number;
  /** Selected sentence category folder (typing material). */
  category: string;
  /** Ambiguous c-/cy- input -> "k" (か行) or "s" (さ行). One side always chosen. */
  cMapping: Record<string, "k" | "s">;
  /** 学習設定: spaced-review parameters. */
  study: StudySettings;
}

/** Reference info attached to a review question shown during play. */
export interface ReviewInfo {
  /** 1-based: this is the Nth review (復習n回目). */
  attempt: number;
  /** Epoch ms of the previous presentation; 0 when this is the first review. */
  lastReviewedTs: number;
}

/** A key that was actually pressed by mistake, with how often. */
export interface WrongKey {
  /** The key the user actually pressed (a single character). */
  key: string;
  count: number;
}

/** One mistyped character and how it contributed to the total misses. */
export interface MissCount {
  /** The character being typed when the miss happened (kana, or ASCII char). */
  char: string;
  count: number;
  /** Share of all misses attributed to this char (0–1). */
  ratio: number;
  /** Which keys were wrongly pressed for this char, most-frequent first (top 5). */
  wrongKeys: WrongKey[];
}

/** A computed result for one finished game. */
export interface ScoreResult {
  correct: number;
  miss: number;
  total: number;
  /** correct / total (0–1). */
  accuracy: number;
  /** Most-mistyped characters, highest first (top 10). */
  missByChar: MissCount[];
  /** Keys mis-pressed the fewest times overall, least-first (top 10). */
  leastMissedKeys: WrongKey[];
}
