import { expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import type { KeyStat, LatencyStats, ScoreResult } from "@/types";

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
  grid?: {
    drawOnChartArea?: boolean;
    color?: (ctx: { tick: { value: number } }) => string;
    tickColor?: string;
    tickLength?: number;
  };
  ticks?: {
    callback?: (v: number, i: number, ticks: { value: number }[]) => string;
  };
  afterDataLimits?: (axis: { min: number; max: number }) => void;
  afterBuildTicks?: (axis: { max: number; ticks: { value: number }[] }) => void;
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
    plugins: { legend: { position: string; align: string } };
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
};

const NO_LATENCY: LatencyStats = {
  count: 0,
  median: 0,
  buckets: [],
  keys: [],
};

function renderView(result: ScoreResult = base) {
  charts.length = 0;
  const utils = render(<ResultView result={result} onBack={mock(() => {})} />);
  // Two canvases: the per-key chart is built first, the latency one second.
  return { ...utils, chart: () => charts[0], latencyChart: () => charts[1] };
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
  // Still the same chart instance, and only the two the screen builds up front
  // (per-key, then latency): a re-sort updates, it does not rebuild.
  expect(charts).toHaveLength(2);
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
  // Only the per-key canvas is left.
  expect(container.querySelectorAll("canvas")).toHaveLength(1);
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
