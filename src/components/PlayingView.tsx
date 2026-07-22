import { useEffect, useState } from "react";
import { MemoModal } from "@/components/MemoModal";
import { SentenceView } from "@/components/SentenceView";
import { isMastered, setMastered } from "@/lib/mastery";
import { addMemo, formatTimestamp } from "@/lib/memo";
import { canSpeak, speak } from "@/lib/speech";
import { isLearning, setLearning } from "@/lib/study";
import type { EngineState, Matcher, ReviewInfo, Sentence } from "@/types";

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
  /** Material / category label (題材) shown to the user. */
  category: string;
  /** Category folder id — identity key for memos and study status. */
  categoryId: string;
  /** Set when this question is a review; drives the reference banner. */
  review: ReviewInfo | null;
  /** Auto-play the question audio when an English question is shown. */
  autoPlayAudio: boolean;
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
  categoryId,
  review,
  autoPlayAudio,
  suspendKeys,
}: Props) {
  const [memoOpen, setMemoOpen] = useState(false);

  // 英語題材では問題文（q）が英文なので、それを読み上げる。
  const isEnglish = sentence.lang === "en";
  const audioText = sentence.q;
  const canPlayAudio = isEnglish && canSpeak();

  // 出題（=index が変わるたび）と同時に、設定が有効なら自動再生する。
  // index を依存に含めることで、同じ英文が連続しても問題が変われば再生される。
  useEffect(() => {
    if (canPlayAudio && autoPlayAudio) speak(audioText);
  }, [index, canPlayAudio, autoPlayAudio, audioText]);

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
        {review && (
          <p className="rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-300">
            復習 {review.attempt} 回目（最終出題{" "}
            {review.lastReviewedTs > 0
              ? formatTimestamp(review.lastReviewedTs)
              : "初回"}
            ）
          </p>
        )}
        <SentenceView sentence={sentence} matcher={matcher} engine={engine} />
        {canPlayAudio && (
          <button
            type="button"
            onClick={(e) => {
              // クリックでフォーカスを奪わない（Space はタイピング入力のため）。
              e.currentTarget.blur();
              speak(audioText);
            }}
            aria-label="問題文を読み上げる"
            className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-1.5 text-sm text-white/70 hover:bg-white/5"
          >
            <span aria-hidden="true">🔊</span>
            音声を再生
          </button>
        )}
        <p className="text-xs text-white/30">
          Shift+Enter でメモ / Esc でコース選択に戻る
        </p>
      </div>

      {memoOpen && (
        <MemoModal
          category={category}
          disp={sentence.disp}
          q={sentence.q}
          initialLearning={isLearning(categoryId, sentence.q)}
          initialMastered={isMastered(sentence.uuid)}
          onCancel={closeMemo}
          onSave={(note, learning, mastered) => {
            if (note.trim())
              addMemo({ category, disp: sentence.disp, q: sentence.q, note });
            setLearning(categoryId, sentence, learning);
            setMastered(sentence.uuid, categoryId, mastered);
            closeMemo();
          }}
        />
      )}
    </>
  );
}
