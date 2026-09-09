import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { StartScreen } from "@/components/StartScreen";

afterEach(cleanup);

function show(count: number, longText: boolean) {
  render(
    <StartScreen
      loading={false}
      username="alice"
      count={count}
      longText={longText}
      categories={["eiken_1st_grade", "rust"]}
      selected={longText ? "rust" : "eiken_1st_grade"}
      onSelect={() => {}}
    />,
  );
}

test("ordinary material is counted as 出題数", () => {
  show(10, false);
  expect(screen.getByText(/出題数 10 問/)).toBeDefined();
});

test("長文課題 is counted as 長文, so 出題数 10 is not claimed for it", () => {
  // 長文は 1 問がプログラム 1 本ぶん。共通の 出題数 とは別の設定で数える。
  show(1, true);
  expect(screen.getByText(/長文 1 問/)).toBeDefined();
  expect(screen.queryByText(/出題数/)).toBeNull();
});

test("both materials are offered, grouped", () => {
  show(1, true);
  expect(screen.getByRole("button", { name: /Rust/ })).toBeDefined();
  expect(screen.getByText("Coding")).toBeDefined();
  expect(screen.getByText("English")).toBeDefined();
});
