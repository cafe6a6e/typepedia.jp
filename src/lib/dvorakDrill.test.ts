import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DRILLS,
  type DvorakEntry,
  HOME_ROW,
  RIGHT_INDEX,
  RIGHT_THREE,
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
