/** Shared domain types for the typing game. */

/** Language of a sentence. "ja" = Japanese (q is romaji), "en" = plain ASCII. */
export type Lang = "ja" | "en";

/** Raw entry as authored in /sentences/<n>.json. `lang`/`uuid` are optional. */
export interface RawSentence {
  disp: string;
  q: string;
  /** Reading in hiragana (Japanese entries only) — used for speech synthesis. */
  kana?: string;
  lang?: Lang;
  /** Stable per-sentence identity (added by scripts/addUuids.ts). */
  uuid?: string;
}

/** Normalized sentence used internally (lang always resolved). */
export interface Sentence {
  disp: string;
  q: string;
  /** Reading in hiragana; absent for English and ad-hoc/test sentences. */
  kana?: string;
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
  /** 出題と同時に、問題文（英文／日本語の読み）の音声を自動再生するか。 */
  autoPlayAudio: boolean;
  /** 読み上げ速度（1 = 等速）。MIN_RATE〜MAX_RATE の範囲。 */
  speechRate: number;
  /** 日本語の読み上げに使う音声の voiceURI。空文字は自動選択。 */
  speechVoiceJa: string;
  /** 英語の読み上げに使う音声の voiceURI。空文字は自動選択。 */
  speechVoiceEn: string;
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

/**
 * Per-key typing statistics, keyed by the expected keystroke folded to lower
 * case (so A and a are one key). `correct` is how often the key was hit right;
 * `miss` counts fumbled attempts at it (the first wrong key of each
 * consecutive run).
 */
export interface KeyStat {
  /** The keyboard key that was expected, lower-cased. */
  key: string;
  correct: number;
  miss: number;
  /** correct + miss. */
  total: number;
  /** correct / total (0–1). */
  accuracy: number;
}

/** A computed result for one finished game. */
export interface ScoreResult {
  correct: number;
  miss: number;
  total: number;
  /** correct / total (0–1). */
  accuracy: number;
  /** Every key that came up, busiest first. The view ranks and trims these. */
  keyStats: KeyStat[];
}
