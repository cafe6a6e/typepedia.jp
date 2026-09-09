import { expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import type { KeyStat, LatencyStats, ScoreResult, SpeedStats } from "@/types";

/**
 * Chart.js needs a real 2d context, which happy-dom does not provide, so the
 * chart is stubbed. That lets the test pin the wiring the chart depends on —
 * datasets, colours, axes, legend placement — and that a re-sort updates the
 * existing chart rather than rebuilding it.
 */
interface Axis {
  stacked?: boolean;
  position?: string;
  min?: number;
  max?: number;
  offset?: boolean;
  grid?: {
    drawOnChartArea?: boolean;
    color?: (ctx: { tick: { value: number } }) => string;
    tickColor?: string;
    tickLength?: number;
  };
  ticks?: {
    callback?: (v: number, i: number, ticks: { value: number }[]) => string;
  };
  bounds?: string;
  afterDataLimits?: (axis: { min: number; max: number }) => void;
  afterBuildTicks?: (axis: { max: number; ticks: { value: number }[] }) => void;
  type?: string;
}

/** What a tooltip callback is handed for one hovered point. */
interface TooltipItem {
  parsed: { x: number; y: number };
  raw: unknown;
}

/** Run an axis's hooks over a data maximum and report what it would draw. */
function axisTicks(axis: Axis, dataMax: number) {
  const scale = { min: 0, max: dataMax, ticks: [] as { value: number }[] };
  axis.afterDataLimits?.(scale);
  axis.afterBuildTicks?.(scale);
  const labels = scale.ticks.map((t, i) =>
    axis.ticks?.callback?.(t.value, i, scale.ticks),
  );
  return {
    top: scale.max,
    grid: scale.ticks.map((t) => t.value),
    labelled: scale.ticks
      .map((t, i) => (labels[i] ? t.value : null))
      .filter((v) => v !== null),
  };
}

interface Captured {
  data: { labels: string[]; datasets: Record<string, unknown>[] };
  options: Record<string, never> & {
    animation?: false | Record<string, unknown>;
    plugins: {
      legend: { position?: string; align?: string; display?: boolean };
      tooltip?: {
        callbacks: {
          title?: (items: TooltipItem[]) => string;
          label?: (item: TooltipItem) => string;
          afterBody?: (items: TooltipItem[]) => string[];
        };
      };
    };
    scales: Record<string, Axis>;
  };
  updates: number;
  destroyed: boolean;
}

const charts: Captured[] = [];

class MockChart {
  data: Captured["data"];
  options: Captured["options"];
  updates = 0;
  destroyed = false;
  constructor(_canvas: unknown, config: { data: unknown; options: unknown }) {
    this.data = config.data as Captured["data"];
    this.options = config.options as Captured["options"];
    charts.push(this as unknown as Captured);
  }
  update() {
    this.updates++;
  }
  destroy() {
    this.destroyed = true;
  }
  static register() {}
}

mock.module("chart.js", () => ({
  Chart: MockChart,
  BarController: {},
  BarElement: {},
  CategoryScale: {},
  Legend: {},
  LinearScale: {},
  LineController: {},
  LineElement: {},
  PointElement: {},
  Tooltip: {},
}));

// The component skips the chart when there is no 2d context; give it one.
HTMLCanvasElement.prototype.getContext =
  (() => ({})) as unknown as HTMLCanvasElement["getContext"];

const { ResultView } = await import("@/components/ResultView");
const { shadedRuns, visChar, wrapText } = await import(
  "@/components/resultCharts"
);

/** [key, total, correct] — 21 keys, so the 20-key cap actually drops one. */
const RAW: [string, number, number][] = [
  ["a", 42, 40],
  ["i", 38, 38],
  ["o", 31, 28],
  ["n", 27, 27],
  ["k", 22, 20],
  ["s", 19, 17],
  ["e", 16, 15],
  [" ", 14, 14],
  // Filler: all perfect, decreasing volume.
  ...("bcdfghjlmpr".split("").map((c, i) => [c, 13 - i, 13 - i]) as [
    string,
    number,
    number,
  ][]),
  ["q", 2, 1],
  ["z", 2, 0],
];

const keyStats: KeyStat[] = RAW.map(([key, total, correct]) => ({
  key,
  correct,
  miss: total - correct,
  total,
  accuracy: correct / total,
}));

const base: ScoreResult = {
  // The summary counts every physical miss, the rows dedupe consecutive
  // fumbles, so these totals deliberately differ from the keys' sums.
  correct: 240,
  miss: 32,
  total: 272,
  accuracy: 240 / 272,
  keyStats,
  latency: {
    count: 9,
    median: 152,
    buckets: [
      { min: 91, max: 128, count: 2 },
      { min: 128, max: 181, count: 5 },
      { min: 181, max: 256, count: 1 },
      { min: 256, max: Number.POSITIVE_INFINITY, count: 1 },
    ],
    // Alphabetical; the per-key bucket arrays sum to the totals above.
    keys: [
      { key: " ", count: 2, median: 120, buckets: [2, 0, 0, 0] },
      { key: "a", count: 4, median: 150, buckets: [0, 3, 1, 0] },
      { key: "e", count: 3, median: 160, buckets: [0, 2, 0, 1] },
    ],
  },
  speed: {
    points: [
      { t: 0, cps: 0, sentence: "一問目" },
      { t: 250, cps: 4 / 3, sentence: "一問目" },
      { t: 500, cps: 2, sentence: "二問目" },
    ],
    missSpans: [{ from: 125, to: 375 }],
    mean: 4,
    peak: 2,
    seconds: 0.5,
  },
};

const NO_LATENCY: LatencyStats = {
  count: 0,
  median: 0,
  buckets: [],
  keys: [],
};

const NO_SPEED: SpeedStats = {
  points: [],
  missSpans: [],
  mean: 0,
  peak: 0,
  seconds: 0,
};

function renderView(result: ScoreResult = base) {
  charts.length = 0;
  const utils = render(<ResultView result={result} onBack={mock(() => {})} />);
  // Three canvases, built top down: per-key, then speed, then latency.
  return {
    ...utils,
    chart: () => charts[0],
    speedChart: () => charts[1],
    latencyChart: () => charts[2],
  };
}

test("summary shows accuracy with the raw counts", () => {
  renderView();
  expect(screen.getByText("88.2%")).toBeDefined();
  expect(screen.getByText("240")).toBeDefined();
  expect(screen.getByText("32")).toBeDefined();
  expect(screen.getByText("272")).toBeDefined();
});

test("the chart stacks correct/miss bars and overlays an accuracy line", () => {
  const { chart } = renderView();
  const [good, bad, rate] = chart().data.datasets;

  expect(good).toMatchObject({
    type: "bar",
    label: "正解数",
    stack: "keys",
    yAxisID: "y",
  });
  expect(bad).toMatchObject({
    type: "bar",
    label: "ミス数",
    stack: "keys",
    yAxisID: "y",
  });
  expect(String(good.backgroundColor)).toContain("74, 222, 128"); // green
  expect(String(bad.backgroundColor)).toContain("248, 113, 113"); // red

  // The accuracy line rides its own right-hand axis, dotted with points.
  expect(rate).toMatchObject({
    type: "line",
    label: "正解率",
    borderColor: "#60a5fa",
    yAxisID: "y1",
    pointStyle: "circle",
  });
  expect(rate.borderDash).toEqual([4, 4]);

  const { scales, plugins } = chart().options;
  expect(scales.x.stacked).toBe(true);
  // 正解率 on the left, 打鍵数 on the right.
  expect(scales.y).toMatchObject({ stacked: true, position: "right" });
  expect(scales.y1).toMatchObject({ position: "left", min: -3, max: 103 });
  expect(plugins.legend).toMatchObject({ position: "top", align: "end" });
});

test("defaults to accuracy ascending and plots every key", () => {
  const { chart } = renderView();
  expect(screen.getByLabelText("並び替えの項目")).toHaveProperty(
    "value",
    "accuracy",
  );
  expect(screen.getByLabelText("並び順")).toHaveProperty("value", "asc");
  // z (0%) and q (50%) are the weakest, then s (89.5%).
  expect(chart().data.labels.slice(0, 3)).toEqual(["z", "q", "s"]);
  expect(chart().data.labels).toHaveLength(keyStats.length);
});

test("changing the metric updates the existing chart in place", () => {
  const { chart } = renderView();
  const before = chart().updates;

  fireEvent.change(screen.getByLabelText("並び替えの項目"), {
    target: { value: "total" },
  });
  fireEvent.change(screen.getByLabelText("並び順"), {
    target: { value: "desc" },
  });

  // Busiest first, and the rare q/z drop out of the plotted set.
  expect(chart().data.labels.slice(0, 3)).toEqual(["a", "i", "o"]);
  expect(chart().data.labels).toContain("z");
  expect(chart().data.labels).toHaveLength(keyStats.length);
  expect(chart().updates).toBeGreaterThan(before);
  // Still the same chart instance, and only the three the screen builds up
  // front (speed, per-key, latency): a re-sort updates, it does not rebuild.
  expect(charts).toHaveLength(3);
});

test("the accuracy axis grids every 10% and labels every 20%", () => {
  const { chart } = renderView();
  const y1 = chart().options.scales.y1;

  // Ticks are pinned to 0,10,…,100 despite the padded -3..103 bounds, and only
  // the multiples of 20 are written out; the rest keep their gridline.
  expect(axisTicks(y1, 103)).toEqual({
    top: 103,
    grid: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    labelled: [0, 20, 40, 60, 80, 100],
  });

  // The accuracy axis owns the horizontal grid; the count axis contributes
  // only its baseline, so the two intervals cannot tangle.
  const countAxis = chart().options.scales.y.grid;
  expect(countAxis?.color?.({ tick: { value: 0 } })).toBe(
    "rgba(255, 255, 255, 0.1)",
  );
  expect(countAxis?.color?.({ tick: { value: 10 } })).toBe("transparent");
  // …but every tick still gets a short mark on the axis itself.
  expect(countAxis).toMatchObject({
    tickColor: "rgba(255, 255, 255, 0.1)", // same ink as the gridlines
    tickLength: 5,
  });
});

test("the space key is labelled visibly on the axis", () => {
  const { chart } = renderView();
  fireEvent.change(screen.getByLabelText("並び替えの項目"), {
    target: { value: "total" },
  });
  expect(chart().data.labels).toContain("␣");
});

test("a game with no keystrokes shows an empty state instead of the chart", () => {
  const { container } = renderView({
    correct: 0,
    miss: 0,
    total: 0,
    accuracy: 0,
    keyStats: [],
    latency: NO_LATENCY,
    speed: NO_SPEED,
  });
  expect(screen.getByText(/打鍵がありませんでした/)).toBeDefined();
  expect(container.querySelector("canvas")).toBeNull();
});

test("the latency section leads with the median and sample count", () => {
  renderView();
  expect(screen.getByText("レイテンシ")).toBeDefined();
  expect(screen.getByText("152ms")).toBeDefined();
  expect(screen.getByText(/中央値 ・ 計測/)).toBeDefined();
  expect(screen.getByText("9")).toBeDefined();
});

test("the latency histogram plots the bucket counts", () => {
  const { latencyChart } = renderView();

  // Bars are the bucket counts, labelled by their ms range; the open-ended top
  // bin reads as "256〜".
  expect(latencyChart().data.labels).toEqual([
    "91–128",
    "128–181",
    "181–256",
    "256〜",
  ]);
  expect(latencyChart().data.datasets[0].data).toEqual([2, 5, 1, 1]);
});

test("no measured gaps shows a note instead of the histogram", () => {
  const { container } = renderView({ ...base, latency: NO_LATENCY });
  expect(screen.getByText(/計測できませんでした/)).toBeDefined();
  // With nothing measured the section drops its summary box entirely.
  expect(screen.queryByText(/中央値 ・ 計測/)).toBeNull();
  // The speed and per-key canvases are left.
  expect(container.querySelectorAll("canvas")).toHaveLength(2);
});

test("the key cards run most-measured first with the median and count", () => {
  renderView();
  expect(screen.getByText(/キー別レイテンシ中央値/)).toBeDefined();
  const cells = screen
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-pressed") !== null);
  // a has 4 samples, e has 3, the space has 2.
  expect(cells.map((b) => b.textContent)).toEqual([
    "a150ms4回",
    "e160ms3回",
    "␣120ms2回",
  ]);
  expect(cells.every((b) => b.getAttribute("aria-pressed") === "false")).toBe(
    true,
  );
});

/** The key-list cell for `key`, found by its rendered text. */
function keyCell(key: string): HTMLElement {
  const cell = screen
    .getAllByRole("button")
    .find(
      (b) =>
        b.getAttribute("aria-pressed") !== null &&
        b.textContent?.startsWith(key),
    );
  if (!cell) throw new Error(`no latency cell for ${key}`);
  return cell;
}

test("picking a key stacks its share in green over the rest", () => {
  const { latencyChart } = renderView();
  expect(latencyChart().data.datasets).toHaveLength(1);

  fireEvent.click(keyCell("a"));

  const [mine, rest] = latencyChart().data.datasets;
  expect(mine.label).toBe("a");
  expect(mine.data).toEqual([0, 3, 1, 0]);
  expect(String(mine.backgroundColor)).toContain("74, 222, 128"); // green
  expect(rest.label).toBe("その他");
  // The two series add back up to the overall histogram.
  expect(rest.data).toEqual([2, 2, 0, 1]);
  expect(mine.stack).toBe(rest.stack);

  // Clicking the same cell again clears the split.
  expect(keyCell("a").getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(keyCell("a"));
  expect(latencyChart().data.datasets).toHaveLength(1);
});

test("the back button invokes onBack", () => {
  const onBack = mock(() => {});
  render(<ResultView result={base} onBack={onBack} />);
  fireEvent.click(screen.getByRole("button", { name: /コース選択に戻る/ }));
  expect(onBack).toHaveBeenCalled();
});

test("the speed curve is plotted in seconds", () => {
  const { speedChart } = renderView();
  const line = speedChart().data.datasets[0];

  expect(line.type).toBe("line");
  // Milliseconds become seconds on the x axis; the y stays keystrokes/second.
  expect(line.data).toEqual([
    { x: 0, y: 0, sentence: "一問目" },
    { x: 0.25, y: 4 / 3, sentence: "一問目" },
    { x: 0.5, y: 2, sentence: "二問目" },
  ]);
  // The points ride along with their question so the tooltip can name it.
  expect(speedChart().options.scales.x.type).toBe("linear");
  // Both ends pinned to the session, so the curve fills the plot's width.
  expect(speedChart().options.scales.x.min).toBe(0);
  expect(speedChart().options.scales.x.bounds).toBe("data");
  // The bar defaults would otherwise pad both ends by half a step.
  expect(speedChart().options.scales.x.offset).toBe(false);
  // One series, so no legend box: the section heading names it.
  expect(speedChart().options.plugins.legend.display).toBe(false);
  // No staggered reveal: the shape of the curve is the point.
  expect(speedChart().options.animation).toBe(false);
});

test("the mistyped moments ride along with the curve, in the axis's seconds", () => {
  const { speedChart } = renderView();
  // The bands are in ms on the model, seconds on the chart, as the points are.
  expect(speedChart().data.datasets[0].missSpans).toEqual([
    { from: 0.125, to: 0.375 },
  ]);
  // The red is only explained where it is actually drawn.
  expect(screen.getByText("ミスタイプ")).toBeDefined();
});

test("a clean run gets no mistype swatch", () => {
  renderView({ ...base, speed: { ...base.speed, missSpans: [] } });
  expect(screen.queryByText("ミスタイプ")).toBeNull();
});

test("the speed section leads with the mean, the peak and the elapsed time", () => {
  renderView();
  expect(screen.getByText("打鍵スピード")).toBeDefined();
  expect(screen.getByText("4.0 打/秒")).toBeDefined();
  expect(screen.getByText(/ピーク/)).toBeDefined();
  expect(screen.getByText("2.0")).toBeDefined();
  expect(screen.getByText("0.5")).toBeDefined();
});

test("the speed tooltip reports the second, the rate and the question", () => {
  const { speedChart } = renderView();
  const cb = speedChart().options.plugins.tooltip?.callbacks;
  const item = { parsed: { x: 0.5, y: 2 }, raw: base.speed.points[2] };

  expect(cb?.title?.([item])).toBe("0.5 秒");
  expect(cb?.label?.(item)).toBe("2.0 打/秒");
  expect(cb?.afterBody?.([item])).toEqual(["二問目"]);
});

test("a long question wraps inside the tooltip instead of stretching it", () => {
  expect(wrapText("あいうえお", 3, 2)).toEqual(["あいう", "えお"]);
  // Past the line budget the last line gives up its final character to "…".
  expect(wrapText("あいうえおかきく", 3, 2)).toEqual(["あいう", "えお…"]);
  expect(wrapText("")).toEqual([]);
});

test("no keystrokes shows a note instead of the speed curve", () => {
  const { container } = renderView({ ...base, speed: NO_SPEED });
  expect(screen.getByText(/速度を計測できませんでした/)).toBeDefined();
  expect(screen.queryByText(/ピーク/)).toBeNull();
  // The per-key and latency canvases are left.
  expect(container.querySelectorAll("canvas")).toHaveLength(2);
});

test("every other question gets a band behind the curve", () => {
  const q = (...names: string[]) => names.map((sentence) => ({ sentence }));

  // Runs of one question each; the first is left bare so the banding alternates.
  expect(shadedRuns(q("a", "a", "b", "b", "b", "c"))).toEqual([
    { from: 2, to: 5 },
  ]);
  expect(shadedRuns(q("a", "b", "c", "d"))).toEqual([
    { from: 1, to: 2 },
    { from: 3, to: 4 },
  ]);
  // One question, or none at all, means nothing to alternate against.
  expect(shadedRuns(q("a", "a"))).toEqual([]);
  expect(shadedRuns([])).toEqual([]);
});

test("the last second on the x axis keeps its gridline but loses its label", () => {
  const { speedChart } = renderView();
  const ticks = [{ value: 0 }, { value: 5 }, { value: 10 }, { value: 12.4 }];
  const label = speedChart().options.scales.x.ticks?.callback;

  // The axis ends on the last keystroke, so that tick sits wherever it falls.
  expect(ticks.map((t, i) => label?.(t.value, i, ticks))).toEqual([
    "0",
    "5",
    "10",
    "",
  ]);
});

test("visChar names the keys that would otherwise print blank", () => {
  // Enter is a real keystroke in the code material, so it reaches the key
  // charts and needs a glyph of its own.
  expect(visChar(" ")).toBe("␣");
  expect(visChar("\t")).toBe("⇥");
  expect(visChar("\n")).toBe("⏎");
  expect(visChar("a")).toBe("a");
});
