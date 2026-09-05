import {
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  KEY_CHART_OPTIONS,
  keyChartData,
  LATENCY_CHART_OPTIONS,
  latencyChartData,
  useChart,
  useChartData,
  visChar,
} from "@/components/resultCharts";
import { rankKeys, type SortColumn, type SortDir } from "@/lib/scoring";
import type { ScoreResult } from "@/types";

interface Props {
  result: ScoreResult;
  onBack: () => void;
}

const METRICS: { value: SortColumn; label: string }[] = [
  { value: "accuracy", label: "正解率" },
  { value: "correct", label: "正解数" },
  { value: "miss", label: "ミス数" },
  { value: "total", label: "打鍵数" },
];

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** Section heading, shared by every block on this screen. */
function Heading({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-left text-xs font-semibold text-white/50">
      {children}
    </h3>
  );
}

/** A headline number with its breakdown, as it sits above each chart. */
function StatBox({ value, children }: { value: string; children: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-center gap-4 rounded-md bg-white/5 px-4 py-3">
      <span className="text-3xl font-bold tabular-nums">{value}</span>
      <span className="text-sm text-white/50">{children}</span>
    </div>
  );
}

/** Stand-in for a chart with nothing to plot. */
function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md bg-white/5 px-4 py-3 text-sm text-white/50">
      {children}
    </p>
  );
}

/** A fixed-height frame for one chart's canvas. */
function ChartFrame({
  canvasRef,
  label,
  height,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  label: string;
  height: string;
}) {
  return (
    <div className={height}>
      <canvas ref={canvasRef} aria-label={label} role="img" />
    </div>
  );
}

/** One of the ordering dropdowns above the accuracy chart. */
function SortSelect<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={{ colorScheme: "dark" }}
        className="rounded border border-white/10 bg-white/10 px-2 py-1 text-xs"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </>
  );
}

const DIRECTIONS: { value: SortDir; label: string }[] = [
  { value: "asc", label: "昇順" },
  { value: "desc", label: "降順" },
];

/** Result screen: accuracy summary, a sortable per-key chart, and latencies. */
export function ResultView({ result, onBack }: Props) {
  const { correct, miss, total, accuracy, keyStats, latency } = result;
  const [column, setColumn] = useState<SortColumn>("accuracy");
  const [dir, setDir] = useState<SortDir>("asc");
  const [pickedKey, setPickedKey] = useState<string | null>(null);

  const picked = latency.keys.find((k) => k.key === pickedKey) ?? null;

  // Most-measured first: the keys with the most samples are the ones whose
  // median actually says something.
  const latencyCards = useMemo(
    () =>
      [...latency.keys].sort(
        (a, b) =>
          b.count - a.count ||
          b.median - a.median ||
          a.key.localeCompare(b.key),
      ),
    [latency.keys],
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const latencyCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const rows = useMemo(
    // Every key that came up; the sort decides the order, not the cast.
    () => rankKeys(keyStats, column, dir, keyStats.length),
    [keyStats, column, dir],
  );

  const chartRef = useChart(canvasRef, KEY_CHART_OPTIONS);
  useChartData(
    chartRef,
    useMemo(() => keyChartData(rows), [rows]),
  );

  const latencyChartRef = useChart(latencyCanvasRef, LATENCY_CHART_OPTIONS);
  // The legend only earns its place once a key splits the bars in two.
  useEffect(() => {
    const legend = latencyChartRef.current?.options.plugins?.legend;
    if (legend) legend.display = picked !== null;
  }, [latencyChartRef, picked]);
  useChartData(
    latencyChartRef,
    useMemo(
      () => latencyChartData(latency.buckets, picked),
      [latency.buckets, picked],
    ),
  );

  return (
    <div className="w-full max-w-2xl text-center">
      <h2 className="mb-4 text-2xl font-bold">結果</h2>

      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Heading>正解率</Heading>
          <div className="flex gap-2">
            <SortSelect
              id="result-metric"
              label="並び替えの項目"
              value={column}
              options={METRICS}
              onChange={setColumn}
            />
            <SortSelect
              id="result-dir"
              label="並び順"
              value={dir}
              options={DIRECTIONS}
              onChange={setDir}
            />
          </div>
        </div>

        <StatBox value={pct(accuracy)}>
          正解 <span className="font-mono text-green-400">{correct}</span> ・
          ミス <span className="font-mono text-red-400">{miss}</span> ・ 打鍵{" "}
          <span className="font-mono text-white">{total}</span>
        </StatBox>

        {keyStats.length === 0 ? (
          <EmptyNote>打鍵がありませんでした</EmptyNote>
        ) : (
          <ChartFrame
            canvasRef={canvasRef}
            label="キー別の正解数・ミス数と正解率のグラフ"
            height="h-72"
          />
        )}
      </section>

      <section>
        <div className="mb-2">
          <Heading>レイテンシ</Heading>
        </div>

        {latency.count === 0 ? (
          <EmptyNote>
            連続して正解した打鍵がなく、計測できませんでした
          </EmptyNote>
        ) : (
          <>
            <StatBox value={`${latency.median}ms`}>
              中央値 ・ 計測{" "}
              <span className="font-mono text-white">{latency.count}</span> 回
            </StatBox>

            <ChartFrame
              canvasRef={latencyCanvasRef}
              label="打鍵レイテンシの頻度グラフ"
              height="h-56"
            />

            <div className="mt-4 mb-2">
              <Heading>
                キー別レイテンシ中央値（クリックでグラフに反映）
              </Heading>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1">
              {latencyCards.map((k) => {
                const on = k.key === pickedKey;
                return (
                  <button
                    key={k.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPickedKey(on ? null : k.key)}
                    className={`flex aspect-square flex-col items-center justify-center rounded border leading-tight transition-colors ${
                      on
                        ? "border-green-500/70 bg-green-500/15 text-white"
                        : "border-white/10 text-white/60 hover:bg-white/5"
                    }`}
                  >
                    <span className="font-mono text-lg">{visChar(k.key)}</span>
                    <span className="text-xs tabular-nums">{k.median}ms</span>
                    <span className="text-[10px] tabular-nums text-white/40">
                      {k.count}回
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      <button
        type="button"
        onClick={onBack}
        className="mt-6 text-sm text-white/50 hover:text-white"
      >
        コース選択に戻る（Space）
      </button>
    </div>
  );
}
