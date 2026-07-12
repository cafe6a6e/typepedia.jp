import { expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoModal } from "@/components/MemoModal";

function renderModal(initialLearning = false) {
  const onSave = mock((_note: string, _learning: boolean) => {});
  const onCancel = mock(() => {});
  render(
    <MemoModal
      category="英語（英検1級）"
      disp="apple"
      q="apple"
      initialLearning={initialLearning}
      onCancel={onCancel}
      onSave={onSave}
    />,
  );
  return { onSave, onCancel };
}

test("the learning toggle reflects the initial status", () => {
  renderModal(true);
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
});

test("clicking the toggle flips the learning status", () => {
  renderModal(false);
  const toggle = screen.getByRole("switch");
  expect(toggle.getAttribute("aria-checked")).toBe("false");
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-checked")).toBe("true");
});

test("OK reports the note and learning value to onSave", () => {
  const { onSave } = renderModal(false);
  fireEvent.click(screen.getByRole("switch"));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "hi" } });
  fireEvent.click(screen.getByRole("button", { name: "OK" }));
  expect(onSave).toHaveBeenCalledWith("hi", true);
});

test("the learning toggle is focused on open", () => {
  renderModal(false);
  expect(document.activeElement).toBe(screen.getByRole("switch"));
});

test("Tab is trapped: from the last control it wraps to the first", () => {
  renderModal(false);
  const toggle = screen.getByRole("switch");
  const ok = screen.getByRole("button", { name: "OK" });

  // Tab from the last focusable (OK) wraps back to the first (toggle).
  ok.focus();
  fireEvent.keyDown(ok, { key: "Tab" });
  expect(document.activeElement).toBe(toggle);

  // Shift+Tab from the first wraps to the last.
  toggle.focus();
  fireEvent.keyDown(toggle, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(ok);
});

test("Escape dismisses the modal", () => {
  const { onCancel } = renderModal(false);
  fireEvent.keyDown(screen.getByRole("switch"), { key: "Escape" });
  expect(onCancel).toHaveBeenCalled();
});
