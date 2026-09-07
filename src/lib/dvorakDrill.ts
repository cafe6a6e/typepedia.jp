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
const PUNCTUATION_BY_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(PUNCTUATION).map(([mark, key]) => [key, mark]),
);

/** Longest reading of a single word; anything longer is a 短文. */
export const MAX_WORD_KANA = 6;
/** Length band for 短文 readings. */
export const MIN_PHRASE_KANA = 7;
export const MAX_PHRASE_KANA = 20;
/** A mimetic word is one stem of this many kana units, said twice: ぴよ+ぴよ. */
export const STEM_UNITS = 2;
/**
 * Vowel-only stems may run one sound longer — アイウアイウ. Two-sound stems on
 * their own leave the all-vowel words, the easiest reach on the whole material,
 * as a thin slice of it.
 */
export const VOWEL_STEM_UNITS = 3;

/** Shapes that are well formed but read as something other than a sound. */
const NOT_A_SOUND = new Set(["ぱいぱい"]);

export interface DrillSpec {
  /** Category id this drill validates. */
  id: string;
  /** Every character the drill allows, romaji and punctuation alike. */
  keys: string;
  /** Whether 拗音 are in scope. */
  yoon: boolean;
  /**
   * Narrows the drill to exactly these kana units. Without it the drill takes
   * everything the keys can spell, which is the right default for a drill named
   * after a set of fingers but not for one built on a chosen set of sounds.
   */
  kana?: string[];
  /**
   * Entries are repetition-type 擬音語 rather than ordinary words, so they are
   * checked for that shape and written in katakana instead of being matched
   * against a headword.
   */
  mimetic?: boolean;
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
  /**
   * Faults in a single 擬音語, so a generator can sift words before pairing them
   * into entries. Always empty for a drill that is not `mimetic`.
   */
  mimeticWordFaults(kana: string): string[];
  checkEntry(e: DvorakEntry): string[];
}

/** True for a hiragana character or the long-vowel mark. */
function isKana(c: string): boolean {
  return (c >= "ぁ" && c <= "ん") || c === "ー";
}

/** Katakana folded to hiragana so disp and kana can be compared directly. */
function toHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60),
  );
}

/** The other direction, for material that is conventionally written in katakana. */
export function toKatakana(text: string): string {
  return text.replace(/[ぁ-ん]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) + 0x60),
  );
}

/**
 * Reading rebuilt from `q` by the real engine tokenizer. The tokenizer only
 * knows the romaji table, where , and . are not kana, so it hands them back as
 * literals; PUNCTUATION is this module's own idea and the round trip has to
 * undo it here.
 */
function kanaFromRomaji(q: string): string {
  return tokenize(q)
    .map((t) => {
      const kana = PUNCTUATION_BY_KEY[t.kana] ?? t.kana;
      return t.sokuon ? `っ${kana}` : kana;
    })
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
  if (spec.kana) {
    const wanted = new Set(spec.kana);
    for (const kana of wanted) {
      if (!(kana in kanaToRomaji)) {
        throw new Error(`${spec.id} cannot spell ${kana} with its keys`);
      }
    }
    for (const kana of Object.keys(kanaToRomaji)) {
      if (!wanted.has(kana)) delete kanaToRomaji[kana];
    }
  }

  // Character-level, so a 拗音 entry like "りょ" contributes both り and ょ.
  // Placement is still enforced by toRomaji, which only knows whole units.
  // A hand-picked kana set is taken literally, sokuon included: っ is only
  // implicit for the drills that take everything their keys can spell.
  const allowedKana: ReadonlySet<string> = new Set([
    ...Object.keys(kanaToRomaji).flatMap((k) => [...k]),
    ...(spec.kana ? [] : ["っ"]),
  ]);
  const allowedKeys = new RegExp(
    `^[${spec.keys.replace(/[\\\]^-]/g, "\\$&")}]+$`,
  );

  /**
   * A reading split into the units the drill types it in: a 拗音 like りょ is one
   * unit, while っ and ー stay on their own because they modify a neighbour.
   */
  function unitsOf(kana: string): string[] {
    const units: string[] = [];
    for (let i = 0; i < kana.length; i++) {
      // 拗音 and other two-kana units are consumed as one token.
      const pair = kana.slice(i, i + 2);
      if (pair.length === 2 && kanaToRomaji[pair]) {
        units.push(pair);
        i++;
        continue;
      }
      units.push(kana[i]);
    }
    return units;
  }

  /**
   * Deterministic kana -> romaji, the same contract as work/kanken_lib.py's
   * kana_to_romaji(): っ doubles the next kana's leading consonant. Throws on
   * anything this drill cannot type.
   */
  function toRomaji(kana: string): string {
    const units = unitsOf(kana);
    let out = "";
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      if (unit === "っ") {
        const next = kanaToRomaji[units[i + 1] ?? ""];
        const consonant = next?.[0];
        // A sokuon only exists to double a following consonant.
        if (
          !consonant ||
          "aiueo-,.".includes(consonant) ||
          units[i + 1] === "ん"
        ) {
          throw new Error(`sokuon must precede a consonant kana: ${kana}`);
        }
        out += consonant;
        continue;
      }
      // ー only lengthens the sound before it.
      if (
        unit === "ー" &&
        (i === 0 || units[i - 1] === "っ" || units[i - 1] === "ー")
      ) {
        throw new Error(`ー must follow a vowel sound: ${kana}`);
      }
      const romaji = kanaToRomaji[unit];
      if (!romaji) throw new Error(`kana outside the drill: ${unit} (${kana})`);
      out += romaji;
    }
    return out;
  }

  /**
   * Shape of a repetition-type 擬音語: one stem said twice (ぴよ+ぴよ). The two
   * sounds of a stem also have to sit well together, which rules out a doubled
   * sound (ぷぷぷぷ), two 拗音 in a row (じょじゃじょじゃ) and a 拗音 beside its
   * own consonant (ぴぴゃぴぴゃ). An all-vowel stem may instead run three sounds
   * long, as long as they are all different (あいうあいう).
   */
  function mimeticFaults(kana: string): string[] {
    if (NOT_A_SOUND.has(kana)) {
      return [`left out of the material on purpose: ${kana}`];
    }

    const units = unitsOf(kana);
    const stemLength = units.length / 2;
    if (stemLength !== STEM_UNITS && stemLength !== VOWEL_STEM_UNITS) {
      return [
        `mimetic word must be a stem of ${STEM_UNITS} or ${VOWEL_STEM_UNITS} sounds said twice, got ${units.length} units: ${kana}`,
      ];
    }
    const stem = units.slice(0, stemLength);
    if (stem.join("") !== units.slice(stemLength).join("")) {
      return [`mimetic word must say its stem twice: ${kana}`];
    }

    const isYoon = (unit: string) => unit.length > 1;
    // The onset comes from the spelling, so it cannot drift from the table.
    const onset = (unit: string) => kanaToRomaji[unit]?.[0] ?? "";
    const isVowel = (unit: string) =>
      /^[aiueo]$/.test(kanaToRomaji[unit] ?? "");

    if (stemLength === VOWEL_STEM_UNITS) {
      if (!stem.every(isVowel)) {
        return [
          `only an all-vowel stem may run ${VOWEL_STEM_UNITS} sounds: ${kana}`,
        ];
      }
      // All different, which also keeps the seam between the halves clean.
      if (new Set(stem).size !== stem.length) {
        return [
          `a ${VOWEL_STEM_UNITS}-sound stem must not repeat a vowel: ${kana}`,
        ];
      }
      return [];
    }

    const [first, second] = stem;
    if (first === second) return [`stem repeats one sound: ${kana}`];
    if (isYoon(first) && isYoon(second)) {
      return [`stem puts two 拗音 in a row: ${kana}`];
    }
    if (onset(first) === onset(second) && (isYoon(first) || isYoon(second))) {
      return [`stem puts a 拗音 beside its own consonant: ${kana}`];
    }
    return [];
  }

  /**
   * One entry is two different 擬音語 side by side: アイアイ、ウオウオ。 The comma
   * splits the line so the eye can take each half in on its own.
   */
  function entryFaults(kana: string): string[] {
    const units = unitsOf(kana);
    if (units[units.length - 1] !== "。") {
      return [`entry must end with 。: ${kana}`];
    }

    const words: string[][] = [[]];
    for (const unit of units.slice(0, -1)) {
      if (unit === "、") {
        words.push([]);
        continue;
      }
      if (unit === "。") return [`entry must hold one 。, at the end: ${kana}`];
      words[words.length - 1].push(unit);
    }
    if (words.length !== 2) {
      return [`entry must be two words split by one 、: ${kana}`];
    }
    const [first, second] = words.map((w) => w.join(""));
    if (first === second) {
      return [`entry must not say the same word twice: ${kana}`];
    }
    return [first, second].flatMap(mimeticFaults);
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
    if (spec.mimetic) {
      // 擬音語 have no headword; they are the reading, written in katakana.
      if (e.disp !== toKatakana(e.kana)) {
        errors.push(`disp must be ${toKatakana(e.kana)}, got "${e.disp}"`);
      }
    } else {
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
    if (spec.mimetic) {
      errors.push(...entryFaults(e.kana));
    } else {
      if (e.kana.length > MAX_PHRASE_KANA || e.kana.length < 2) {
        errors.push(`kana length ${e.kana.length} out of range`);
      }

      // Kana in disp is read as written, so a kana run at either end must show
      // up at the same end of the reading (catches 出し authored as だした).
      const tail = /[ぁ-んー]+$/.exec(dispKana)?.[0];
      if (tail && !e.kana.endsWith(tail)) {
        errors.push(`disp ends with ${tail} but the reading is ${e.kana}`);
      }
      const head = /^[ぁ-んー]+/.exec(dispKana)?.[0];
      if (head && !e.kana.startsWith(head)) {
        errors.push(`disp starts with ${head} but the reading is ${e.kana}`);
      }
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

  return {
    spec,
    kanaToRomaji,
    allowedKana,
    toRomaji,
    mimeticWordFaults: spec.mimetic ? mimeticFaults : () => [],
    checkEntry,
  };
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

/**
 * The left hand and nothing else: a o e u i / p y / j, plus the , and . keys
 * that sit above them. The right hand never moves, so ん and ー are out — they
 * need n and -.
 *
 * Unlike the drills above the kana are listed rather than derived: the keys
 * would also reach か行 and じ, but the material is repetition-type 擬音語 built
 * from the five vowels, や行, ぱ行, じゃ行 and ぴゃ行, two to a line —
 * アイアイ、ウオウオ。 `mimetic` swaps the rules that only make sense for a
 * headword and its reading for that shape.
 */
export const LEFT_HAND = createDrill({
  id: "dvorak_left_hand",
  keys: "aoeuipyj,.",
  yoon: true,
  // biome-ignore format: one line per row of the gojuon, in drill order.
  kana: [
    "あ", "い", "う", "え", "お",
    "や", "ゆ", "よ",
    "ぱ", "ぴ", "ぷ", "ぺ", "ぽ",
    "じゃ", "じぇ", "じゅ", "じょ",
    "ぴゃ", "ぴゅ", "ぴょ",
    "、", "。",
  ],
  mimetic: true,
});

export const DRILLS: Drill[] = [HOME_ROW, RIGHT_THREE, RIGHT_INDEX, LEFT_HAND];
