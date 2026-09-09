import { useEffect, useMemo, useRef } from "react";
import type { EngineState, Matcher, Sentence } from "@/types";

interface Props {
  sentence: Sentence;
  matcher: Matcher;
  engine: EngineState;
}

/** One source line, as a slice of the matcher. */
interface CodeLine {
  /** Index of the line's first slot. */
  start: number;
  /** Index of the "\n" slot ending the line; matcher.length for the last one. */
  end: number;
  text: string;
}

/**
 * Fold the matcher into lines once. Code compiles to one slot per character,
 * so a line's text is just its slots' characters and `end - start` is its
 * length — which lets a whole line render as one span instead of one span per
 * character. At ~900 slots per question that is the difference between a
 * handful of DOM nodes per keystroke and a thousand.
 */
export function splitLines(matcher: Matcher): CodeLine[] {
  const lines: CodeLine[] = [];
  let start = 0;
  let text = "";
  for (let i = 0; i < matcher.length; i++) {
    if (matcher[i].variants[0] === "\n") {
      lines.push({ start, end: i, text });
      start = i + 1;
      text = "";
      continue;
    }
    text += matcher[i].variants[0];
  }
  lines.push({ start, end: matcher.length, text });
  return lines;
}

const DONE = "text-green-400";
const TODO = "text-white/40";
const CURSOR = "bg-white/30 text-white rounded-sm";

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
 * The typing screen for source code: a scrolling, left-aligned, line-numbered
 * block that keeps its indentation verbatim.
 *
 * Auto-filled indentation needs no special treatment here — the cursor has
 * already moved past it, so it simply renders as typed.
 */
export function CodeView({ sentence, matcher, engine }: Props) {
  const { slotIndex } = engine;
  const lines = useMemo(() => splitLines(matcher), [matcher]);

  // The line holding the cursor. The cursor sits on a line's own "\n" slot
  // while the learner still owes an Enter, so `<=` keeps it on that line.
  let cur = lines.findIndex((l) => slotIndex <= l.end);
  if (cur < 0) cur = lines.length - 1;

  const boxRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
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

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-4">
      <p className="text-2xl font-bold text-center biz-udmincho-regular">
        {sentence.disp}
      </p>

      <div
        ref={boxRef}
        className="max-h-[60vh] w-full overflow-y-auto rounded-md bg-black/30 p-4 text-left font-mono text-base leading-6"
      >
        {lines.map((line, i) => {
          const typed = i === cur ? slotIndex - line.start : 0;
          return (
            <div
              key={line.start}
              ref={i === cur ? rowRef : undefined}
              className="flex"
            >
              <span className="w-10 shrink-0 pr-3 text-right tabular-nums text-white/25 select-none">
                {i + 1}
              </span>
              <span className="whitespace-pre">
                {i < cur && <span className={DONE}>{line.text}</span>}
                {i > cur && <span className={TODO}>{line.text}</span>}
                {i === cur && (
                  <>
                    <span className={DONE}>{line.text.slice(0, typed)}</span>
                    {slotIndex >= line.end ? (
                      // Waiting on the Enter that ends this line: without a
                      // mark the cursor would be invisible past the last
                      // character.
                      <span className={CURSOR}>⏎</span>
                    ) : (
                      <>
                        <span className={CURSOR}>{line.text[typed]}</span>
                        <span className={TODO}>
                          {line.text.slice(typed + 1)}
                        </span>
                      </>
                    )}
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs tabular-nums text-white/40">
        {cur + 1} / {lines.length} 行
      </p>
    </div>
  );
}
