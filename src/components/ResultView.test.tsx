import { expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { ResultView } from "@/components/ResultView";
import type { ScoreResult } from "@/types";

const base: ScoreResult = {
  correct: 90,
  miss: 10,
  total: 100,
  accuracy: 0.9,
  missByChar: [
    { char: "a", count: 6, ratio: 0.6 },
    { char: "b", count: 4, ratio: 0.4 },
  ],
};

test("summary shows accuracy and miss rates with counts", () => {
  render(<ResultView result={base} onBack={mock(() => {})} />);
  expect(screen.getByText(/正解率/)).toBeDefined();
  // The value spans are unique (labels like ミス率 also appear as a table header).
  expect(screen.getByText("90.0%")).toBeDefined(); // accuracy
  expect(screen.getByText("10.0%")).toBeDefined(); // miss rate
  // Counts over 総打鍵数.
  expect(screen.getByText("90")).toBeDefined(); // correct count
});

test("miss breakdown lists the mistyped characters and their share", () => {
  render(<ResultView result={base} onBack={mock(() => {})} />);
  expect(screen.getByText("a")).toBeDefined();
  expect(screen.getByText("60.0%")).toBeDefined(); // a's share of misses
});

test("no misses shows the celebratory empty state", () => {
  const clean: ScoreResult = {
    correct: 20,
    miss: 0,
    total: 20,
    accuracy: 1,
    missByChar: [],
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
