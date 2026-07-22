import { expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoModal } from "@/components/MemoModal";

function renderModal(initialLearning = false, initialMastered = false) {
  const onSave = mock(
    (_note: string, _learning: boolean, _mastered: boolean) => {},
  );
  const onCancel = mock(() => {});
  render(
    <MemoModal
      category="英語（英検1級）"
      disp="apple"
      q="apple"
      initialLearning={initialLearning}
      initialMastered={initialMastered}
      onCancel={onCancel}
      onSave={onSave}
    />,
  );
  return { onSave, onCancel };
}

const learningSwitch = () => screen.getByRole("switch", { name: "学習中" });
const masteredSwitch = () =>
  screen.getByRole("switch", { name: "完全に覚えた" });

test("the learning toggle reflects the initial status", () => {
  renderModal(true);
  expect(learningSwitch().getAttribute("aria-checked")).toBe("true");
});

test("clicking the toggle flips the learning status", () => {
  renderModal(false);
  const toggle = learningSwitch();
  expect(toggle.getAttribute("aria-checked")).toBe("false");
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-checked")).toBe("true");
});

test("the mastered toggle reflects the initial status and flips", () => {
  renderModal(false, true);
  const toggle = masteredSwitch();
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-checked")).toBe("false");
});

test("turning on 完全に覚えた switches off 学習中", () => {
  renderModal(true, false);
  expect(learningSwitch().getAttribute("aria-checked")).toBe("true");
  fireEvent.click(masteredSwitch());
  expect(masteredSwitch().getAttribute("aria-checked")).toBe("true");
  expect(learningSwitch().getAttribute("aria-checked")).toBe("false");
});

test("OK reports the note, learning and mastered values to onSave", () => {
  const { onSave } = renderModal(false);
  fireEvent.click(learningSwitch());
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "hi" } });
  fireEvent.click(screen.getByRole("button", { name: "OK" }));
  expect(onSave).toHaveBeenCalledWith("hi", true, false);
});

test("the learning toggle is focused on open", () => {
  renderModal(false);
  expect(document.activeElement).toBe(learningSwitch());
});

test("Tab is trapped: from the last control it wraps to the first", () => {
  renderModal(false);
  const toggle = learningSwitch();
  const ok = screen.getByRole("button", { name: "OK" });

  // Tab from the last focusable (OK) wraps back to the first (学習中 toggle).
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
  fireEvent.keyDown(learningSwitch(), { key: "Escape" });
  expect(onCancel).toHaveBeenCalled();
});
