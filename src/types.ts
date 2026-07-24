/** Shared domain types for the typing game. */

/** Language of a sentence. "ja" = Japanese (q is romaji), "en" = plain ASCII. */
export type Lang = "ja" | "en";

/** Raw entry as authored in /sentences/<n>.json. `lang`/`uuid` are optional. */
export interface RawSentence {
  disp: string;
  q: string;
  lang?: Lang;
  /** Stable per-sentence identity (added by scripts/addUuids.ts). */
  uuid?: string;
}

/** Normalized sentence used internally (lang always resolved). */
export interface Sentence {
  disp: string;
  q: string;
  lang: Lang;
  /** Stable per-sentence identity. Empty string only for ad-hoc/test sentences. */
  uuid: string;
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
  /** Number of sentences in the file (for per-category totals). */
  count?: number;
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
  /** 英語題材で、出題と同時に問題文の音声を自動再生するか。 */
  autoPlayAudio: boolean;
  /** 「完全に覚えた」問題を今後の出題から除外するか（既定 true）。 */
  hideMastered: boolean;
  /** 入力部分（q）を、正解済みの文字だけ表示して隠すか（既定 false）。 */
  hideInput: boolean;
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

/**
 * Per-key typing statistics, keyed by the expected keystroke. `correct` is how
 * often the key was hit right; `miss` counts fumbled attempts at it (the first
 * wrong key of each consecutive run); `wrongKeys` are what was pressed instead.
 */
export interface KeyStat {
  /** The keyboard key that was expected (a single character). */
  key: string;
  correct: number;
  miss: number;
  /** correct + miss. */
  total: number;
  /** correct / total (0–1). */
  accuracy: number;
  /** miss / total (0–1). */
  missRate: number;
  /** Keys pressed instead when this key was expected, most-first (top 5). */
  wrongKeys: WrongKey[];
}

/** A computed result for one finished game. */
export interface ScoreResult {
  correct: number;
  miss: number;
  total: number;
  /** correct / total (0–1). */
  accuracy: number;
  /** Keys with the lowest accuracy (that had misses), worst-first (bottom 10). */
  lowAccuracyKeys: KeyStat[];
  /** Keys with the highest accuracy, best-first (top 10). */
  highAccuracyKeys: KeyStat[];
}
