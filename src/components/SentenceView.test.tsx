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

// --- 順番題材: the next question's opening trails the current one ---

/** Render with a next question set, and return the display line's <p>. */
function dispLine(nextDisp: string | undefined, hideInput = false) {
  const matcher = compileMatcher(ja.q, DEFAULT_SETTINGS, ja.lang);
  const { container } = render(
    <SentenceView
      sentence={ja}
      matcher={matcher}
      engine={{ slotIndex: 0, buffer: "" }}
      hideInput={hideInput}
      nextDisp={nextDisp}
    />,
  );
  const p = container.querySelectorAll("p")[0];
  if (!p) throw new Error("no display line");
  return p;
}

test("the next question's opening trails the display line, faintly", () => {
  const p = dispLine("逃げられる状況になっても動かなくなった");
  // Five characters of the next question, then an ellipsis for the rest.
  expect(p.textContent).toBe("海逃げられる…");
  const faint = p.querySelector("span");
  expect(faint?.textContent).toBe("逃げられる…");
  expect(faint?.className).toContain("text-white/25");
});

test("a short next question is shown whole, with no ellipsis", () => {
  expect(dispLine("似た状態").textContent).toBe("海似た状態");
});

test("the last question of a course has nothing trailing it", () => {
  const p = dispLine(undefined);
  expect(p.textContent).toBe("海");
  expect(p.querySelector("span")).toBeNull();
});

test("hiding the typing line keeps the peek ahead", () => {
  // hideInput hides this question's spelling; the next question's opening is
  // not part of that answer, so it stays visible.
  const p = dispLine("逃げられる状況になっても", true);
  expect(p.textContent).toBe("海逃げられる…");
});

// --- edge spaces in the display text are keystrokes, so they are marked ---

/** Render `sentence` and return its display line. */
function dispOf(sentence: Sentence, nextDisp?: string) {
  const matcher = compileMatcher(sentence.q, DEFAULT_SETTINGS, sentence.lang);
  const { container } = render(
    <SentenceView
      sentence={sentence}
      matcher={matcher}
      engine={{ slotIndex: 0, buffer: "" }}
      nextDisp={nextDisp}
    />,
  );
  const p = container.querySelectorAll("p")[0];
  if (!p) throw new Error("no display line");
  return p;
}

test("a leading space in the display text is shown as ␣", () => {
  const cont: Sentence = {
    disp: " 似た状態",
    q: " nitajoutai",
    lang: "ja",
    uuid: "u",
  };
  expect(dispOf(cont).textContent).toBe("␣似た状態");
});

test("a space inside the display text is left alone", () => {
  // 24k existing entries have interior spaces in translations; none are typed.
  const inner: Sentence = {
    disp: "Wi Fi の話",
    q: "waihuinohanashi",
    lang: "ja",
    uuid: "u",
  };
  expect(dispOf(inner).textContent).toBe("Wi Fi の話");
});

test("the peek ahead skips the next question's opening ␣⏎", () => {
  const plain: Sentence = { disp: "海", q: "umi", lang: "ja", uuid: "u" };
  // Those two keystrokes confirm THIS question; the peek shows five characters
  // of the next sentence itself.
  expect(dispOf(plain, " \n逃げられる状況になっても").textContent).toBe(
    "海逃げられる…",
  );
});

// --- the Enter that closes each question ---

test("a trailing newline in the display text is shown as ⏎", () => {
  const nl: Sentence = {
    disp: "似た状態に陥ることがあります。\n",
    q: "nitajoutai.\n",
    lang: "ja",
    uuid: "u",
  };
  expect(dispOf(nl).textContent).toBe("似た状態に陥ることがあります。⏎");
});

test("a trailing space and newline together are both marked", () => {
  const both: Sentence = {
    disp: "されています。 \n",
    q: "sareteimasu. \n",
    lang: "ja",
    uuid: "u",
  };
  expect(dispOf(both).textContent).toBe("されています。␣⏎");
});

test("the typing line shows the closing Enter as ⏎", () => {
  // Display text without edge whitespace, so `show`'s own disp check still holds.
  const nl: Sentence = { disp: "海", q: "umi\n", lang: "ja", uuid: "u" };
  expect(show(nl, { slotIndex: 0, buffer: "" }, false)).toBe("umi⏎");
});
