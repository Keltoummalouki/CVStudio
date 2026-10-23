import { describe, expect, it } from "vitest";
import {
  PAGE_MM,
  createBlankDesign,
  designSchema,
  isDecoration,
  uniqueKey,
  type Design,
  type DesignElement,
  type ElementContent,
} from "@/features/cv-design/design";
import { elementsWithIssues, layoutIssues } from "@/features/cv-design/layout";
import {
  PAGE_INSET_MM,
  addElement,
  canDuplicate,
  createElement,
  duplicateElement,
  moveElement,
  moveInReadingOrder,
  placedKeys,
  readingOrder,
  removeElement,
  resizeElement,
  setAutoHeight,
  setElementContent,
  setElementStyle,
  setPageCount,
  sortReadingOrder,
} from "@/features/cv-design/operations";
import { snapMove, snapResize } from "@/features/cv-design/snapping";

let counter = 0;
const nextId = () => `00000000-0000-4000-8000-${String((counter += 1)).padStart(12, "0")}`;

const NAME: ElementContent = { type: "field", field: "name", inline: false };
const PROJECTS: ElementContent = {
  type: "section",
  section: "projects",
  showTitle: true,
  rule: true,
  columns: 1,
};
const TEXT: ElementContent = { type: "text", text: { shared: "Hello" } };
const SHAPE: ElementContent = { type: "shape" };

function place(design: Design, content: ElementContent, at?: { x: number; y: number }) {
  const element = createElement(design, content, { newId: nextId, ...at });
  return { design: addElement(design, element), element };
}

describe("design format", () => {
  it("accepts a blank design and the elements the designer makes", () => {
    let design = createBlankDesign();
    for (const content of [NAME, PROJECTS, TEXT, SHAPE] as const) {
      design = place(design, content).design;
    }
    expect(designSchema.safeParse(design).success).toBe(true);
  });

  it("refuses duplicated ids, career content placed twice, and elements without a page", () => {
    const { design, element } = place(createBlankDesign(), PROJECTS);
    const twice = { ...design, elements: [element, { ...element, id: nextId() }] };
    expect(designSchema.safeParse(twice).error?.issues[0]?.message).toBe("duplicateContent");

    const text = createElement(design, TEXT, { newId: nextId });
    const sameId = { ...design, elements: [text, { ...text }] };
    expect(designSchema.safeParse(sameId).error?.issues[0]?.message).toBe("duplicateId");

    const lost = { ...design, elements: [{ ...text, page: 1 }] };
    expect(designSchema.safeParse(lost).error?.issues[0]?.message).toBe("noPage");
  });

  it("keeps every element on the page, in valid colours and sizes", () => {
    const text = createElement(createBlankDesign(), TEXT, { newId: nextId });
    const invalid: DesignElement[] = [
      { ...text, x: 200, w: 20 },
      { ...text, style: { ...text.style, color: "#ABCDEF" } },
      { ...text, style: { ...text.style, size: 5 } },
      { ...text, w: 1 },
    ];
    for (const element of invalid) {
      const result = designSchema.safeParse({ ...createBlankDesign(), elements: [element] });
      expect(result.success, JSON.stringify(element)).toBe(false);
    }
  });

  it("tells decorations, which hold no text, from content placed once", () => {
    expect(isDecoration(SHAPE)).toBe(true);
    expect(isDecoration({ type: "photo", shape: "circle" })).toBe(true);
    expect(isDecoration(TEXT)).toBe(false);
    expect(uniqueKey(PROJECTS)).toBe("section:projects");
    expect(uniqueKey({ type: "custom", refId: "r", showTitle: true, rule: false })).toBe(
      "custom:r",
    );
    expect(uniqueKey(TEXT)).toBeNull();
  });
});

describe("design operations", () => {
  it("places new elements one below the other, from the page inset", () => {
    const first = place(createBlankDesign(), NAME);
    expect(first.element).toMatchObject({ x: PAGE_INSET_MM, y: PAGE_INSET_MM, page: 0 });
    const second = place(first.design, TEXT);
    expect(second.element.y).toBe(first.element.y + first.element.h + 4);
    // An explicit spot is kept, within the page.
    expect(place(createBlankDesign(), TEXT, { x: 500, y: -3 }).element).toMatchObject({
      x: PAGE_MM.width - 60,
      y: 0,
    });
  });

  it("inserts text where it reads; decorations only stack", () => {
    let design = createBlankDesign();
    const low = place(design, TEXT, { x: 10, y: 200 });
    design = low.design;
    const high = place(design, { type: "text", text: { shared: "Top" } }, { x: 10, y: 20 });
    design = high.design;
    const shape = place(design, SHAPE, { x: 0, y: 0 });
    design = shape.design;
    expect(readingOrder(design).map((element) => element.id)).toEqual([
      high.element.id,
      low.element.id,
    ]);
    expect(design.elements.at(-1)?.id).toBe(shape.element.id);
  });

  it("moves and resizes within the page, to a tenth of a millimetre", () => {
    const { design, element } = place(createBlankDesign(), TEXT);
    const moved = moveElement(design, element.id, 12.345, 999);
    expect(moved.elements[0]).toMatchObject({ x: 12.3, y: PAGE_MM.height - element.h });
    expect(moveElement(moved, element.id, 12.3, PAGE_MM.height - element.h)).toBe(moved);

    const resized = resizeElement(design, element.id, { x: 200, y: 10, w: 50, h: 0.5 });
    expect(resized.elements[0]).toMatchObject({ x: 200, y: 10, w: 10, h: 2 });
    expect(resizeElement(design, "missing", { x: 0, y: 0, w: 10, h: 10 })).toBe(design);
  });

  it("restyles, rewords and switches growth without touching other elements", () => {
    const first = place(createBlankDesign(), TEXT);
    const { design, element } = place(first.design, PROJECTS);
    const styled = setElementStyle(design, element.id, { size: 12, color: "#224466" });
    expect(styled.elements[1]?.style).toMatchObject({ size: 12, color: "#224466" });
    expect(styled.elements[0]).toBe(design.elements[0]);

    const reworded = setElementContent(styled, first.element.id, {
      type: "text",
      text: { en: "Hi", fr: "Salut" },
    });
    expect(reworded.elements[0]?.content).toEqual({ type: "text", text: { en: "Hi", fr: "Salut" } });
    // Content of another kind is never swapped in.
    expect(setElementContent(reworded, first.element.id, SHAPE)).toBe(reworded);

    expect(setAutoHeight(reworded, element.id, false).elements[1]?.autoHeight).toBe(false);
    expect(setAutoHeight(reworded, element.id, true)).toBe(reworded);
  });

  it("removes and duplicates; career content and the photo exist once", () => {
    const text = place(createBlankDesign(), TEXT);
    const both = place(text.design, PROJECTS);
    expect(canDuplicate(text.element)).toBe(true);
    expect(canDuplicate(both.element)).toBe(false);

    const copied = duplicateElement(both.design, text.element.id, () => "copy");
    expect(copied.elements.map((element) => element.id)).toEqual([
      text.element.id,
      "copy",
      both.element.id,
    ]);
    expect(copied.elements[1]).toMatchObject({ x: text.element.x + 4, y: text.element.y + 4 });
    expect(duplicateElement(both.design, both.element.id)).toBe(both.design);

    expect(removeElement(copied, "copy").elements).toHaveLength(2);
    expect(removeElement(copied, "missing")).toBe(copied);
    expect(placedKeys(both.design)).toEqual(new Set(["section:projects"]));
  });

  it("reorders the reading order by hand or by position", () => {
    let design = createBlankDesign();
    const a = place(design, TEXT, { x: 10, y: 10 });
    design = a.design;
    const shape = place(design, SHAPE);
    design = shape.design;
    const b = place(design, { type: "text", text: { shared: "B" } }, { x: 10, y: 50 });
    design = b.design;

    const swapped = moveInReadingOrder(design, b.element.id, -1);
    expect(readingOrder(swapped).map((element) => element.id)).toEqual([b.element.id, a.element.id]);
    expect(moveInReadingOrder(swapped, b.element.id, -1)).toBe(swapped);

    const sorted = sortReadingOrder(swapped);
    expect(readingOrder(sorted).map((element) => element.id)).toEqual([a.element.id, b.element.id]);
    expect(sortReadingOrder(sorted)).toBe(sorted);
  });

  it("adds pages, and never removes one that holds elements", () => {
    const { design, element } = place(createBlankDesign(), TEXT);
    const three = setPageCount(design, 3);
    expect(three.pages).toBe(3);
    const used = { ...three, elements: [{ ...element, page: 2 }] };
    expect(setPageCount(used, 1).pages).toBe(3);
    expect(setPageCount(design, 0)).toBe(design);
  });
});

describe("snapping", () => {
  it("snaps an edge or a centre to the page and to other boxes within 1.5 mm", () => {
    // Near the page's vertical centre line (105 mm): the box's centre snaps to it.
    expect(snapMove({ x: 85.8, y: 40.3, w: 40, h: 10 }, [])).toMatchObject({
      x: 85,
      guides: [{ axis: "x", at: 105 }],
    });
    const other = { x: 30, y: 100, w: 50, h: 20 };
    expect(snapMove({ x: 31.2, y: 121, w: 20, h: 10 }, [other])).toMatchObject({
      x: 30,
      y: 120,
      guides: [
        { axis: "x", at: 30 },
        { axis: "y", at: 120 },
      ],
    });
    // Too far from every line: nothing moves.
    expect(snapMove({ x: 47, y: 61, w: 20, h: 10 }, [other])).toEqual({ x: 47, y: 61, guides: [] });
  });

  it("moves only the dragged edges when resizing, and keeps a positive size", () => {
    const start = { x: 20, y: 20, w: 40, h: 30 };
    expect(snapResize(start, "se", 10, 5, [], 0).rect).toEqual({ x: 20, y: 20, w: 50, h: 35 });
    expect(snapResize(start, "w", -5, 99, [], 0).rect).toEqual({ x: 15, y: 20, w: 45, h: 30 });
    // Past the opposite edge: anchored on the fixed edge.
    expect(snapResize(start, "e", -50, 0, [], 0).rect).toEqual({ x: 10, y: 20, w: 10, h: 30 });
    // The moving edge snaps to the page inset.
    expect(snapResize(start, "n", 0, -4.2, []).rect.y).toBe(PAGE_INSET_MM);
  });
});

describe("layout issues", () => {
  it("reports text cut off, past the page and overlapping; decorations never count", () => {
    let design = createBlankDesign();
    const top = place(design, TEXT, { x: 10, y: 10 });
    design = top.design;
    const below = place(design, { type: "text", text: { shared: "B" } }, { x: 10, y: 15 });
    design = below.design;
    const bottom = place(design, PROJECTS, { x: 10, y: 260 });
    design = bottom.design;
    const shape = place(design, SHAPE, { x: 0, y: 0 });
    design = shape.design;

    const issues = layoutIssues(design, {
      [top.element.id]: { h: 8, clipped: true },
      [bottom.element.id]: { h: 50, clipped: false },
    });
    expect(issues).toEqual([
      { kind: "clipped", id: top.element.id },
      { kind: "offPage", id: bottom.element.id },
      { kind: "overlap", id: top.element.id, other: below.element.id },
    ]);
    expect(elementsWithIssues(issues)).toEqual(
      new Set([top.element.id, below.element.id, bottom.element.id]),
    );
  });

  it("ignores boxes on other pages and touches thinner than half a millimetre", () => {
    const design: Design = { ...createBlankDesign(), pages: 2 };
    const a = createElement(design, TEXT, { newId: nextId, x: 10, y: 10 });
    const b = { ...createElement(design, TEXT, { newId: nextId, x: 10, y: 17.7 }), page: 0 };
    const c = { ...createElement(design, TEXT, { newId: nextId, x: 10, y: 10 }), page: 1 };
    expect(layoutIssues({ ...design, elements: [a, b, c] }, {})).toEqual([]);
  });
});
