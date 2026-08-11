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
      speechRate={1}
      speechVoiceJa=""
      speechVoiceEn=""
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
  /** Name of the voice that was selected, or "" when none was set. */
  voice: string;
}

/** Voices the stubbed browser reports — a good and a legacy one per language. */
const STUB_VOICES = [
  {
    name: "Microsoft Haruka",
    lang: "ja-JP",
    localService: true,
    default: true,
  },
  { name: "Google 日本語", lang: "ja-JP", localService: false, default: false },
  { name: "Microsoft David", lang: "en-US", localService: true, default: true },
  {
    name: "Google US English",
    lang: "en-US",
    localService: false,
    default: false,
  },
].map((v) => ({ ...v, voiceURI: `uri:${v.name}` }));

/** happy-dom has no Web Speech API, so canSpeak() is false unless we stub it. */
function installSpeechStub(): Spoken[] {
  const spoken: Spoken[] = [];
  class FakeUtterance {
    lang = "";
    rate = 1;
    pitch = 1;
    volume = 1;
    voice: { name: string } | null = null;
    constructor(public text: string) {}
  }
  const g = globalThis as unknown as Record<string, unknown>;
  g.SpeechSynthesisUtterance = FakeUtterance;
  g.speechSynthesis = {
    cancel() {},
    resume() {},
    addEventListener() {},
    removeEventListener() {},
    getVoices: () => STUB_VOICES,
    speak(u: FakeUtterance) {
      spoken.push({
        text: u.text,
        lang: u.lang,
        rate: u.rate,
        voice: u.voice?.name ?? "",
      });
    },
  };
  return spoken;
}

function renderSpeaking(s: Sentence, autoPlayAudio = true, rate = 1) {
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
      speechRate={rate}
      speechVoiceJa=""
      speechVoiceEn=""
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
      speechRate={1}
      speechVoiceJa=""
      speechVoiceEn=""
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

test("a 四字熟語 is auto-played as kana in ja-JP with the best ja voice", () => {
  // 漢字のままだと四字熟語を誤読するので、読み（kana）を読み上げる。
  const spoken = installSpeechStub();
  renderSpeaking(JA);
  expect(spoken).toEqual([
    {
      text: "あくいあくしょく",
      lang: "ja-JP",
      rate: 1,
      voice: "Google 日本語",
    },
  ]);
});

test("a Japanese sentence is auto-played as disp, not as kana", () => {
  // ひらがなだけを渡すと助詞の は→「ハ」を誤読し、外来語（ちーむ）も崩れる。
  const spoken = installSpeechStub();
  renderSpeaking({
    disp: "阿呍の呼吸で動くチームは、意思が通じる。",
    kana: "あうんのこきゅうでうごくちーむは、いしがつうじる。",
    q: "aunnnokokyuudeugokuchi-muha,ishigatsuujiru.",
    lang: "ja",
    uuid: "u-kanken",
  });
  expect(spoken[0].text).toBe("阿呍の呼吸で動くチームは、意思が通じる。");
  expect(spoken[0].lang).toBe("ja-JP");
});

test("a 四字熟語 without kana falls back to disp", () => {
  const spoken = installSpeechStub();
  renderSpeaking({ ...JA, kana: undefined });
  expect(spoken[0].text).toBe("悪衣悪食");
});

test("an English question is auto-played as the English text", () => {
  const spoken = installSpeechStub();
  renderSpeaking({ disp: "りんご", q: "an apple", lang: "en", uuid: "u-en" });
  expect(spoken).toEqual([
    { text: "an apple", lang: "en-US", rate: 1, voice: "Google US English" },
  ]);
});

test("the speech rate setting is passed through to the utterance", () => {
  const spoken = installSpeechStub();
  renderSpeaking(JA, true, 1.4);
  expect(spoken[0].rate).toBe(1.4);
});

test("音声を再生 plays a Japanese question on demand with autoplay off", () => {
  const spoken = installSpeechStub();
  renderSpeaking(JA, false);
  expect(spoken).toHaveLength(0);

  fireEvent.click(screen.getByRole("button", { name: "問題文を読み上げる" }));
  expect(spoken[0].text).toBe("あくいあくしょく");
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
  renderView(
    mock(() => {}),
    true,
  );
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
