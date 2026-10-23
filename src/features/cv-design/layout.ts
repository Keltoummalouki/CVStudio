import { PAGE_MM, isDecoration, type Design, type DesignElement } from "./design";

/** What the browser drew for each element, measured after layout. */
export type Measured = Record<
  string,
  {
    /** Rendered height in millimetres: more than `h` when the box grew to fit. */
    h: number;
    /** A fixed box whose text did not fit and was clipped. */
    clipped: boolean;
  }
>;

export type LayoutIssue =
  | { kind: "clipped"; id: string }
  | { kind: "offPage"; id: string }
  | { kind: "overlap"; id: string; other: string };

/** Overlaps thinner than this (millimetres) are rounding, not collisions. */
const TOLERANCE_MM = 0.5;

function box(element: DesignElement, measured: Measured) {
  const h = measured[element.id]?.h ?? element.h;
  return { left: element.x, top: element.y, right: element.x + element.w, bottom: element.y + h };
}

/**
 * Problems a reader would see in print: text cut off by its box, text running
 * past the bottom of the page, and text boxes drawn over each other. Each one
 * blocks export until it is fixed (CLAUDE.md §12). Decorations hold no text
 * and may sit under anything.
 */
export function layoutIssues(design: Design, measured: Measured): LayoutIssue[] {
  const text = design.elements.filter((element) => !isDecoration(element.content));
  const issues: LayoutIssue[] = [];

  for (const element of text) {
    if (measured[element.id]?.clipped) issues.push({ kind: "clipped", id: element.id });
    else if (box(element, measured).bottom > PAGE_MM.height + TOLERANCE_MM) {
      issues.push({ kind: "offPage", id: element.id });
    }
  }

  text.forEach((element, index) => {
    const a = box(element, measured);
    for (const other of text.slice(index + 1)) {
      if (other.page !== element.page) continue;
      const b = box(other, measured);
      const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (width > TOLERANCE_MM && height > TOLERANCE_MM) {
        issues.push({ kind: "overlap", id: element.id, other: other.id });
      }
    }
  });
  return issues;
}

/** The elements an issue concerns, to mark them on the canvas. */
export function elementsWithIssues(issues: readonly LayoutIssue[]): Set<string> {
  return new Set(
    issues.flatMap((issue) => (issue.kind === "overlap" ? [issue.id, issue.other] : [issue.id])),
  );
}
