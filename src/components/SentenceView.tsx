import type { ReactNode } from "react";
import { CodeView } from "@/components/CodeView";
import type { EngineState, Matcher, Sentence, Slot } from "@/types";

interface Props {
  sentence: Sentence;
  matcher: Matcher;
  engine: EngineState;
  /**
   * Hide the not-yet-typed part of the typing line, showing only the
   * characters already answered correctly. Used to practise recalling kanji
   * readings / English spellings instead of copying them.
   */
  hideInput?: boolean;
  /**
   * Display text of the question that follows, for 順番題材 where the questions
   * are consecutive pieces of one passage. Its opening runs on faintly after
   * this question so the sentence keeps reading across the break.
   */
  nextDisp?: string;
  /** 長文課題 only: the line being typed, and the two callbacks it reports to. */
  lineIndex?: number;
  onStroke?: (key: string, removed: string) => void;
  onSubmitLine?: (text: string) => boolean;
}

/** How many characters of the next question trail the current one. */
const PREVIEW_CHARS = 5;

/**
 * The faint run-on showing where the passage goes next. Nothing is rendered
 * without a next question — the last question of a course ends where it ends.
 */
function NextPreview({ disp }: { disp?: string }) {
  if (!disp) return null;
  // The next question opens with the ␣⏎ that converts and confirms this one.
  // The peek is about where the sentence goes, so it starts past them and
  // spends all PREVIEW_CHARS on actual text.
  const chars = [...disp.replace(/^[ \n]+/, "")];
  const head = chars.slice(0, PREVIEW_CHARS).join("");
  return (
    <span className="font-normal text-white/25">
      {head}
      {chars.length > PREVIEW_CHARS ? "…" : ""}
    </span>
  );
}

/** Make the keys that print nothing visible (and JP romaji unaffected). */
function vis(s: string): string {
  return s.replace(/ /g, "␣").replace(/\n/g, "⏎");
}

/**
 * Mark the invisible keystrokes at either edge of the display text. 順番題材
 * joins its pieces with a space and closes each one with Enter, and neither
 * would otherwise show up next to the sentence. A space inside the text belongs
 * to the sentence itself and is left alone.
 */
function visEdges(s: string): string {
  return s.replace(/^[ \n]+/, vis).replace(/[ \n]+$/, vis);
}

function isSpaceSlot(slot: Slot): boolean {
  return slot.variants[0] === " ";
}

/** Renders the display text plus the typing line with typed/cursor/remaining. */
export function SentenceView({
  sentence,
  matcher,
  engine,
  hideInput = false,
  nextDisp,
  lineIndex = 0,
  onStroke,
  onSubmitLine,
}: Props) {
  // Code is a whole multi-line program, typed a line at a time on its own
  // screen. `hideInput` is meaningless there — nobody recalls 40 lines of Rust
  // — and is dropped, as is the romaji matcher: lines are judged as text.
  if (sentence.lang === "code") {
    return (
      <CodeView
        sentence={sentence}
        lineIndex={lineIndex}
        onStroke={onStroke}
        onSubmitLine={onSubmitLine}
      />
    );
  }

  return (
    <SentenceLine
      sentence={sentence}
      matcher={matcher}
      engine={engine}
      hideInput={hideInput}
      nextDisp={nextDisp}
    />
  );
}

/** The single-line typing screen used by the Japanese and English material. */
function SentenceLine({
  sentence,
  matcher,
  engine,
  hideInput = false,
  nextDisp,
}: Props) {
  const { slotIndex, buffer } = engine;

  // Colored fragment for a single slot (typed = green, cursor = boxed, rest = faint).
  // When hiding, everything past the cursor is dropped — not even its length
  // leaks — and the cursor becomes a blank block so the line stays visible.
  const renderSlot = (slot: Slot, i: number) => {
    if (i < slotIndex) {
      return (
        <span key={i} className="text-green-400">
          {vis(slot.variants[0])}
        </span>
      );
    }
    if (i === slotIndex) {
      const variant =
        slot.variants.find((v) => v.startsWith(buffer)) ?? slot.variants[0];
      const remainder = variant.slice(buffer.length);
      return (
        <span key={i}>
          <span className="text-green-400">{vis(buffer)}</span>
          {remainder.length > 0 &&
            (hideInput ? (
              <span
                aria-hidden="true"
                className="bg-white/30 text-transparent rounded-sm"
              >
                {" "}
              </span>
            ) : (
              <>
                <span className="bg-white/30 text-white rounded-sm">
                  {vis(remainder[0])}
                </span>
                <span className="text-white/40">{vis(remainder.slice(1))}</span>
              </>
            ))}
        </span>
      );
    }
    if (hideInput) return null;
    return (
      <span key={i} className="text-white/40">
        {vis(slot.variants[0])}
      </span>
    );
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-3xl">
      <p
        className={`text-4xl font-bold text-center leading-relaxed ${
          sentence.lang === "ja" ? "biz-udmincho-regular" : ""
        }`}
      >
        {visEdges(sentence.disp)}
        {/* Shown even while the typing line is hidden: that drill is about
            recalling this question's spelling, not about where the passage
            goes next, and the peek gives no part of the answer away. */}
        <NextPreview disp={nextDisp} />
      </p>

      <p className="text-2xl font-mono tracking-wide text-center leading-relaxed">
        {sentence.lang === "en"
          ? renderWordWrapped(matcher, renderSlot)
          : matcher.flatMap((slot, i) => [
              renderSlot(slot, i),
              <wbr key={`b${i}`} />,
            ])}
      </p>
    </div>
  );
}

/**
 * Group slots into words so they never break mid-word. Each word is an
 * inline-block that stays whole; a line break may only happen at a space
 * (a <wbr> is inserted after each visible ␣).
 */
function renderWordWrapped(
  matcher: Matcher,
  renderSlot: (slot: Slot, i: number) => ReactNode,
) {
  const out: ReactNode[] = [];
  let word: ReactNode[] = [];

  const flush = (key: string) => {
    if (word.length > 0) {
      out.push(
        <span key={key} className="inline-block whitespace-nowrap">
          {word}
        </span>,
      );
      word = [];
    }
  };

  matcher.forEach((slot, i) => {
    if (isSpaceSlot(slot)) {
      flush(`w${i}`);
      out.push(renderSlot(slot, i));
      out.push(<wbr key={`b${i}`} />);
    } else {
      word.push(renderSlot(slot, i));
    }
  });
  flush("wend");
  return out;
}
