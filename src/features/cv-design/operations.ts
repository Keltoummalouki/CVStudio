import {
  MIN_SIZE_MM,
  PAGE_MM,
  isDecoration,
  uniqueKey,
  type Design,
  type DesignElement,
  type ElementContent,
  type ElementStyle,
  type FieldKind,
} from "./design";

export type IdFactory = () => string;
const randomId: IdFactory = () => crypto.randomUUID();

/** Geometry is kept to a tenth of a millimetre: finer is invisible on paper. */
export const round = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Where new elements start on an empty page, and the gap left between them. */
export const PAGE_INSET_MM = 15;
const GAP_MM = 4;

export const DEFAULT_STYLE: ElementStyle = {
  font: "poppins",
  size: 10,
  weight: 400,
  color: "#111111",
  align: "left",
  lineHeight: 1.35,
  uppercase: false,
  accent: "#111111",
  background: null,
  borderWidth: 0,
  borderColor: "#111111",
  radius: 0,
  padding: 0,
};

type Start = { w: number; h: number; autoHeight: boolean; style: Partial<ElementStyle> };

function fieldStart(field: FieldKind): Start {
  switch (field) {
    case "name":
      return { w: 120, h: 12, autoHeight: true, style: { size: 22, weight: 700 } };
    case "title":
      return { w: 120, h: 8, autoHeight: true, style: { size: 13 } };
    case "contacts":
      return { w: 80, h: 20, autoHeight: true, style: { size: 9 } };
    case "links":
      return { w: 80, h: 12, autoHeight: true, style: { size: 9 } };
  }
}

/** A new element's size and look, by what it holds. */
function startFor(content: ElementContent): Start {
  switch (content.type) {
    case "field":
      return fieldStart(content.field);
    case "section":
      return {
        w: content.section === "technical_skills" ? 180 : 120,
        h: 30,
        autoHeight: true,
        style: {},
      };
    case "custom":
      return { w: 120, h: 30, autoHeight: true, style: {} };
    case "text":
      return { w: 60, h: 8, autoHeight: true, style: {} };
    case "photo":
      return { w: 32, h: 32, autoHeight: false, style: {} };
    case "line":
      return { w: 180, h: 2, autoHeight: false, style: { borderWidth: 0.75 } };
    case "shape":
      return { w: 60, h: 40, autoHeight: false, style: { background: "#eef0f3" } };
  }
}

/** Keeps a box of the given size on the page. */
function clampPosition(x: number, y: number, w: number, h: number) {
  return {
    x: round(clamp(x, 0, PAGE_MM.width - w)),
    y: round(clamp(y, 0, PAGE_MM.height - h)),
  };
}

/** Below the lowest element of the page, at the left inset; back to the top when full. */
function freeSpot(design: Design, page: number, w: number, h: number) {
  const bottoms = design.elements
    .filter((element) => element.page === page)
    .map((element) => element.y + element.h);
  const below = bottoms.length > 0 ? Math.max(...bottoms) + GAP_MM : PAGE_INSET_MM;
  const y = below + h <= PAGE_MM.height - PAGE_INSET_MM ? below : PAGE_INSET_MM;
  return { x: Math.min(PAGE_INSET_MM, PAGE_MM.width - w), y };
}

export function createElement(
  design: Design,
  content: ElementContent,
  options: { page?: number; x?: number; y?: number; newId?: IdFactory } = {},
): DesignElement {
  const start = startFor(content);
  const page = options.page ?? 0;
  const w = Math.min(start.w, PAGE_MM.width);
  const h = Math.min(start.h, PAGE_MM.height);
  const spot =
    options.x !== undefined && options.y !== undefined
      ? { x: options.x, y: options.y }
      : freeSpot(design, page, w, h);
  return {
    id: (options.newId ?? randomId)(),
    page,
    ...clampPosition(spot.x, spot.y, w, h),
    w,
    h,
    autoHeight: start.autoHeight,
    content,
    style: { ...DEFAULT_STYLE, ...start.style },
  };
}

/** Top to bottom, then left to right: the order a reader takes on one page. */
function readsBefore(a: DesignElement, b: DesignElement): boolean {
  if (a.page !== b.page) return a.page < b.page;
  if (a.y !== b.y) return a.y < b.y;
  return a.x < b.x;
}

/**
 * Adds an element. Text is inserted where it reads, after every text element
 * above it; decorations go last, which only decides how they stack.
 */
export function addElement(design: Design, element: DesignElement): Design {
  if (isDecoration(element.content)) {
    return { ...design, elements: [...design.elements, element] };
  }
  const elements = [...design.elements];
  let index = 0;
  elements.forEach((other, position) => {
    if (!isDecoration(other.content) && !readsBefore(element, other)) index = position + 1;
  });
  elements.splice(index, 0, element);
  return { ...design, elements };
}

function updateElement(
  design: Design,
  id: string,
  change: (element: DesignElement) => DesignElement,
): Design {
  let changed = false;
  const elements = design.elements.map((element) => {
    if (element.id !== id) return element;
    const next = change(element);
    changed = next !== element;
    return next;
  });
  return changed ? { ...design, elements } : design;
}

export function moveElement(design: Design, id: string, x: number, y: number): Design {
  return updateElement(design, id, (element) => {
    const position = clampPosition(x, y, element.w, element.h);
    return position.x === element.x && position.y === element.y
      ? element
      : { ...element, ...position };
  });
}

export type Rect = { x: number; y: number; w: number; h: number };

/** Sets an element's box, kept on the page and at least MIN_SIZE_MM wide and high. */
export function resizeElement(design: Design, id: string, rect: Rect): Design {
  return updateElement(design, id, (element) => {
    const x = round(clamp(rect.x, 0, PAGE_MM.width - MIN_SIZE_MM));
    const y = round(clamp(rect.y, 0, PAGE_MM.height - MIN_SIZE_MM));
    const w = round(clamp(rect.w, MIN_SIZE_MM, PAGE_MM.width - x));
    const h = round(clamp(rect.h, MIN_SIZE_MM, PAGE_MM.height - y));
    if (x === element.x && y === element.y && w === element.w && h === element.h) return element;
    return { ...element, x, y, w, h };
  });
}

export function setElementStyle(design: Design, id: string, patch: Partial<ElementStyle>): Design {
  return updateElement(design, id, (element) => ({
    ...element,
    style: { ...element.style, ...patch },
  }));
}

export function setElementContent(design: Design, id: string, content: ElementContent): Design {
  return updateElement(design, id, (element) =>
    element.content.type === content.type ? { ...element, content } : element,
  );
}

export function setAutoHeight(design: Design, id: string, autoHeight: boolean): Design {
  return updateElement(design, id, (element) =>
    element.autoHeight === autoHeight ? element : { ...element, autoHeight },
  );
}

export function removeElement(design: Design, id: string): Design {
  const elements = design.elements.filter((element) => element.id !== id);
  return elements.length === design.elements.length ? design : { ...design, elements };
}

/** Whether a copy is allowed: career content and the photo appear once. */
export function canDuplicate(element: DesignElement): boolean {
  return uniqueKey(element.content) === null;
}

/** A copy slightly below and to the right, right after the original. */
export function duplicateElement(design: Design, id: string, newId: IdFactory = randomId): Design {
  const index = design.elements.findIndex((element) => element.id === id);
  const source = design.elements[index];
  if (!source || !canDuplicate(source)) return design;
  const copy: DesignElement = {
    ...source,
    id: newId(),
    ...clampPosition(source.x + GAP_MM, source.y + GAP_MM, source.w, source.h),
  };
  const elements = [...design.elements];
  elements.splice(index + 1, 0, copy);
  return { ...design, elements };
}

/** The text elements, in the order the PDF holds their text. */
export function readingOrder(design: Design): DesignElement[] {
  return design.elements.filter((element) => !isDecoration(element.content));
}

/** Swaps a text element with its neighbour in the reading order. */
export function moveInReadingOrder(design: Design, id: string, direction: -1 | 1): Design {
  const order = readingOrder(design);
  const position = order.findIndex((element) => element.id === id);
  const neighbour = order[position + direction];
  if (position < 0 || !neighbour) return design;
  const from = design.elements.indexOf(order[position]!);
  const to = design.elements.indexOf(neighbour);
  const elements = [...design.elements];
  [elements[from], elements[to]] = [elements[to]!, elements[from]!];
  return { ...design, elements };
}

/** Puts the text in reading order by position: top to bottom, then left to right. */
export function sortReadingOrder(design: Design): Design {
  const decorations = design.elements.filter((element) => isDecoration(element.content));
  const text = readingOrder(design).toSorted((a, b) =>
    readsBefore(a, b) ? -1 : readsBefore(b, a) ? 1 : 0,
  );
  const elements = [...decorations, ...text];
  return elements.every((element, index) => element === design.elements[index])
    ? design
    : { ...design, elements };
}

/** What is already on the page and can only appear once. */
export function placedKeys(design: Design): Set<string> {
  return new Set(design.elements.flatMap((element) => uniqueKey(element.content) ?? []));
}

/** Adds or removes pages; a page still holding elements is never removed. */
export function setPageCount(design: Design, pages: number): Design {
  const used = Math.max(0, ...design.elements.map((element) => element.page + 1));
  const next = Math.max(1, used, pages);
  return next === design.pages ? design : { ...design, pages: next };
}
