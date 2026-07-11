import { useEffect, useState } from "react";
import { MemoModal } from "@/components/MemoModal";
import { SentenceView } from "@/components/SentenceView";
import { addMemo } from "@/lib/memo";
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
  /** Material / category label (題材) recorded with memos. */
  category: string;
  /** Pause/resume the game key listener while the memo modal is open. */
  suspendKeys: (v: boolean) => void;
}

/** The active typing screen: progress bar, sentence, memo button, and Esc hint. */
export function PlayingView({
  index,
  total,
  correct,
  miss,
  missFlash,
  sentence,
  matcher,
  engine,
  category,
  suspendKeys,
}: Props) {
  const [memoOpen, setMemoOpen] = useState(false);

  const openMemo = () => {
    suspendKeys(true);
    setMemoOpen(true);
  };
  const closeMemo = () => {
    setMemoOpen(false);
    suspendKeys(false);
  };

  // Shift+Enter opens the memo modal during play. (Esc closes it via the
  // modal's own handler, without ending the course.)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && e.shiftKey && !memoOpen) {
        e.preventDefault();
        suspendKeys(true);
        setMemoOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [memoOpen, suspendKeys]);

  // Safety: always resume keys if this screen unmounts with the modal open.
  useEffect(() => () => suspendKeys(false), [suspendKeys]);

  return (
    <>
      <button
        type="button"
        onClick={openMemo}
        className="fixed top-4 right-4 z-10 rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5"
      >
        Memo
      </button>

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
        <p className="text-xs text-white/30">
          Shift+Enter でメモ / Esc でコース選択に戻る
        </p>
      </div>

      {memoOpen && (
        <MemoModal
          category={category}
          disp={sentence.disp}
          q={sentence.q}
          onCancel={closeMemo}
          onSave={(note) => {
            addMemo({ category, disp: sentence.disp, q: sentence.q, note });
            closeMemo();
          }}
        />
      )}
    </>
  );
}
