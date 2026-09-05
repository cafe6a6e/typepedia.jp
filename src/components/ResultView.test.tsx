import { expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { ResultView } from "@/components/ResultView";
import type { ScoreResult } from "@/types";

const base: ScoreResult = {
  correct: 90,
  miss: 10,
  total: 100,
  accuracy: 0.9,
  topKeys: [
    { key: "a", correct: 40, miss: 2, total: 42, accuracy: 40 / 42 },
    { key: "e", correct: 26, miss: 4, total: 30, accuracy: 26 / 30 },
    { key: " ", correct: 20, miss: 0, total: 20, accuracy: 1 },
  ],
};

test("summary shows accuracy with the raw counts", () => {
  render(<ResultView result={base} onBack={mock(() => {})} />);
  expect(screen.getByText("90.0%")).toBeDefined();
  expect(screen.getByText("90")).toBeDefined(); // correct
  expect(screen.getByText("10")).toBeDefined(); // miss
  expect(screen.getByText("100")).toBeDefined(); // total
});

test("the key table is ranked by volume and has no wrong-key column", () => {
  const { container } = render(
    <ResultView result={base} onBack={mock(() => {})} />,
  );
  expect(screen.getByText(/キー別/)).toBeDefined();
  expect(screen.queryByText(/誤入力キー/)).toBeNull();

  const headers = [...container.querySelectorAll("th")].map(
    (th) => th.textContent,
  );
  expect(headers).toEqual(["キー", "打鍵", "正解", "ミス", "正解率"]);

  const rows = [...container.querySelectorAll("tbody tr")].map((tr) =>
    [...tr.querySelectorAll("td")].map((td) => td.textContent),
  );
  expect(rows).toEqual([
    ["a", "42", "40", "2", "95.2%"],
    ["e", "30", "26", "4", "86.7%"],
    ["␣", "20", "20", "0", "100.0%"], // space is shown visibly
  ]);
});

test("a game with no keystrokes shows an empty state instead of the table", () => {
  const empty: ScoreResult = {
    correct: 0,
    miss: 0,
    total: 0,
    accuracy: 0,
    topKeys: [],
  };
  const { container } = render(
    <ResultView result={empty} onBack={mock(() => {})} />,
  );
  expect(screen.getByText(/打鍵がありませんでした/)).toBeDefined();
  expect(container.querySelector("table")).toBeNull();
});

test("the back button invokes onBack", () => {
  const onBack = mock(() => {});
  render(<ResultView result={base} onBack={onBack} />);
  fireEvent.click(screen.getByRole("button", { name: /コース選択に戻る/ }));
  expect(onBack).toHaveBeenCalled();
});
