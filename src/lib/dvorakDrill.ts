/**
 * Rules for the Dvorak finger-discipline materials.
 *
 * Each drill fixes a set of keys and admits only the sentences typable with
 * them. The kana table is derived from the real romaji table rather than
 * hand-written: for every kana we take the shortest accepted spelling that fits
 * the keys, so 訓令式 falls out on its own (し=si, ち=ti, つ=tu, ふ=hu, しゃ=sya)
 * and a kana with no fitting spelling is simply out of scope.
 *
 * The generator (work/gen_dvorak.ts) and the data test both go through here so
 * the rules cannot drift apart.
 */

import { compileMatcher, tokenize } from "@/lib/romajiEngine";
import { KANA_TO_ROMAJI } from "@/lib/romajiTable";
import { DEFAULT_SETTINGS } from "@/lib/settings";

/** Japanese punctuation, and the key each one is typed with. */
const PUNCTUATION: Record<string, string> = { "、": ",", "。": "." };

/** Longest reading of a single word; anything longer is a 短文. */
export const MAX_WORD_KANA = 6;
/** Length band for 短文 readings. */
export const MIN_PHRASE_KANA = 7;
export const MAX_PHRASE_KANA = 20;

export interface DrillSpec {
  /** Category id this drill validates. */
  id: string;
  /** Every character the drill allows, romaji and punctuation alike. */
  keys: string;
  /** Whether 拗音 are in scope. */
  yoon: boolean;
}

export interface DvorakEntry {
  disp: string;
  kana: string;
  q: string;
}

export interface Drill {
  spec: DrillSpec;
  /** kana -> the spelling this drill authors it as. */
  kanaToRomaji: Record<string, string>;
  /** Every kana a reading may use, including っ and any punctuation. */
  allowedKana: ReadonlySet<string>;
  toRomaji(kana: string): string;
  checkEntry(e: DvorakEntry): string[];
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

/** Shortest accepted spelling that fits the keys; table order breaks ties. */
function spellingFor(variants: string[], keys: Set<string>): string | null {
  const fitting = variants.filter((v) => [...v].every((c) => keys.has(c)));
  if (fitting.length === 0) return null;
  return fitting.reduce((best, v) => (v.length < best.length ? v : best));
}

export function createDrill(spec: DrillSpec): Drill {
  const keys = new Set(spec.keys.split(""));
  const kanaToRomaji: Record<string, string> = {};

  for (const [kana, variants] of Object.entries(KANA_TO_ROMAJI)) {
    if (!spec.yoon && kana.length > 1) continue;
    const spelling = spellingFor(variants, keys);
    if (spelling) kanaToRomaji[kana] = spelling;
  }
  // ん is always written doubled so the greedy tokenizer cannot mistake it for
  // the start of the next sound (あんない -> annnai).
  if (kanaToRomaji["ん"]) kanaToRomaji["ん"] = "nn";
  for (const [mark, key] of Object.entries(PUNCTUATION)) {
    if (keys.has(key)) kanaToRomaji[mark] = key;
  }

  // Character-level, so a 拗音 entry like "りょ" contributes both り and ょ.
  // Placement is still enforced by toRomaji, which only knows whole units.
  const allowedKana: ReadonlySet<string> = new Set([
    ...Object.keys(kanaToRomaji).flatMap((k) => [...k]),
    "っ",
  ]);
  const allowedKeys = new RegExp(
    `^[${spec.keys.replace(/[\\\]^-]/g, "\\$&")}]+$`,
  );

  /**
   * Deterministic kana -> romaji, the same contract as work/kanken_lib.py's
   * kana_to_romaji(): っ doubles the next kana's leading consonant. Throws on
   * anything this drill cannot type.
   */
  function toRomaji(kana: string): string {
    let out = "";
    for (let i = 0; i < kana.length; i++) {
      const ch = kana[i];
      if (ch === "っ") {
        const next = kanaToRomaji[kana[i + 1] ?? ""];
        const consonant = next?.[0];
        // A sokuon only exists to double a following consonant.
        if (
          !consonant ||
          "aiueo-,.".includes(consonant) ||
          kana[i + 1] === "ん"
        ) {
          throw new Error(`sokuon must precede a consonant kana: ${kana}`);
        }
        out += consonant;
        continue;
      }
      // ー only lengthens the sound before it.
      if (
        ch === "ー" &&
        (i === 0 || kana[i - 1] === "っ" || kana[i - 1] === "ー")
      ) {
        throw new Error(`ー must follow a vowel sound: ${kana}`);
      }
      // 拗音 and other two-kana units are consumed as one token.
      const pair = kana.slice(i, i + 2);
      if (pair.length === 2 && kanaToRomaji[pair]) {
        out += kanaToRomaji[pair];
        i++;
        continue;
      }
      const romaji = kanaToRomaji[ch];
      if (!romaji) throw new Error(`kana outside the drill: ${ch} (${kana})`);
      out += romaji;
    }
    return out;
  }

  /** Hard rules for one entry. Returns an empty array when it is acceptable. */
  function checkEntry(e: DvorakEntry): string[] {
    const errors: string[] = [];

    if (!e.disp || /[!-~\s]/.test(e.disp)) {
      errors.push("disp must be non-empty Japanese with no ASCII");
    }
    // 外来語 are written in katakana, so disp may hold either script; what
    // matters is that every kana in it reads as something the drill can type.
    const dispKana = toHiragana(e.disp);
    const loose = [...dispKana].filter((c) => isKana(c) && !allowedKana.has(c));
    if (loose.length > 0) {
      errors.push(
        `disp kana outside the drill: ${[...new Set(loose)].join("")}`,
      );
    }
    for (const mark of ["、", "。", "「", "」", "・", "，", "．", "！", "？"]) {
      if (e.disp.includes(mark) && !allowedKana.has(mark)) {
        errors.push(`disp must not contain ${mark}`);
        break;
      }
    }
    // disp is 漢字かな交じり (or katakana) by design; an all-hiragana disp is a
    // function word or a reading that lost its headword.
    if (!/[一-鿿ァ-ヶ]/.test(e.disp)) {
      errors.push("disp must contain kanji or katakana");
    }
    // An い-adjective cannot take the copula ("酸いだった"). 丁寧だ is fine: the
    // い there belongs to the kanji reading, not to an adjective ending.
    if (/[一-鿿]い(だった|だ)$/.test(e.disp)) {
      errors.push("i-adjective cannot be followed by だ");
    }

    if (!e.kana) {
      errors.push("kana is empty");
      return errors;
    }
    const bad = [...e.kana].filter((c) => !allowedKana.has(c));
    if (bad.length > 0) {
      errors.push(
        `kana uses characters outside the drill: ${[...new Set(bad)].join("")}`,
      );
      return errors;
    }
    if (e.kana.length > MAX_PHRASE_KANA || e.kana.length < 2) {
      errors.push(`kana length ${e.kana.length} out of range`);
    }

    // Kana in disp is read as written, so a kana run at either end must show up
    // at the same end of the reading (catches 出し authored as だした).
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
      expected = toRomaji(e.kana);
    } catch (err) {
      errors.push((err as Error).message);
      return errors;
    }
    if (e.q !== expected) {
      errors.push(`q should be "${expected}" for ${e.kana}, got "${e.q}"`);
      return errors;
    }
    if (!allowedKeys.test(e.q))
      errors.push(`q leaves the drill's keys: ${e.q}`);

    // The greedy tokenizer must split q back into exactly this reading, and the
    // on-screen guide must stay inside the drill's keys too.
    const roundTrip = kanaFromRomaji(e.q);
    if (roundTrip !== e.kana) {
      errors.push(`q tokenizes to ${roundTrip}, not ${e.kana}`);
    }
    const guide = guideOf(e.q);
    if (!allowedKeys.test(guide)) {
      errors.push(`romaji guide leaves the drill's keys: ${guide}`);
    }

    return errors;
  }

  return { spec, kanaToRomaji, allowedKana, toRomaji, checkEntry };
}

/** あ・さ・た・な・は・だ行 plus ん, っ and ー, all on the Dvorak home row. */
export const HOME_ROW = createDrill({
  id: "dvorak_home_row",
  keys: "aoeuidhtns-",
  yoon: false,
});

/**
 * The whole left hand, but only the right pinky (LSZ), ring (RNV) and middle
 * (CTW) — so no b d f g h m, which drops は・ま・が・だ・ば行 and ふ.
 */
export const RIGHT_THREE = createDrill({
  id: "dvorak_right3",
  keys: "aoeuipyqjkx',.;lszrnvctw-",
  yoon: true,
});

/**
 * Pinky (LSZ), ring (RNV) and index (GHM + FDB) — the middle finger's column is
 * out, so c/t/w go and with them た行, わ, を and ちゃ行. Past 〜た and the
 * て-form disappear too, though 〜んだ / 〜いだ survive.
 *
 * `k` is dropped as well even though it sits on the left hand: the engine also
 * accepts ca/cu/co for か行, which would let the right middle finger sneak back
 * in. Removing か行 and きゃ行 closes that door.
 */
export const RIGHT_INDEX = createDrill({
  id: "dvorak_right_index",
  keys: "aoeuipyqjx',.;lszrnvghmfdb-",
  yoon: true,
});

export const DRILLS: Drill[] = [HOME_ROW, RIGHT_THREE, RIGHT_INDEX];
