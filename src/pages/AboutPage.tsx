import { usePageTitle } from "@/hooks/usePageTitle";

export function AboutPage() {
  usePageTitle("このアプリについて");

  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-2xl font-bold mb-6">About</h2>

      <section className="mb-10">
        <h3 className="text-lg font-semibold mb-3">このアプリについて</h3>
        <div className="flex flex-col gap-3 text-sm leading-relaxed text-white/70">
          <p>
            Typepedia は「タイピング練習」と「新しい知識の定着」の両方の実現をコンセプトに作られたタイピングアプリです。
          </p>
          <p>
            漢検・英検の各級に相当する語彙や表現を題材にした例文をタイピングすることで、指を動かしながら自然と知識が身についていくことを目指しています。
          </p>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-3">著作権</h3>
        <div className="flex flex-col gap-3 text-sm leading-relaxed text-white/70">
          <p>本アプリに関する著作権はすべて cafe6a6e に帰属します。</p>
          <p>
            例文は、漢検・英検の当該難易度相当の例文をオープンソースの大規模言語モデル「Qwen3」シリーズで生成し、cafe6a6e
            が加筆修正を行ったものです。
          </p>
          <p className="text-white/80">
            テキストの一切の転載・転用を禁じます。
          </p>
        </div>
      </section>
    </div>
  );
}
