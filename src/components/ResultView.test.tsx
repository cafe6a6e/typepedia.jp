import { expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import type { KeyStat, ScoreResult } from "@/types";

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
};

function renderView(result: ScoreResult = base) {
  charts.length = 0;
  const utils = render(<ResultView result={result} onBack={mock(() => {})} />);
  return { ...utils, chart: () => charts[0] };
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

test("defaults to accuracy ascending and plots at most 20 keys", () => {
  const { chart } = renderView();
  expect(screen.getByLabelText("並び替えの項目")).toHaveProperty(
    "value",
    "accuracy",
  );
  expect(screen.getByLabelText("並び順")).toHaveProperty("value", "asc");
  // z (0%) and q (50%) are the weakest, then s (89.5%).
  expect(chart().data.labels.slice(0, 3)).toEqual(["z", "q", "s"]);
  expect(chart().data.labels.length).toBeLessThanOrEqual(20);
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
  expect(chart().data.labels).not.toContain("z");
  expect(chart().updates).toBeGreaterThan(before);
  // Still the same chart instance: no rebuild.
  expect(charts).toHaveLength(1);
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
  });
  expect(screen.getByText(/打鍵がありませんでした/)).toBeDefined();
  expect(container.querySelector("canvas")).toBeNull();
});

test("the back button invokes onBack", () => {
  const onBack = mock(() => {});
  render(<ResultView result={base} onBack={onBack} />);
  fireEvent.click(screen.getByRole("button", { name: /コース選択に戻る/ }));
  expect(onBack).toHaveBeenCalled();
});
