/** Thin wrapper around the Web Speech API (SpeechSynthesis). */

/** True when the browser can synthesize speech. */
export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Speak `text` in the given language (default American English) at `rate`
 * (1 = normal), cancelling any utterance already in progress. No-op when speech
 * synthesis is unavailable.
 */
export function speak(text: string, lang = "en-US", rate = 1): void {
  if (!canSpeak() || !text.trim()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
}
