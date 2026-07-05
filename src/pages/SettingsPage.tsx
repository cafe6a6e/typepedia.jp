import { usePageTitle } from "@/hooks/usePageTitle";
import { useSettings } from "@/hooks/useSettings";
import { C_CHOICES, C_INPUTS, type CSide } from "@/lib/romajiTable";

export function SettingsPage() {
  usePageTitle("設定");
  const { settings, update } = useSettings();

  const setSide = (input: string, side: CSide) => {
    update({ cMapping: { ...settings.cMapping, [input]: side } });
  };

  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-2xl font-bold mb-6">設定</h2>

      <section className="mb-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 max-w-xs">
          <span className="text-sm text-white/60">ユーザー名</span>
          <input
            type="text"
            value={settings.username}
            maxLength={24}
            onChange={(e) => update({ username: e.target.value })}
            placeholder="anonymous"
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-md"
          />
        </label>

        <label className="flex flex-col gap-1 max-w-xs">
          <span className="text-sm text-white/60">出題数</span>
          <input
            type="number"
            min={1}
            max={50}
            value={settings.questionCount}
            onChange={(e) =>
              update({
                questionCount: Math.max(1, Number(e.target.value) || 1),
              })
            }
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-md"
          />
        </label>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-1">ローマ字カスタマイズ</h3>
        <p className="text-sm text-white/50 mb-4">
          子音 c / cy
          の入力を、か行・さ行（きゃ行・しゃ行）のどちらに割り当てるか選びます。設定は自動保存されます。
        </p>

        <div className="grid grid-cols-[3rem_1fr] gap-x-4 gap-y-2 items-center max-w-md">
          {C_INPUTS.map((input) => {
            const choices = C_CHOICES[input];
            const current = settings.cMapping[input];
            return (
              <div key={input} className="contents">
                <span className="font-mono text-right text-white/80">
                  {input}
                </span>
                <div className="flex gap-2">
                  {(["k", "s"] as const).map((side) => {
                    const active = current === side;
                    return (
                      <button
                        key={side}
                        type="button"
                        onClick={() => setSide(input, side)}
                        className={`flex-1 px-3 py-1.5 rounded-md border text-lg transition-colors ${
                          active
                            ? "border-green-500/70 bg-green-500/15 font-bold"
                            : "border-white/10 text-white/50 hover:bg-white/5"
                        }`}
                      >
                        {choices[side]}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
