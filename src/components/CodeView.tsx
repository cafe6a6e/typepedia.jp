import { useEffect, useMemo, useRef, useState } from "react";
import type { Sentence } from "@/types";

interface Props {
  sentence: Sentence;
  /** Index of the line being typed. */
  lineIndex: number;
  /** Count one keystroke. Called for every key, Backspace and arrows included. */
  onStroke?: (key: string) => void;
  /** Hand in the typed line; returns whether it matched the expected one. */
  onSubmitLine?: (text: string) => boolean;
}

/** The program's lines, indentation and blank lines intact. */
export function splitLines(q: string): string[] {
  return q.split("\n");
}

/** The leading spaces a line opens with, which the input starts pre-filled. */
export function indentOf(line: string): string {
  return line.match(/^ */)?.[0] ?? "";
}

const DONE = "text-green-400";
const TODO = "text-white/40";
const CURRENT = "text-white";

/** Geometry the scroll position is derived from, in pixels. */
export interface ScrollGeometry {
  /** Current scroll offset of the code box. */
  scrollTop: number;
  /** Visible height of the code box. */
  clientHeight: number;
  /** Full height of the code inside it. */
  scrollHeight: number;
  /** The cursor row's offset from the top of the visible area (may be < 0). */
  rowOffset: number;
  /** Height of one row. */
  rowHeight: number;
}

/**
 * Where to scroll so the line being typed sits halfway down the box, keeping
 * the lines still to come in view rather than pinning the cursor to the bottom
 * edge. Clamped, so the first and last screens do not scroll past the code.
 */
export function centeredScrollTop(g: ScrollGeometry): number {
  const wanted = g.scrollTop + g.rowOffset - (g.clientHeight - g.rowHeight) / 2;
  const max = Math.max(0, g.scrollHeight - g.clientHeight);
  return Math.min(Math.max(wanted, 0), max);
}

/**
 * The typing screen for source code: a scrolling, line-numbered block with a
 * text field under the line being typed.
 *
 * Code is entered a whole line at a time rather than a key at a time, because
 * that is how code is really written — `Vec<u64>` gets typed as `<>` and then
 * the caret goes back between them. The field is an ordinary input, so the
 * caret, Backspace and selection all behave the way they do in an editor; only
 * the finished line is judged, when Enter hands it in.
 */
export function CodeView({
  sentence,
  lineIndex,
  onStroke,
  onSubmitLine,
}: Props) {
  const lines = useMemo(() => splitLines(sentence.q), [sentence.q]);
  const cur = Math.min(lineIndex, lines.length - 1);
  const expected = lines[cur] ?? "";

  const [typed, setTyped] = useState(() => indentOf(expected));
  const matches = typed === expected;

  const boxRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 行が変わったら、その行のインデントまで入力済みの状態から始める。エディタの
  // 自動インデントと同じで、毎行スペースを打ち直させても練習にならないため。
  useEffect(() => {
    setTyped(indentOf(lines[cur] ?? ""));
    inputRef.current?.focus();
  }, [cur, lines]);

  // カーソルが行を移ったら、その行が箱の中央あたりに来るまでスクロールする。
  // 下端に貼り付くと、これから打つコードが見えないまま打つことになるため。
  // 箱の scrollTop を直接動かすのは、scrollIntoView だとページ全体まで
  // 巻き込んで動いてしまうから。
  // biome-ignore lint/correctness/useExhaustiveDependencies: cur は本体では参照しないが「行が変わった」ことを表す唯一の依存なので意図的に含める。
  useEffect(() => {
    const box = boxRef.current;
    const row = rowRef.current;
    if (!box || !row) return;
    const boxTop = box.getBoundingClientRect().top;
    const rowRect = row.getBoundingClientRect();
    box.scrollTop = centeredScrollTop({
      scrollTop: box.scrollTop,
      clientHeight: box.clientHeight,
      scrollHeight: box.scrollHeight,
      rowOffset: rowRect.top - boxTop,
      rowHeight: rowRect.height,
    });
  }, [cur]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Shift+Enter belongs to the memo modal, and a modifier chord is not typing.
    if (e.ctrlKey || e.metaKey || e.altKey || (e.key === "Enter" && e.shiftKey))
      return;
    if (e.key === "Escape") return; // ends the course, handled globally
    if (e.key === "Tab") {
      // Indentation is filled in already; Tab would only lose the field.
      e.preventDefault();
      return;
    }
    onStroke?.(e.key);
    if (e.key === "Enter") {
      e.preventDefault();
      // A rejected line stays put, so it can be fixed instead of retyped.
      onSubmitLine?.(e.currentTarget.value);
    }
  };

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-4">
      <p className="text-2xl font-bold text-center biz-udmincho-regular">
        {sentence.disp}
      </p>

      <div
        ref={boxRef}
        className="max-h-[60vh] w-full overflow-y-auto rounded-md bg-black/30 p-4 text-left font-mono text-base leading-6"
      >
        {lines.map((line, i) => (
          <div key={`${i}-${line}`}>
            <div ref={i === cur ? rowRef : undefined} className="flex">
              <span className="w-10 shrink-0 pr-3 text-right tabular-nums text-white/25 select-none">
                {i + 1}
              </span>
              <span
                className={`whitespace-pre ${i < cur ? DONE : i > cur ? TODO : CURRENT}`}
              >
                {line}
              </span>
            </div>

            {i === cur && (
              <div className="flex">
                <span className="w-10 shrink-0 pr-3 text-right text-white/30 select-none">
                  ▸
                </span>
                <input
                  ref={inputRef}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={onKeyDown}
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  aria-label={`${i + 1} 行目の入力`}
                  className={`w-full rounded-sm border bg-white/5 px-1 font-mono text-base leading-6 text-white outline-none ${
                    matches ? "border-green-500/70" : "border-white/15"
                  }`}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs tabular-nums text-white/40">
        {cur + 1} / {lines.length} 行
        {matches && <span className="ml-2 text-green-400">一致 — Enter</span>}
      </p>
    </div>
  );
}
