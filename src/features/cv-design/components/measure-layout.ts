import { PAGE_MM } from "../design";
import type { Measured } from "../layout";
import { round } from "../operations";

/**
 * What the browser drew for each element of a rendered design: its height in
 * millimetres (grown boxes are taller than designed) and whether a fixed box
 * clipped its text. Works at any zoom or scale: sizes are read relative to
 * the element's page, which is 297 mm high.
 */
export function measureLayout(root: ParentNode): Measured {
  const result: Measured = {};
  for (const node of root.querySelectorAll<HTMLElement>("[data-element-id]")) {
    const page = node.closest<HTMLElement>("[data-page]");
    const id = node.dataset.elementId;
    if (!page || !id) continue;
    const pageHeight = page.getBoundingClientRect().height;
    if (pageHeight === 0) continue;
    result[id] = {
      h: round((node.getBoundingClientRect().height * PAGE_MM.height) / pageHeight),
      clipped: node.scrollHeight > node.clientHeight + 1,
    };
  }
  return result;
}
