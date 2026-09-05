/**
 * Rules for the "Dvorak / ホームキーのみ" material.
 *
 * Every sentence in this category must be typable without leaving the Dvorak
 * home row (a o e u i d h t n s). That holds for あ行・さ行・た行・な行・は行・だ行
 * plus ん, っ and the long-vowel mark ー, as long as the kunrei spellings are
 * used: し=si, ち=ti, つ=tu, ふ=hu, ぢ=di, づ=du. ー is typed as "-", which sits at
 * the right end of the Dvorak home row, so 外来語 like ソース or セーター are in
 * scope. 「を」(wo) and punctuation are off the home row and so are excluded.
 *
 * The generator (work/gen_dvorak.ts) and the data test both go through here so
 * the rules cannot drift apart.
 */

import { compileMatcher, tokenize } from "@/lib/romajiEngine";
import { DEFAULT_SETTINGS } from "@/lib/settings";

/** The Dvorak home-row keys this material is restricted to. */
export const HOME_ROW = "aoeuidhtns-";

const HOME_ROW_ONLY = /^[aoeuidhtns-]+$/;

/** Kana -> the home-row romaji this material authors it as. */
export const KANA_TO_HOME_ROW: Record<string, string> = {
  あ: "a",
  い: "i",
  う: "u",
  え: "e",
  お: "o",
  さ: "sa",
  し: "si",
  す: "su",
  せ: "se",
  そ: "so",
  た: "ta",
  ち: "ti",
  つ: "tu",
  て: "te",
  と: "to",
  な: "na",
  に: "ni",
  ぬ: "nu",
  ね: "ne",
  の: "no",
  は: "ha",
  ひ: "hi",
  ふ: "hu",
  へ: "he",
  ほ: "ho",
  だ: "da",
  ぢ: "di",
  づ: "du",
  で: "de",
  ど: "do",
  ん: "nn",
  ー: "-",
};

/** Kana that may appear in a reading, including the sokuon. */
export const ALLOWED_KANA: ReadonlySet<string> = new Set([
  ...Object.keys(KANA_TO_HOME_ROW),
  "っ",
]);

/** Longest reading of a single word; anything longer is a 短文. */
export const MAX_WORD_KANA = 6;
/** Length band for 短文 readings. */
export const MIN_PHRASE_KANA = 7;
export const MAX_PHRASE_KANA = 20;

/**
 * Deterministic kana -> home-row romaji, the same contract as
 * work/kanken_lib.py's kana_to_romaji(): ん is always "nn" and っ doubles the
 * next kana's leading consonant. Throws on anything off the home row.
 */
export function kanaToHomeRowRomaji(kana: string): string {
  let out = "";
  for (let i = 0; i < kana.length; i++) {
    const ch = kana[i];
    if (ch === "っ") {
      const next = KANA_TO_HOME_ROW[kana[i + 1] ?? ""];
      // A sokuon only exists to double a following consonant.
      if (!next || !"dhtns".includes(next[0]) || kana[i + 1] === "ん") {
        throw new Error(`sokuon must precede a consonant kana: ${kana}`);
      }
      out += next[0];
      continue;
    }
    // ー only lengthens the sound before it.
    if (
      ch === "ー" &&
      (i === 0 || kana[i - 1] === "っ" || kana[i - 1] === "ー")
    ) {
      throw new Error(`ー must follow a vowel sound: ${kana}`);
    }
    const romaji = KANA_TO_HOME_ROW[ch];
    if (!romaji) throw new Error(`kana off the home row: ${ch} (${kana})`);
    out += romaji;
  }
  return out;
}

/** Reading rebuilt from `q` by the real engine tokenizer. */
function kanaFromRomaji(q: string): string {
  return tokenize(q)
    .map((t) => (t.sokuon ? `っ${t.kana}` : t.kana))
    .join("");
}

/** The romaji guide the player actually sees under the sentence. */
function guideOf(q: string): string {
  return compileMatcher(q, DEFAULT_SETTINGS, "ja")
    .map((slot) => slot.variants[0])
    .join("");
}

/** True for a hiragana character or the long-vowel mark. */
function isKana(c: string): boolean {
  return (c >= "ぁ" && c <= "ん") || c === "ー";
}

/** Katakana folded to hiragana so disp and kana can be compared directly. */
export function toHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60),
  );
}

export interface DvorakEntry {
  disp: string;
  kana: string;
  q: string;
}

/** Hard rules for one entry. Returns an empty array when it is acceptable. */
export function checkEntry(e: DvorakEntry): string[] {
  const errors: string[] = [];

  if (!e.disp || /[!-~\s]/.test(e.disp)) {
    errors.push("disp must be non-empty Japanese with no ASCII");
  }
  if (/[、。「」・，．！？]/.test(e.disp)) {
    errors.push("disp must not contain punctuation");
  }
  // 外来語 are written in katakana, so disp may hold either script; what matters
  // is that every kana in it reads as something on the home row.
  const dispKana = toHiragana(e.disp);
  const loose = [...dispKana].filter((c) => isKana(c) && !ALLOWED_KANA.has(c));
  if (loose.length > 0) {
    errors.push(`disp kana off the home row: ${[...new Set(loose)].join("")}`);
  }
  // disp is 漢字かな交じり (or katakana) by design; an all-hiragana disp is a
  // function word or a reading that lost its headword.
  if (!/[\u4e00-\u9fff\u30a1-\u30f6]/.test(e.disp)) {
    errors.push("disp must contain kanji or katakana");
  }
  // An い-adjective cannot take the copula ("酸いだった"). 丁寧だ is fine: the
  // い there belongs to the kanji reading, not to an adjective ending.
  if (/[\u4e00-\u9fff]い(だった|だ)$/.test(e.disp)) {
    errors.push("i-adjective cannot be followed by だ");
  }

  if (!e.kana) {
    errors.push("kana is empty");
    return errors;
  }
  const bad = [...e.kana].filter((c) => !ALLOWED_KANA.has(c));
  if (bad.length > 0) {
    errors.push(
      `kana uses disallowed characters: ${[...new Set(bad)].join("")}`,
    );
    return errors;
  }
  if (e.kana.length > MAX_PHRASE_KANA || e.kana.length < 2) {
    errors.push(`kana length ${e.kana.length} out of range`);
  }

  // Kana in disp is read as written, so a kana run at either end must show up at
  // the same end of the reading (catches 出し authored as だした).
  const tail = /[ぁ-んー]+$/.exec(dispKana)?.[0];
  if (tail && !e.kana.endsWith(tail)) {
    errors.push(`disp ends with ${tail} but the reading is ${e.kana}`);
  }
  const head = /^[ぁ-んー]+/.exec(dispKana)?.[0];
  if (head && !e.kana.startsWith(head)) {
    errors.push(`disp starts with ${head} but the reading is ${e.kana}`);
  }

  let expected: string;
  try {
    expected = kanaToHomeRowRomaji(e.kana);
  } catch (err) {
    errors.push((err as Error).message);
    return errors;
  }
  if (e.q !== expected) {
    errors.push(`q should be "${expected}" for ${e.kana}, got "${e.q}"`);
    return errors;
  }
  if (!HOME_ROW_ONLY.test(e.q)) errors.push(`q leaves the home row: ${e.q}`);

  // The greedy tokenizer must split q back into exactly this reading, and the
  // on-screen guide must stay on the home row too.
  const roundTrip = kanaFromRomaji(e.q);
  if (roundTrip !== e.kana) {
    errors.push(`q tokenizes to ${roundTrip}, not ${e.kana}`);
  }
  const guide = guideOf(e.q);
  if (!HOME_ROW_ONLY.test(guide)) {
    errors.push(`romaji guide leaves the home row: ${guide}`);
  }

  return errors;
}
