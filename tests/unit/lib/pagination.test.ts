import { describe, expect, it } from "vitest";
import { pageCountOf, pageSlots, parsePage } from "@/lib/pagination";

describe("pagination", () => {
  it("always has at least one page", () => {
    expect(pageCountOf(0, 10)).toBe(1);
    expect(pageCountOf(10, 10)).toBe(1);
    expect(pageCountOf(11, 10)).toBe(2);
  });

  it("reads only plain positive page numbers from the URL", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(null)).toBe(1);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("")).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("2.5")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("9999999")).toBe(1);
  });

  it("lists every page when they fit", () => {
    expect(pageSlots(1, 1)).toEqual([1]);
    expect(pageSlots(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps the first, last and current pages, with gaps for the rest", () => {
    expect(pageSlots(1, 20)).toEqual([1, 2, 3, 4, 5, "gap", 20]);
    expect(pageSlots(4, 20)).toEqual([1, 2, 3, 4, 5, "gap", 20]);
    expect(pageSlots(5, 20)).toEqual([1, "gap", 4, 5, 6, "gap", 20]);
    expect(pageSlots(17, 20)).toEqual([1, "gap", 16, 17, 18, 19, 20]);
    expect(pageSlots(20, 20)).toEqual([1, "gap", 16, 17, 18, 19, 20]);
  });

  it("never hides a single page behind a gap", () => {
    for (let pageCount = 8; pageCount <= 12; pageCount += 1) {
      for (let page = 1; page <= pageCount; page += 1) {
        const slots = pageSlots(page, pageCount);
        expect(slots.length).toBeLessThanOrEqual(7);
        expect(slots).toContain(page);
        slots.forEach((slot, index) => {
          if (slot !== "gap") return;
          const before = slots[index - 1] as number;
          const after = slots[index + 1] as number;
          expect(after - before).toBeGreaterThan(2);
        });
      }
    }
  });

  it("clamps a current page outside the range", () => {
    expect(pageSlots(0, 20)).toEqual([1, 2, 3, 4, 5, "gap", 20]);
    expect(pageSlots(99, 20)).toEqual([1, "gap", 16, 17, 18, 19, 20]);
  });
});
