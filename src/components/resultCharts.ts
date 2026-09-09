/**
 * Chart.js wiring for the result screen: the datasets, the axis/legend options,
 * and the two hooks that own a chart's lifetime. Kept apart from ResultView so
 * that file is just the screen.
 */
import type { ChartConfiguration, Plugin } from "chart.js";
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
import type {
  KeyStat,
  LatencyBucket,
  LatencyKeyStat,
  MissSpan,
  SpeedPoint,
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

const GREEN = "rgba(74, 222, 128, 0.85)";
const RED = "rgba(248, 113, 113, 0.85)";
const BLUE = "#60a5fa";
const SLATE = "rgba(148, 163, 184, 0.85)";
const INK = "rgba(255, 255, 255, 0.6)";
const GRID = "rgba(255, 255, 255, 0.1)";
/** Bright enough to follow with the eye, still quieter than the line itself. */
const GUIDE = "rgba(255, 255, 255, 0.25)";
/**
 * The band behind every other question. A mid grey at low alpha moves whatever
 * it sits on toward the middle — lifting a dark ground, dropping a light one —
 * so the banding reads either way without a theme-aware colour.
 */
const BAND = "rgba(148, 163, 184, 0.1)";
/**
 * The band over the moments that were mistyped. Red enough to find at a glance,
 * pale enough that the curve still reads through it. Kept in step with the
 * swatch the result view puts beside the heading.
 */
const MISS_BAND = "rgba(248, 113, 113, 0.25)";

/** Make an otherwise-invisible key visible on the axis. */
export function visChar(ch: string): string {
  if (ch === " ") return "␣";
  if (ch === "\t") return "⇥";
  if (ch === "\n") return "⏎";
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
 * Split a question into short lines for the tooltip. Chart.js draws one array
 * entry per line, so a long sentence stacks instead of stretching the box off
 * the side of the chart.
 */
export function wrapText(text: string, width = 28, maxLines = 3): string[] {
  const chars = [...text];
  const lines: string[][] = [];
  for (let i = 0; i < chars.length && lines.length < maxLines; i += width) {
    lines.push(chars.slice(i, i + width));
  }
  if (chars.length > lines.length * width) {
    const last = lines.length - 1;
    lines[last] = [...lines[last].slice(0, width - 1), "…"];
  }
  return lines.map((line) => line.join(""));
}

/** A speed point as Chart.js holds it: seconds on x, its question in tow. */
interface SpeedDatum {
  x: number;
  y: number;
  sentence: string;
}

/** The line for the speed curve; one series, so the heading is its label. */
export function speedChartData(points: SpeedPoint[], misses: MissSpan[] = []) {
  const data: SpeedDatum[] = points.map((p) => ({
    x: p.t / 1000,
    y: p.cps,
    sentence: p.sentence,
  }));
  return {
    datasets: [
      {
        type: "line" as const,
        label: "打鍵速度",
        // Rides along with the series in the axis's own unit, so MISS_BANDS
        // reads it off the chart without a second wiring of its own.
        missSpans: misses.map((m) => ({
          from: m.from / 1000,
          to: m.to / 1000,
        })),
        // Each point carries its question, so the tooltip can name it off
        // `ctx.raw` and the options below stay a plain module constant.
        data,
        borderColor: BLUE,
        backgroundColor: BLUE,
        borderWidth: 2,
        tension: 0.25,
        // A point per 250ms would be a wall of dots; the hover brings one back.
        pointRadius: 0,
        pointHoverRadius: 4,
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
  plugins: Plugin[] = [],
) {
  const chartRef = useRef<Chart | null>(null);
  const optionsRef = useRef(options);
  const pluginsRef = useRef(plugins);
  useEffect(() => {
    const canvas = canvasRef.current;
    // happy-dom (and any headless canvas-less host) hands back no 2d context.
    if (!canvas?.getContext("2d")) return;
    const chart = new Chart(canvas, {
      type: "bar",
      data: { labels: [], datasets: [] },
      options: optionsRef.current,
      plugins: pluginsRef.current,
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

/**
 * A vertical guide under the tooltip. On a curve with no visible points it is
 * what ties the reading to a moment on the x axis.
 */
export const CROSSHAIR: Plugin = {
  id: "crosshair",
  afterDatasetsDraw(chart) {
    const [active] = chart.getActiveElements();
    if (!active) return;
    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(active.element.x, chartArea.top);
    ctx.lineTo(active.element.x, chartArea.bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = GUIDE;
    ctx.stroke();
    ctx.restore();
  },
};

/**
 * Index ranges of the points to shade: every other run of one question. Leaving
 * the alternate runs bare is what makes the banding read; two shades would just
 * look like a second series.
 */
export function shadedRuns(points: { sentence: string }[]) {
  const runs: { from: number; to: number }[] = [];
  for (let from = 0, n = 0; from < points.length; n++) {
    let to = from + 1;
    while (
      to < points.length &&
      points[to].sentence === points[from].sentence
    ) {
      to++;
    }
    if (n % 2 === 1) runs.push({ from, to });
    from = to;
  }
  return runs;
}

/**
 * Bands behind the plot, one per question. Drawn in beforeDraw so the gridlines
 * still sit on top of them.
 */
export const QUESTION_BANDS: Plugin = {
  id: "questionBands",
  beforeDraw(chart) {
    const points = chart.data.datasets[0]?.data as unknown as
      | SpeedDatum[]
      | undefined;
    const scale = chart.scales.x;
    if (!points?.length || !scale) return;

    const { ctx } = chart;
    const { top, bottom, left, right } = chart.chartArea;
    const px = (i: number) => scale.getPixelForValue(points[i].x);
    ctx.save();
    ctx.fillStyle = BAND;
    for (const run of shadedRuns(points)) {
      const from = Math.max(px(run.from), left);
      // The last run reaches the edge; the others stop where the next begins.
      const to = run.to < points.length ? Math.min(px(run.to), right) : right;
      ctx.fillRect(from, top, to - from, bottom - top);
    }
    ctx.restore();
  },
};

/**
 * Bands over the moments a key was fumbled, drawn on top of the question
 * banding so a miss stays the same shade whichever question it fell in.
 */
export const MISS_BANDS: Plugin = {
  id: "missBands",
  beforeDraw(chart) {
    const { missSpans } = (chart.data.datasets[0] ?? {}) as {
      missSpans?: MissSpan[];
    };
    const scale = chart.scales.x;
    if (!missSpans?.length || !scale) return;

    const { ctx } = chart;
    const { top, bottom, left, right } = chart.chartArea;
    ctx.save();
    ctx.fillStyle = MISS_BAND;
    for (const span of missSpans) {
      const from = Math.max(scale.getPixelForValue(span.from), left);
      const to = Math.min(scale.getPixelForValue(span.to), right);
      if (to > from) ctx.fillRect(from, top, to - from, bottom - top);
    }
    ctx.restore();
  },
};

export const SPEED_CHART_OPTIONS: ChartOptions = {
  ...BASE_OPTIONS,
  // The staggered reveal suits bars; on a curve of hundreds of points it only
  // delays the shape the eye came for.
  animation: false,
  // The curve has no visible points, so let the whole column be the hit target.
  interaction: { mode: "index", intersect: false },
  plugins: {
    // One series: the section heading already names it.
    legend: { display: false },
    tooltip: {
      callbacks: {
        title: (items) => `${Number(items[0]?.parsed.x ?? 0).toFixed(1)} 秒`,
        label: (ctx) => `${Number(ctx.parsed.y).toFixed(1)} 打/秒`,
        afterBody: (items) =>
          wrapText(
            String((items[0]?.raw as SpeedDatum | undefined)?.sentence ?? ""),
          ),
      },
    },
  },
  scales: {
    x: {
      type: "linear",
      // Pinned to the session at both ends: 0 on the y axis, the last sample
      // on the right edge. `offset` undoes the half-step of room the bar
      // defaults leave at each end — useChart builds every chart as a bar one.
      bounds: "data",
      min: 0,
      offset: false,
      title: { display: true, text: "経過時間 (秒)", color: INK },
      ticks: {
        color: INK,
        // The last tick sits wherever typing stopped, usually close enough to
        // the one before it to collide. Keep the gridline, drop the text.
        callback: (value, i, ticks) =>
          i === ticks.length - 1 ? "" : String(value),
      },
      grid: { color: GRID, offset: false },
    },
    y: {
      beginAtZero: true,
      title: { display: true, text: "打鍵速度 (打/秒)", color: INK },
      ticks: { color: INK },
      grid: { color: GRID },
    },
  },
};

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
