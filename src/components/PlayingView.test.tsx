import { beforeEach, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlayingView } from "@/components/PlayingView";
import { getMemos } from "@/lib/memo";
import { compileMatcher } from "@/lib/romajiEngine";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { isLearning } from "@/lib/study";

const CAT = "eiken_1st_grade";
const sentence = { disp: "apple", q: "apple", lang: "en" as const };
const matcher = compileMatcher("apple", DEFAULT_SETTINGS, "en");

function renderView(suspendKeys = mock(() => {})) {
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
      suspendKeys={suspendKeys}
    />,
  );
  return suspendKeys;
}

beforeEach(() => {
  localStorage.clear();
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
  fireEvent.click(screen.getByRole("switch"));
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
  fireEvent.click(screen.getByRole("switch")); // learning on
  fireEvent.click(screen.getByRole("button", { name: "OK" }));

  expect(getMemos()).toHaveLength(0);
  expect(isLearning(CAT, "apple")).toBe(true);
});
