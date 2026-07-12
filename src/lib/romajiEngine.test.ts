import { describe, expect, test } from "bun:test";
import { compileMatcher, feedKey } from "@/lib/romajiEngine";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { Lang } from "@/types";

/** Feed a whole input string against a compiled sentence. */
function play(q: string, input: string, lang: Lang = "ja") {
  const slots = compileMatcher(q, DEFAULT_SETTINGS, lang);
  let state = { slotIndex: 0, buffer: "" };
  let miss = 0;
  let completed = false;
  for (const ch of input) {
    const r = feedKey(slots, state, ch);
    state = r.state;
    if (r.result === "miss") miss++;
    if (r.result === "complete-all") completed = true;
  }
  return { completed, miss, slots };
}

describe("multi-spelling acceptance", () => {
  test("し accepts shi / si / ci", () => {
    expect(play("si", "shi").completed).toBe(true);
    expect(play("si", "si").completed).toBe(true);
    expect(play("si", "ci").completed).toBe(true);
  });

  test("か accepts ka / ca", () => {
    expect(play("ka", "ka").completed).toBe(true);
    expect(play("ka", "ca").completed).toBe(true);
  });
});

describe("ん IME rule", () => {
  test("あんうん requires annunn", () => {
    expect(play("annunn", "annunn").completed).toBe(true);
    // single n before a vowel / at the end is not enough
    expect(play("annunn", "annun").completed).toBe(false);
  });

  test("ん at end requires nn (ほん)", () => {
    expect(play("hon", "hon").completed).toBe(false);
    expect(play("hon", "honn").completed).toBe(true);
  });

  test("ん before a consonant allows single n (ほんだな)", () => {
    expect(play("hondana", "hondana").completed).toBe(true);
    expect(play("hondana", "honndana").completed).toBe(true);
  });
});

describe("sokuon and yōon", () => {
  test("っ doubles the next consonant (きって)", () => {
    expect(play("kitte", "kitte").completed).toBe(true);
  });

  test("拗音 (きょう)", () => {
    expect(play("kyou", "kyou").completed).toBe(true);
  });
});

describe("english", () => {
  test("matches exactly, case sensitive", () => {
    expect(play("I am.", "I am.", "en").completed).toBe(true);
    expect(play("I am.", "i am.", "en").miss).toBeGreaterThan(0);
  });
});

describe("miss handling", () => {
  test("wrong key counts as a miss and does not advance", () => {
    const r = play("ka", "xka");
    expect(r.completed).toBe(true);
    expect(r.miss).toBe(1);
  });
});

describe("c-mapping customization", () => {
  function playC(
    q: string,
    input: string,
    cMapping: Record<string, "k" | "s">,
  ) {
    const settings = {
      ...DEFAULT_SETTINGS,
      cMapping: { ...DEFAULT_SETTINGS.cMapping, ...cMapping },
    };
    const slots = compileMatcher(q, settings, "ja");
    let state = { slotIndex: 0, buffer: "" };
    let completed = false;
    for (const ch of input) {
      const r = feedKey(slots, state, ch);
      state = r.state;
      if (r.result === "complete-all") completed = true;
    }
    return completed;
  }

  test("default: ca -> か, ci -> し", () => {
    expect(playC("ka", "ca", {})).toBe(true);
    expect(playC("si", "ci", {})).toBe(true);
  });

  test("ca -> さ makes ca complete さ but not か", () => {
    expect(playC("sa", "ca", { ca: "s" })).toBe(true);
    expect(playC("ka", "ca", { ca: "s" })).toBe(false);
  });

  test("ci -> き makes ci complete き but not し", () => {
    expect(playC("ki", "ci", { ci: "k" })).toBe(true);
    expect(playC("si", "ci", { ci: "k" })).toBe(false);
  });

  test("cyo -> しょ completes しょ", () => {
    expect(playC("sho", "cyo", { cyo: "s" })).toBe(true);
  });
});

describe("boundary cases", () => {
  test("ん before や行 (y) requires nn (ほんや)", () => {
    // Tokenizes to ほ・ん・や; ん before y forces the double-n spelling.
    expect(play("honnya", "honnya").completed).toBe(true);
    expect(play("honnya", "honya").completed).toBe(false);
  });

  test("sokuon doubles a multi-char variant (っしゃ)", () => {
    expect(play("ssha", "ssha").completed).toBe(true);
  });

  test("sokuon interacts with a c-mapping variant (っか via cca)", () => {
    // Default mapping keeps ca -> か, so the sokuon doubles it to "cca".
    const slots = compileMatcher("kka", DEFAULT_SETTINGS, "ja");
    let state = { slotIndex: 0, buffer: "" };
    let completed = false;
    for (const ch of "cca") {
      const r = feedKey(slots, state, ch);
      state = r.state;
      if (r.result === "complete-all") completed = true;
    }
    expect(completed).toBe(true);
  });

  test("feedKey is pure: it never mutates the input state", () => {
    const slots = compileMatcher("ka", DEFAULT_SETTINGS, "ja");
    const state = { slotIndex: 0, buffer: "" };
    const r = feedKey(slots, state, "k");
    expect(state).toEqual({ slotIndex: 0, buffer: "" }); // unchanged
    expect(r.state).toEqual({ slotIndex: 0, buffer: "k" });
    expect(r.result).toBe("progress");
  });

  test("feeding past the end of a sentence is a miss", () => {
    const slots = compileMatcher("a", DEFAULT_SETTINGS, "ja");
    const r = feedKey(slots, { slotIndex: 1, buffer: "" }, "a");
    expect(r.result).toBe("miss");
  });
});
