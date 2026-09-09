import { expect, test } from "bun:test";
import { isCompound, speechTextOf } from "@/lib/speechText";
import type { Sentence } from "@/types";

const YOJI: Sentence = {
  disp: "悪衣悪食",
  q: "akuiakushoku",
  kana: "あくいあくしょく",
  lang: "ja",
  uuid: "u-yoji",
};

const KANKEN: Sentence = {
  disp: "阿呍の呼吸で動くチームは、意思が通じる。",
  q: "aunnnokokyuudeugokuchi-muha,ishigatsuujiru.",
  kana: "あうんのこきゅうでうごくちーむは、いしがつうじる。",
  lang: "ja",
  uuid: "u-kanken",
};

test("四字熟語 is spoken as its kana reading", () => {
  // 漢字のままだと TTS が四字熟語を誤読するため。
  expect(speechTextOf(YOJI)).toEqual({
    text: "あくいあくしょく",
    lang: "ja-JP",
  });
});

test("a Japanese sentence is spoken as disp, not as kana", () => {
  // ひらがなだけだと助詞の は→「ハ」を誤読し、外来語（ちーむ）も崩れる。
  expect(speechTextOf(KANKEN)).toEqual({ text: KANKEN.disp, lang: "ja-JP" });
});

test("an English question is spoken as its English text", () => {
  const en: Sentence = {
    disp: "an apple",
    q: "an apple",
    lang: "en",
    uuid: "u",
  };
  expect(speechTextOf(en)).toEqual({ text: "an apple", lang: "en-US" });
});

test("a 四字熟語 without kana falls back to disp", () => {
  // kana を保存する前の localStorage 復習項目。
  expect(speechTextOf({ ...YOJI, kana: undefined }).text).toBe("悪衣悪食");
  expect(speechTextOf({ ...YOJI, kana: "  " }).text).toBe("悪衣悪食");
});

test("isCompound accepts kanji-only words including 々 and rejects sentences", () => {
  expect(isCompound("悪衣悪食")).toBe(true);
  expect(isCompound("正々堂々")).toBe(true);
  expect(isCompound("阿呍")).toBe(true);
  // 文にはかならずひらがなが混じるので compound にはならない。
  expect(isCompound(KANKEN.disp)).toBe(false);
  expect(isCompound("走る")).toBe(false);
  expect(isCompound("チーム")).toBe(false);
  // 9 文字以上は語ではなく文とみなす。
  expect(isCompound("一二三四五六七八九")).toBe(false);
});

test("code is never spoken", () => {
  // 出題画面は読み上げテキストが空かどうかで音声ボタンの有無を決めているので、
  // ここが空文字であることが「コードは読み上げない」の実装そのもの。
  const CODE: Sentence = {
    disp: "二分探索",
    q: "fn f() {\n    let x = 1;\n}",
    lang: "code",
    uuid: "u-code",
  };
  expect(speechTextOf(CODE)).toEqual({ text: "", lang: "en-US" });
});
