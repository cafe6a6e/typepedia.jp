import { useEffect, useState } from "react";
import { PlayingView } from "@/components/PlayingView";
import { ResultView } from "@/components/ResultView";
import { StartScreen } from "@/components/StartScreen";
import { useCourseGuard } from "@/hooks/useCourseGuard";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useSettings } from "@/hooks/useSettings";
import { useTypingGame } from "@/hooks/useTypingGame";
import { categoryLabel, DEFAULT_CATEGORY } from "@/lib/categories";
import { getCategories } from "@/lib/sentences";

export function StartPage() {
  usePageTitle();
  const { settings, update } = useSettings();
  const game = useTypingGame(settings);
  const { setActive } = useCourseGuard();
  const [categories, setCategories] = useState<string[]>([]);

  // Let the nav guard know when a course is running.
  useEffect(() => {
    setActive(game.phase === "playing");
    return () => setActive(false);
  }, [game.phase, setActive]);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  // If the saved category isn't available, fall back to the default (or first).
  useEffect(() => {
    if (categories.length > 0 && !categories.includes(settings.category)) {
      update({
        category: categories.includes(DEFAULT_CATEGORY)
          ? DEFAULT_CATEGORY
          : categories[0],
      });
    }
  }, [categories, settings.category, update]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      {game.error && <p className="mb-4 text-red-400">{game.error}</p>}

      {(game.phase === "idle" || game.phase === "loading") && (
        <StartScreen
          loading={game.phase === "loading"}
          username={settings.username}
          count={settings.questionCount}
          categories={categories}
          selected={settings.category}
          onSelect={(c) => update({ category: c })}
        />
      )}

      {game.phase === "playing" &&
        game.currentSentence &&
        game.currentMatcher && (
          <PlayingView
            index={game.sentenceIndex}
            total={game.sentences.length}
            correct={game.stats.correct}
            miss={game.stats.miss}
            missFlash={game.missFlash}
            sentence={game.currentSentence}
            matcher={game.currentMatcher}
            engine={game.engine}
            category={categoryLabel(settings.category)}
            suspendKeys={game.suspendKeys}
          />
        )}

      {game.phase === "result" && game.result && (
        <ResultView result={game.result} onBack={game.goIdle} />
      )}
    </div>
  );
}
