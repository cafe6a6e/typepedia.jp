/**
 * Game-loop state machine: idle → countdown → playing → result (or aborted).
 *
 * Gameplay-critical values live in refs so the single global keydown listener
 * always reads fresh data without re-attaching; state mirrors are kept in sync
 * to drive rendering.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { compileMatcher, feedKey } from "@/lib/romajiEngine";
import { computeScore } from "@/lib/scoring";
import { loadGameSentences } from "@/lib/sentences";
import type {
  EngineState,
  Matcher,
  ScoreResult,
  Sentence,
  Settings,
} from "@/types";

export type Phase =
  | "idle"
  | "loading"
  | "countdown"
  | "playing"
  | "result"
  | "aborted";

const INITIAL_ENGINE: EngineState = { slotIndex: 0, buffer: "" };

export function useTypingGame(settings: Settings) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(3);
  const [sentences, setSentences] = useState<Sentence[]>([]);
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
  const sentenceIndexRef = useRef(0);
  const engineRef = useRef<EngineState>(INITIAL_ENGINE);
  const correctRef = useRef(0);
  const missRef = useRef(0);
  const startTimeRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  const beginPlay = useCallback(() => {
    correctRef.current = 0;
    missRef.current = 0;
    sentenceIndexRef.current = 0;
    engineRef.current = INITIAL_ENGINE;
    startTimeRef.current = performance.now();
    setStats({ correct: 0, miss: 0 });
    setSentenceIndex(0);
    setEngine(INITIAL_ENGINE);
    setPhase("playing");
  }, []);

  const finish = useCallback(() => {
    const elapsed = performance.now() - startTimeRef.current;
    setResult(computeScore(correctRef.current, missRef.current, elapsed));
    setPhase("result");
  }, []);

  const start = useCallback(async () => {
    clearTimers();
    setError(null);
    setResult(null);
    setPhase("loading");
    let loaded: Sentence[];
    try {
      loaded = await loadGameSentences(
        settingsRef.current.category,
        settingsRef.current.questionCount,
      );
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
    setMatchers(compiled);
    matchersRef.current = compiled;

    // 3-2-1 countdown, then play.
    setPhase("countdown");
    setCountdown(3);
    timersRef.current.push(setTimeout(() => setCountdown(2), 1000));
    timersRef.current.push(setTimeout(() => setCountdown(1), 2000));
    timersRef.current.push(setTimeout(() => beginPlay(), 3000));
  }, [beginPlay, clearTimers]);

  const abort = useCallback(() => {
    clearTimers();
    setPhase("aborted");
  }, [clearTimers]);

  const handlePlayKey = useCallback(
    (key: string) => {
      const matcher = matchersRef.current[sentenceIndexRef.current];
      if (!matcher) return;
      const { state, result: res } = feedKey(matcher, engineRef.current, key);

      if (res === "miss") {
        missRef.current += 1;
        setStats({ correct: correctRef.current, miss: missRef.current });
        setMissFlash((f) => f + 1);
        return;
      }

      correctRef.current += 1;
      engineRef.current = state;
      setEngine(state);
      setStats({ correct: correctRef.current, miss: missRef.current });

      if (res === "complete-all") {
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
      const p = phaseRef.current;
      if (
        e.key === " " &&
        (p === "idle" || p === "result" || p === "aborted")
      ) {
        e.preventDefault();
        start();
        return;
      }
      if (e.key === "Escape" && (p === "playing" || p === "countdown")) {
        e.preventDefault();
        if (p === "countdown") goIdle();
        else abort();
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
  }, [start, abort, goIdle, handlePlayKey]);

  // Cleanup any pending timers on unmount.
  useEffect(() => clearTimers, [clearTimers]);

  return {
    phase,
    countdown,
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
    start,
  };
}
