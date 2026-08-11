import { beforeEach, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { loadSettings } from "@/lib/settings";
import { SettingsPage } from "@/pages/SettingsPage";

beforeEach(() => {
  localStorage.clear();
});

test("editing the username persists it", () => {
  render(<SettingsPage />);
  fireEvent.change(screen.getByRole("textbox", { name: "ユーザー名" }), {
    target: { value: "alice" },
  });
  expect(loadSettings().username).toBe("alice");
});

test("questionCount is clamped to at least 1", () => {
  render(<SettingsPage />);
  const input = screen.getByRole("spinbutton", { name: "出題数" });
  fireEvent.change(input, { target: { value: "5" } });
  expect(loadSettings().questionCount).toBe(5);
  fireEvent.change(input, { target: { value: "0" } });
  expect(loadSettings().questionCount).toBe(1);
});

test("学習設定 inputs persist to settings.study", () => {
  render(<SettingsPage />);
  fireEvent.change(screen.getByRole("spinbutton", { name: /復習頻度/ }), {
    target: { value: "12" },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: /復習回数/ }), {
    target: { value: "5" },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: /復習割合/ }), {
    target: { value: "80" },
  });
  const { study } = loadSettings();
  expect(study.reviewFrequencyHours).toBe(12);
  expect(study.reviewCount).toBe(5);
  expect(study.reviewRatio).toBeCloseTo(0.8, 5);
});

test("復習割合 is clamped to the 0–100 range", () => {
  render(<SettingsPage />);
  const ratio = screen.getByRole("spinbutton", { name: /復習割合/ });
  fireEvent.change(ratio, { target: { value: "150" } });
  expect(loadSettings().study.reviewRatio).toBe(1);
});

test("入力部分を隠す toggles and persists", () => {
  render(<SettingsPage />);
  const toggle = screen.getByRole("checkbox", { name: /入力部分を隠す/ });
  expect(loadSettings().hideInput).toBe(false);

  fireEvent.click(toggle);
  expect(loadSettings().hideInput).toBe(true);

  fireEvent.click(toggle);
  expect(loadSettings().hideInput).toBe(false);
});

test("読み上げ速度 persists and is shown next to the slider", () => {
  render(<SettingsPage />);
  const slider = screen.getByRole("slider", { name: /読み上げ速度/ });
  expect(screen.getByText(/読み上げ速度（1.0倍）/)).toBeDefined();

  fireEvent.change(slider, { target: { value: "1.4" } });

  expect(loadSettings().speechRate).toBe(1.4);
  expect(screen.getByText(/読み上げ速度（1.4倍）/)).toBeDefined();
});

test("the voice pickers explain themselves when no voices are available", () => {
  // happy-dom has no Web Speech API, so useVoices() stays empty.
  render(<SettingsPage />);
  expect(
    screen.getByText("日本語の音声：この環境では選択できる音声がありません"),
  ).toBeDefined();
  expect(
    screen.getByText("英語の音声：この環境では選択できる音声がありません"),
  ).toBeDefined();
});

test("choosing a romaji c-mapping side persists it", () => {
  render(<SettingsPage />);
  // "さ" is the さ行 choice for the "ca" input only.
  fireEvent.click(screen.getByRole("button", { name: "さ" }));
  expect(loadSettings().cMapping.ca).toBe("s");
});

test("the ？ tip reveals its explanation on click", () => {
  render(<SettingsPage />);
  expect(screen.queryByText(/前回の出題から/)).toBeNull();
  // Tips in DOM order: [0] 音声再生, [1] 読み上げ速度, [2] 覚えた問題,
  // [3] 入力部分を隠す, [4] 復習頻度, … — click 復習頻度.
  fireEvent.click(screen.getAllByLabelText("説明を表示")[4]);
  expect(screen.getByText(/前回の出題から/)).toBeDefined();
});
