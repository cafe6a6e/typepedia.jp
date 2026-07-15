import { expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { ResultView } from "@/components/ResultView";
import type { ScoreResult } from "@/types";

const base: ScoreResult = {
  correct: 90,
  miss: 10,
  total: 100,
  accuracy: 0.9,
  lowAccuracyKeys: [
    {
      key: "e",
      correct: 6,
      miss: 4,
      total: 10,
      accuracy: 0.6,
      missRate: 0.4,
      wrongKeys: [
        { key: "d", count: 3 },
        { key: "w", count: 1 },
      ],
    },
    {
      key: "t",
      correct: 8,
      miss: 2,
      total: 10,
      accuracy: 0.8,
      missRate: 0.2,
      wrongKeys: [{ key: "r", count: 2 }],
    },
  ],
  highAccuracyKeys: [
    { key: "a", correct: 20, miss: 0, total: 20, accuracy: 1, missRate: 0, wrongKeys: [] },
    { key: "s", correct: 15, miss: 0, total: 15, accuracy: 1, missRate: 0, wrongKeys: [] },
  ],
};

test("summary shows accuracy and miss rates with counts", () => {
  render(<ResultView result={base} onBack={mock(() => {})} />);
  // 正解率 also appears as a section title, so allow multiple.
  expect(screen.getAllByText(/正解率/).length).toBeGreaterThan(0);
  expect(screen.getByText("90.0%")).toBeDefined(); // accuracy
  expect(screen.getByText("10.0%")).toBeDefined(); // miss rate
  expect(screen.getByText("90")).toBeDefined(); // correct count
});

test("low-accuracy table lists keys with miss/correct/rate and wrong keys", () => {
  render(<ResultView result={base} onBack={mock(() => {})} />);
  expect(screen.getByText(/正解率の低いキー/)).toBeDefined();
  expect(screen.getByText(/誤入力キー/)).toBeDefined();
  // Key "e" is a low-accuracy row; "d" is a wrong key pressed for it.
  expect(screen.getByText("e")).toBeDefined();
  expect(screen.getByText("d")).toBeDefined();
  expect(screen.getByText("40.0%")).toBeDefined(); // e's miss rate
});

test("high-accuracy table lists the best keys (no wrong-key column)", () => {
  render(<ResultView result={base} onBack={mock(() => {})} />);
  expect(screen.getByText(/正解率の高いキー/)).toBeDefined();
  expect(screen.getByText("a")).toBeDefined();
  expect(screen.getByText("s")).toBeDefined();
});

test("no low-accuracy keys shows the celebratory empty state", () => {
  const clean: ScoreResult = {
    correct: 20,
    miss: 0,
    total: 20,
    accuracy: 1,
    lowAccuracyKeys: [],
    highAccuracyKeys: [
      { key: "a", correct: 20, miss: 0, total: 20, accuracy: 1, missRate: 0, wrongKeys: [] },
    ],
  };
  render(<ResultView result={clean} onBack={mock(() => {})} />);
  expect(screen.getByText(/ミスはありませんでした/)).toBeDefined();
});

test("the back button invokes onBack", () => {
  const onBack = mock(() => {});
  render(<ResultView result={base} onBack={onBack} />);
  fireEvent.click(screen.getByRole("button", { name: /コース選択に戻る/ }));
  expect(onBack).toHaveBeenCalled();
});
