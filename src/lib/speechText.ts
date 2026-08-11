/** Decide what text to read aloud for a sentence, and in which language. */
import type { Sentence } from "@/types";

/** BCP 47 tags handed to the Web Speech API. */
export const JA_LANG = "ja-JP";
export const EN_LANG = "en-US";

/** 漢字（々〆ヶ を含む）だけからなる語。 */
const ALL_KANJI = /^[一-鿿々〆ヶ]+$/;

/**
 * 四字熟語のような「漢字だけの短い語」か。日本語の文には必ずひらがな（助詞・送りがな）が
 * 混じるので、文をここで拾ってしまうことはない。
 */
export function isCompound(disp: string): boolean {
  return disp.length <= 8 && ALL_KANJI.test(disp);
}

export interface SpeechText {
  text: string;
  lang: string;
}

/**
 * 読み上げるテキストと言語を決める。
 *
 * - 英語題材は問題文（q）がそのまま英文なので、それを読み上げる。
 * - 日本語の「文」は disp（漢字かな交じり）を読み上げる。ひらがなだけを渡すと形態素解析が
 *   効かず、助詞の は→「ハ」・を→「ヲ」・へ→「ヘ」を誤読し、外来語（ちーむ）も崩れるため。
 * - 日本語でも四字熟語のような漢字だけの語は逆に誤読されやすいので、読み（kana）を渡す。
 * - kana を持たない旧 localStorage の復習項目などでは disp で代用する。
 */
export function speechTextOf(s: Sentence): SpeechText {
  if (s.lang === "en") return { text: s.q, lang: EN_LANG };
  const text = isCompound(s.disp) ? s.kana?.trim() || s.disp : s.disp;
  return { text, lang: JA_LANG };
}
