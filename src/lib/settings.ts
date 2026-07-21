/** Load/save user settings in localStorage with safe defaults. */
import { DEFAULT_CATEGORY } from "@/lib/categories";
import { C_INPUTS, DEFAULT_C_MAPPING } from "@/lib/romajiTable";
import type { Settings, StudySettings } from "@/types";

const STORAGE_KEY = "typing-game:settings";

export const DEFAULT_STUDY_SETTINGS: StudySettings = {
  reviewFrequencyHours: 8,
  reviewCount: 3,
  reviewRatio: 0.5,
};

export const DEFAULT_SETTINGS: Settings = {
  username: "",
  questionCount: 10,
  category: DEFAULT_CATEGORY,
  cMapping: { ...DEFAULT_C_MAPPING },
  study: { ...DEFAULT_STUDY_SETTINGS },
  autoPlayAudio: true,
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

/** Clamp/validate the study settings, filling gaps from the defaults. */
function normalizeStudy(raw: unknown): StudySettings {
  const s =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const freq = Number(s.reviewFrequencyHours);
  const count = Number(s.reviewCount);
  const ratio = Number(s.reviewRatio);
  return {
    reviewFrequencyHours:
      Number.isFinite(freq) && freq > 0
        ? freq
        : DEFAULT_STUDY_SETTINGS.reviewFrequencyHours,
    reviewCount:
      Number.isFinite(count) && count >= 1
        ? Math.floor(count)
        : DEFAULT_STUDY_SETTINGS.reviewCount,
    reviewRatio:
      Number.isFinite(ratio) && ratio >= 0 && ratio <= 1
        ? ratio
        : DEFAULT_STUDY_SETTINGS.reviewRatio,
  };
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
      study: normalizeStudy(parsed.study),
      autoPlayAudio:
        typeof parsed.autoPlayAudio === "boolean"
          ? parsed.autoPlayAudio
          : DEFAULT_SETTINGS.autoPlayAudio,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
