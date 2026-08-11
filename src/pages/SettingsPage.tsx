import { useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useSettings } from "@/hooks/useSettings";
import { useVoices } from "@/hooks/useVoices";
import { C_CHOICES, C_INPUTS, type CSide } from "@/lib/romajiTable";
import {
  MAX_RATE,
  MIN_RATE,
  pickVoice,
  speak,
  stopSpeaking,
  voicesFor,
} from "@/lib/speech";
import { EN_LANG, JA_LANG } from "@/lib/speechText";
import type { StudySettings } from "@/types";

/** Small "？" affordance that reveals an explanation on click. */
function Tip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block align-middle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="説明を表示"
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/30 text-[10px] text-white/60 hover:bg-white/10"
      >
        ？
      </button>
      {open && (
        <span className="absolute left-6 top-0 z-10 w-64 rounded-md border border-white/15 bg-neutral-800 p-2 text-xs leading-relaxed font-normal text-white/70 shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}

/**
 * 言語ごとの読み上げ音声を選ぶドロップダウンと、その場で確かめられる試聴ボタン。
 * 使える音声は端末やブラウザによって違うので、既定の「自動」では品質の高いものを
 * 優先して選ぶ（実際に選ばれる音声名を括弧で示す）。
 */
function VoiceSelect({
  label,
  lang,
  sample,
  value,
  rate,
  onChange,
}: {
  label: string;
  lang: string;
  /** 試聴で読み上げる短い文。 */
  sample: string;
  /** 選択中の voiceURI（空文字は自動）。 */
  value: string;
  rate: number;
  onChange: (voiceURI: string) => void;
}) {
  const voices = useVoices();
  const options = voicesFor(voices, lang);
  const auto = pickVoice(options, lang);

  // 音声はブラウザが非同期に読み込むため、まだ 0 件のことがある。
  if (options.length === 0) {
    return (
      <p className="text-sm text-white/40">
        {label}：この環境では選択できる音声がありません
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1 max-w-md">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-white/60">{label}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-md"
        >
          <option value="">
            自動（おすすめ{auto ? ` — ${auto.name}` : ""}）
          </option>
          {options.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name}
              {v.localService ? "" : "（ネットワーク）"}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => {
          stopSpeaking();
          speak(sample, { lang, rate, voiceURI: value });
        }}
        className="self-start flex items-center gap-2 rounded-full border border-white/15 px-4 py-1.5 text-sm text-white/70 hover:bg-white/5"
      >
        <span aria-hidden="true">🔊</span>
        試聴
      </button>
    </div>
  );
}

export function SettingsPage() {
  usePageTitle("設定");
  const { settings, update } = useSettings();

  const setSide = (input: string, side: CSide) => {
    update({ cMapping: { ...settings.cMapping, [input]: side } });
  };

  const updateStudy = (patch: Partial<StudySettings>) => {
    update({ study: { ...settings.study, ...patch } });
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

        <label className="flex items-center gap-3 cursor-pointer max-w-md">
          <input
            type="checkbox"
            checked={settings.autoPlayAudio}
            onChange={(e) => update({ autoPlayAudio: e.target.checked })}
            className="h-4 w-4 accent-green-500"
          />
          <span className="text-sm text-white/60">
            出題と同時に音声を再生
            <Tip text="問題が表示されると同時に自動で読み上げます。英語の題材では英文を、日本語の題材では文をそのまま（漢字かな交じりのまま）、四字熟語は読み（ひらがな）を読み上げます。オフにしても、出題画面の「音声を再生」ボタンでいつでも再生できます。" />
          </span>
        </label>

        <label className="flex flex-col gap-1 max-w-xs">
          <span className="text-sm text-white/60">
            読み上げ速度（{settings.speechRate.toFixed(1)}倍）
            <Tip text="読み上げの速さ。1.0 が等速です。遅くすると聞き取りやすく、速くすると手早く確認できます。（既定 1.0 倍）" />
          </span>
          <input
            type="range"
            min={MIN_RATE}
            max={MAX_RATE}
            step={0.1}
            value={settings.speechRate}
            onChange={(e) => update({ speechRate: Number(e.target.value) })}
            className="w-full accent-green-500"
          />
        </label>

        <VoiceSelect
          label="日本語の音声"
          lang={JA_LANG}
          sample="速度と声を確認します。"
          value={settings.speechVoiceJa}
          rate={settings.speechRate}
          onChange={(speechVoiceJa) => update({ speechVoiceJa })}
        />

        <VoiceSelect
          label="英語の音声"
          lang={EN_LANG}
          sample="This is a sample of the reading voice."
          value={settings.speechVoiceEn}
          rate={settings.speechRate}
          onChange={(speechVoiceEn) => update({ speechVoiceEn })}
        />

        <label className="flex items-center gap-3 cursor-pointer max-w-md">
          <input
            type="checkbox"
            checked={settings.hideMastered}
            onChange={(e) => update({ hideMastered: e.target.checked })}
            className="h-4 w-4 accent-green-500"
          />
          <span className="text-sm text-white/60">
            覚えた問題を出題しない
            <Tip text="メモ画面で「完全に覚えた」にした問題を、今後の出題（新規・復習とも）から除外します。オフにすると、覚えた問題も通常どおり出題されます。進捗率にはどちらの設定でも反映されます。" />
          </span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer max-w-md">
          <input
            type="checkbox"
            checked={settings.hideInput}
            onChange={(e) => update({ hideInput: e.target.checked })}
            className="h-4 w-4 accent-green-500"
          />
          <span className="text-sm text-white/60">
            入力部分を隠す
            <Tip text="出題画面の入力部分（ローマ字・英文）を隠し、正解した文字だけを表示します。漢字の読みや英単語のつづりを思い出しながら入力する練習になります。思い出せないときは、出題画面の「答えを見る」でその問題だけ表示できます。" />
          </span>
        </label>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold mb-1">学習設定</h3>
        <p className="text-sm text-white/50 mb-4">
          メモ画面で「学習中」にした題材を、間隔をあけて復習出題するための設定です。設定は自動保存されます。
        </p>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 max-w-xs">
            <span className="text-sm text-white/60">
              復習頻度（時間）
              <Tip text="「学習中」にした題材を、前回の出題から何時間あけて再び出題するか。短くすると頻繁に、長くすると間隔をあけて復習します。（既定 8 時間）" />
            </span>
            <input
              type="number"
              min={1}
              step={1}
              value={settings.study.reviewFrequencyHours}
              onChange={(e) =>
                updateStudy({
                  reviewFrequencyHours: Math.max(
                    1,
                    Number(e.target.value) || 1,
                  ),
                })
              }
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-md"
            />
          </label>

          <label className="flex flex-col gap-1 max-w-xs">
            <span className="text-sm text-white/60">
              復習回数（回）
              <Tip text="ひとつの題材を「学習中」にしてから、復習として再出題する最大回数。この回数に達すると復習ローテーションから外れます。（既定 3 回）" />
            </span>
            <input
              type="number"
              min={1}
              step={1}
              value={settings.study.reviewCount}
              onChange={(e) =>
                updateStudy({
                  reviewCount: Math.max(
                    1,
                    Math.floor(Number(e.target.value) || 1),
                  ),
                })
              }
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-md"
            />
          </label>

          <label className="flex flex-col gap-1 max-w-xs">
            <span className="text-sm text-white/60">
              復習割合（％）
              <Tip text="1 回の出題のうち、復習対象（学習中の題材）から出題する割合。残りは通常のランダム出題です。復習対象が足りない場合は自動でランダム出題で補います。（既定 50％）" />
            </span>
            <input
              type="number"
              min={0}
              max={100}
              step={5}
              value={Math.round(settings.study.reviewRatio * 100)}
              onChange={(e) => {
                const pct = Math.min(
                  100,
                  Math.max(0, Number(e.target.value) || 0),
                );
                updateStudy({ reviewRatio: pct / 100 });
              }}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-md"
            />
          </label>
        </div>
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
