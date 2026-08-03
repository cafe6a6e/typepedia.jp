import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlayingView } from "@/components/PlayingView";
import { isMastered } from "@/lib/mastery";
import { getMemos } from "@/lib/memo";
import { compileMatcher } from "@/lib/romajiEngine";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { isLearning } from "@/lib/study";
import type { Sentence } from "@/types";

const CAT = "eiken_1st_grade";
const UUID = "test-uuid-apple";
const sentence = { disp: "apple", q: "apple", lang: "en" as const, uuid: UUID };
const matcher = compileMatcher("apple", DEFAULT_SETTINGS, "en");

function renderView(suspendKeys = mock(() => {}), hideInput = false) {
  render(
    <PlayingView
      index={0}
      total={3}
      correct={0}
      miss={0}
      missFlash={0}
      sentence={sentence}
      matcher={matcher}
      engine={{ slotIndex: 0, buffer: "" }}
      category="英語（英検1級）"
      categoryId={CAT}
      review={null}
      autoPlayAudio={false}
      hideInput={hideInput}
      suspendKeys={suspendKeys}
    />,
  );
  return suspendKeys;
}

/** One recorded utterance. */
interface Spoken {
  text: string;
  lang: string;
  rate: number;
}

/** happy-dom has no Web Speech API, so canSpeak() is false unless we stub it. */
function installSpeechStub(): Spoken[] {
  const spoken: Spoken[] = [];
  class FakeUtterance {
    lang = "";
    rate = 1;
    constructor(public text: string) {}
  }
  const g = globalThis as unknown as Record<string, unknown>;
  g.SpeechSynthesisUtterance = FakeUtterance;
  g.speechSynthesis = {
    cancel() {},
    speak(u: FakeUtterance) {
      spoken.push({ text: u.text, lang: u.lang, rate: u.rate });
    },
  };
  return spoken;
}

function renderSpeaking(s: Sentence, autoPlayAudio = true) {
  render(
    <PlayingView
      index={0}
      total={1}
      correct={0}
      miss={0}
      missFlash={0}
      sentence={s}
      matcher={compileMatcher(s.q, DEFAULT_SETTINGS, s.lang)}
      engine={{ slotIndex: 0, buffer: "" }}
      category="四字熟語（漢検5級）"
      categoryId="yoji_01_kyu5"
      review={null}
      autoPlayAudio={autoPlayAudio}
      hideInput={false}
      suspendKeys={mock(() => {})}
    />,
  );
}

const JA: Sentence = {
  disp: "悪衣悪食",
  q: "akuiakushoku",
  kana: "あくいあくしょく",
  lang: "ja",
  uuid: "uuid-akui",
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  delete g.SpeechSynthesisUtterance;
  delete g.speechSynthesis;
});

test("shows the Esc / Shift+Enter hint", () => {
  renderView();
  expect(screen.getByText(/Shift\+Enter でメモ/)).toBeDefined();
});

test("Shift+Enter opens the memo modal and suspends game keys", () => {
  const suspendKeys = renderView();
  expect(screen.queryByText("学習中")).toBeNull();

  fireEvent.keyDown(window, { key: "Enter", shiftKey: true });

  expect(screen.getByText("学習中")).toBeDefined();
  expect(suspendKeys).toHaveBeenCalledWith(true);
});

test("shows a review banner when the question is a review", () => {
  render(
    <PlayingView
      index={0}
      total={1}
      correct={0}
      miss={0}
      missFlash={0}
      sentence={sentence}
      matcher={matcher}
      engine={{ slotIndex: 0, buffer: "" }}
      category="英語（英検1級）"
      categoryId={CAT}
      review={{ attempt: 2, lastReviewedTs: Date.now() }}
      autoPlayAudio={false}
      hideInput={false}
      suspendKeys={mock(() => {})}
    />,
  );
  expect(screen.getByText(/復習 2 回目/)).toBeDefined();
});

test("saving a memo with a note persists the memo and learning status", () => {
  renderView();
  // Open via the Memo button.
  fireEvent.click(screen.getByRole("button", { name: "Memo" }));

  // Turn learning on and write a note.
  fireEvent.click(screen.getByRole("switch", { name: "学習中" }));
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "覚える" },
  });
  fireEvent.click(screen.getByRole("button", { name: "OK" }));

  const memos = getMemos();
  expect(memos).toHaveLength(1);
  expect(memos[0].note).toBe("覚える");
  expect(isLearning(CAT, "apple")).toBe(true);
});

test("saving with an empty note records learning but no memo", () => {
  renderView();
  fireEvent.click(screen.getByRole("button", { name: "Memo" }));
  fireEvent.click(screen.getByRole("switch", { name: "学習中" })); // learning on
  fireEvent.click(screen.getByRole("button", { name: "OK" }));

  expect(getMemos()).toHaveLength(0);
  expect(isLearning(CAT, "apple")).toBe(true);
});

test("marking 完全に覚えた persists by uuid", () => {
  renderView();
  fireEvent.click(screen.getByRole("button", { name: "Memo" }));
  fireEvent.click(screen.getByRole("switch", { name: "完全に覚えた" }));
  fireEvent.click(screen.getByRole("button", { name: "OK" }));

  expect(isMastered(UUID)).toBe(true);
});

// --- speech ---

test("a Japanese question is auto-played as kana in ja-JP at 2x", () => {
  // 漢字のままだと四字熟語を誤読するので、読み（kana）を読み上げる。
  const spoken = installSpeechStub();
  renderSpeaking(JA);
  expect(spoken).toEqual([
    { text: "あくいあくしょく", lang: "ja-JP", rate: 2 },
  ]);
});

test("a Japanese question without kana falls back to disp", () => {
  const spoken = installSpeechStub();
  renderSpeaking({ ...JA, kana: undefined });
  expect(spoken).toEqual([{ text: "悪衣悪食", lang: "ja-JP", rate: 2 }]);
});

test("an English question is still auto-played as the English text at 1x", () => {
  const spoken = installSpeechStub();
  renderSpeaking({ disp: "りんご", q: "an apple", lang: "en", uuid: "u-en" });
  expect(spoken).toEqual([{ text: "an apple", lang: "en-US", rate: 1 }]);
});

test("音声を再生 plays a Japanese question on demand with autoplay off", () => {
  const spoken = installSpeechStub();
  renderSpeaking(JA, false);
  expect(spoken).toHaveLength(0);

  fireEvent.click(screen.getByRole("button", { name: "問題文を読み上げる" }));
  expect(spoken).toEqual([
    { text: "あくいあくしょく", lang: "ja-JP", rate: 2 },
  ]);
});

test("no 音声を再生 button when speech synthesis is unavailable", () => {
  // No stub installed → canSpeak() is false.
  renderSpeaking(JA);
  expect(
    screen.queryByRole("button", { name: "問題文を読み上げる" }),
  ).toBeNull();
});

test("no 答えを見る button when the input is not hidden", () => {
  renderView();
  expect(screen.queryByRole("button", { name: /答えを見る/ })).toBeNull();
});

test("答えを見る reveals the hidden input for the current question", () => {
  renderView(mock(() => {}), true);
  // Paragraphs: [0] 問題文(disp), [1] 入力行, [2] 操作ヒント.
  const typingLine = () =>
    (document.querySelectorAll("p")[1].textContent ?? "").replace(
      /\u00a0/g,
      "",
    );

  expect(typingLine()).toBe(""); // caret only — "apple" is hidden
  fireEvent.click(screen.getByRole("button", { name: /答えを見る/ }));

  expect(typingLine()).toBe("apple");
  expect(screen.queryByRole("button", { name: /答えを見る/ })).toBeNull();
});
