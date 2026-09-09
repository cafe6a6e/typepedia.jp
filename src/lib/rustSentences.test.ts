/**
 * Hard rules for the Coding material, checked against the shipped data.
 *
 * Code is typed literally, so the file is only playable if every character in
 * it is reachable from a keyboard without an IME, and only readable if the
 * indentation is the shape the auto-indent expects. Both are easy to break by
 * hand-editing the JSON, so they are pinned here rather than in review.
 */

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  compileMatcher,
  feedKey,
  initialEngineState,
} from "@/lib/romajiEngine";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { RawSentence } from "@/types";

const rows = JSON.parse(
  readFileSync("docs/sentences/rust/1.json", "utf8"),
) as RawSentence[];

/** Printable ASCII plus LF. No CR, no tab, no full-width character. */
const TYPABLE = /^[\x20-\x7E\n]+$/;

test("the Rust material has the expected algorithms", () => {
  expect(rows.map((r) => r.disp)).toEqual([
    "二分探索",
    "最短経路（Warshall-Floyd）",
    "最短経路（Dijkstra）",
    "DSU",
    "セグメント木（区間和）",
  ]);
});

test("every entry is identified as code and uniquely", () => {
  const failures: string[] = [];
  const seenUuid = new Set<string>();
  const seenQ = new Set<string>();
  const seenDisp = new Set<string>();

  for (const r of rows) {
    // Without an explicit lang, inferLang would read the source as romaji.
    if (r.lang !== "code") failures.push(`${r.disp}: lang is ${r.lang}`);
    if (r.kana) failures.push(`${r.disp}: code has no reading`);

    if (!r.uuid) failures.push(`${r.disp}: missing uuid`);
    else if (seenUuid.has(r.uuid)) failures.push(`${r.disp}: duplicate uuid`);
    else seenUuid.add(r.uuid);

    if (seenQ.has(r.q)) failures.push(`${r.disp}: duplicate q`);
    seenQ.add(r.q);

    if (seenDisp.has(r.disp)) failures.push(`${r.disp}: duplicate disp`);
    seenDisp.add(r.disp);

    // disp labels the bands and tooltips on the result charts, which wrap at
    // 28 chars — a title, not a description.
    if (r.disp.length > 20) failures.push(`${r.disp}: disp too long`);
  }

  expect(failures).toEqual([]);
});

test("every entry is typable without an IME and formatted like rustfmt", () => {
  const failures: string[] = [];

  for (const r of rows) {
    if (!TYPABLE.test(r.q)) failures.push(`${r.disp}: q has untypable chars`);
    if (/[ \t]+$/m.test(r.q)) failures.push(`${r.disp}: trailing whitespace`);
    if (r.q !== r.q.trim()) failures.push(`${r.disp}: leading/trailing blank`);

    for (const [i, line] of r.q.split("\n").entries()) {
      const indent = line.length - line.trimStart().length;
      if (indent % 4 !== 0)
        failures.push(`${r.disp}:${i + 1}: indent ${indent}`);
    }

    let depth = 0;
    for (const ch of r.q) {
      if (ch === "{" || ch === "(" || ch === "[") depth++;
      if (ch === "}" || ch === ")" || ch === "]") depth--;
      if (depth < 0) break;
    }
    if (depth !== 0) failures.push(`${r.disp}: unbalanced brackets`);

    // Long enough to be a 長文, short enough to finish in one sitting.
    if (r.q.length < 300 || r.q.length > 2000)
      failures.push(`${r.disp}: q length ${r.q.length}`);
  }

  expect(failures).toEqual([]);
});

test("every entry can be typed to the end by the engine", () => {
  for (const r of rows) {
    const slots = compileMatcher(r.q, DEFAULT_SETTINGS, "code");
    let state = initialEngineState(slots);
    let miss = 0;
    let done = false;

    // Type what the cursor actually asks for: the auto-filled indentation is
    // skipped, so walking the raw string would go out of step.
    while (state.slotIndex < slots.length) {
      const key = slots[state.slotIndex].variants[0];
      const r2 = feedKey(slots, state, key);
      if (r2.result === "miss") {
        miss++;
        break;
      }
      state = r2.state;
      if (r2.result === "complete-all") {
        done = true;
        break;
      }
    }

    expect({ disp: r.disp, miss, done }).toEqual({
      disp: r.disp,
      miss: 0,
      done: true,
    });
  }
});

test("auto-indent saves a real share of the keystrokes", () => {
  // Sanity check on the feature's whole reason for existing: without it a
  // quarter of the session is the space bar.
  for (const r of rows) {
    const slots = compileMatcher(r.q, DEFAULT_SETTINGS, "code");
    const auto = slots.filter((s) => s.auto).length;
    expect(auto).toBeGreaterThan(0);
    expect(auto / slots.length).toBeLessThan(0.5);
  }
});
