import { afterEach, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import {
  centeredScrollTop,
  indentOf,
  removedBy,
  splitLines,
} from "@/components/CodeView";
import { SentenceView } from "@/components/SentenceView";
import { compileMatcher } from "@/lib/romajiEngine";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { Sentence } from "@/types";

const Q = "fn f() {\n    let x = 1;\n}";
const code: Sentence = { disp: "二分探索", q: Q, lang: "code", uuid: "u-code" };
// Code is judged as text now; the matcher only rides along as an unused prop.
const matcher = compileMatcher(Q, DEFAULT_SETTINGS, "code");

afterEach(cleanup);

interface Handlers {
  onStroke?: (key: string, removed: string) => void;
  onSubmitLine?: (text: string) => boolean;
  hideInput?: boolean;
}

function show(lineIndex = 0, h: Handlers = {}) {
  const { container } = render(
    <SentenceView
      sentence={code}
      matcher={matcher}
      engine={{ slotIndex: 0, buffer: "" }}
      hideInput={h.hideInput ?? false}
      lineIndex={lineIndex}
      onStroke={h.onStroke}
      onSubmitLine={h.onSubmitLine ?? (() => true)}
    />,
  );
  return container;
}

/** The per-line wrappers inside the scrolling code block. */
function codeRows(container: HTMLElement): Element[] {
  const box = container.querySelector(".overflow-y-auto");
  expect(box).not.toBeNull();
  return [...(box as Element).children];
}

/** The program's lines as rendered, line number stripped. */
function codeLines(container: HTMLElement): string[] {
  return codeRows(container).map(
    (row) => row.children[0].children[1].textContent ?? "",
  );
}

/** The line-entry field. */
function input(container: HTMLElement): HTMLInputElement {
  const el = container.querySelector("input");
  if (!el) throw new Error("no line input");
  return el;
}

// --- 行の組み立て ---

test("splitLines keeps blank lines and indentation", () => {
  expect(splitLines("a\n\n    b")).toEqual(["a", "", "    b"]);
});

test("indentOf reads the leading spaces the input starts with", () => {
  expect(indentOf("    let x = 1;")).toBe("    ");
  expect(indentOf("}")).toBe("");
  expect(indentOf("")).toBe("");
});

// --- 表示 ---

test("code is laid out one row per line, indentation intact", () => {
  expect(codeLines(show())).toEqual(["fn f() {", "    let x = 1;", "}"]);
});

test("rows are numbered from 1", () => {
  const nums = codeRows(show()).map(
    (row) => row.children[0].children[0].textContent,
  );
  expect(nums).toEqual(["1", "2", "3"]);
});

test("the title is shown above the code", () => {
  expect(show().textContent).toContain("二分探索");
});

test("the current line number is reported", () => {
  expect(show(1).textContent).toContain("2 / 3 行");
});

test("hideInput does not hide code", () => {
  // 40 行の Rust を暗記で打つことはないので、この設定はコードには効かせない。
  const c = show(0, { hideInput: true });
  expect(codeLines(c)).toEqual(["fn f() {", "    let x = 1;", "}"]);
  expect(input(c)).toBeDefined();
});

// --- 行単位の入力 ---

test("the input sits under the line being typed", () => {
  const rows = codeRows(show(1));
  // Only the current line's wrapper carries the entry row.
  expect(rows.map((r) => r.children.length)).toEqual([1, 2, 1]);
  expect(rows[1].querySelector("input")).not.toBeNull();
});

test("the input starts pre-filled with the line's indentation", () => {
  // エディタの自動インデントと同じ。毎行スペースを打ち直させても練習にならない。
  expect(input(show(1)).value).toBe("    ");
  expect(input(show(0)).value).toBe("");
});

test("Enter hands the typed line in", () => {
  const onSubmitLine = mock(() => true);
  const c = show(1, { onSubmitLine });
  fireEvent.change(input(c), { target: { value: "    let x = 1;" } });
  fireEvent.keyDown(input(c), { key: "Enter" });
  expect(onSubmitLine).toHaveBeenCalledWith("    let x = 1;");
});

test("a rejected line is left in the field to be fixed", () => {
  const onSubmitLine = mock(() => false);
  const c = show(1, { onSubmitLine });
  fireEvent.change(input(c), { target: { value: "    let x = 2;" } });
  fireEvent.keyDown(input(c), { key: "Enter" });
  expect(input(c).value).toBe("    let x = 2;");
});

test("a blank line is handed in as the empty string", () => {
  const blank: Sentence = { ...code, q: "a\n\nb" };
  const onSubmitLine = mock(() => true);
  const { container } = render(
    <SentenceView
      sentence={blank}
      matcher={matcher}
      engine={{ slotIndex: 0, buffer: "" }}
      lineIndex={1}
      onSubmitLine={onSubmitLine}
    />,
  );
  expect(input(container).value).toBe("");
  fireEvent.keyDown(input(container), { key: "Enter" });
  expect(onSubmitLine).toHaveBeenCalledWith("");
});

test("every keystroke is reported, arrows and Backspace included", () => {
  // `Vec<u64>` gets typed as `<>` and then the caret goes back between them,
  // so those keys are real work and belong in the statistics.
  const keys: string[] = [];
  const c = show(0, { onStroke: (k) => keys.push(k) });
  for (const key of ["<", ">", "ArrowLeft", "u", "Backspace", "Enter"]) {
    fireEvent.keyDown(input(c), { key });
  }
  expect(keys).toEqual(["<", ">", "ArrowLeft", "u", "Backspace", "Enter"]);
});

test("a line is judged by its text, not by the order it was typed", () => {
  // The whole point of line entry: `Vec<u64>` is typed as `Vec<>`, then the
  // caret goes back between the brackets and `u64` goes in. Key-by-key judging
  // rejected that outright; here only the finished line is looked at.
  const generic: Sentence = { ...code, q: "let v: Vec<u64>;" };
  const onSubmitLine = mock(() => true);
  const keys: string[] = [];
  const { container } = render(
    <SentenceView
      sentence={generic}
      matcher={matcher}
      engine={{ slotIndex: 0, buffer: "" }}
      lineIndex={0}
      onStroke={(k) => keys.push(k)}
      onSubmitLine={onSubmitLine}
    />,
  );
  const field = input(container);

  fireEvent.change(field, { target: { value: "let v: Vec<>;" } });
  for (const k of ["ArrowLeft", "ArrowLeft"])
    fireEvent.keyDown(field, { key: k });
  fireEvent.change(field, { target: { value: "let v: Vec<u64>;" } });
  fireEvent.keyDown(field, { key: "Enter" });

  expect(onSubmitLine).toHaveBeenCalledWith("let v: Vec<u64>;");
  expect(keys).toEqual(["ArrowLeft", "ArrowLeft", "Enter"]);
});

// --- 打ち直し: 何が消えるかはカーソルから読む ---

/** A stand-in for the line field with the caret placed by hand. */
function field(value: string, from: number, to = from) {
  return { value, selectionStart: from, selectionEnd: to } as HTMLInputElement;
}

test("Backspace reports the character it takes back", () => {
  expect(removedBy("Backspace", field("let", 3))).toBe("t");
  // Caret moved back inside the line — the very move line entry exists for.
  expect(removedBy("Backspace", field("Vec<u64>", 7))).toBe("4");
});

test("Delete reports the character under the caret", () => {
  expect(removedBy("Delete", field("let", 0))).toBe("l");
});

test("a selection goes in one piece", () => {
  expect(removedBy("Backspace", field("let x", 0, 3))).toBe("let");
});

test("nothing is taken back at the edges, or by any other key", () => {
  expect(removedBy("Backspace", field("let", 0))).toBe("");
  expect(removedBy("Delete", field("let", 3))).toBe("");
  expect(removedBy("a", field("let", 3))).toBe("");
  expect(removedBy("ArrowLeft", field("let", 3))).toBe("");
});

test("the keystroke is reported with what it removed", () => {
  const seen: [string, string][] = [];
  const c = show(0, { onStroke: (k, removed) => seen.push([k, removed]) });
  const el = input(c);
  fireEvent.change(el, { target: { value: "let" } });
  el.setSelectionRange(3, 3);
  fireEvent.keyDown(el, { key: "Backspace" });
  fireEvent.keyDown(el, { key: "x" });
  expect(seen).toEqual([
    ["Backspace", "t"],
    ["x", ""],
  ]);
});

test("Tab is swallowed rather than moving focus off the field", () => {
  const keys: string[] = [];
  const c = show(0, { onStroke: (k) => keys.push(k) });
  fireEvent.keyDown(input(c), { key: "Tab" });
  expect(keys).toEqual([]);
});

test("Shift+Enter is left to the memo modal", () => {
  const onSubmitLine = mock(() => true);
  const keys: string[] = [];
  const c = show(0, { onSubmitLine, onStroke: (k) => keys.push(k) });
  fireEvent.keyDown(input(c), { key: "Enter", shiftKey: true });
  expect(onSubmitLine).not.toHaveBeenCalled();
  expect(keys).toEqual([]);
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
