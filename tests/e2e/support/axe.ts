import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Fails on serious or critical WCAG 2.2 AA violations, naming the rule and the elements. */
export async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
  const blocking = results.violations
    .filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))
    .map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`,
    );
  expect(blocking, `on ${new URL(page.url()).pathname}`).toEqual([]);
}
