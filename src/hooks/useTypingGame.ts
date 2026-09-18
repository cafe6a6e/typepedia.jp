/**
 * Game-loop state machine: idle → playing → result.
 * Esc during playing returns to idle (the start / course-select screen).
 *
 * Gameplay-critical values live in refs so the single global keydown listener
 * always reads fresh data without re-attaching; state mirrors are kept in sync
 * to drive rendering.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { isLongText } from "@/lib/categories";
import {
  compileMatcher,
  feedKey,
  initialEngineState,
} from "@/lib/romajiEngine";
import { computeScore } from "@/lib/scoring";
import { loadGameSentences } from "@/lib/sentences";
import { recordReview } from "@/lib/study";
import type {
  EngineState,
  LatencySample,
  Matcher,
  ReviewInfo,
  ScoreResult,
  Sentence,
  Settings,
  StrokeSample,
} from "@/types";

export type Phase = "idle" | "loading" | "playing" | "result";

const INITIAL_ENGINE: EngineState = { slotIndex: 0, buffer: "" };

/** Keys that stand for a character the engine has to see but `key` spells out. */
const PLAY_KEYS: Record<string, string> = { Enter: "\n" };

export function useTypingGame(settings: Settings) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [reviews, setReviews] = useState<(ReviewInfo | null)[]>([]);
  const [matchers, setMatchers] = useState<Matcher[]>([]);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [engine, setEngine] = useState<EngineState>(INITIAL_ENGINE);
  // 長文課題 only: which line of the program is being typed. Short sentences
  // never leave line 0.
  const [lineIndex, setLineIndex] = useState(0);
  const [stats, setStats] = useState({ correct: 0, miss: 0 });
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [missFlash, setMissFlash] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs mirroring the values the keydown listener needs.
  const phaseRef = useRef(phase);
  const settingsRef = useRef(settings);
  const matchersRef = useRef<Matcher[]>([]);
  // Mirror of sentences/reviews so the key listener can record a completed review.
  const sentencesRef = useRef<Sentence[]>([]);
  const reviewsRef = useRef<(ReviewInfo | null)[]>([]);
  const sentenceIndexRef = useRef(0);
  const engineRef = useRef<EngineState>(INITIAL_ENGINE);
  const lineIndexRef = useRef(0);
  const correctRef = useRef(0);
  const missRef = useRef(0);
  // Per-expected-key statistics, keyed by the key that should have been pressed.
  // keyCorrect: right hits. keyMiss: fumbled attempts, counting only the first
  // wrong key of each consecutive run.
  const keyCorrectRef = useRef<Record<string, number>>({});
  const keyMissRef = useRef<Record<string, number>>({});
  // Whether the previous keystroke was a miss (to skip repeated mistakes).
  const lastWasMissRef = useRef(false);
  // Gaps between consecutive correct keystrokes, attributed to the key that
  // ended each one ("how long it took to reach this key").
  const latenciesRef = useRef<LatencySample[]>([]);
  // When the last correct key landed; null at the start of each sentence, so
  // the first keystroke of a question is never timed against the previous one.
  const prevCorrectTsRef = useRef<number | null>(null);
  // When the first keystroke landed, so the speed curve starts where the typing
  // does rather than where the screen appeared.
  const startTsRef = useRef(0);
  // Every correct keystroke on that clock, for the result screen's speed curve.
  // Unlike the latencies above nothing is filtered out: the curve is meant to
  // show how fast the text actually advanced, pauses and all.
  const strokesRef = useRef<StrokeSample[]>([]);
  // Raw timestamps of every mistype. They are kept unshifted because a miss can
  // land before the clock starts — the first key of a course can be a wrong one
  // — so they are only put on the session's clock once `finish` knows where it
  // began.
  const missTimesRef = useRef<number[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // When true (e.g. the memo modal is open), the global key listener is inert.
  const keysSuspendedRef = useRef(false);

  phaseRef.current = phase;
  settingsRef.current = settings;

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);

  const goIdle = useCallback(() => {
    clearTimers();
    setPhase("idle");
  }, [clearTimers]);

  // Pause/resume the global key listener (used while a modal is open).
  const suspendKeys = useCallback((v: boolean) => {
    keysSuspendedRef.current = v;
  }, []);

  const beginPlay = useCallback(() => {
    const first = matchersRef.current[0];
    const start = first ? initialEngineState(first) : INITIAL_ENGINE;
    correctRef.current = 0;
    missRef.current = 0;
    keyCorrectRef.current = {};
    keyMissRef.current = {};
    lastWasMissRef.current = false;
    latenciesRef.current = [];
    prevCorrectTsRef.current = null;
    startTsRef.current = 0;
    strokesRef.current = [];
    missTimesRef.current = [];
    sentenceIndexRef.current = 0;
    lineIndexRef.current = 0;
    engineRef.current = start;
    setStats({ correct: 0, miss: 0 });
    setLineIndex(0);
    setSentenceIndex(0);
    setEngine(start);
    setPhase("playing");
  }, []);

  const finish = useCallback(() => {
    const start = startTsRef.current;
    setResult(
      computeScore(
        correctRef.current,
        missRef.current,
        keyCorrectRef.current,
        keyMissRef.current,
        latenciesRef.current,
        strokesRef.current,
        // A miss from before the first correct keystroke is pinned to 0: the
        // curve does not reach back that far, but it did happen at the start.
        missTimesRef.current.map((ts) => Math.max(0, ts - start)),
      ),
    );
    setPhase("result");
  }, []);

  const start = useCallback(async () => {
    clearTimers();
    setError(null);
    setResult(null);
    setPhase("loading");
    let loaded: Sentence[];
    let loadedReviews: (ReviewInfo | null)[];
    try {
      // 長文課題は 1 問がプログラム 1 本ぶんなので、出題数は専用の設定を使う。
      // また 復習割合 0.5 のままだと Math.round(1 * 0.5) = 1 で全枠が復習に化けるため、
      // 長文では復習ローテーションを使わない。
      const long = isLongText(settingsRef.current.category);
      const count = long
        ? settingsRef.current.longQuestionCount
        : settingsRef.current.questionCount;
      const study = long
        ? { ...settingsRef.current.study, reviewRatio: 0 }
        : settingsRef.current.study;
      const load = await loadGameSentences(
        settingsRef.current.category,
        count,
        study,
        settingsRef.current.hideMastered,
      );
      loaded = load.sentences;
      loadedReviews = load.reviews;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sentences");
      setPhase("idle");
      return;
    }
    if (loaded.length === 0) {
      setError("No sentences available");
      setPhase("idle");
      return;
    }
    const compiled = loaded.map((s) =>
      compileMatcher(s.q, settingsRef.current, s.lang),
    );
    setSentences(loaded);
    setReviews(loadedReviews);
    setMatchers(compiled);
    matchersRef.current = compiled;
    sentencesRef.current = loaded;
    reviewsRef.current = loadedReviews;

    beginPlay();
  }, [beginPlay, clearTimers]);

  /**
   * Book the question just finished and move on, or end the course. Shared by
   * the per-keystroke path (short sentences) and the per-line one (長文課題).
   */
  const completeQuestion = useCallback(() => {
    // If the just-finished question was a review, book it as reviewed.
    if (reviewsRef.current[sentenceIndexRef.current]) {
      const done = sentencesRef.current[sentenceIndexRef.current];
      if (done)
        recordReview(
          settingsRef.current.category,
          done.q,
          settingsRef.current.study.reviewCount,
        );
    }
    const next = sentenceIndexRef.current + 1;
    if (next >= matchersRef.current.length) {
      finish();
      return;
    }
    sentenceIndexRef.current = next;
    // A new question starts the rhythm over.
    prevCorrectTsRef.current = null;
    lineIndexRef.current = 0;
    const fresh = initialEngineState(matchersRef.current[next]);
    engineRef.current = fresh;
    setLineIndex(0);
    setSentenceIndex(next);
    setEngine(fresh);
  }, [finish]);

  const handlePlayKey = useCallback(
    (key: string) => {
      const matcher = matchersRef.current[sentenceIndexRef.current];
      if (!matcher) return;
      const { slotIndex, buffer } = engineRef.current;
      const { state, result: res } = feedKey(matcher, engineRef.current, key);

      if (res === "miss") {
        missRef.current += 1;
        missTimesRef.current.push(performance.now());
        // Only the first miss of a consecutive run counts toward the keystroke
        // statistics (e.g. "abck" for "k" tallies only the wrong "a"). It is
        // attributed to the key that was expected, not to what was pressed.
        if (!lastWasMissRef.current) {
          const slot = matcher[slotIndex];
          const variant =
            slot?.variants.find((v) => v.startsWith(buffer)) ??
            slot?.variants[0] ??
            "";
          const expected = variant[buffer.length] ?? key;
          keyMissRef.current[expected] =
            (keyMissRef.current[expected] ?? 0) + 1;
        }
        lastWasMissRef.current = true;
        setStats({ correct: correctRef.current, miss: missRef.current });
        setMissFlash((f) => f + 1);
        return;
      }

      // Time the gap before clearing the miss flag: a keystroke that follows a
      // miss is the recovery, not the rhythm, so it only sets the new baseline.
      const now = performance.now();
      if (prevCorrectTsRef.current !== null && !lastWasMissRef.current) {
        latenciesRef.current.push({ key, ms: now - prevCorrectTsRef.current });
      }
      prevCorrectTsRef.current = now;
      if (strokesRef.current.length === 0) startTsRef.current = now;
      // The sentence index only moves on below, so this is still the question
      // the keystroke belonged to.
      strokesRef.current.push({
        at: now - startTsRef.current,
        sentence: sentencesRef.current[sentenceIndexRef.current]?.disp ?? "",
      });

      lastWasMissRef.current = false;
      // A correct keystroke: the pressed key is the expected key.
      keyCorrectRef.current[key] = (keyCorrectRef.current[key] ?? 0) + 1;
      correctRef.current += 1;
      engineRef.current = state;
      setEngine(state);
      setStats({ correct: correctRef.current, miss: missRef.current });

      if (res === "complete-all") completeQuestion();
    },
    [completeQuestion],
  );

  /**
   * Count one keystroke of a 長文課題's free-form line entry. Every key actually
   * pressed counts — Backspace and the arrows included, because moving the caret
   * back into `<u64>` is how that line really gets typed. Correctness is judged
   * per line here, so a keystroke is never a miss on its own.
   */
  const recordStroke = useCallback((key: string) => {
    const now = performance.now();
    // A keystroke that follows a rejected line is the recovery, not the rhythm.
    if (prevCorrectTsRef.current !== null && !lastWasMissRef.current) {
      latenciesRef.current.push({ key, ms: now - prevCorrectTsRef.current });
    }
    prevCorrectTsRef.current = now;
    if (strokesRef.current.length === 0) startTsRef.current = now;
    strokesRef.current.push({
      at: now - startTsRef.current,
      sentence: sentencesRef.current[sentenceIndexRef.current]?.disp ?? "",
    });
    lastWasMissRef.current = false;
    keyCorrectRef.current[key] = (keyCorrectRef.current[key] ?? 0) + 1;
    correctRef.current += 1;
    setStats({ correct: correctRef.current, miss: missRef.current });
  }, []);

  /**
   * Hand in the line just typed. Returns whether it matched, so the view can
   * leave a rejected line in place to be fixed. A line handed in wrong is the
   * only kind of miss a 長文課題 has — every key that built it was a real one.
   */
  const submitLine = useCallback(
    (text: string) => {
      const sentence = sentencesRef.current[sentenceIndexRef.current];
      if (!sentence) return false;
      const lines = sentence.q.split("\n");
      const i = lineIndexRef.current;
      if (text !== lines[i]) {
        missRef.current += 1;
        missTimesRef.current.push(performance.now());
        keyMissRef.current.Enter = (keyMissRef.current.Enter ?? 0) + 1;
        lastWasMissRef.current = true;
        setStats({ correct: correctRef.current, miss: missRef.current });
        setMissFlash((f) => f + 1);
        return false;
      }
      lastWasMissRef.current = false;
      if (i + 1 >= lines.length) {
        completeQuestion();
        return true;
      }
      lineIndexRef.current = i + 1;
      setLineIndex(i + 1);
      return true;
    },
    [completeQuestion],
  );

  // Single global keydown listener for the whole lifecycle.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (keysSuspendedRef.current) return;
      // An IME's confirm-Enter is not an input of its own.
      if (e.isComposing) return;
      const p = phaseRef.current;
      if (e.key === " " && p === "idle") {
        e.preventDefault();
        start();
        return;
      }
      // After a course ends, Space returns to the course-select screen.
      if (e.key === " " && p === "result") {
        e.preventDefault();
        goIdle();
        return;
      }
      // Esc bails out of a run back to the start / course-select screen.
      if (e.key === "Escape" && p === "playing") {
        e.preventDefault();
        goIdle();
        return;
      }
      if (p === "playing" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // 長文課題 types into a real input so the caret can be moved mid-line.
        // Those keys belong to that element; swallowing them here would stop
        // the text from ever reaching it.
        if (sentencesRef.current[sentenceIndexRef.current]?.lang === "code") {
          return;
        }
        // Indentation is filled in automatically, so Tab is never typed — but
        // it still has to be swallowed or it moves focus off the game.
        if (e.key === "Tab") {
          e.preventDefault();
          return;
        }
        // Shift+Enter opens the memo modal (PlayingView's own listener, which
        // preventDefault here would not stop), so only a plain Enter is a
        // newline.
        const mapped = e.shiftKey ? undefined : PLAY_KEYS[e.key];
        if (mapped) {
          e.preventDefault();
          handlePlayKey(mapped);
          return;
        }
        if (e.key.length === 1) {
          e.preventDefault();
          handlePlayKey(e.key);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [start, goIdle, handlePlayKey]);

  // Cleanup any pending timers on unmount.
  useEffect(() => clearTimers, [clearTimers]);

  return {
    phase,
    sentences,
    matchers,
    sentenceIndex,
    engine,
    stats,
    result,
    missFlash,
    error,
    currentSentence: sentences[sentenceIndex],
    currentMatcher: matchers[sentenceIndex],
    currentReview: reviews[sentenceIndex] ?? null,
    lineIndex,
    recordStroke,
    submitLine,
    start,
    goIdle,
    suspendKeys,
  };
}
