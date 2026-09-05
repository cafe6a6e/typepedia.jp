/**
 * Multi-spelling romaji typing engine.
 *
 * `compileMatcher` turns a sentence's `q` string into an ordered list of slots,
 * each holding the romaji spellings accepted for that unit. `feedKey` advances a
 * typing position one keystroke at a time, accepting any enabled spelling.
 *
 * The `ん` rule follows IME behaviour: a single `n` only resolves to ん when the
 * next sound is a non-{vowel,y,n} consonant; before a vowel / y / another ん, or
 * at the end of a sentence, `nn` is required (so あんうん → "annunn").
 */

import {
  C_CHOICES,
  DEFAULT_C_MAPPING,
  KANA_TO_ROMAJI,
  MAX_SPELLING_LEN,
  ROMAJI_TO_KANA,
  SPELLING_SET,
} from "@/lib/romajiTable";
import type {
  EngineState,
  FeedResult,
  Lang,
  Matcher,
  Settings,
  Slot,
} from "@/types";

const N_REQUIRES_DOUBLE = new Set(["a", "i", "u", "e", "o", "y", "n"]);

interface Token {
  kana: string;
  /** The spelling as authored in `q`, so the guide can show what was written. */
  spelling: string;
  /** Doubled leading consonant from a preceding sokuon (っ), or "". */
  sokuon: boolean;
}

/** Greedy longest-match tokenizer over an authored romaji string. */
export function tokenize(q: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let pendingSokuon = false;

  while (i < q.length) {
    // Try the longest spelling first.
    let matched = "";
    const maxLen = Math.min(MAX_SPELLING_LEN, q.length - i);
    for (let len = maxLen; len >= 1; len--) {
      const sub = q.slice(i, i + len);
      if (SPELLING_SET.has(sub)) {
        matched = sub;
        break;
      }
    }

    if (matched) {
      tokens.push({
        kana: ROMAJI_TO_KANA[matched],
        spelling: matched,
        sokuon: pendingSokuon,
      });
      pendingSokuon = false;
      i += matched.length;
      continue;
    }

    // No spelling matched. A doubled consonant marks a sokuon (small っ).
    if (i + 1 < q.length && q[i] === q[i + 1]) {
      pendingSokuon = true;
      i += 1;
      continue;
    }

    // Unknown single char (authoring slip): keep it as a literal so the
    // sentence stays completable.
    tokens.push({ kana: q[i], spelling: q[i], sokuon: pendingSokuon });
    pendingSokuon = false;
    i += 1;
  }

  return tokens;
}

/**
 * Build kana -> extra c-spelling from the user's mapping. e.g. if "ca" is
 * assigned to the か行, the result has { "か": "ca" }.
 */
function buildCByKana(settings: Settings): Record<string, string> {
  const map: Record<string, string> = {};
  for (const input of Object.keys(C_CHOICES)) {
    const side = settings.cMapping?.[input] ?? DEFAULT_C_MAPPING[input];
    map[C_CHOICES[input][side]] = input;
  }
  return map;
}

/** Variants for a kana: the canonical spellings plus any assigned c-spelling. */
function variantsFor(kana: string, cByKana: Record<string, string>): string[] {
  const canonical = KANA_TO_ROMAJI[kana] ?? [kana];
  const extra = cByKana[kana];
  return extra ? [...canonical, extra] : canonical;
}

/**
 * Move the spelling authored in `q` to the front so the romaji guide shows what
 * the data actually wrote (e.g. `ti` rather than the canonical `chi`).
 */
function preferAuthored(variants: string[], spelling: string): string[] {
  const i = variants.indexOf(spelling);
  if (i <= 0) return variants;
  return [spelling, ...variants.filter((v) => v !== spelling)];
}

/** Apply a sokuon by doubling each variant's leading consonant. */
function applySokuon(variants: string[]): string[] {
  return variants.map((v) => v[0] + v);
}

/**
 * Compile a sentence's `q` into a matcher.
 * For English (`lang === "en"`) each character becomes its own slot.
 */
export function compileMatcher(
  q: string,
  settings: Settings,
  lang: Lang,
): Matcher {
  if (lang === "en") {
    return [...q].map((ch) => ({ kana: "", display: ch, variants: [ch] }));
  }

  const cByKana = buildCByKana(settings);
  const tokens = tokenize(q);
  const slots: Slot[] = tokens.map((t) => {
    let variants = preferAuthored(variantsFor(t.kana, cByKana), t.spelling);
    if (t.sokuon) variants = applySokuon(variants);
    return { kana: t.kana, display: variants[0], variants };
  });

  // IME ん rule: decide whether a single `n` is allowed based on the next slot.
  for (let idx = 0; idx < slots.length; idx++) {
    if (slots[idx].kana !== "ん") continue;
    const next = slots[idx + 1];
    const requireDouble = !next || N_REQUIRES_DOUBLE.has(next.variants[0][0]);
    slots[idx].variants = requireDouble ? ["nn"] : ["nn", "n"];
    slots[idx].display = "nn";
  }

  return slots;
}

/** Variants of a slot that have `prefix` as a prefix. */
function matchingVariants(slot: Slot, prefix: string): string[] {
  return slot.variants.filter((v) => v.startsWith(prefix));
}

/**
 * Feed one keystroke. Returns the next state and what happened. Pure: never
 * mutates the input state.
 */
export function feedKey(
  slots: Matcher,
  state: EngineState,
  key: string,
): { state: EngineState; result: FeedResult } {
  const { slotIndex, buffer } = state;
  if (slotIndex >= slots.length) return { state, result: "miss" };

  const slot = slots[slotIndex];
  const cand = buffer + key;
  const matches = matchingVariants(slot, cand);

  if (matches.length > 0) {
    const isComplete = matches.includes(cand);
    const canExtend = matches.some((v) => v.length > cand.length);
    if (isComplete && !canExtend) {
      const nextIndex = slotIndex + 1;
      return {
        state: { slotIndex: nextIndex, buffer: "" },
        result: nextIndex >= slots.length ? "complete-all" : "complete-slot",
      };
    }
    return { state: { slotIndex, buffer: cand }, result: "progress" };
  }

  // Deferred completion: the buffer already spells the slot (e.g. ん typed as
  // "n"); commit it and re-feed this key against the next slot.
  if (buffer.length > 0 && slot.variants.includes(buffer)) {
    const committed: EngineState = { slotIndex: slotIndex + 1, buffer: "" };
    if (committed.slotIndex >= slots.length) return { state, result: "miss" };
    return feedKey(slots, committed, key);
  }

  return { state, result: "miss" };
}
