/** Load/save user settings in localStorage with safe defaults. */
import { DEFAULT_CATEGORY } from "@/lib/categories";
import { C_INPUTS, DEFAULT_C_MAPPING } from "@/lib/romajiTable";
import type { Settings } from "@/types";

const STORAGE_KEY = "typing-game:settings";

export const DEFAULT_SETTINGS: Settings = {
  username: "",
  questionCount: 5,
  category: DEFAULT_CATEGORY,
  cMapping: { ...DEFAULT_C_MAPPING },
};

/** Keep only known inputs and valid sides, filling gaps from the defaults. */
function normalizeCMapping(raw: unknown): Record<string, "k" | "s"> {
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const result: Record<string, "k" | "s"> = {};
  for (const input of C_INPUTS) {
    result[input] =
      source[input] === "k" || source[input] === "s"
        ? source[input]
        : DEFAULT_C_MAPPING[input];
  }
  return result;
}

export function loadSettings(): Settings {
  if (typeof localStorage === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      username:
        typeof parsed.username === "string"
          ? parsed.username
          : DEFAULT_SETTINGS.username,
      questionCount:
        Number.isFinite(parsed.questionCount) &&
        (parsed.questionCount as number) > 0
          ? Math.floor(parsed.questionCount as number)
          : DEFAULT_SETTINGS.questionCount,
      category:
        typeof parsed.category === "string" && parsed.category
          ? parsed.category
          : DEFAULT_SETTINGS.category,
      cMapping: normalizeCMapping(parsed.cMapping),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
