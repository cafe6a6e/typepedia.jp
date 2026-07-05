import { SentenceView } from "@/components/SentenceView";
import type { EngineState, Matcher, Sentence } from "@/types";

interface Props {
  index: number;
  total: number;
  correct: number;
  miss: number;
  /** Bumped on each miss; used as a key to retrigger the shake animation. */
  missFlash: number;
  sentence: Sentence;
  matcher: Matcher;
  engine: EngineState;
}

/** The active typing screen: progress bar, sentence, and Esc hint. */
export function PlayingView({
  index,
  total,
  correct,
  miss,
  missFlash,
  sentence,
  matcher,
  engine,
}: Props) {
  return (
    <div
      key={missFlash}
      className="flex flex-col items-center gap-8 w-full animate-shake"
    >
      <div className="flex gap-6 text-sm text-white/50">
        <span>
          {index + 1} / {total}
        </span>
        <span>正解 {correct}</span>
        <span className="text-red-400">ミス {miss}</span>
      </div>
      <SentenceView sentence={sentence} matcher={matcher} engine={engine} />
      <p className="text-xs text-white/30">Esc でコース選択に戻る</p>
    </div>
  );
}
