import { z } from "zod";
import { BUILT_IN_SECTION_ORDER } from "@/features/cv-builder/defaults";
import { localizedTextSchema } from "@/lib/i18n/localized-text";

/**
 * A free-form design ("canvas-v1", approved 2026-10-23): elements placed on A4
 * pages, drawn by the canvas renderer for the designer, previews, print and PDF.
 * Geometry is in millimetres from the top-left corner of the element's page.
 *
 * Reading order. Elements holding text are drawn in the order of `elements`,
 * which is the order of the text in the PDF: what copy-paste and applicant
 * tracking systems read. Lines, shapes and the photo hold no text: they are
 * drawn first, under the text, so they never change that order.
 *
 * Stored in cv_templates.design (and cv_documents.design for CVs made from a
 * design). Bump DESIGN_SCHEMA_VERSION for incompatible changes, with a
 * migration of stored designs.
 */
export const DESIGN_SCHEMA_VERSION = 1;

export const PAGE_MM = { width: 210, height: 297 } as const;
export const MAX_PAGES = 3;
export const MAX_ELEMENTS = 80;
export const MIN_SIZE_MM = 2;
/** Smaller text is hard to read on paper, so the designer stops there. */
export const MIN_FONT_PT = 8;
export const MAX_FONT_PT = 48;

export const FONT_FAMILIES = ["poppins", "inter", "lora"] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];
export const FONT_WEIGHTS = [400, 700] as const;
export const TEXT_ALIGNS = ["left", "center", "right"] as const;
export const PHOTO_SHAPES = ["circle", "rounded", "square"] as const;

/** Profile details that can be placed on their own. */
export const FIELD_KINDS = ["name", "title", "contacts", "links"] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];
export const DESIGN_SECTION_KINDS = BUILT_IN_SECTION_ORDER;
export type DesignSectionKind = (typeof DESIGN_SECTION_KINDS)[number];

// Lowercase only: one spelling per colour keeps stored designs comparable.
const color = z.string().regex(/^#[0-9a-f]{6}$/, { error: "invalidColor" });
const mm = z.number().finite();

export const elementContentSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("field"),
      field: z.enum(FIELD_KINDS),
      /** Contacts and links on one line, separated, instead of one per line. */
      inline: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal("section"),
      section: z.enum(DESIGN_SECTION_KINDS),
      showTitle: z.boolean(),
      /** A fine rule under the heading, in the accent colour. */
      rule: z.boolean(),
      /** Skills, soft skills and languages can read in two columns. */
      columns: z.union([z.literal(1), z.literal(2)]),
    })
    .strict(),
  z
    .object({
      type: z.literal("custom"),
      refId: z.uuid(),
      showTitle: z.boolean(),
      rule: z.boolean(),
    })
    .strict(),
  z.object({ type: z.literal("text"), text: localizedTextSchema(500) }).strict(),
  z.object({ type: z.literal("photo"), shape: z.enum(PHOTO_SHAPES) }).strict(),
  z.object({ type: z.literal("line") }).strict(),
  z.object({ type: z.literal("shape") }).strict(),
]);
export type ElementContent = z.infer<typeof elementContentSchema>;
export type ElementType = ElementContent["type"];

/** Content that is drawn under the text and never part of the reading order. */
export const DECORATION_TYPES = [
  "photo",
  "line",
  "shape",
] as const satisfies readonly ElementType[];

export function isDecoration(content: ElementContent): boolean {
  return (DECORATION_TYPES as readonly string[]).includes(content.type);
}

export const elementStyleSchema = z
  .object({
    font: z.enum(FONT_FAMILIES),
    /** Points, like the reference CV. */
    size: z.number().min(MIN_FONT_PT).max(MAX_FONT_PT),
    weight: z.union([z.literal(400), z.literal(700)]),
    color,
    align: z.enum(TEXT_ALIGNS),
    lineHeight: z.number().min(1).max(2),
    uppercase: z.boolean(),
    /** Section headings and their rule; the colour of a line. */
    accent: color,
    background: color.nullable(),
    /** Points. */
    borderWidth: z.number().min(0).max(4),
    borderColor: color,
    /** Millimetres. */
    radius: z.number().min(0).max(50),
    /** Millimetres. */
    padding: z.number().min(0).max(10),
  })
  .strict();
export type ElementStyle = z.infer<typeof elementStyleSchema>;

export const designElementSchema = z
  .object({
    id: z.uuid(),
    page: z
      .int()
      .min(0)
      .max(MAX_PAGES - 1),
    x: mm.min(0).max(PAGE_MM.width - MIN_SIZE_MM),
    y: mm.min(0).max(PAGE_MM.height - MIN_SIZE_MM),
    w: mm.min(MIN_SIZE_MM).max(PAGE_MM.width),
    h: mm.min(MIN_SIZE_MM).max(PAGE_MM.height),
    /**
     * The box grows downward to fit its text instead of clipping it; `h` is
     * then its smallest height. Text that still does not fit (a fixed box, or
     * one growing past the page) is reported and blocks export.
     */
    autoHeight: z.boolean(),
    content: elementContentSchema,
    style: elementStyleSchema,
  })
  .strict()
  .refine(
    // A hundredth of a millimetre of slack for rounding.
    (element) =>
      element.x + element.w <= PAGE_MM.width + 0.01 &&
      element.y + element.h <= PAGE_MM.height + 0.01,
    { error: "outsidePage" },
  );
export type DesignElement = z.infer<typeof designElementSchema>;

/** Elements that show profile or career content appear once per design. */
export function uniqueKey(content: ElementContent): string | null {
  switch (content.type) {
    case "field":
      return `field:${content.field}`;
    case "section":
      return `section:${content.section}`;
    case "custom":
      return `custom:${content.refId}`;
    case "photo":
      return "photo";
    case "text":
    case "line":
    case "shape":
      return null;
  }
}

export const designSchema = z
  .object({
    schemaVersion: z.literal(DESIGN_SCHEMA_VERSION),
    pages: z.int().min(1).max(MAX_PAGES),
    background: color,
    elements: z.array(designElementSchema).max(MAX_ELEMENTS),
  })
  .strict()
  .superRefine((design, context) => {
    const ids = new Set<string>();
    const keys = new Set<string>();
    design.elements.forEach((element, index) => {
      if (ids.has(element.id)) {
        context.addIssue({
          code: "custom",
          path: ["elements", index, "id"],
          message: "duplicateId",
        });
      }
      ids.add(element.id);
      if (element.page >= design.pages) {
        context.addIssue({ code: "custom", path: ["elements", index, "page"], message: "noPage" });
      }
      const key = uniqueKey(element.content);
      if (key !== null) {
        if (keys.has(key)) {
          context.addIssue({
            code: "custom",
            path: ["elements", index, "content"],
            message: "duplicateContent",
          });
        }
        keys.add(key);
      }
    });
  });
export type Design = z.infer<typeof designSchema>;

export function createBlankDesign(): Design {
  return { schemaVersion: DESIGN_SCHEMA_VERSION, pages: 1, background: "#ffffff", elements: [] };
}
