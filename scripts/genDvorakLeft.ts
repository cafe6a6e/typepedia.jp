#!/usr/bin/env bun
/**
 * Generate the "Dvorak / 左手限定" material: repetition-type 擬音語 built from the
 * sounds the left hand can type on its own, two to a line — アイアイ、ウオウオ。
 *
 *   bun scripts/genDvorakLeft.ts
 *
 * No model is involved. Every stem is enumerated and the drill decides which
 * words the material keeps, so the rules live in LEFT_HAND alone. Only the
 * pairing is sampled, from a fixed seed, and it deals the words out in shuffled
 * rounds so each one turns up about as often as the next.
 */
import {
  LEFT_HAND,
  STEM_UNITS,
  toKatakana,
  VOWEL_STEM_UNITS,
} from "@/lib/dvorakDrill";

const OUT = "docs/sentences/dvorak_left_hand/1.json";
const COUNT = 500;
const SEED = 20260907;

const SOUNDS = (LEFT_HAND.spec.kana ?? []).filter(
  (kana) => !"、。".includes(kana),
);
const VOWELS = SOUNDS.filter((kana) =>
  /^[aiueo]$/.test(LEFT_HAND.kanaToRomaji[kana]),
);

if (STEM_UNITS !== 2 || VOWEL_STEM_UNITS !== 3) {
  throw new Error("this generator enumerates 2-sound stems and 3-vowel stems");
}

/** Every 擬音語 the drill accepts, in enumeration order. */
const WORDS = [
  ...SOUNDS.flatMap((first) => SOUNDS.map((second) => [first, second])),
  ...VOWELS.flatMap((first) =>
    VOWELS.flatMap((second) => VOWELS.map((third) => [first, second, third])),
  ),
]
  .map((stem) => stem.join("").repeat(2))
  .filter((word) => LEFT_HAND.mimeticWordFaults(word).length === 0);

/** Small seeded PRNG, so the shipped material is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Deal the words into pairs a shuffled round at a time. A round pairs adjacent
 * words, so every word is used once before any is used twice.
 */
const entries: { disp: string; kana: string; q: string; lang: string }[] = [];
const seen = new Set<string>();
while (entries.length < COUNT) {
  const round = shuffled(WORDS);
  for (let i = 0; i + 1 < round.length && entries.length < COUNT; i += 2) {
    const kana = `${round[i]}、${round[i + 1]}。`;
    if (seen.has(kana)) continue;
    seen.add(kana);
    entries.push({
      disp: toKatakana(kana),
      kana,
      q: LEFT_HAND.toRomaji(kana),
      lang: "ja",
    });
  }
}

const failures = entries.flatMap((e) =>
  LEFT_HAND.checkEntry(e).map((msg) => `${e.kana}: ${msg}`),
);
if (failures.length > 0) {
  console.error(failures.slice(0, 20).join("\n"));
  throw new Error(`${failures.length} entries failed checkEntry`);
}

await Bun.write(OUT, `${JSON.stringify(entries, null, 2)}\n`);
console.log(`✅ ${entries.length} lines from ${WORDS.length} words -> ${OUT}`);
