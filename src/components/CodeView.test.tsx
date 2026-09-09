import { afterEach, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { centeredScrollTop } from "@/components/CodeView";
import { SentenceView } from "@/components/SentenceView";
import { compileMatcher, initialEngineState } from "@/lib/romajiEngine";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { EngineState, Sentence } from "@/types";

const Q = "fn f() {\n    let x = 1;\n}";
const code: Sentence = { disp: "二分探索", q: Q, lang: "code", uuid: "u-code" };
const matcher = compileMatcher(Q, DEFAULT_SETTINGS, "code");

afterEach(cleanup);

function show(engine: EngineState, hideInput = false) {
  const { container } = render(
    <SentenceView
      sentence={code}
      matcher={matcher}
      engine={engine}
      hideInput={hideInput}
    />,
  );
  return container;
}

/** The rows inside the scrolling code block (the outer flex layout is not one). */
function codeRows(container: HTMLElement): Element[] {
  const box = container.querySelector(".overflow-y-auto");
  expect(box).not.toBeNull();
  return [...(box as Element).children];
}

/** The rows of the code block, line number stripped. */
function codeLines(container: HTMLElement): string[] {
  return codeRows(container).map((row) => row.children[1].textContent ?? "");
}

test("code is laid out one row per line, indentation intact", () => {
  const lines = codeLines(show(initialEngineState(matcher)));
  expect(lines).toEqual(["fn f() {", "    let x = 1;", "}"]);
  // Not the ␣ the single-line view uses — that would be noise in code.
  expect(lines.join("")).not.toContain("␣");
});

test("rows are numbered from 1", () => {
  const container = show(initialEngineState(matcher));
  const nums = codeRows(container).map((row) => row.children[0].textContent);
  expect(nums).toEqual(["1", "2", "3"]);
});

test("the title is shown above the code", () => {
  const container = show(initialEngineState(matcher));
  expect(container.querySelector("p")?.textContent).toBe("二分探索");
});

test("the cursor sits on the character the engine is waiting for", () => {
  // Four characters in: "fn f" typed, cursor on "(".
  const container = show({ slotIndex: 4, buffer: "" });
  const cursor = container.querySelector(".bg-white\\/30");
  expect(cursor?.textContent).toBe("(");
});

test("the cursor becomes ⏎ when the line owes an Enter", () => {
  // slotIndex 8 is the "\n" that ends line 1.
  expect(matcher[8].variants[0]).toBe("\n");
  const container = show({ slotIndex: 8, buffer: "" });
  expect(container.querySelector(".bg-white\\/30")?.textContent).toBe("⏎");
});

test("auto-filled indentation reads as already typed", () => {
  // Right after the Enter the cursor is past line 2's four spaces, on "l".
  const afterEnter = 8 + 1 + 4;
  expect(matcher[afterEnter].variants[0]).toBe("l");
  const container = show({ slotIndex: afterEnter, buffer: "" });
  expect(container.querySelector(".bg-white\\/30")?.textContent).toBe("l");
  // The indentation it skipped is shown in the typed colour, so the learner
  // can see it was filled in rather than missed.
  const row = codeRows(container)[1];
  expect(row.querySelector(".text-green-400")?.textContent).toBe("    ");
});

test("the current line number is reported", () => {
  const container = show({ slotIndex: 8 + 1 + 4, buffer: "" });
  expect(container.textContent).toContain("2 / 3 行");
});

test("hideInput does not hide code", () => {
  // 40 行の Rust を暗記で打つことはないので、この設定はコードには効かせない。
  const lines = codeLines(show(initialEngineState(matcher), true));
  expect(lines).toEqual(["fn f() {", "    let x = 1;", "}"]);
});

// --- 縦スクロール: カーソル行を中央付近に保つ ---

/** A 20-row box showing 10 rows of 24px, scrolled to `scrollTop`. */
function box(scrollTop: number, row: number) {
  const rowHeight = 24;
  return {
    scrollTop,
    clientHeight: rowHeight * 10,
    scrollHeight: rowHeight * 20,
    rowOffset: row * rowHeight - scrollTop,
    rowHeight,
  };
}

test("the cursor line is parked halfway down the box", () => {
  // 行 10 は箱の高さ 240 の中央（108）に来る位置までスクロールする。
  expect(centeredScrollTop(box(0, 10))).toBe(10 * 24 - (240 - 24) / 2);
});

test("the first screen does not scroll above the code", () => {
  // 行 0〜4 を中央に置こうとすると負になるので、先頭で止める。
  expect(centeredScrollTop(box(0, 0))).toBe(0);
  expect(centeredScrollTop(box(0, 4))).toBe(0);
});

test("the last screen does not scroll past the end", () => {
  // 20 行 × 24 - 240 = 240 が下限いっぱい。
  expect(centeredScrollTop(box(240, 19))).toBe(240);
});

test("code that fits in the box never scrolls", () => {
  expect(
    centeredScrollTop({
      scrollTop: 0,
      clientHeight: 240,
      scrollHeight: 240,
      rowOffset: 200,
      rowHeight: 24,
    }),
  ).toBe(0);
});

test("scrolling back up re-centres too", () => {
  // Esc なしで前の行に戻ることはないが、行がずれたら常に中央へ寄せる。
  const scrolled = centeredScrollTop(box(240, 12));
  expect(scrolled).toBeLessThan(240);
  expect(scrolled).toBe(12 * 24 - (240 - 24) / 2);
});
