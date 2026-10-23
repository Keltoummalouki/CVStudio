import { PAGE_MM } from "./design";
import { PAGE_INSET_MM, type Rect } from "./operations";

/** Within this distance (millimetres) an edge or a centre snaps to a guide. */
export const SNAP_MM = 1.5;

export type Guide = { axis: "x" | "y"; at: number };

/** Lines a box can align to: the page's edges, inset and centre, and the other boxes. */
function lines(axis: "x" | "y", others: readonly Rect[]): number[] {
  const size = axis === "x" ? PAGE_MM.width : PAGE_MM.height;
  const page = [0, PAGE_INSET_MM, size / 2, size - PAGE_INSET_MM, size];
  const boxes = others.flatMap((other) =>
    axis === "x"
      ? [other.x, other.x + other.w / 2, other.x + other.w]
      : [other.y, other.y + other.h / 2, other.y + other.h],
  );
  return [...page, ...boxes];
}

/** The smallest shift (within the threshold) that puts one of `edges` on a line. */
function nearest(edges: readonly number[], candidates: readonly number[], threshold: number) {
  let best: { shift: number; at: number } | null = null;
  for (const edge of edges) {
    for (const at of candidates) {
      const shift = at - edge;
      if (Math.abs(shift) <= threshold && (!best || Math.abs(shift) < Math.abs(best.shift))) {
        best = { shift, at };
      }
    }
  }
  return best;
}

/**
 * Snaps a moving box: its left, centre or right edge to a vertical guide and
 * its top, middle or bottom to a horizontal one, like design tools do.
 * Returns the guides it snapped to, so the designer can draw them.
 */
export function snapMove(
  rect: Rect,
  others: readonly Rect[],
  threshold = SNAP_MM,
): { x: number; y: number; guides: Guide[] } {
  const x = nearest([rect.x, rect.x + rect.w / 2, rect.x + rect.w], lines("x", others), threshold);
  const y = nearest([rect.y, rect.y + rect.h / 2, rect.y + rect.h], lines("y", others), threshold);
  const guides: Guide[] = [];
  if (x) guides.push({ axis: "x", at: x.at });
  if (y) guides.push({ axis: "y", at: y.at });
  return { x: rect.x + (x?.shift ?? 0), y: rect.y + (y?.shift ?? 0), guides };
}

/** Which edges a resize handle moves: n, s, e, w or a corner. */
export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
export const HANDLES: readonly Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/**
 * The box after dragging `handle` by (dx, dy) millimetres, its moving edges
 * snapped to guides. The opposite edges stay where they are.
 */
export function snapResize(
  start: Rect,
  handle: Handle,
  dx: number,
  dy: number,
  others: readonly Rect[],
  threshold = SNAP_MM,
): { rect: Rect; guides: Guide[] } {
  let left = start.x;
  let right = start.x + start.w;
  let top = start.y;
  let bottom = start.y + start.h;
  const guides: Guide[] = [];

  const snapEdge = (axis: "x" | "y", value: number) => {
    const hit = nearest([value], lines(axis, others), threshold);
    if (!hit) return value;
    guides.push({ axis, at: hit.at });
    return hit.at;
  };

  if (handle.includes("w")) left = snapEdge("x", left + dx);
  if (handle.includes("e")) right = snapEdge("x", right + dx);
  if (handle.includes("n")) top = snapEdge("y", top + dy);
  if (handle.includes("s")) bottom = snapEdge("y", bottom + dy);

  // Dragged past the opposite edge: keep a positive size, anchored on the fixed edge.
  const x = Math.min(left, right);
  const y = Math.min(top, bottom);
  return { rect: { x, y, w: Math.abs(right - left), h: Math.abs(bottom - top) }, guides };
}
