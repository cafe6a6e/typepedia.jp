import { expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { SentenceView } from "@/components/SentenceView";
import { compileMatcher } from "@/lib/romajiEngine";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { EngineState, Sentence } from "@/types";

const en: Sentence = {
  disp: "りんご",
  q: "apple pie",
  lang: "en",
  uuid: "u-en",
};
const ja: Sentence = {
  disp: "海",
  q: "umi",
  lang: "ja",
  uuid: "u-ja",
};

/** Text of the typing line only (the second <p>), with the caret nbsp stripped. */
function typingLine(container: HTMLElement, sentence: Sentence): string {
  const paragraphs = container.querySelectorAll("p");
  const line = paragraphs[paragraphs.length - 1].textContent ?? "";
  expect(paragraphs[0].textContent).toBe(sentence.disp);
  return line.replace(/\u00a0/g, "");
}

function show(sentence: Sentence, engine: EngineState, hideInput: boolean) {
  const matcher = compileMatcher(sentence.q, DEFAULT_SETTINGS, sentence.lang);
  const { container } = render(
    <SentenceView
      sentence={sentence}
      matcher={matcher}
      engine={engine}
      hideInput={hideInput}
    />,
  );
  return typingLine(container, sentence);
}

test("without hideInput the whole typing line is shown", () => {
  expect(show(en, { slotIndex: 0, buffer: "" }, false)).toBe("apple␣pie");
});

test("hideInput shows nothing before the first keystroke", () => {
  expect(show(en, { slotIndex: 0, buffer: "" }, true)).toBe("");
});

test("hideInput reveals only the characters already typed correctly", () => {
  expect(show(en, { slotIndex: 3, buffer: "" }, true)).toBe("app");
});

test("hideInput keeps the typed space visible and hides the rest", () => {
  expect(show(en, { slotIndex: 6, buffer: "" }, true)).toBe("apple␣");
});

test("hideInput hides the remainder of the slot in progress (JP romaji)", () => {
  // "umi" -> slots [u][mi]; mid-slot buffer "m" must not reveal the trailing i.
  expect(show(ja, { slotIndex: 1, buffer: "m" }, true)).toBe("um");
  expect(show(ja, { slotIndex: 1, buffer: "m" }, false)).toBe("umi");
});

test("hideInput defaults to off", () => {
  const matcher = compileMatcher(ja.q, DEFAULT_SETTINGS, ja.lang);
  const { container } = render(
    <SentenceView
      sentence={ja}
      matcher={matcher}
      engine={{ slotIndex: 0, buffer: "" }}
    />,
  );
  expect(typingLine(container, ja)).toBe("umi");
});
