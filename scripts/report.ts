/**
 * Run the test suite with coverage + JUnit output, then render a single
 * self-contained HTML report (coverage table + test-item list) to
 * coverage/index.html. No external tools (genhtml/lcov) required.
 *
 * Usage: bun scripts/report.ts   (or: bun run test:report)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const COVERAGE_DIR = "coverage";
const LCOV = `${COVERAGE_DIR}/lcov.info`;
const JUNIT = `${COVERAGE_DIR}/junit.xml`;
const OUT = `${COVERAGE_DIR}/index.html`;

// --- run the suite ------------------------------------------------------

mkdirSync(COVERAGE_DIR, { recursive: true });

const proc = Bun.spawnSync(
  [
    "bun",
    "test",
    "--coverage",
    "--coverage-reporter=lcov",
    "--reporter=junit",
    `--reporter-outfile=${JUNIT}`,
  ],
  { stdout: "pipe", stderr: "pipe" },
);
const exitCode = proc.exitCode ?? 0;

// --- parse lcov ---------------------------------------------------------

interface FileCov {
  file: string;
  linesFound: number;
  linesHit: number;
  fnFound: number;
  fnHit: number;
}

/** Keep only the app source under test (drop test files and tooling). */
function isAppSource(file: string): boolean {
  return (
    file.startsWith("src/") &&
    !file.includes(".test.") &&
    !file.endsWith(".d.ts")
  );
}

function parseLcov(text: string): FileCov[] {
  const files: FileCov[] = [];
  let cur: FileCov | null = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("SF:")) {
      cur = {
        file: line.slice(3).trim(),
        linesFound: 0,
        linesHit: 0,
        fnFound: 0,
        fnHit: 0,
      };
    } else if (!cur) {
      // ignore
    } else if (line.startsWith("DA:")) {
      const hits = Number(line.slice(3).split(",")[1] ?? 0);
      cur.linesFound += 1;
      if (hits > 0) cur.linesHit += 1;
    } else if (line.startsWith("FNF:")) {
      cur.fnFound = Number(line.slice(4));
    } else if (line.startsWith("FNH:")) {
      cur.fnHit = Number(line.slice(4));
    } else if (line.startsWith("end_of_record")) {
      files.push(cur);
      cur = null;
    }
  }
  if (cur) files.push(cur);
  return files.filter((f) => isAppSource(f.file)).sort((a, b) =>
    a.file.localeCompare(b.file),
  );
}

// --- parse junit --------------------------------------------------------

interface TestCase {
  name: string;
  time: number;
  passed: boolean;
}
interface Suite {
  name: string;
  cases: TestCase[];
}

function attr(tag: string, key: string): string {
  const m = tag.match(new RegExp(`${key}="([^"]*)"`));
  return m ? m[1] : "";
}

function decode(s: string): string {
  return s
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");
}

function parseJunit(text: string): Suite[] {
  const suites: Suite[] = [];
  const suiteRe = /<testsuite\b([^>]*)>([\s\S]*?)<\/testsuite>/g;
  for (let s = suiteRe.exec(text); s; s = suiteRe.exec(text)) {
    const suiteAttrs = s[1];
    const body = s[2];
    const cases: TestCase[] = [];
    const caseRe = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
    for (let c = caseRe.exec(body); c; c = caseRe.exec(body)) {
      const tagAttrs = c[1];
      const inner = c[3] ?? "";
      cases.push({
        name: decode(attr(tagAttrs, "name")),
        time: Number(attr(tagAttrs, "time")) || 0,
        passed: !inner.includes("<failure") && !inner.includes("<error"),
      });
    }
    suites.push({ name: decode(attr(suiteAttrs, "name")), cases });
  }
  return suites.sort((a, b) => a.name.localeCompare(b.name));
}

// --- render html --------------------------------------------------------

const THRESHOLD = 80;
const pct = (hit: number, found: number) =>
  found === 0 ? 100 : (hit / found) * 100;
const fmt = (n: number) => `${n.toFixed(1)}%`;
const esc = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

function render(files: FileCov[], suites: Suite[]): string {
  const totLinesFound = files.reduce((s, f) => s + f.linesFound, 0);
  const totLinesHit = files.reduce((s, f) => s + f.linesHit, 0);
  const totFnFound = files.reduce((s, f) => s + f.fnFound, 0);
  const totFnHit = files.reduce((s, f) => s + f.fnHit, 0);
  const linePct = pct(totLinesHit, totLinesFound);
  const fnPct = pct(totFnHit, totFnFound);

  const allCases = suites.flatMap((s) => s.cases);
  const passed = allCases.filter((c) => c.passed).length;
  const failed = allCases.length - passed;

  const cls = (p: number) => (p >= THRESHOLD ? "ok" : "low");

  const covRows = files
    .map((f) => {
      const lp = pct(f.linesHit, f.linesFound);
      const fp = pct(f.fnHit, f.fnFound);
      return `<tr>
        <td class="file">${esc(f.file)}</td>
        <td class="num ${cls(lp)}">${fmt(lp)}</td>
        <td class="num muted">${f.linesHit}/${f.linesFound}</td>
        <td class="num ${cls(fp)}">${fmt(fp)}</td>
        <td class="num muted">${f.fnHit}/${f.fnFound}</td>
      </tr>`;
    })
    .join("\n");

  const suiteBlocks = suites
    .map((s) => {
      const sp = s.cases.filter((c) => c.passed).length;
      const rows = s.cases
        .map(
          (c) => `<li class="${c.passed ? "pass" : "fail"}">
            <span class="badge">${c.passed ? "PASS" : "FAIL"}</span>
            <span class="tname">${esc(c.name)}</span>
            <span class="ttime">${(c.time * 1000).toFixed(1)} ms</span>
          </li>`,
        )
        .join("\n");
      return `<section class="suite">
        <h3>${esc(s.name)} <span class="scount">${sp}/${s.cases.length}</span></h3>
        <ul>${rows}</ul>
      </section>`;
    })
    .join("\n");

  const generated = new Date().toISOString();

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Typepedia テストレポート</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.5 system-ui, -apple-system, sans-serif;
         background: #0f1115; color: #e6e6e6; padding: 24px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: #8a8f98; margin-bottom: 24px; font-size: 12px; }
  .tiles { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 28px; }
  .tile { flex: 1 1 150px; background: #171a21; border: 1px solid #262b36;
          border-radius: 10px; padding: 14px 16px; }
  .tile .label { color: #8a8f98; font-size: 12px; }
  .tile .value { font-size: 26px; font-weight: 700; margin-top: 4px; }
  .ok { color: #3fb950; } .low { color: #f85149; }
  .muted { color: #8a8f98; }
  h2 { font-size: 16px; margin: 28px 0 10px; border-bottom: 1px solid #262b36;
       padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; }
  .cov-wrap { overflow-x: auto; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #1e2229; }
  th { color: #8a8f98; font-weight: 600; font-size: 12px; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; font-family: ui-monospace, monospace; }
  td.file { font-family: ui-monospace, monospace; font-size: 13px; }
  tfoot td { font-weight: 700; border-top: 2px solid #262b36; }
  .suite { margin-bottom: 18px; }
  .suite h3 { font-size: 13px; font-family: ui-monospace, monospace; margin: 0 0 6px;
              color: #cdd3dc; }
  .scount { color: #8a8f98; font-weight: 400; }
  .suite ul { list-style: none; margin: 0; padding: 0; }
  .suite li { display: flex; align-items: center; gap: 10px; padding: 4px 8px;
              border-radius: 6px; }
  .suite li:hover { background: #171a21; }
  .badge { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; }
  li.pass .badge { background: #12341c; color: #3fb950; }
  li.fail .badge { background: #3a1315; color: #f85149; }
  .tname { flex: 1; }
  .ttime { color: #8a8f98; font-size: 12px; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
  <h1>Typepedia テストレポート</h1>
  <div class="meta">生成: ${generated}${exitCode === 0 ? "" : " ・ ⚠ テスト失敗あり"}</div>

  <div class="tiles">
    <div class="tile"><div class="label">テスト</div>
      <div class="value">${passed}<span class="muted" style="font-size:16px"> / ${allCases.length}</span></div></div>
    <div class="tile"><div class="label">失敗</div>
      <div class="value ${failed === 0 ? "ok" : "low"}">${failed}</div></div>
    <div class="tile"><div class="label">行カバレッジ</div>
      <div class="value ${cls(linePct)}">${fmt(linePct)}</div></div>
    <div class="tile"><div class="label">関数カバレッジ</div>
      <div class="value ${cls(fnPct)}">${fmt(fnPct)}</div></div>
  </div>

  <h2>カバレッジ（対象: src/ の実装コード ・ 閾値 ${THRESHOLD}%）</h2>
  <div class="cov-wrap">
  <table>
    <thead><tr><th>ファイル</th><th class="num">行%</th><th class="num">行</th>
      <th class="num">関数%</th><th class="num">関数</th></tr></thead>
    <tbody>${covRows}</tbody>
    <tfoot><tr>
      <td>合計（${files.length} ファイル）</td>
      <td class="num ${cls(linePct)}">${fmt(linePct)}</td>
      <td class="num muted">${totLinesHit}/${totLinesFound}</td>
      <td class="num ${cls(fnPct)}">${fmt(fnPct)}</td>
      <td class="num muted">${totFnHit}/${totFnFound}</td>
    </tr></tfoot>
  </table>
  </div>

  <h2>テスト結果（${allCases.length} 項目 ・ ${suites.length} スイート）</h2>
  ${suiteBlocks}
</body>
</html>`;
}

// --- main ---------------------------------------------------------------

const lcovText = existsSync(LCOV) ? readFileSync(LCOV, "utf8") : "";
const junitText = existsSync(JUNIT) ? readFileSync(JUNIT, "utf8") : "";
const files = parseLcov(lcovText);
const suites = parseJunit(junitText);

writeFileSync(OUT, render(files, suites));

const allCases = suites.flatMap((s) => s.cases);
const passed = allCases.filter((c) => c.passed).length;
const lineTotal = files.reduce((s, f) => s + f.linesFound, 0);
const lineHit = files.reduce((s, f) => s + f.linesHit, 0);
console.log(
  `Tests: ${passed}/${allCases.length} passed ・ ` +
    `Line coverage: ${fmt(pct(lineHit, lineTotal))} ・ ` +
    `Report: ${OUT}`,
);

process.exit(exitCode);
