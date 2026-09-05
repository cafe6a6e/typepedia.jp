import { expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { ResultView } from "@/components/ResultView";
import type { KeyStat, ScoreResult } from "@/types";

/** [key, total, correct] — 12 keys, so the 10-row cap actually bites. */
const RAW: [string, number, number][] = [
  ["a", 42, 40],
  ["i", 38, 38],
  ["o", 31, 28],
  ["n", 27, 27],
  ["k", 22, 20],
  ["u", 21, 21],
  ["s", 19, 17],
  ["t", 18, 18],
  ["e", 16, 15],
  [" ", 14, 14],
  ["q", 2, 1],
  ["z", 2, 0],
];

const keyStats: KeyStat[] = RAW.map(([key, total, correct]) => ({
  key,
  correct,
  miss: total - correct,
  total,
  accuracy: correct / total,
}));

const base: ScoreResult = {
  // The summary counts every physical miss, the rows dedupe consecutive
  // fumbles, so these totals deliberately differ from the rows' sums.
  correct: 240,
  miss: 32,
  total: 272,
  accuracy: 240 / 272,
  keyStats,
};

/** The key column of every rendered row, in order. */
function renderedKeys(container: HTMLElement): string[] {
  return [...container.querySelectorAll("tbody tr")].map(
    (tr) => tr.querySelector("td")?.textContent ?? "",
  );
}

const header = (label: string) =>
  screen.getByRole("button", { name: new RegExp(`^${label}`) });

test("summary shows accuracy with the raw counts", () => {
  render(<ResultView result={base} onBack={mock(() => {})} />);
  expect(screen.getByText("88.2%")).toBeDefined();
  expect(screen.getByText("240")).toBeDefined();
  expect(screen.getByText("32")).toBeDefined();
  expect(screen.getByText("272")).toBeDefined();
});

test("defaults to accuracy ascending and shows only 10 rows", () => {
  const { container } = render(
    <ResultView result={base} onBack={mock(() => {})} />,
  );
  expect(renderedKeys(container)).toEqual([
    "z", // 0%
    "q", // 50%
    "s", // 89.5%
    "o", // 90.3%
    "k", // 90.9%
    "e", // 93.8%
    "a", // 95.2%
    "i", // 100%, busiest of the ties
    "n",
    "u",
  ]);
  // t and ␣ are 100% but less busy, so they fall outside the 10 rows.
  expect(renderedKeys(container)).not.toContain("␣");
});

test("clicking a header re-picks which keys are shown", () => {
  const { container } = render(
    <ResultView result={base} onBack={mock(() => {})} />,
  );
  fireEvent.click(header("打鍵"));
  // Busiest first: the rare q and z drop out entirely.
  expect(renderedKeys(container)).toEqual([
    "a",
    "i",
    "o",
    "n",
    "k",
    "u",
    "s",
    "t",
    "e",
    "␣",
  ]);
});

test("clicking the active header flips the direction", () => {
  const { container } = render(
    <ResultView result={base} onBack={mock(() => {})} />,
  );
  fireEvent.click(header("ミス")); // desc first: most misses
  expect(renderedKeys(container)[0]).toBe("o"); // 3 misses
  fireEvent.click(header("ミス")); // asc: fewest misses
  expect(renderedKeys(container)[0]).toBe("i"); // 0 misses, busiest
});

test("the active column is marked for assistive tech", () => {
  const { container } = render(
    <ResultView result={base} onBack={mock(() => {})} />,
  );
  const sorted = () =>
    [...container.querySelectorAll("th[aria-sort]")]
      .filter((th) => th.getAttribute("aria-sort") !== "none")
      .map((th) => [th.textContent, th.getAttribute("aria-sort")]);
  expect(sorted()).toEqual([["正解率▲", "ascending"]]);
  fireEvent.click(header("正解率"));
  expect(sorted()).toEqual([["正解率▼", "descending"]]);
});

test("a game with no keystrokes shows an empty state instead of the table", () => {
  const empty: ScoreResult = {
    correct: 0,
    miss: 0,
    total: 0,
    accuracy: 0,
    keyStats: [],
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
