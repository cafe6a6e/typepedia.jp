/** Thin wrapper around the Web Speech API (SpeechSynthesis). */

/** 読み上げ速度の許容範囲と既定値（設定のバリデーションと UI が共有する）。 */
export const MIN_RATE = 0.5;
export const MAX_RATE = 2;
export const DEFAULT_RATE = 1;

/** True when the browser can synthesize speech. */
export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// --- 音声一覧のキャッシュ ---
//
// Chrome は最初の getVoices() が [] を返し、あとから voiceschanged を発火する。
// useSyncExternalStore から読めるよう、中身が変わったときだけ配列を差し替えて
// 同一参照を保つ（毎回新しい配列を返すと無限に再レンダリングされる）。

const NO_VOICES: SpeechSynthesisVoice[] = [];
let cachedVoices: SpeechSynthesisVoice[] = NO_VOICES;
let cachedSignature = "";
let listening = false;
const listeners = new Set<() => void>();

function signatureOf(voices: SpeechSynthesisVoice[]): string {
  return voices.map((v) => `${v.voiceURI}|${v.lang}`).join("\n");
}

/** Pull the latest voices into the cache. Returns true when they changed. */
function syncVoices(): boolean {
  const usable =
    canSpeak() && typeof window.speechSynthesis.getVoices === "function";
  const next = usable
    ? (window.speechSynthesis.getVoices() ?? NO_VOICES)
    : NO_VOICES;
  const signature = signatureOf(next);
  if (signature === cachedSignature) return false;
  cachedSignature = signature;
  cachedVoices = next;
  return true;
}

function handleVoicesChanged(): void {
  if (syncVoices()) for (const notify of [...listeners]) notify();
}

/** Fill the cache once and start watching for late-loading voices. */
function ensureListening(): void {
  if (listening || !canSpeak()) return;
  listening = true;
  syncVoices();
  const synth = window.speechSynthesis;
  if (typeof synth.addEventListener === "function") {
    synth.addEventListener("voiceschanged", handleVoicesChanged);
  } else {
    synth.onvoiceschanged = handleVoicesChanged;
  }
}

/**
 * The browser's voices, cached. Empty until they have loaded — subscribe with
 * `subscribeVoices` to be told when they arrive. The reference is stable while
 * the list is unchanged, so this is safe as a `useSyncExternalStore` snapshot.
 */
export function getVoices(): SpeechSynthesisVoice[] {
  ensureListening();
  syncVoices();
  return cachedVoices;
}

/** Watch for the voice list changing. Returns an unsubscribe function. */
export function subscribeVoices(onChange: () => void): () => void {
  ensureListening();
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

// --- 音声の選択 ---

/**
 * 言語ごとの音声の優先順位。先にマッチするものほど高品質。ブラウザ既定の音声は
 * Windows の Ayumi/Haruka のような旧世代のものが選ばれがちなので、明示的に選び直す。
 */
const PREFERRED: Record<string, RegExp[]> = {
  ja: [
    /Google 日本語/i,
    /Nanami|Keita/i, // Microsoft Natural (neural)
    /Kyoko|Otoya|Hattori|O-Ren/i, // Apple
    /Ayumi|Haruka|Ichiro|Sayaka/i, // Microsoft legacy
  ],
  en: [
    /Google US English/i,
    /Ava|Jenny|Aria|Guy|Emma/i, // Microsoft Natural (neural)
    /Samantha|Alex|Allison/i, // Apple
  ],
};

/** "ja-JP" / "ja_JP" -> "ja" */
function primaryTag(lang: string): string {
  return lang.toLowerCase().replace("_", "-").split("-")[0];
}

/** The voices able to speak `lang`, matched on the primary subtag ("ja", "en"). */
export function voicesFor(
  voices: SpeechSynthesisVoice[],
  lang: string,
): SpeechSynthesisVoice[] {
  const want = primaryTag(lang);
  return voices.filter((v) => primaryTag(v.lang) === want);
}

/** Lower is better: name rank first, then network (neural) voices, then default. */
function rankOf(voice: SpeechSynthesisVoice, ranks: RegExp[]): number {
  const index = ranks.findIndex((re) => re.test(voice.name));
  const nameRank = index === -1 ? ranks.length : index;
  return nameRank * 4 + (voice.localService ? 2 : 0) + (voice.default ? 0 : 1);
}

/**
 * Choose the voice to speak `lang` with. An explicit `preferredURI` (the user's
 * pick in settings) always wins, as long as that voice still exists. Otherwise
 * the best-ranked voice for the language is used, or null when the browser has
 * none — the caller then falls back to `utterance.lang` alone.
 */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  lang: string,
  preferredURI = "",
): SpeechSynthesisVoice | null {
  if (preferredURI) {
    const chosen = voices.find((v) => v.voiceURI === preferredURI);
    if (chosen) return chosen;
  }
  const matches = voicesFor(voices, lang);
  if (matches.length === 0) return null;
  const ranks = PREFERRED[primaryTag(lang)] ?? [];
  return matches.reduce((best, v) =>
    rankOf(v, ranks) < rankOf(best, ranks) ? v : best,
  );
}

// --- 再生 ---

export interface SpeakOptions {
  /** BCP 47 tag (default American English). */
  lang?: string;
  /** 1 = normal. */
  rate?: number;
  /** voiceURI the user picked in settings; empty selects one automatically. */
  voiceURI?: string;
}

/**
 * Speak `text`, cancelling any utterance already in progress. No-op when speech
 * synthesis is unavailable.
 */
export function speak(text: string, opts: SpeakOptions = {}): void {
  if (!canSpeak() || !text.trim()) return;
  const { lang = "en-US", rate = DEFAULT_RATE, voiceURI = "" } = opts;
  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  utterance.pitch = 1;
  utterance.volume = 1;
  const voice = pickVoice(getVoices(), lang, voiceURI);
  if (voice) utterance.voice = voice;

  synth.speak(utterance);
  // Chrome がまれに paused のままになり無音になるので、念のため再開させる。
  synth.resume?.();
}

/** Stop whatever is being spoken (used when leaving the play screen). */
export function stopSpeaking(): void {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
}
