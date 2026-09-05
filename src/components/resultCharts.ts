/**
 * Chart.js wiring for the result screen: the datasets, the axis/legend options,
 * and the two hooks that own a chart's lifetime. Kept apart from ResultView so
 * that file is just the screen.
 */
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
import { type RefObject, useEffect, useRef } from "react";
import type { KeyStat, LatencyBucket, LatencyKeyStat } from "@/types";

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

const GREEN = "rgba(74, 222, 128, 0.85)";
const RED = "rgba(248, 113, 113, 0.85)";
const BLUE = "#60a5fa";
const SLATE = "rgba(148, 163, 184, 0.85)";
const INK = "rgba(255, 255, 255, 0.6)";
const GRID = "rgba(255, 255, 255, 0.1)";

/** Make an otherwise-invisible key visible on the axis. */
export function visChar(ch: string): string {
  if (ch === " ") return "␣";
  if (ch === "\t") return "⇥";
  return ch;
}

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
export function keyChartData(rows: KeyStat[]) {
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
export function latencyChartData(
  buckets: LatencyBucket[],
  picked: LatencyKeyStat | null,
) {
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
export function useChart(
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
export function useChartData(
  chartRef: RefObject<Chart | null>,
  data: ChartData,
) {
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.data = data;
    chart.update();
  }, [chartRef, data]);
}

/**
 * Shared by both charts: fill the plot to its frame, and stagger the bars just
 * enough to feel alive without holding up reading the numbers.
 */
const BASE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 250,
    delay: (ctx: { type: string; mode?: string; dataIndex: number }) =>
      ctx.type === "data" && ctx.mode === "default" ? ctx.dataIndex * 12 : 0,
  },
} satisfies ChartOptions;

export const KEY_CHART_OPTIONS: ChartOptions = {
  ...BASE_OPTIONS,
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

export const LATENCY_CHART_OPTIONS: ChartOptions = {
  ...BASE_OPTIONS,
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
