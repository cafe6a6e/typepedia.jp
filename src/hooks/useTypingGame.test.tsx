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

/**
 * Run `fn` with performance.now() driven by a settable clock. The clock starts
 * at 0, so a test that needs play to begin on it can start the course inside
 * `fn` rather than before it.
 */
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

test("the speed curve runs from the first correct keystroke to the last", async () => {
  installFetch([{ disp: "abcd", q: "abcd" }]);
  const { result } = renderHook(() =>
    useTypingGame(settings({ questionCount: 1 })),
  );

  await withClock(async (at) => {
    // Start inside the clock so play begins at 0 and the times are relative.
    await press(" ");
    await waitFor(() => expect(result.current.phase).toBe("playing"));
    await at(100, "a"); // starts the clock, and counts (unlike for latency)
    await at(250, "b");
    await at(400, "z"); // a miss: the text did not advance
    await at(900, "c"); // the recovery counts here too
    await at(1000, "d");
  });

  const speed = result.current.result?.speed;
  // 100ms to 1000ms: the wait before the first keystroke is not counted.
  expect(speed?.seconds).toBeCloseTo(0.9, 5);
  expect(speed?.points[0]?.t).toBe(0);
  // Four correct keystrokes over that span; the miss is not one of them.
  expect(speed?.mean).toBeCloseTo(4 / 0.9, 5);
  expect(speed?.points.at(-1)?.cps).toBeCloseTo(4 / 3, 5);
});

test("mistypes are marked on the speed curve's own clock", async () => {
  installFetch([{ disp: "abcd", q: "abcd" }]);
  const { result } = renderHook(() =>
    useTypingGame(settings({ questionCount: 1 })),
  );

  await withClock(async (at) => {
    await press(" ");
    await waitFor(() => expect(result.current.phase).toBe("playing"));
    await at(50, "z"); // a miss before the clock starts: pinned to its start
    await at(100, "a"); // the clock starts here
    await at(200, "b");
    await at(600, "z"); // a miss 500ms in
    await at(700, "c");
    await at(800, "d");
  });

  // A band a step wide around each miss, clipped to the span the curve covers.
  expect(result.current.result?.speed.missSpans).toEqual([
    { from: 0, to: 125 },
    { from: 375, to: 625 },
  ]);
});

test("the speed curve names the question each keystroke belonged to", async () => {
  // Two questions, and the loader shuffles them, so drive whatever comes up.
  installFetch([
    { disp: "ab", q: "ab" },
    { disp: "cd", q: "cd" },
  ]);
  const { result } = renderHook(() =>
    useTypingGame(settings({ questionCount: 2 })),
  );

  let first = "";
  let second = "";
  await withClock(async (at) => {
    await press(" ");
    await waitFor(() => expect(result.current.phase).toBe("playing"));
    first = result.current.currentSentence.disp;
    await at(100, result.current.currentSentence.q[0]);
    await at(200, result.current.currentSentence.q[1]);
    second = result.current.currentSentence.disp;
    await at(700, result.current.currentSentence.q[0]);
    await at(800, result.current.currentSentence.q[1]);
  });

  const points = result.current.result?.speed.points ?? [];
  expect(points.find((p) => p.t === 250)?.sentence).toBe(first);
  expect(points.at(-1)?.sentence).toBe(second);
  expect([...new Set(points.map((p) => p.sentence))].sort()).toEqual(
    [first, second].sort(),
  );
});

// --- 長文課題（コード）---

const RUST = "rust";

/** Stub the manifest under a category id the app knows is 長文. */
function installCodeFetch(files: RawSentence[]) {
  const manifest = [{ category: RUST, id: 1 }];
  // @ts-expect-error minimal fetch stub for tests
  globalThis.fetch = (url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => (url === "sentences/manifest.json" ? manifest : files),
    } as Response);
}

function codeSettings(patch: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, category: RUST, ...patch };
}

const TWO_LINES: RawSentence = {
  disp: "二分探索",
  q: "fn f() {\n    let x = 1;\n}",
  lang: "code",
};

/** Start a code course and wait until it is playing. */
async function startCode(settings = codeSettings()) {
  installCodeFetch([TWO_LINES]);
  const { result } = renderHook(() => useTypingGame(settings));
  await press(" ");
  await waitFor(() => expect(result.current.phase).toBe("playing"));
  return result;
}

test("a code question is handed in one line at a time", async () => {
  const result = await startCode();
  expect(result.current.lineIndex).toBe(0);

  for (const line of ["fn f() {", "    let x = 1;"]) {
    let ok = false;
    await act(async () => {
      ok = result.current.submitLine(line);
    });
    expect(ok).toBe(true);
  }
  expect(result.current.lineIndex).toBe(2);

  await act(async () => {
    result.current.submitLine("}");
  });
  expect(result.current.phase).toBe("result");
  expect(result.current.result?.miss).toBe(0);
});

test("a line handed in wrong is a miss and stays on its line", async () => {
  const result = await startCode();

  let ok = true;
  await act(async () => {
    ok = result.current.submitLine("fn f() }");
  });
  expect(ok).toBe(false);
  expect(result.current.lineIndex).toBe(0);
  // The rejected line itself is not a miss — only taking characters back is.
  expect(result.current.stats.miss).toBe(0);

  // The same line, right this time, moves on.
  await act(async () => {
    result.current.submitLine("fn f() {");
  });
  expect(result.current.lineIndex).toBe(1);
});

test("the indentation still has to be handed in with the line", async () => {
  // The field is pre-filled with it, but a line that lost it is not the line.
  const result = await startCode();
  await act(async () => {
    result.current.submitLine("fn f() {");
  });
  let ok = true;
  await act(async () => {
    ok = result.current.submitLine("let x = 1;");
  });
  expect(ok).toBe(false);
  expect(result.current.lineIndex).toBe(1);
});

test("keystrokes that move the line forward count as progress", async () => {
  // `Vec<u64>` is really typed as `<>` then the caret goes back between them,
  // so the arrows are work, not mistakes.
  const result = await startCode();
  await act(async () => {
    for (const k of ["<", ">", "ArrowLeft", "u"])
      result.current.recordStroke(k);
  });
  expect(result.current.stats).toEqual({ correct: 4, miss: 0 });

  await act(async () => {
    result.current.submitLine("fn f() {");
    result.current.submitLine("    let x = 1;");
    result.current.submitLine("}");
  });
  expect(result.current.result?.keyStats.map((k) => k.key)).toContain(
    "arrowleft",
  );
});

test("taking a character back is the miss, booked against that character", async () => {
  // The line is only judged when it is handed in, so a correction is the one
  // trace a fumbled key leaves behind.
  const result = await startCode();
  await act(async () => {
    result.current.recordStroke("l");
    result.current.recordStroke("e");
    result.current.recordStroke("t");
    result.current.recordStroke("Backspace", "t");
  });
  expect(result.current.stats).toEqual({ correct: 3, miss: 1 });

  await act(async () => {
    result.current.submitLine("fn f() {");
    result.current.submitLine("    let x = 1;");
    result.current.submitLine("}");
  });
  const t = result.current.result?.keyStats.find((k) => k.key === "t");
  expect(t).toMatchObject({ correct: 1, miss: 1 });
  // The key that did the deleting is not itself blamed.
  expect(result.current.result?.keyStats.map((k) => k.key)).not.toContain(
    "backspace",
  );
});

test("a Backspace that removes nothing is just a keystroke", async () => {
  // At the start of a line there is nothing to take back.
  const result = await startCode();
  await act(async () => {
    result.current.recordStroke("Backspace", "");
  });
  expect(result.current.stats).toEqual({ correct: 1, miss: 0 });
});

test("a rejected line flashes but is not counted as a miss", async () => {
  const result = await startCode();
  const flash = result.current.missFlash;
  await act(async () => {
    result.current.submitLine("fn f() }");
  });
  expect(result.current.stats.miss).toBe(0);
  expect(result.current.missFlash).toBe(flash + 1);
  expect(result.current.lineIndex).toBe(0);
});

test("the global key listener leaves code keys to the input", async () => {
  // Code is typed into a real input so the caret can be moved; swallowing the
  // keys here would stop the text from ever reaching it.
  const result = await startCode();
  await press("f");
  await press("Tab");
  await act(async () => {
    fireEvent.keyDown(window, { key: "Enter", shiftKey: true });
  });
  expect(result.current.stats).toEqual({ correct: 0, miss: 0 });
  expect(result.current.lineIndex).toBe(0);
});

test("長文課題 is sized by 長文の出題数, not by 出題数", async () => {
  installCodeFetch([
    TWO_LINES,
    { ...TWO_LINES, disp: "DSU", q: "struct Dsu;" },
    { ...TWO_LINES, disp: "Dijkstra", q: "fn dijkstra() {}" },
  ]);
  const { result } = renderHook(() =>
    useTypingGame(codeSettings({ questionCount: 3, longQuestionCount: 1 })),
  );
  await press(" ");
  await waitFor(() => expect(result.current.phase).toBe("playing"));
  expect(result.current.sentences).toHaveLength(1);
});

test("長文課題 skips the review rotation", async () => {
  // 復習割合 0.5 と 出題数 1 では Math.round(0.5) = 1 になり、学習中の項目が
  // 1 件でもあると毎回それしか出なくなる。長文は復習ローテーションを使わない。
  installCodeFetch([TWO_LINES]);
  setLearning(
    RUST,
    { disp: TWO_LINES.disp, q: TWO_LINES.q, lang: "code", uuid: "u-code" },
    true,
  );
  const s = codeSettings({
    study: { ...DEFAULT_SETTINGS.study, reviewFrequencyHours: 0 },
  });
  expect(getDueReviews(RUST, s.study)).toHaveLength(1);

  const { result } = renderHook(() => useTypingGame(s));
  await press(" ");
  await waitFor(() => expect(result.current.phase).toBe("playing"));
  expect(result.current.currentReview).toBeNull();
});
