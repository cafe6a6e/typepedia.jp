import { describe, expect, test } from "bun:test";
import {
  compileMatcher,
  feedKey,
  initialEngineState,
} from "@/lib/romajiEngine";
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

describe("romaji guide follows the authored spelling", () => {
  test("q written with kunrei spellings guides with them", () => {
    const slots = compileMatcher("tiisanahuta", DEFAULT_SETTINGS, "ja");
    expect(slots.map((s) => s.variants[0]).join("")).toBe("tiisanahuta");
  });

  test("q written with the canonical spellings is unchanged", () => {
    const slots = compileMatcher("chiisanafuta", DEFAULT_SETTINGS, "ja");
    expect(slots.map((s) => s.variants[0]).join("")).toBe("chiisanafuta");
  });

  test("reordering variants does not change what is accepted", () => {
    expect(play("tiisai", "chiisai").completed).toBe(true);
    expect(play("chiisai", "tiisai").completed).toBe(true);
  });
});

describe("source code", () => {
  /** Type the keys the cursor actually asks for, skipping auto-filled slots. */
  function typeAll(q: string) {
    const slots = compileMatcher(q, DEFAULT_SETTINGS, "code");
    let state = initialEngineState(slots);
    const keys: string[] = [];
    let guard = 0;
    while (state.slotIndex < slots.length && guard++ < 500) {
      const key = slots[state.slotIndex].variants[0];
      keys.push(key);
      const r = feedKey(slots, state, key);
      if (r.result === "miss") return { keys, completed: false };
      state = r.state;
      if (r.result === "complete-all") return { keys, completed: true };
    }
    return { keys, completed: false };
  }

  test("each character becomes its own slot", () => {
    const slots = compileMatcher("a b\n", DEFAULT_SETTINGS, "code");
    expect(slots.map((s) => s.variants)).toEqual([["a"], [" "], ["b"], ["\n"]]);
  });

  test("only the indentation right after a newline is auto-filled", () => {
    // index:   0 1 2 3 4 5    6 7 8 9 10
    const q = "  a b\n    c";
    const slots = compileMatcher(q, DEFAULT_SETTINGS, "code");
    // The first line's own indentation and the space inside it are typed.
    expect(slots.slice(0, 6).some((s) => s.auto)).toBe(false);
    // The next line's four spaces are not.
    expect(slots.slice(6, 10).every((s) => s.auto)).toBe(true);
    expect(slots[10].variants[0]).toBe("c");
    expect(slots[10].auto).toBeUndefined();
  });

  test("Enter carries the cursor past the next line's indentation", () => {
    const slots = compileMatcher("a\n    b", DEFAULT_SETTINGS, "code");
    const r = feedKey(slots, { slotIndex: 1, buffer: "" }, "\n");
    expect(r.result).toBe("complete-slot");
    // Straight to "b" — the four spaces are never asked for.
    expect(r.state.slotIndex).toBe(6);
    expect(slots[r.state.slotIndex].variants[0]).toBe("b");
  });

  test("a blank line still costs two Enters", () => {
    // Nothing follows the first newline but another newline, so there is no
    // indentation to skip.
    expect(typeAll("a\n\nb").keys).toEqual(["a", "\n", "\n", "b"]);
  });

  test("indentation the learner never types is not counted as keystrokes", () => {
    const { keys, completed } = typeAll("fn f() {\n    let x = 1;\n}");
    expect(completed).toBe(true);
    expect(keys.join("")).toBe("fn f() {\nlet x = 1;\n}");
  });

  test("a wrong key is a miss and does not advance", () => {
    const slots = compileMatcher("let", DEFAULT_SETTINGS, "code");
    const r = feedKey(slots, { slotIndex: 0, buffer: "" }, "x");
    expect(r.result).toBe("miss");
    expect(r.state).toEqual({ slotIndex: 0, buffer: "" });
  });

  test("case matters", () => {
    const slots = compileMatcher("Vec", DEFAULT_SETTINGS, "code");
    expect(feedKey(slots, { slotIndex: 0, buffer: "" }, "v").result).toBe(
      "miss",
    );
    expect(feedKey(slots, { slotIndex: 0, buffer: "" }, "V").result).toBe(
      "complete-slot",
    );
  });

  test("initialEngineState skips leading auto slots", () => {
    // Plain text starts at 0 …
    expect(
      initialEngineState(compileMatcher("ab", DEFAULT_SETTINGS, "code")),
    ).toEqual({ slotIndex: 0, buffer: "" });
    // … and a matcher that opens on auto slots starts past them.
    const slots = compileMatcher("a\n  b", DEFAULT_SETTINGS, "code");
    expect(initialEngineState(slots.slice(2))).toEqual({
      slotIndex: 2,
      buffer: "",
    });
  });
});
