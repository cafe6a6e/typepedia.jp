import { expect, test } from "bun:test";
import { pickVoice, voicesFor } from "@/lib/speech";

/** Minimal stand-in for a SpeechSynthesisVoice. */
function voice(
  name: string,
  lang: string,
  opts: { localService?: boolean; isDefault?: boolean } = {},
): SpeechSynthesisVoice {
  return {
    name,
    lang,
    voiceURI: `uri:${name}`,
    localService: opts.localService ?? true,
    default: opts.isDefault ?? false,
  };
}

const JA_HARUKA = voice("Microsoft Haruka - Japanese", "ja-JP", {
  isDefault: true,
});
const JA_GOOGLE = voice("Google 日本語", "ja-JP", { localService: false });
const JA_KYOKO = voice("Kyoko", "ja_JP");
const EN_DAVID = voice("Microsoft David - English (United States)", "en-US", {
  isDefault: true,
});
const EN_GOOGLE = voice("Google US English", "en-US", { localService: false });

const ALL = [JA_HARUKA, JA_KYOKO, JA_GOOGLE, EN_DAVID, EN_GOOGLE];

test("voicesFor matches on the primary subtag, tolerating ja_JP", () => {
  expect(voicesFor(ALL, "ja-JP")).toEqual([JA_HARUKA, JA_KYOKO, JA_GOOGLE]);
  expect(voicesFor(ALL, "en-US")).toEqual([EN_DAVID, EN_GOOGLE]);
  expect(voicesFor(ALL, "fr-FR")).toEqual([]);
});

test("pickVoice prefers the highest-ranked voice over the browser default", () => {
  // 既定の Haruka（旧世代）ではなく Google 日本語 を選ぶ。
  expect(pickVoice(ALL, "ja-JP")).toBe(JA_GOOGLE);
  expect(pickVoice(ALL, "en-US")).toBe(EN_GOOGLE);
});

test("pickVoice falls back down the ranking when better voices are absent", () => {
  expect(pickVoice([JA_HARUKA, JA_KYOKO], "ja-JP")).toBe(JA_KYOKO);
  expect(pickVoice([JA_HARUKA], "ja-JP")).toBe(JA_HARUKA);
});

test("pickVoice prefers network voices among otherwise unranked ones", () => {
  const local = voice("Unknown Local", "ja-JP");
  const remote = voice("Unknown Remote", "ja-JP", { localService: false });
  expect(pickVoice([local, remote], "ja-JP")).toBe(remote);
});

test("an explicit voiceURI wins, but a stale one falls back to auto", () => {
  expect(pickVoice(ALL, "ja-JP", JA_KYOKO.voiceURI)).toBe(JA_KYOKO);
  // 別の端末で選んだ音声がこの環境に無い場合。
  expect(pickVoice(ALL, "ja-JP", "uri:Nonexistent")).toBe(JA_GOOGLE);
});

test("pickVoice returns null when no voice speaks the language", () => {
  expect(pickVoice(ALL, "fr-FR")).toBeNull();
  expect(pickVoice([], "ja-JP")).toBeNull();
});
