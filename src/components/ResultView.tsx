import type { ChartConfiguration } from "chart.js";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { rankKeys, type SortColumn, type SortDir } from "@/lib/scoring";
import type {
  KeyStat,
  LatencyBucket,
  LatencyKeyStat,
  ScoreResult,
} from "@/types";

/** The per-key chart mixes bar and line datasets; the latency one is bars. */
type MixedConfig = ChartConfiguration<"bar" | "line">;
type ChartOptions = MixedConfig["options"];
type ChartData = MixedConfig["data"];

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
);

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

const GREEN = "rgba(74, 222, 128, 0.85)";
const RED = "rgba(248, 113, 113, 0.85)";
const BLUE = "#60a5fa";
const SLATE = "rgba(148, 163, 184, 0.85)";
const INK = "rgba(255, 255, 255, 0.6)";
const GRID = "rgba(255, 255, 255, 0.1)";

/** Make an otherwise-invisible key visible on the axis. */
function visChar(ch: string): string {
  if (ch === " ") return "␣";
  if (ch === "\t") return "⇥";
  return ch;
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** Accuracy axis bounds: 0-100 with a little headroom so points are not clipped. */
const ACCURACY_MIN = -3;
const ACCURACY_MAX = 103;
/** Gridlines every 10%, labels every 20%. */
const ACCURACY_GRID_STEP = 10;
const ACCURACY_LABEL_STEP = 20;
const ACCURACY_TICKS = Array.from(
  { length: 100 / ACCURACY_GRID_STEP + 1 },
  (_, i) => ({ value: i * ACCURACY_GRID_STEP }),
);

/** Bars and line for the ranked keys, in the shape Chart.js wants. */
function chartData(rows: KeyStat[]) {
  return {
    labels: rows.map((s) => visChar(s.key)),
    datasets: [
      {
        type: "bar" as const,
        label: "正解数",
        data: rows.map((s) => s.correct),
        backgroundColor: GREEN,
        stack: "keys",
        yAxisID: "y",
        order: 2,
      },
      {
        type: "bar" as const,
        label: "ミス数",
        data: rows.map((s) => s.miss),
        backgroundColor: RED,
        stack: "keys",
        yAxisID: "y",
        order: 2,
      },
      {
        type: "line" as const,
        label: "正解率",
        data: rows.map((s) => s.accuracy * 100),
        borderColor: BLUE,
        backgroundColor: BLUE,
        borderDash: [4, 4],
        borderWidth: 2,
        pointStyle: "circle" as const,
        pointRadius: 3,
        tension: 0,
        yAxisID: "y1",
        order: 1,
      },
    ],
  };
}

/**
 * Bars for the latency histogram. With a key picked the bars split into that
 * key's share and everything else, stacked so the totals stay comparable.
 */
function latencyData(buckets: LatencyBucket[], picked: LatencyKeyStat | null) {
  const labels = buckets.map((b) =>
    b.max === Number.POSITIVE_INFINITY ? `${b.min}〜` : `${b.min}–${b.max}`,
  );
  if (!picked) {
    return {
      labels,
      datasets: [
        {
          label: "件数",
          data: buckets.map((b) => b.count),
          backgroundColor: SLATE,
          stack: "latency",
        },
      ],
    };
  }
  return {
    labels,
    datasets: [
      {
        label: visChar(picked.key),
        data: picked.buckets,
        backgroundColor: GREEN,
        stack: "latency",
      },
      {
        label: "その他",
        data: buckets.map((b, i) => b.count - (picked.buckets[i] ?? 0)),
        backgroundColor: SLATE,
        stack: "latency",
      },
    ],
  };
}

/**
 * Build a chart once and hand back its ref. It starts empty so that later data
 * changes animate through the same instance instead of rebuilding one.
 */
function useChart(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  options: ChartOptions,
) {
  const chartRef = useRef<Chart | null>(null);
  const optionsRef = useRef(options);
  useEffect(() => {
    const canvas = canvasRef.current;
    // happy-dom (and any headless canvas-less host) hands back no 2d context.
    if (!canvas?.getContext("2d")) return;
    const chart = new Chart(canvas, {
      type: "bar",
      data: { labels: [], datasets: [] },
      options: optionsRef.current,
    } as MixedConfig);
    chartRef.current = chart;
    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, [canvasRef]);
  return chartRef;
}

/** Push new data into a chart built by `useChart`. */
function useChartData(chartRef: RefObject<Chart | null>, data: ChartData) {
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.data = data;
    chart.update();
  }, [chartRef, data]);
}

/** Animation shared by both charts: a short stagger, never a hold-up. */
const ANIMATION = {
  duration: 250,
  delay: (ctx: { type: string; mode?: string; dataIndex: number }) =>
    ctx.type === "data" && ctx.mode === "default" ? ctx.dataIndex * 12 : 0,
};

const KEY_CHART_OPTIONS: ChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  // A short stagger so the bars fill in with a bit of life but never
  // hold up reading the numbers.
  animation: {
    duration: 250,
    delay: (ctx) =>
      ctx.type === "data" && ctx.mode === "default" ? ctx.dataIndex * 12 : 0,
  },
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: {
      position: "top",
      align: "end",
      labels: { color: INK, boxWidth: 12, usePointStyle: true },
    },
    tooltip: {
      callbacks: {
        label: (ctx) =>
          ctx.dataset.label === "正解率"
            ? `正解率 ${(ctx.parsed.y as number).toFixed(1)}%`
            : `${ctx.dataset.label} ${ctx.parsed.y}`,
      },
    },
  },
  scales: {
    x: { stacked: true, ticks: { color: INK }, grid: { color: GRID } },
    // `y` is the bars' axis and `y1` the line's; the sides below are what
    // decides which edge each one is drawn on.
    y: {
      stacked: true,
      position: "right",
      beginAtZero: true,
      title: { display: true, text: "打鍵数", color: INK },
      ticks: { color: INK, precision: 0 },
      // The accuracy axis draws the horizontal grid; two sets at
      // different intervals just tangle. Keep the baseline, and mark the
      // scale with short ticks on the axis itself instead.
      grid: {
        color: (ctx) => (ctx.tick.value === 0 ? GRID : "transparent"),
        tickColor: GRID,
        tickLength: 5,
      },
    },
    y1: {
      position: "left",
      min: ACCURACY_MIN,
      max: ACCURACY_MAX,
      title: { display: true, text: "正解率", color: INK },
      // Pin the ticks to 0,10,…,100 rather than letting Chart.js pick
      // them from the padded -3..103 bounds.
      afterBuildTicks: (axis) => {
        axis.ticks = ACCURACY_TICKS.map((t) => ({ ...t }));
      },
      ticks: {
        color: INK,
        autoSkip: false,
        // An empty label keeps the gridline but drops the text, so the
        // grid is every 10% while only every 20% is written out.
        callback: (v) => (Number(v) % ACCURACY_LABEL_STEP === 0 ? `${v}%` : ""),
      },
      grid: { color: GRID },
    },
  },
};

const LATENCY_CHART_OPTIONS: ChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: ANIMATION,
  plugins: {
    // Only meaningful once a key splits the bars in two.
    legend: {
      display: false,
      position: "top",
      align: "end",
      labels: { color: INK, boxWidth: 12, usePointStyle: true },
    },
    tooltip: {
      callbacks: { label: (ctx) => `${ctx.dataset.label} ${ctx.parsed.y} 件` },
    },
  },
  scales: {
    x: {
      stacked: true,
      title: { display: true, text: "レイテンシ (ms)", color: INK },
      ticks: { color: INK },
      grid: { display: false },
    },
    y: {
      stacked: true,
      beginAtZero: true,
      title: { display: true, text: "件数", color: INK },
      ticks: { color: INK, precision: 0 },
      grid: { color: GRID },
    },
  },
};

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
    useMemo(() => chartData(rows), [rows]),
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
      () => latencyData(latency.buckets, picked),
      [latency.buckets, picked],
    ),
  );

  return (
    <div className="w-full max-w-2xl text-center">
      <h2 className="mb-4 text-2xl font-bold">結果</h2>

      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-white/50">正解率</h3>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="result-metric">
            並び替えの項目
          </label>
          <select
            id="result-metric"
            value={column}
            onChange={(e) => setColumn(e.target.value as SortColumn)}
            style={{ colorScheme: "dark" }}
            className="rounded border border-white/10 bg-white/10 px-2 py-1 text-xs"
          >
            {METRICS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="result-dir">
            並び順
          </label>
          <select
            id="result-dir"
            value={dir}
            onChange={(e) => setDir(e.target.value as SortDir)}
            style={{ colorScheme: "dark" }}
            className="rounded border border-white/10 bg-white/10 px-2 py-1 text-xs"
          >
            <option value="asc">昇順</option>
            <option value="desc">降順</option>
          </select>
        </div>
      </div>

      <div className="mb-6 flex items-baseline justify-center gap-4 rounded-md bg-white/5 px-4 py-3">
        <span className="text-3xl font-bold tabular-nums">{pct(accuracy)}</span>
        <span className="text-sm text-white/50">
          正解 <span className="font-mono text-green-400">{correct}</span> ・
          ミス <span className="font-mono text-red-400">{miss}</span> ・ 打鍵{" "}
          <span className="font-mono text-white">{total}</span>
        </span>
      </div>

      {keyStats.length === 0 ? (
        <p className="rounded-md bg-white/5 px-4 py-3 text-sm text-white/50">
          打鍵がありませんでした
        </p>
      ) : (
        <div className="h-72">
          <canvas
            ref={canvasRef}
            aria-label="キー別の正解数・ミス数と正解率のグラフ"
            role="img"
          />
        </div>
      )}

      <h3 className="mt-8 mb-2 text-left text-xs font-semibold text-white/50">
        レイテンシ
      </h3>
      {latency.count > 0 && (
        <div className="mb-4 flex items-baseline justify-center gap-4 rounded-md bg-white/5 px-4 py-3">
          <span className="text-3xl font-bold tabular-nums">
            {latency.median}ms
          </span>
          <span className="text-sm text-white/50">
            中央値 ・ 計測{" "}
            <span className="font-mono text-white">{latency.count}</span> 回
          </span>
        </div>
      )}
      {latency.count === 0 ? (
        <p className="rounded-md bg-white/5 px-4 py-3 text-sm text-white/50">
          連続して正解した打鍵がなく、計測できませんでした
        </p>
      ) : (
        <>
          <div className="h-56">
            <canvas
              ref={latencyCanvasRef}
              aria-label="打鍵レイテンシの頻度グラフ"
              role="img"
            />
          </div>

          <p className="mt-4 mb-2 text-left text-xs font-semibold text-white/50">
            キー別レイテンシ中央値（クリックでグラフに反映）
          </p>
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
