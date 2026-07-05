/**
 * Romaji table ported from simulation/kbopt/romaji.py.
 *
 * Each kana maps to the list of accepted romaji spellings. When multiple
 * spellings exist they are all valid (the engine accepts any enabled one).
 * Spellings are ordered with the most common / canonical first.
 */

// biome-ignore format: keep the kana grid aligned for readability.
export const KANA_TO_ROMAJI: Record<string, string[]> = {
  // 母音
  "あ": ["a"],        "い": ["i"],        "う": ["u"],        "え": ["e"],        "お": ["o"],

  // 清音
  "か": ["ka"],       "き": ["ki"],       "く": ["ku"],       "け": ["ke"],       "こ": ["ko"],
  "さ": ["sa"],       "し": ["shi", "si"], "す": ["su"],      "せ": ["se"],       "そ": ["so"],
  "た": ["ta"],       "ち": ["chi", "ti"], "つ": ["tsu", "tu"], "て": ["te"],      "と": ["to"],
  "な": ["na"],       "に": ["ni"],       "ぬ": ["nu"],       "ね": ["ne"],       "の": ["no"],
  "は": ["ha"],       "ひ": ["hi"],       "ふ": ["fu", "hu"], "へ": ["he"],       "ほ": ["ho"],
  "ま": ["ma"],       "み": ["mi"],       "む": ["mu"],       "め": ["me"],       "も": ["mo"],
  "や": ["ya"],                           "ゆ": ["yu"],                           "よ": ["yo"],
  "ら": ["ra"],       "り": ["ri"],       "る": ["ru"],       "れ": ["re"],       "ろ": ["ro"],
  "わ": ["wa"],                                                                  "を": ["wo"],
  "ん": ["nn", "n"],

  // 濁音
  "が": ["ga"],       "ぎ": ["gi"],       "ぐ": ["gu"],       "げ": ["ge"],       "ご": ["go"],
  "ざ": ["za"],       "じ": ["ji", "zi"], "ず": ["zu"],       "ぜ": ["ze"],       "ぞ": ["zo"],
  "だ": ["da"],       "ぢ": ["di"],       "づ": ["du"],       "で": ["de"],       "ど": ["do"],
  "ば": ["ba"],       "び": ["bi"],       "ぶ": ["bu"],       "べ": ["be"],       "ぼ": ["bo"],

  // 半濁音
  "ぱ": ["pa"],       "ぴ": ["pi"],       "ぷ": ["pu"],       "ぺ": ["pe"],       "ぽ": ["po"],

  // 拗音（子音＋ ゃ ぃ ゅ ぇ ょ）
  "きゃ": ["kya"],                        "きゅ": ["kyu"],                        "きょ": ["kyo"],
  "しゃ": ["sha", "sya"],                 "しゅ": ["shu", "syu"],                 "しょ": ["sho", "syo"],
  "ちゃ": ["cha", "tya"],                 "ちゅ": ["chu", "tyu"],                 "ちょ": ["cho", "tyo"],
  "にゃ": ["nya"],                        "にゅ": ["nyu"],                        "にょ": ["nyo"],
  "ひゃ": ["hya"],    "ひぃ": ["hyi"],    "ひゅ": ["hyu"],    "ひぇ": ["hye"],    "ひょ": ["hyo"],
  "みゃ": ["mya"],                        "みゅ": ["myu"],                        "みょ": ["myo"],
  "りゃ": ["rya"],                        "りゅ": ["ryu"],                        "りょ": ["ryo"],
  "ぎゃ": ["gya"],                        "ぎゅ": ["gyu"],                        "ぎょ": ["gyo"],
  "じゃ": ["ja", "zya"],                  "じゅ": ["ju", "zyu"],                  "じょ": ["jo", "zyo"],
  "びゃ": ["bya"],                        "びゅ": ["byu"],                        "びょ": ["byo"],
  "ふぁ": ["fa"],     "ふぃ": ["fi"],                        "ふぇ": ["fe"],     "ふぉ": ["fo"],
  "うぁ": ["wha"],    "うぃ": ["wi"],                        "うぇ": ["we"],     "うぉ": ["who"],

  // 小書き単独（促音・拗音素片を含めない長音や記号の保険）
  "ー": ["-"],
};

/** Longest spelling length, used to bound the greedy tokenizer. */
export const MAX_SPELLING_LEN = Object.values(KANA_TO_ROMAJI).reduce(
  (max, spellings) => Math.max(max, ...spellings.map((s) => s.length)),
  1,
);

/**
 * Reverse map: spelling -> kana. Built once at module load. If two kana share a
 * spelling the first one inserted wins (the table is authored to avoid this).
 */
export const ROMAJI_TO_KANA: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [kana, spellings] of Object.entries(KANA_TO_ROMAJI)) {
    for (const s of spellings) {
      if (!(s in map)) map[s] = kana;
    }
  }
  return map;
})();

/** Set of every valid spelling, for fast membership checks in the tokenizer. */
export const SPELLING_SET = new Set(Object.keys(ROMAJI_TO_KANA));

/**
 * Ambiguous consonant inputs the user assigns to either the か行 ("k") or the
 * さ行 ("s"). One side is always chosen. These spellings are intentionally
 * absent from KANA_TO_ROMAJI above and added to the chosen kana at compile time.
 */
export type CSide = "k" | "s";

export const C_CHOICES: Record<string, Record<CSide, string>> = {
  ca: { k: "か", s: "さ" },
  ci: { k: "き", s: "し" },
  cu: { k: "く", s: "す" },
  ce: { k: "け", s: "せ" },
  co: { k: "こ", s: "そ" },
  cya: { k: "きゃ", s: "しゃ" },
  cyu: { k: "きゅ", s: "しゅ" },
  cyo: { k: "きょ", s: "しょ" },
};

/** Stable order for the settings UI. */
export const C_INPUTS = Object.keys(C_CHOICES);

/** Defaults: hard/soft-c rule for ca–co (ca→か, ci→し, cu→く …); cy- → さ行 (cya→しゃ). */
export const DEFAULT_C_MAPPING: Record<string, CSide> = {
  ca: "k",
  ci: "s",
  cu: "k",
  ce: "s",
  co: "k",
  cya: "s",
  cyu: "s",
  cyo: "s",
};

const VOWELS = new Set(["a", "i", "u", "e", "o"]);

/** True if the romaji string begins with a vowel. */
export function startsWithVowel(romaji: string): boolean {
  return VOWELS.has(romaji[0]);
}
