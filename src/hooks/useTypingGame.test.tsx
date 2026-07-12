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

test("the result records which wrong key was pressed for a character", async () => {
  installFetch([{ disp: "a", q: "a" }]);
  const { result } = renderHook(() =>
    useTypingGame(settings({ questionCount: 1 })),
  );
  await press(" ");
  await waitFor(() => expect(result.current.phase).toBe("playing"));

  await press("z"); // wrong key for target "a"
  await type("a"); // then correct -> finishes
  expect(result.current.phase).toBe("result");

  const entry = result.current.result?.missByChar.find((m) => m.char === "a");
  expect(entry?.wrongKeys).toEqual([{ key: "z", count: 1 }]);
  expect(result.current.result?.leastMissedKeys).toEqual([
    { key: "z", count: 1 },
  ]);
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
  // ...but only the first wrong key ("z") is tallied in the breakdown.
  const entry = result.current.result?.missByChar.find((m) => m.char === "a");
  expect(entry?.wrongKeys).toEqual([{ key: "z", count: 1 }]);
  expect(entry?.count).toBe(1);
});

test('the "example" / "dxexamplde" spec: e gets d(2)', async () => {
  installFetch([{ disp: "example", q: "example" }]);
  const { result } = renderHook(() =>
    useTypingGame(settings({ questionCount: 1 })),
  );
  await press(" ");
  await waitFor(() => expect(result.current.phase).toBe("playing"));

  await type("dxexamplde");
  expect(result.current.phase).toBe("result");

  const e = result.current.result?.missByChar.find((m) => m.char === "e");
  expect(e?.wrongKeys).toEqual([{ key: "d", count: 2 }]);
  expect(e?.count).toBe(2);
  expect(result.current.result?.leastMissedKeys).toEqual([
    { key: "d", count: 2 },
  ]);
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
  setLearning(CAT, { disp: "ab", q: "ab", lang: "en" }, true);
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
