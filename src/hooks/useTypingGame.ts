/**
 * Game-loop state machine: idle → playing → result.
 * Esc during playing returns to idle (the start / course-select screen).
 *
 * Gameplay-critical values live in refs so the single global keydown listener
 * always reads fresh data without re-attaching; state mirrors are kept in sync
 * to drive rendering.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { compileMatcher, feedKey } from "@/lib/romajiEngine";
import { computeScore } from "@/lib/scoring";
import { loadGameSentences } from "@/lib/sentences";
import { recordReview } from "@/lib/study";
import type {
  EngineState,
  Matcher,
  ReviewInfo,
  ScoreResult,
  Sentence,
  Settings,
} from "@/types";

export type Phase = "idle" | "loading" | "playing" | "result";

const INITIAL_ENGINE: EngineState = { slotIndex: 0, buffer: "" };

export function useTypingGame(settings: Settings) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [reviews, setReviews] = useState<(ReviewInfo | null)[]>([]);
  const [matchers, setMatchers] = useState<Matcher[]>([]);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [engine, setEngine] = useState<EngineState>(INITIAL_ENGINE);
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
  const correctRef = useRef(0);
  const missRef = useRef(0);
  // Miss tally keyed by the character being typed when each miss occurred.
  const missByCharRef = useRef<Record<string, number>>({});
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
    correctRef.current = 0;
    missRef.current = 0;
    missByCharRef.current = {};
    sentenceIndexRef.current = 0;
    engineRef.current = INITIAL_ENGINE;
    setStats({ correct: 0, miss: 0 });
    setSentenceIndex(0);
    setEngine(INITIAL_ENGINE);
    setPhase("playing");
  }, []);

  const finish = useCallback(() => {
    setResult(
      computeScore(correctRef.current, missRef.current, missByCharRef.current),
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
      const load = await loadGameSentences(
        settingsRef.current.category,
        settingsRef.current.questionCount,
        settingsRef.current.study,
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

  const handlePlayKey = useCallback(
    (key: string) => {
      const matcher = matchersRef.current[sentenceIndexRef.current];
      if (!matcher) return;
      const { state, result: res } = feedKey(matcher, engineRef.current, key);

      if (res === "miss") {
        missRef.current += 1;
        // Attribute the miss to the character currently being typed.
        const slot = matcher[engineRef.current.slotIndex];
        const ch = slot ? slot.kana || slot.display : key;
        missByCharRef.current[ch] = (missByCharRef.current[ch] ?? 0) + 1;
        setStats({ correct: correctRef.current, miss: missRef.current });
        setMissFlash((f) => f + 1);
        return;
      }

      correctRef.current += 1;
      engineRef.current = state;
      setEngine(state);
      setStats({ correct: correctRef.current, miss: missRef.current });

      if (res === "complete-all") {
        // If the just-finished question was a review, book it as reviewed.
        if (reviewsRef.current[sentenceIndexRef.current]) {
          const done = sentencesRef.current[sentenceIndexRef.current];
          if (done) recordReview(settingsRef.current.category, done.q);
        }
        const next = sentenceIndexRef.current + 1;
        if (next >= matchersRef.current.length) {
          finish();
        } else {
          sentenceIndexRef.current = next;
          engineRef.current = INITIAL_ENGINE;
          setSentenceIndex(next);
          setEngine(INITIAL_ENGINE);
        }
      }
    },
    [finish],
  );

  // Single global keydown listener for the whole lifecycle.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (keysSuspendedRef.current) return;
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
      if (
        p === "playing" &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        handlePlayKey(e.key);
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
    start,
    goIdle,
    suspendKeys,
  };
}
