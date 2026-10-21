import { describe, expect, it } from "vitest";
import { formatPeriod, type Period } from "@/lib/dates/period";

const period = (overrides: Partial<Period>): Period => ({
  startYear: null,
  startMonth: null,
  endYear: null,
  endMonth: null,
  isCurrent: false,
  ...overrides,
});

describe("formatPeriod", () => {
  it("formats an ongoing role from a month", () => {
    expect(
      formatPeriod(period({ startYear: 2026, startMonth: 2, isCurrent: true }), "fr", "Présent"),
    ).toBe("Février 2026 – Présent");
    expect(
      formatPeriod(period({ startYear: 2026, startMonth: 2, isCurrent: true }), "en", "Present"),
    ).toBe("February 2026 – Present");
  });

  it("names the year once when both months fall in the same year", () => {
    const summer = period({ startYear: 2025, startMonth: 6, endYear: 2025, endMonth: 8 });
    expect(formatPeriod(summer, "fr", "Présent")).toBe("Juin – Août 2025");
    expect(formatPeriod(summer, "en", "Present")).toBe("June – August 2025");
  });

  it("supports year-only precision", () => {
    expect(formatPeriod(period({ startYear: 2024, endYear: 2026 }), "fr", "Présent")).toBe(
      "2024 – 2026",
    );
    expect(formatPeriod(period({ startYear: 2024, endYear: 2024 }), "en", "Present")).toBe("2024");
  });

  it("shows a single date when only one end is known", () => {
    expect(formatPeriod(period({ endYear: 2025, endMonth: 12 }), "fr", "Présent")).toBe(
      "Décembre 2025",
    );
    expect(formatPeriod(period({ startYear: 2025, startMonth: 4 }), "en", "Present")).toBe(
      "April 2025",
    );
  });

  it("mixes precisions across years", () => {
    expect(
      formatPeriod(period({ startYear: 2023, startMonth: 9, endYear: 2024 }), "en", "Present"),
    ).toBe("September 2023 – 2024");
  });

  it("returns an empty string when no date is set", () => {
    expect(formatPeriod(period({}), "en", "Present")).toBe("");
  });
});
