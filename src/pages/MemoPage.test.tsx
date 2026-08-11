import { beforeEach, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { addMemo, getMemos } from "@/lib/memo";
import { MemoPage } from "@/pages/MemoPage";

function seed() {
  addMemo({ category: "英語", disp: "apple", q: "apple", note: "A" });
  addMemo({ category: "英語", disp: "banana", q: "banana", note: "B" });
}

beforeEach(() => {
  localStorage.clear();
});

test("renders a row per memo", () => {
  seed();
  render(<MemoPage />);
  // disp and q are both "apple"/"banana", so each appears in two cells.
  expect(screen.getAllByText("apple").length).toBeGreaterThan(0);
  expect(screen.getAllByText("banana").length).toBeGreaterThan(0);
  expect(screen.getAllByLabelText("削除対象に選択")).toHaveLength(2);
});

test("shows an empty state when there are no memos", () => {
  render(<MemoPage />);
  expect(screen.getByText("まだメモがありません。")).toBeDefined();
});

test("selecting a row and confirming deletes it", () => {
  seed();
  render(<MemoPage />);

  // Select one row (per-row checkboxes carry this aria-label).
  const rowChecks = screen.getAllByLabelText("削除対象に選択");
  expect(rowChecks).toHaveLength(2);
  fireEvent.click(rowChecks[0]);

  // Trigger the bulk-delete button (label reflects the selection count).
  fireEvent.click(screen.getByRole("button", { name: /一括削除/ }));

  // Confirm in the modal.
  fireEvent.click(screen.getByRole("button", { name: "削除" }));

  expect(getMemos()).toHaveLength(1);
  // The remaining row is still shown; the deleted one is gone.
  expect(screen.getAllByLabelText("削除対象に選択")).toHaveLength(1);
});

test("select-all selects every row", () => {
  seed();
  render(<MemoPage />);
  // The header checkbox is the first checkbox (no per-row aria-label).
  const headerCheck = screen.getAllByRole("checkbox")[0];
  fireEvent.click(headerCheck);
  // Bulk-delete label now reflects all rows selected.
  expect(screen.getByRole("button", { name: /一括削除（2）/ })).toBeDefined();
});
