// Prints the unit-test coverage totals as a Markdown table, for the GitHub
// Actions job summary: `node scripts/coverage-summary.mjs >> "$GITHUB_STEP_SUMMARY"`.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const summaryPath = resolve(import.meta.dirname, "..", "coverage", "coverage-summary.json");
const { total } = JSON.parse(readFileSync(summaryPath, "utf8"));
const METRICS = ["statements", "branches", "functions", "lines"];

const rows = METRICS.map((metric) => {
  const { covered, total: count, pct } = total[metric];
  return `| ${metric[0].toUpperCase()}${metric.slice(1)} | ${pct}% | ${covered} / ${count} |`;
});

console.log(
  [
    "### Unit test coverage",
    "",
    "| Metric | Coverage | Covered |",
    "| --- | ---: | ---: |",
    ...rows,
    "",
    "Thresholds are enforced by `vitest.config.mts`; the full HTML report is in the `coverage` artifact.",
  ].join("\n"),
);
