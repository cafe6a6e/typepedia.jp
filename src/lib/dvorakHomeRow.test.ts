import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  ALLOWED_KANA,
  checkEntry,
  type DvorakEntry,
  kanaToHomeRowRomaji,
} from "@/lib/dvorakHomeRow";
import type { RawSentence } from "@/types";

const DATA = "docs/sentences/dvorak_home_row/1.json";

test("kanaToHomeRowRomaji uses the kunrei spellings", () => {
  expect(kanaToHomeRowRomaji("しちつふぢづ")).toBe("sitituhudidu");
  expect(kanaToHomeRowRomaji("ふとん")).toBe("hutonn");
  expect(kanaToHomeRowRomaji("はしった")).toBe("hasitta");
});

test("kanaToHomeRowRomaji writes ん as nn, so あんない keeps three n", () => {
  expect(kanaToHomeRowRomaji("あんない")).toBe("annnai");
  expect(kanaToHomeRowRomaji("あんあい")).toBe("annai");
});

test("kanaToHomeRowRomaji rejects kana off the home row", () => {
  expect(() => kanaToHomeRowRomaji("ねこ")).toThrow();
  expect(() => kanaToHomeRowRomaji("ほしを")).toThrow();
  expect(() => kanaToHomeRowRomaji("あっ")).toThrow();
});

function entry(over: Partial<DvorakEntry>): DvorakEntry {
  const kana = over.kana ?? "あした";
  return {
    disp: over.disp ?? "明日",
    kana,
    q: over.q ?? kanaToHomeRowRomaji(kana),
  };
}

test("checkEntry accepts a well-formed entry", () => {
  expect(checkEntry(entry({}))).toEqual([]);
  expect(checkEntry(entry({ disp: "外に出た", kana: "そとにでた" }))).toEqual(
    [],
  );
});

test("checkEntry rejects a q that does not match the reading", () => {
  expect(checkEntry(entry({ q: "asitaa" }))).not.toEqual([]);
});

test("checkEntry rejects disp that cannot be typed or read", () => {
  // 濡れる: れ and る are off the home row even though the reading looks fine.
  expect(
    checkEntry({ disp: "濡れる", kana: "ぬれた", q: "nureta" }),
  ).not.toEqual([]);
  expect(checkEntry(entry({ disp: "明日は", kana: "あした" }))).not.toEqual([]);
  expect(checkEntry(entry({ disp: "出し", kana: "だした" }))).not.toEqual([]);
  expect(checkEntry(entry({ disp: "あした", kana: "あした" }))).not.toEqual([]);
  expect(checkEntry(entry({ disp: "明日、", kana: "あした" }))).not.toEqual([]);
});

test("every shipped entry is typable on the Dvorak home row", () => {
  const rows = JSON.parse(readFileSync(DATA, "utf8")) as RawSentence[];
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

    const errors = checkEntry({ disp: r.disp, kana: r.kana ?? "", q: r.q });
    for (const e of errors) failures.push(`${r.disp}: ${e}`);
  }

  expect(failures).toEqual([]);
});

test("the allowed kana set is the six rows plus ん, っ and ー", () => {
  expect(ALLOWED_KANA.size).toBe(33);
  for (const c of "あさたなはだんっー") expect(ALLOWED_KANA.has(c)).toBe(true);
  for (const c of "かまやらわがざばぱをゃゅょ")
    expect(ALLOWED_KANA.has(c)).toBe(false);
});

test("外来語 with ー are in scope, in katakana", () => {
  expect(kanaToHomeRowRomaji("そーす")).toBe("so-su");
  expect(checkEntry({ disp: "ソース", kana: "そーす", q: "so-su" })).toEqual(
    [],
  );
  expect(
    checkEntry({ disp: "セーター", kana: "せーたー", q: "se-ta-" }),
  ).toEqual([]);
  // A katakana word whose reading leaves the home row is still rejected.
  expect(() => kanaToHomeRowRomaji("ちーむ")).toThrow();
  // ー cannot open a reading or follow a sokuon.
  expect(() => kanaToHomeRowRomaji("ーと")).toThrow();
});
