/** Subscribe to the browser's speech-synthesis voices (they load lazily). */
import { useSyncExternalStore } from "react";
import { getVoices, subscribeVoices } from "@/lib/speech";

const NO_VOICES: SpeechSynthesisVoice[] = [];

/** The available voices, re-rendering the caller once the browser loads them. */
export function useVoices(): SpeechSynthesisVoice[] {
  return useSyncExternalStore(subscribeVoices, getVoices, () => NO_VOICES);
}
