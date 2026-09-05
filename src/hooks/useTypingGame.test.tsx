import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, fireEvent, renderHook, waitFor } from "@testing-library/react";
import { useTypingGame } from "@/hooks/useTypingGame";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { getDueReviews, setLearning } from "@/lib/study";
import type { RawSentence, Settings } from "@/types";

// Drive the real loadGameSentences via a stubbed fetch (manifest + one file).
const realFetch = globalThis.fetch;
const CAT = "eiken_1st_grade";

function installFetch(files: RawSentence[]) {
  const manifest = [{ category: CAT, id: 1 }];
  // @ts-expect-error minimal fetch stub for tests
  globalThis.fetch = (url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => (url === "sentences/manifest.json" ? manifest : files),
    } as Response);
}

function settings(patch: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, category: CAT, questionCount: 2, ...patch };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Dispatch a key on window inside act(). */
async function press(key: string) {
  await act(async () => {
    fireEvent.keyDown(window, { key });
  });
}

async function type(s: string) {
  await act(async () => {
    for (const ch of s) fireEvent.keyDown(window, { key: ch });
  });
}

test("Space starts a course: idle -> playing, and completing all -> result", async () => {
  installFetch([
    { disp: "ab", q: "ab" },
    { disp: "cd", q: "cd" },
  ]);
  const { result } = renderHook(() => useTypingGame(settings()));

  expect(result.current.phase).toBe("idle");

  await press(" ");
  await waitFor(() => expect(result.current.phase).toBe("playing"));
  expect(result.current.sentences).toHaveLength(2);

  // Type each sentence's target until the course finishes.
  let guard = 0;
  while (result.current.phase === "playing" && guard++ < 20) {
    await type(result.current.currentSentence.q);
  }

  expect(result.current.phase).toBe("result");
  expect(result.current.result?.total).toBe(4); // "ab" + "cd" = 4 keystrokes
  expect(result.current.result?.accuracy).toBe(1);
});

test("Space on the result screen returns to idle", async () => {
  installFetch([{ disp: "a", q: "a" }]);
  const { result } = renderHook(() =>
    useTypingGame(settings({ questionCount: 1 })),
  );
  await press(" ");
  await waitFor(() => expect(result.current.phase).toBe("playing"));
  await type("a");
  expect(result.current.phase).toBe("result");

  await press(" ");
  expect(result.current.phase).toBe("idle");
});

test("Escape while playing aborts back to idle", async () => {
  installFetch([{ disp: "ab", q: "ab" }]);
  const { result } = renderHook(() =>
    useTypingGame(settings({ questionCount: 1 })),
  );
  await press(" ");
  await waitFor(() => expect(result.current.phase).toBe("playing"));

  await press("Escape");
  expect(result.current.phase).toBe("idle");
});

test("a wrong key counts as a miss without advancing", async () => {
  installFetch([{ disp: "ab", q: "ab" }]);
  const { result } = renderHook(() =>
    useTypingGame(settings({ questionCount: 1 })),
  );
  await press(" ");
  await waitFor(() => expect(result.current.phase).toBe("playing"));

  await press("z"); // wrong: target starts with "a"
  expect(result.current.stats.miss).toBe(1);
  expect(result.current.phase).toBe("playing");
});

test("the result tallies a miss against the key that was expected", async () => {
  installFetch([{ disp: "a", q: "a" }]);
  const { result } = renderHook(() =>
    useTypingGame(settings({ questionCount: 1 })),
  );
  await press(" ");
  await waitFor(() => expect(result.current.phase).toBe("playing"));

  await press("z"); // wrong key for target "a"
  await type("a"); // then correct -> finishes
  expect(result.current.phase).toBe("result");

  // "a" was expected: hit once, missed once. The wrong key itself is not kept.
  const keys = result.current.result?.keyStats ?? [];
  expect(keys).toHaveLength(1);
  expect(keys[0]).toMatchObject({ key: "a", correct: 1, miss: 1, total: 2 });
});

test("only the first key of a consecutive miss run is tallied", async () => {
  installFetch([{ disp: "a", q: "a" }]);
  const { result } = renderHook(() =>
    useTypingGame(settings({ questionCount: 1 })),
  );
  await press(" ");
  await waitFor(() => expect(result.current.phase).toBe("playing"));

  // Three consecutive wrong keys for target "a", then the correct one.
  await type("zxq");
  await type("a");
  expect(result.current.phase).toBe("result");

  // All three physical misses count toward the summary...
  expect(result.current.result?.miss).toBe(3);
  // ...but the run counts as a single fumble of key "a".
  const entry = result.current.result?.keyStats.find((s) => s.key === "a");
  expect(entry).toMatchObject({ key: "a", correct: 1, miss: 1 });
});

test('the "example" / "dxexamplde" spec: e is fumbled twice', async () => {
  installFetch([{ disp: "example", q: "example" }]);
  const { result } = renderHook(() =>
    useTypingGame(settings({ questionCount: 1 })),
  );
  await press(" ");
  await waitFor(() => expect(result.current.phase).toBe("playing"));

  await type("dxexamplde");
  expect(result.current.phase).toBe("result");

  // Key "e" was expected twice, hit right twice, fumbled twice (the "x" was a
  // repeat within the first run and is not tallied).
  const e = result.current.result?.keyStats.find((s) => s.key === "e");
  expect(e).toMatchObject({ key: "e", correct: 2, miss: 2, total: 4 });
});

test("suspendKeys makes the global listener inert (Space ignored)", async () => {
  installFetch([{ disp: "a", q: "a" }]);
  const { result } = renderHook(() =>
    useTypingGame(settings({ questionCount: 1 })),
  );
  act(() => result.current.suspendKeys(true));

  await press(" ");
  expect(result.current.phase).toBe("idle"); // start suppressed
});

test("completing a review question records the review", async () => {
  // One learning item, all slots reviews, due immediately.
  setLearning(CAT, { disp: "ab", q: "ab", lang: "en", uuid: "uuid-ab" }, true);
  installFetch([{ disp: "ab", q: "ab" }]);
  const { result } = renderHook(() =>
    useTypingGame(
      settings({
        questionCount: 1,
        study: { reviewFrequencyHours: 0, reviewCount: 3, reviewRatio: 1 },
      }),
    ),
  );

  await press(" ");
  await waitFor(() => expect(result.current.phase).toBe("playing"));
  expect(result.current.currentReview?.attempt).toBe(1);

  await type("ab");
  expect(result.current.phase).toBe("result");

  // recordReview bumped the count for this item.
  const [item] = getDueReviews(CAT, {
    reviewFrequencyHours: 0,
    reviewCount: 3,
    reviewRatio: 1,
  });
  expect(item.reviewsDone).toBe(1);
});

/** Run `fn` with performance.now() driven by a settable clock. */
async function withClock(
  fn: (at: (t: number, key: string) => Promise<void>) => Promise<void>,
) {
  const real = performance.now;
  let clock = 0;
  performance.now = () => clock;
  try {
    await fn(async (t, key) => {
      clock = t;
      await press(key);
    });
  } finally {
    performance.now = real;
  }
}

test("latency skips the first keystroke, misses, and the recovery after one", async () => {
  installFetch([{ disp: "abcd", q: "abcd" }]);
  const { result } = renderHook(() =>
    useTypingGame(settings({ questionCount: 1 })),
  );
  await press(" ");
  await waitFor(() => expect(result.current.phase).toBe("playing"));

  await withClock(async (at) => {
    await at(100, "a"); // first of the question: nothing to time against
    await at(250, "b"); // 150ms  <- measured
    await at(400, "z"); // a miss: not measured
    await at(900, "c"); // recovery after a miss: only sets the baseline
    await at(1000, "d"); // 100ms <- measured
  });

  expect(result.current.phase).toBe("result");
  const { latency } = result.current.result ?? { latency: null };
  expect(latency?.count).toBe(2);
  expect(latency?.median).toBe(125); // (100 + 150) / 2
  // Each gap belongs to the key that ended it: b took 150ms, d took 100ms.
  expect(latency?.keys.map((k) => [k.key, k.count, k.median])).toEqual([
    ["b", 1, 150],
    ["d", 1, 100],
  ]);
});

test("a new question restarts the rhythm", async () => {
  // Two questions, and the loader shuffles them, so drive whatever comes up.
  installFetch([
    { disp: "ab", q: "ab" },
    { disp: "cd", q: "cd" },
  ]);
  const { result } = renderHook(() =>
    useTypingGame(settings({ questionCount: 2 })),
  );
  await press(" ");
  await waitFor(() => expect(result.current.phase).toBe("playing"));

  await withClock(async (at) => {
    const first = result.current.currentSentence.q;
    await at(100, first[0]);
    await at(200, first[1]); // 100ms <- measured
    const second = result.current.currentSentence.q;
    // A long gap across the question boundary that must NOT be measured.
    await at(700, second[0]);
    await at(800, second[1]); // 100ms <- measured
  });

  expect(result.current.phase).toBe("result");
  expect(result.current.result?.latency.count).toBe(2);
  expect(result.current.result?.latency.median).toBe(100);
});
