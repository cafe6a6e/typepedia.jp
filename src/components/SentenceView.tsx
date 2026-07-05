import type { ReactNode } from "react";
import type { EngineState, Matcher, Sentence, Slot } from "@/types";

interface Props {
  sentence: Sentence;
  matcher: Matcher;
  engine: EngineState;
}

/** Make half-width spaces visible (and JP romaji unaffected). */
function vis(s: string): string {
  return s.replace(/ /g, "␣");
}

function isSpaceSlot(slot: Slot): boolean {
  return slot.variants[0] === " ";
}

/** Renders the display text plus the typing line with typed/cursor/remaining. */
export function SentenceView({ sentence, matcher, engine }: Props) {
  const { slotIndex, buffer } = engine;

  // Colored fragment for a single slot (typed = green, cursor = boxed, rest = faint).
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
          {remainder.length > 0 && (
            <>
              <span className="bg-white/30 text-white rounded-sm">
                {vis(remainder[0])}
              </span>
              <span className="text-white/40">{vis(remainder.slice(1))}</span>
            </>
          )}
        </span>
      );
    }
    return (
      <span key={i} className="text-white/40">
        {vis(slot.variants[0])}
      </span>
    );
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-3xl">
      <p className="text-4xl font-bold text-center leading-relaxed">
        {sentence.disp}
      </p>

      <p className="text-2xl font-mono tracking-wide text-center leading-relaxed">
        {sentence.lang === "en"
          ? renderWordWrapped(matcher, renderSlot)
          : matcher.map((slot, i) => renderSlot(slot, i))}
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
