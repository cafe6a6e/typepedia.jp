import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DRILLS,
  type DvorakEntry,
  HOME_ROW,
  LEFT_HAND,
  RIGHT_INDEX,
  RIGHT_THREE,
  toKatakana,
} from "@/lib/dvorakDrill";
import type { RawSentence } from "@/types";

test("the home-row drill derives the kunrei spellings", () => {
  const t = HOME_ROW.kanaToRomaji;
  expect([t["し"], t["ち"], t["つ"], t["ふ"], t["ぢ"], t["づ"]]).toEqual([
    "si",
    "ti",
    "tu",
    "hu",
    "di",
    "du",
  ]);
  expect(t["ん"]).toBe("nn");
  expect(t["ー"]).toBe("-");
  // か行 needs k, ま行 needs m: neither is on the home row.
  expect(t["か"]).toBeUndefined();
  expect(t["ま"]).toBeUndefined();
  // 拗音 are out of scope for this drill even though sha would fit.
  expect(t["しゃ"]).toBeUndefined();
});

test("the right-three drill drops the rows needing b d f g h m", () => {
  const t = RIGHT_THREE.kanaToRomaji;
  for (const kana of ["は", "ふ", "ま", "が", "だ", "ば"]) {
    expect(t[kana]).toBeUndefined();
  }
  expect([t["し"], t["ち"], t["つ"], t["を"]]).toEqual([
    "si",
    "ti",
    "tu",
    "wo",
  ]);
  // 拗音 and punctuation are in scope here.
  expect([t["しゃ"], t["ちゃ"], t["じゃ"], t["りょ"]]).toEqual([
    "sya",
    "tya",
    "ja",
    "ryo",
  ]);
  expect([t["、"], t["。"]]).toEqual([",", "."]);
});

test("the right-index drill drops the middle finger's column, and か行", () => {
  const t = RIGHT_INDEX.kanaToRomaji;
  // c, t and w go, so た行, わ, を and ちゃ行 go with them.
  for (const kana of ["た", "ち", "つ", "て", "と", "わ", "を", "ちゃ"]) {
    expect(t[kana]).toBeUndefined();
  }
  // k is on the left hand, but the engine also accepts ca/cu/co for か行,
  // which would put the right middle finger back in play. So か行 goes too.
  for (const kana of ["か", "き", "く", "け", "こ", "きゃ", "きゅ", "きょ"]) {
    expect(t[kana]).toBeUndefined();
  }
  // Everything the right-three drill lacks is back: は・ま・が・だ・ば行 and ふ.
  expect([t["は"], t["ま"], t["が"], t["だ"], t["ば"], t["ふ"]]).toEqual([
    "ha",
    "ma",
    "ga",
    "da",
    "ba",
    "fu",
  ]);
});

test("the left-hand drill takes only the kana it was given", () => {
  const t = LEFT_HAND.kanaToRomaji;
  expect([t["あ"], t["や"], t["ぱ"], t["、"], t["。"]]).toEqual([
    "a",
    "ya",
    "pa",
    ",",
    ".",
  ]);
  expect([t["じゃ"], t["じぇ"], t["ぴゃ"], t["ぴょ"]]).toEqual([
    "ja",
    "je",
    "pya",
    "pyo",
  ]);
  // か行 and じ are on the left hand too, but they are not part of this set.
  for (const kana of ["か", "き", "きゃ", "じ", "ず"]) {
    expect(t[kana]).toBeUndefined();
  }
  // n and - are right-hand keys, so these have nowhere to go.
  for (const kana of ["ん", "ー"]) {
    expect(t[kana]).toBeUndefined();
  }
  // A hand-picked set is taken literally: no implicit っ.
  expect(LEFT_HAND.allowedKana.has("っ")).toBe(false);
});

test("toRomaji handles ん, っ and 拗音", () => {
  expect(HOME_ROW.toRomaji("あんない")).toBe("annnai");
  expect(HOME_ROW.toRomaji("あんあい")).toBe("annai");
  expect(HOME_ROW.toRomaji("はしった")).toBe("hasitta");
  expect(RIGHT_THREE.toRomaji("いっしょ")).toBe("issyo");
  expect(RIGHT_THREE.toRomaji("きょう、さくら。")).toBe("kyou,sakura.");
});

test("toRomaji rejects kana the drill cannot type", () => {
  expect(() => HOME_ROW.toRomaji("ねこ")).toThrow();
  expect(() => HOME_ROW.toRomaji("ほしを")).toThrow();
  expect(() => RIGHT_THREE.toRomaji("やま")).toThrow();
  expect(() => RIGHT_THREE.toRomaji("はる")).toThrow();
  // A small kana on its own is not a unit.
  expect(() => RIGHT_THREE.toRomaji("ょこ")).toThrow();
  // ー cannot open a reading or follow a sokuon.
  expect(() => HOME_ROW.toRomaji("ーと")).toThrow();
  expect(() => HOME_ROW.toRomaji("あっ")).toThrow();
});

function entry(drill: typeof HOME_ROW, over: Partial<DvorakEntry>) {
  const kana = over.kana ?? "あした";
  return {
    disp: over.disp ?? "明日",
    kana,
    q: over.q ?? drill.toRomaji(kana),
  };
}

test("checkEntry accepts well-formed entries in either drill", () => {
  expect(HOME_ROW.checkEntry(entry(HOME_ROW, {}))).toEqual([]);
  expect(
    HOME_ROW.checkEntry({ disp: "ソース", kana: "そーす", q: "so-su" }),
  ).toEqual([]);
  expect(
    RIGHT_THREE.checkEntry({
      disp: "料理を作る",
      kana: "りょうりをつくる",
      q: "ryouriwotukuru",
    }),
  ).toEqual([]);
});

test("checkEntry accepts punctuation, which the round trip has to restore", () => {
  expect(
    RIGHT_THREE.checkEntry({
      disp: "今日、桜",
      kana: "きょう、さくら",
      q: "kyou,sakura",
    }),
  ).toEqual([]);
});

/** One entry built from two 擬音語, the shape the material ships in. */
function mimetic(first: string, second = "うおうお"): DvorakEntry {
  const kana = `${first}、${second}。`;
  return { disp: toKatakana(kana), kana, q: LEFT_HAND.toRomaji(kana) };
}

test("checkEntry accepts a well-formed mimetic word", () => {
  expect(LEFT_HAND.checkEntry(mimetic("あいあい"))).toEqual([]);
  expect(LEFT_HAND.checkEntry(mimetic("ぴよぴよ"))).toEqual([]);
  // 拗音 count as one unit each, so this is a two-sound stem said twice.
  expect(LEFT_HAND.checkEntry(mimetic("じゃあじゃあ"))).toEqual([]);
  expect(LEFT_HAND.checkEntry(mimetic("いぴょいぴょ", "ぽいぽい"))).toEqual([]);
});

test("checkEntry enforces the 〜、〜。 line", () => {
  const line = (kana: string) => ({
    disp: toKatakana(kana),
    kana,
    q: LEFT_HAND.toRomaji(kana),
  });
  const bad = (kana: string) =>
    expect(LEFT_HAND.checkEntry(line(kana))).not.toEqual([]);
  bad("あいあい、うおうお"); // does not end with 。
  bad("あいあい。"); // only one word
  bad("あいあい、うおうお、やゆやゆ。"); // three words
  bad("あいあい。うおうお。"); // 。 inside the line
  bad("あいあい、あいあい。"); // the same word twice
});

test("checkEntry enforces the repeated-stem shape", () => {
  const bad = (kana: string) =>
    expect(LEFT_HAND.checkEntry(mimetic(kana))).not.toEqual([]);
  bad("あいあ"); // three units
  bad("あいうえ"); // stem is not repeated
  bad("ぷぷぷぷ"); // stem repeats one sound
  bad("じょじゃじょじゃ"); // two 拗音 in a row
  bad("ぴぴゃぴぴゃ"); // 拗音 beside its own consonant
  bad("ぱいぱい"); // reads as slang, not as a sound
  // や行 and ぱ行 pair up fine as long as no 拗音 is involved.
  expect(LEFT_HAND.checkEntry(mimetic("やゆやゆ"))).toEqual([]);
  expect(LEFT_HAND.checkEntry(mimetic("ぱぴぱぴ"))).toEqual([]);
  // 擬音語 are written in katakana, not as the bare reading.
  expect(
    LEFT_HAND.checkEntry({
      disp: "あいあい",
      kana: "あいあい",
      q: LEFT_HAND.toRomaji("あいあい"),
    }),
  ).not.toEqual([]);
});

test("checkEntry lets an all-vowel stem run three sounds", () => {
  expect(LEFT_HAND.checkEntry(mimetic("あいうあいう"))).toEqual([]);
  expect(LEFT_HAND.checkEntry(mimetic("おえいおえい"))).toEqual([]);
  const bad = (kana: string) =>
    expect(LEFT_HAND.checkEntry(mimetic(kana))).not.toEqual([]);
  bad("あいああいあ"); // a vowel repeats inside the stem
  bad("あいやあいや"); // や is not a vowel
  bad("あいうえあいうえ"); // four sounds is too long for any stem
});

test("checkEntry rejects q that does not match the reading", () => {
  expect(HOME_ROW.checkEntry(entry(HOME_ROW, { q: "asitaa" }))).not.toEqual([]);
});

test("checkEntry rejects disp that cannot be typed or read", () => {
  const bad = (over: Partial<DvorakEntry>) =>
    expect(HOME_ROW.checkEntry({ q: "", ...over } as DvorakEntry)).not.toEqual(
      [],
    );
  // 濡れる: れ and る are outside the drill even though the reading looks fine.
  bad({ disp: "濡れる", kana: "ぬれた", q: "nureta" });
  bad(entry(HOME_ROW, { disp: "明日は" }));
  bad(entry(HOME_ROW, { disp: "出し", kana: "だした" }));
  bad(entry(HOME_ROW, { disp: "あした" }));
  // Punctuation belongs to the right-three drill only.
  bad(entry(HOME_ROW, { disp: "明日、" }));
});

test.each(DRILLS.map((d) => [d.spec.id, d] as const))(
  "every shipped entry in %s is typable",
  (id, drill) => {
    const rows = JSON.parse(
      readFileSync(`docs/sentences/${id}/1.json`, "utf8"),
    ) as RawSentence[];
    expect(rows.length).toBeGreaterThan(0);

    const failures: string[] = [];
    const seenQ = new Set<string>();
    const seenUuid = new Set<string>();

    for (const r of rows) {
      if (r.lang !== "ja") failures.push(`${r.disp}: lang is ${r.lang}`);
      if (!r.uuid) failures.push(`${r.disp}: missing uuid`);
      else if (seenUuid.has(r.uuid)) failures.push(`${r.disp}: duplicate uuid`);
      else seenUuid.add(r.uuid);

      if (seenQ.has(r.q)) failures.push(`${r.disp}: duplicate q ${r.q}`);
      seenQ.add(r.q);

      for (const e of drill.checkEntry({
        disp: r.disp,
        kana: r.kana ?? "",
        q: r.q,
      })) {
        failures.push(`${r.disp}: ${e}`);
      }
    }

    expect(failures).toEqual([]);
  },
);
